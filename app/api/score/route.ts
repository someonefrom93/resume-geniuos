/**
 * POST /api/score
 *
 * Orchestrates the full scoring flow:
 *   1. Validate request body (resume + optional job description).
 *   2. Run deterministic ATS checks (lib/ats/checks.ts) — no AI.
 *   3. Call DeepSeek to score content + (if JD) job match + improvements.
 *   4. Compute the weighted holistic score.
 *   5. Return ScoreResult.
 *
 * Errors:
 *   - 400: malformed body
 *   - 500: AI service unavailable, missing API key, or invalid LLM response
 *
 * We do NOT cache, retry, or persist the response. Each call is independent.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { runAtsChecks } from '@/lib/ats/checks';
import { getDeepSeek, MODEL_NAME, LLM_TIMEOUT_MS } from '@/lib/ai/client';
import {
  buildUserPrompt,
  LlmScoreResponseSchema,
  SCORING_PARAMS,
  SYSTEM_PROMPT,
} from '@/lib/ai/prompts';
import { resumeToText } from '@/lib/ai/resumeToText';
import type {
  Resume,
  ScoreResult,
  Improvement,
  ResumeSection,
  ImprovementPriority,
} from '@/types/resume';

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const ResumeSectionSchema = z.object({
  id: z.string(),
  company: z.string().optional().default(''),
  position: z.string().optional().default(''),
  startDate: z.string().optional().default(''),
  endDate: z.string().nullable().optional(),
  location: z.string().optional(),
  bullets: z.array(z.string()).default([]),
}).passthrough();

const EducationSectionSchema = z.object({
  id: z.string(),
  institution: z.string().optional().default(''),
  degree: z.string().optional().default(''),
  startDate: z.string().optional().default(''),
  endDate: z.string().optional().default(''),
  gpa: z.string().optional(),
}).passthrough();

const ProjectSectionSchema = z.object({
  id: z.string(),
  name: z.string().optional().default(''),
  description: z.string().optional().default(''),
  techStack: z.array(z.string()).default([]),
  link: z.string().optional(),
}).passthrough();

const ContactSchema = z.object({
  name: z.string().default(''),
  email: z.string().default(''),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedin: z.string().optional(),
  github: z.string().optional(),
  portfolio: z.string().optional(),
}).passthrough();

const SkillsSchema = z.object({
  technical: z.array(z.string()).default([]),
  soft: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
}).passthrough();

const ResumeSchema = z.object({
  version: z.number().default(1),
  contact: ContactSchema,
  summary: z.string().default(''),
  experience: z.array(ResumeSectionSchema).default([]),
  education: z.array(EducationSectionSchema).default([]),
  skills: SkillsSchema,
  projects: z.array(ProjectSectionSchema).default([]),
  updatedAt: z.string().optional(),
}).passthrough();

const RequestSchema = z.object({
  resume: ResumeSchema,
  jobDescription: z.string().max(20_000).optional(),
});

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: 'Invalid request body.',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { resume, jobDescription } = parsed.data;
  const trimmedJD = jobDescription?.trim() || undefined;

  // 1. Deterministic ATS checks
  const atsResult = runAtsChecks(resume as unknown as Resume);

  // 2. LLM scoring
  let llmResponse;
  try {
    llmResponse = await callLlmForScoring(resume as unknown as Resume, trimmedJD);
  } catch (err) {
    console.error('[score] LLM call failed:', err);
    return Response.json(
      {
        error:
          err instanceof Error
            ? `AI scoring failed: ${err.message}`
            : 'AI scoring failed for an unknown reason.',
      },
      { status: 500 },
    );
  }

  // 3. Weighted holistic score
  const holistic = computeHolistic({
    ats: atsResult.score,
    content: llmResponse.contentScore,
    jobMatch: llmResponse.jobMatchScore,
  });

  const result: ScoreResult = {
    ats: atsResult.score,
    content: llmResponse.contentScore,
    jobMatch: llmResponse.jobMatchScore,
    holistic,
    improvements: llmResponse.improvements.map(toTypedImprovement),
    generatedAt: new Date().toISOString(),
  };

  return Response.json(result);
}

// ---------------------------------------------------------------------------
// LLM call
// ---------------------------------------------------------------------------

async function callLlmForScoring(
  resume: Resume,
  jobDescription: string | undefined,
): Promise<z.infer<typeof LlmScoreResponseSchema>> {
  const client = getDeepSeek();
  const resumeText = resumeToText(resume);
  const userPrompt = buildUserPrompt({ resumeText, jobDescription });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  let completion;
  try {
    completion = await client.chat.completions.create(
      {
        model: MODEL_NAME,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        ...SCORING_PARAMS,
      },
      { signal: controller.signal },
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error('AI returned an empty response.');
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (err) {
    console.error('[score] LLM returned non-JSON:', raw);
    throw new Error('AI returned a response that was not valid JSON.');
  }

  const validated = LlmScoreResponseSchema.safeParse(parsedJson);
  if (!validated.success) {
    console.error('[score] LLM JSON failed validation:', raw, validated.error);
    throw new Error('AI returned JSON that did not match the expected schema.');
  }

  return validated.data;
}

// ---------------------------------------------------------------------------
// Holistic score weighting
// ---------------------------------------------------------------------------

interface HolisticArgs {
  ats: number;
  content: number;
  jobMatch: number | null;
}

function computeHolistic({ ats, content, jobMatch }: HolisticArgs): number {
  if (jobMatch === null) {
    // No JD: weight ATS 50%, content 50%.
    return Math.round(ats * 0.5 + content * 0.5);
  }
  // With JD: ATS 35%, content 40%, jobMatch 25%.
  return Math.round(ats * 0.35 + content * 0.4 + jobMatch * 0.25);
}

// ---------------------------------------------------------------------------
// Type narrowing for improvements
// ---------------------------------------------------------------------------

function toTypedImprovement(
  imp: z.infer<typeof LlmScoreResponseSchema>['improvements'][number],
): Improvement {
  return {
    section: imp.section as ResumeSection,
    priority: imp.priority as ImprovementPriority,
    issue: imp.issue,
    suggestion: imp.suggestion,
    // The LLM may send null for an absent example; normalize to undefined
    // so the Improvement type stays clean.
    example: imp.example ?? undefined,
  };
}

/**
 * LLM prompt and response schema for resume scoring.
 *
 * We make ONE LLM call that returns:
 *   - contentScore (0-100): bullet quality, action verbs, quantification, clarity
 *   - jobMatchScore (0-100) or null: keyword/relevance match to the job description
 *   - improvements: max 8, ordered high → low priority
 *
 * Why one call: cheaper, faster, and the model can reason holistically
 * about the resume rather than scoring in disconnected passes.
 *
 * Job description is OPTIONAL. When absent, the model returns null for
 * jobMatchScore and does not include job-description improvements.
 *
 * Determinism:
 *   - temperature: 0
 *   - explicit "return ONLY valid JSON" instructions
 *   - schema is validated server-side with Zod; failure → 500, no retry
 *
 * Privacy: the resume text and (if present) the job description are
 * sent to DeepSeek's API. The UI discloses this. We do not store the
 * prompt or response.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Response schema
// ---------------------------------------------------------------------------

export const ImprovementPriority = z.enum(['high', 'medium', 'low']);
export type ImprovementPriority = z.infer<typeof ImprovementPriority>;

export const ResumeSectionName = z.enum([
  'header',
  'summary',
  'experience',
  'skills',
  'education',
  'projects',
  'general',
]);
export type ResumeSectionName = z.infer<typeof ResumeSectionName>;

export const ImprovementSchema = z.object({
  section: ResumeSectionName,
  priority: ImprovementPriority,
  /** Diagnosis: what's wrong with this specific part of the resume. */
  issue: z.string().min(5).max(500),
  /** Prescription: how to fix it. May include specific rewrite examples. */
  suggestion: z.string().min(5).max(1000),
  /** Optional: a concrete before/after or specific rewrite. */
  example: z.string().max(1000).nullish(),
});

export const LlmScoreResponseSchema = z.object({
  contentScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe('Content quality score 0-100'),
  jobMatchScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .nullable()
    .describe('Job description match score 0-100, or null if no JD was provided'),
  improvements: z
    .array(ImprovementSchema)
    .max(8)
    .describe('Up to 8 actionable improvements, ordered by impact (highest first)'),
});

export type LlmScoreResponse = z.infer<typeof LlmScoreResponseSchema>;

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a senior technical recruiter with 15+ years of experience reviewing resumes for tech roles (software, data, infrastructure, product). You are precise, honest, and you give specific, actionable feedback.

You evaluate resumes on REAL qualities that matter to hiring managers and ATS systems:
- Bullet points that demonstrate impact vs. responsibilities
- Quantified outcomes (numbers, %, $, time saved, users served)
- Strong action verbs at the start of bullets
- Concise, scannable writing (no fluff, no clichés)
- Section completeness (does the candidate have what's expected for their level?)
- Honesty: claims that look inflated or unverifiable
- For job match: how well the resume aligns with the role's required skills and experience

You DO NOT:
- Re-score the deterministic ATS checks (contact info, section presence, bullet length). The caller handles those.
- Hallucinate improvements. Every improvement must be tied to specific text in the resume. If you can't point to a specific bullet or field, don't suggest the improvement.
- Reformat the resume. You give feedback, you don't rewrite.
- Make up metrics. If a bullet lacks a number, say so — don't invent one.

You always return valid JSON matching the requested schema exactly. No markdown, no commentary, no trailing text. The schema requires every improvement to have FOUR required fields and one optional field:
- \`section\`: one of "header", "summary", "experience", "skills", "education", "projects", "general"
- \`priority\`: "high", "medium", or "low"
- \`issue\`: 1-3 sentences diagnosing what's wrong. Be specific. Quote the actual text from the resume when relevant.
- \`suggestion\`: 1-3 sentences prescribing how to fix it. May include a concrete rewrite.
- \`example\` (optional): a single string with a before/after rewrite. Skip this field entirely (don't include it as null) if you don't have a concrete example.

The \`issue\` is the diagnosis, and the \`suggestion\` is the prescription. They are SEPARATE fields. Do NOT combine them into a single "description" field.`;

// ---------------------------------------------------------------------------
// User prompt builder
// ---------------------------------------------------------------------------

interface BuildUserPromptArgs {
  resumeText: string;
  jobDescription?: string;
}

/**
 * Build the user prompt. The resume is always present (stringified from
 * the structured form, or the extracted text from the uploaded file).
 * The job description is optional.
 */
export function buildUserPrompt({ resumeText, jobDescription }: BuildUserPromptArgs): string {
  const jdBlock = jobDescription?.trim()
    ? `

JOB DESCRIPTION (the role the candidate is targeting):
\`\`\`
${jobDescription.trim()}
\`\`\`
`
    : `
No job description was provided. Score the resume on general content quality only. Set jobMatchScore to null in your response. Do not include any improvements that reference specific job requirements.`;

  return `Score the following resume and return JSON matching the requested schema.

RESUME:
\`\`\`
${resumeText.trim()}
\`\`\`
${jdBlock}

Output instructions:
- contentScore: 0-100. Calibrate against this scale:
  * 90-100: exceptional. Every bullet is quantified, every claim is backed by impact, no clichés, scannable in 10 seconds.
  * 70-89: solid. Most bullets have substance, a few could be sharper.
  * 50-69: mediocre. Many bullets are responsibilities instead of achievements. Some clichés. Missing quantification.
  * 30-49: weak. Reads like a job description copied into bullet form.
  * 0-29: very poor. Vague, dishonest, or hard to parse.
- jobMatchScore: 0-100 if a JD was provided, null otherwise. Score = how well the resume's experience, skills, and impact align with the JD's requirements. Same 0-100 scale as content but relative to the role.
- improvements: up to 8, ordered by impact (high first). Each improvement must be tied to something specific in the resume. Use the section values: header, summary, experience, skills, education, projects, general.
  * Be specific. "Add metrics to bullets" is bad. "The bullet 'Managed spare parts supply chain' has no number — quantify with a percentage of fill rate, dollar value, or count" is good.
  * Prioritize: high = blocking / will get rejected. medium = noticeable weakness. low = polish.
  * If the resume is already strong, return fewer improvements (1-3). Don't pad.

Return only the JSON object, no markdown fencing, no commentary.`;
}

// ---------------------------------------------------------------------------
// Chat-completion params
// ---------------------------------------------------------------------------

/**
 * Default parameters for the scoring call. Centralized so we can tune
 * them in one place.
 */
export const SCORING_PARAMS = {
  temperature: 0,
  response_format: { type: 'json_object' as const },
  max_tokens: 2000,
};

export { SYSTEM_PROMPT };

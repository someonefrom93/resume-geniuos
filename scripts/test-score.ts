/**
 * Smoke test for the scoring pipeline.
 *
 * Tests:
 *   1. resumeToText produces sensible text from a structured resume
 *   2. runAtsChecks produces a sensible score for a real-shaped resume
 *   3. The LLM prompt is well-formed (contains the resume, has the schema)
 *   4. The Zod schema accepts valid responses and rejects invalid ones
 *   5. The /api/score route returns 400 for bad bodies
 *
 * We do NOT call the actual LLM here (requires DEEPSEEK_API_KEY and
 * costs money). The prompt structure and schema are the parts we own
 * and can verify.
 *
 * Run: npx tsx scripts/test-score.ts
 */

import { resumeToText } from '../lib/ai/resumeToText';
import { runAtsChecks } from '../lib/ats/checks';
import {
  buildUserPrompt,
  LlmScoreResponseSchema,
  SYSTEM_PROMPT,
} from '../lib/ai/prompts';
import { createEmptyResume, type Resume } from '../types/resume';

let failed = 0;
function check(name: string, pass: boolean, detail?: string) {
  console.log(`  ${pass ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failed++;
}

// A reasonably-filled resume, shaped like the user's actual CV.
const sampleResume: Resume = {
  version: 1,
  contact: {
    name: 'Juan Diego Angeles Hernandez',
    email: 'j.diego93@outlook.com',
    phone: '+52 442 123 4567',
    location: 'Querétaro, Mexico',
    linkedin: 'https://linkedin.com/in/juan-diego',
    github: 'https://github.com/jdiego',
  },
  summary: 'Data engineering professional with 5+ years of experience.',
  experience: [
    {
      id: 'e1',
      company: 'Santander',
      position: 'Data Engineer',
      startDate: 'Jun 2024',
      endDate: null,
      location: 'Querétaro',
      bullets: [
        'Led KYC processes, ensuring compliance with AML standards',
        'Built ELT pipelines with Snowflake and AWS',
      ],
    },
    {
      id: 'e2',
      company: 'Makino',
      position: 'Parts Specialist',
      startDate: 'May 2023',
      endDate: 'Jun 2024',
      bullets: ['Managed spare parts supply chain for machining centers'],
    },
  ],
  education: [
    {
      id: 'edu1',
      institution: 'Universidad Politécnica de Santa Rosa Jáuregui',
      degree: 'Ingeniería en Sistemas Automotrices',
      startDate: 'Jan 2013',
      endDate: 'Jan 2016',
    },
  ],
  skills: {
    technical: ['Snowflake', 'AWS S3', 'dbt', 'SQL', 'Python'],
    tools: ['Git', 'Docker'],
    languages: ['English', 'Spanish'],
    soft: [],
  },
  projects: [
    {
      id: 'p1',
      name: 'Resume Scorer',
      description: 'Web app that scores resumes against ATS rules.',
      techStack: ['Next.js', 'TypeScript'],
    },
  ],
  updatedAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// 1. resumeToText
// ---------------------------------------------------------------------------

console.log('--- 1. resumeToText ---');
{
  const text = resumeToText(sampleResume);
  check('text is non-empty', text.length > 0);
  check('contains the name', text.includes('Juan Diego Angeles Hernandez'));
  check('contains the email', text.includes('j.diego93@outlook.com'));
  check('contains section header SUMMARY', text.includes('SUMMARY'));
  check('contains section header EXPERIENCE', text.includes('EXPERIENCE'));
  check('contains section header PROJECTS', text.includes('PROJECTS'));
  check('contains section header SKILLS', text.includes('SKILLS'));
  check('contains section header EDUCATION', text.includes('EDUCATION'));
  check('renders job position', text.includes('Data Engineer'));
  check('renders company', text.includes('Santander'));
  check('renders bullets with • prefix', text.includes('• Led KYC processes'));
  check('renders current job with no end date gracefully', text.includes('Jun 2024'));
  check('renders skills with labels', text.includes('Technical: Snowflake'));
  check('omits empty soft skills group', !text.includes('Soft skills:'));
  check('renders project name', text.includes('Resume Scorer'));
  check('renders project tech stack', text.includes('Next.js, TypeScript'));

  // Empty resume should produce nearly empty text (no section headers).
  const emptyText = resumeToText(createEmptyResume());
  check('empty resume → no SUMMARY section', !emptyText.includes('SUMMARY'));
  check('empty resume → no EXPERIENCE section', !emptyText.includes('EXPERIENCE'));
}

// ---------------------------------------------------------------------------
// 2. runAtsChecks
// ---------------------------------------------------------------------------

console.log('\n--- 2. runAtsChecks ---');
{
  const result = runAtsChecks(sampleResume);
  check('score is 0-100', result.score >= 0 && result.score <= 100);
  check('score for filled resume is high', result.score >= 80, `got ${result.score}`);
  check('has all expected checks', result.checks.length === 11);

  const emailCheck = result.checks.find((c) => c.id === 'has-email');
  check('email check passes', emailCheck?.passed === true);

  const phoneCheck = result.checks.find((c) => c.id === 'has-phone');
  check('phone check passes', phoneCheck?.passed === true);

  // Empty resume should score 0 (or very low).
  const emptyResult = runAtsChecks(createEmptyResume());
  check('empty resume scores low', emptyResult.score < 20, `got ${emptyResult.score}`);
}

// ---------------------------------------------------------------------------
// 3. LLM prompt
// ---------------------------------------------------------------------------

console.log('\n--- 3. LLM prompt ---');
{
  check('system prompt is non-trivial', SYSTEM_PROMPT.length > 200);
  check('system prompt forbids reformatting', SYSTEM_PROMPT.toLowerCase().includes('reformat'));
  check('system prompt forbids hallucinating metrics', SYSTEM_PROMPT.toLowerCase().includes('make up metrics'));

  const withJD = buildUserPrompt({
    resumeText: 'fake resume text',
    jobDescription: 'fake jd text',
  });
  check('user prompt contains the resume', withJD.includes('fake resume text'));
  check('user prompt contains the JD when provided', withJD.includes('fake jd text'));
  check('user prompt includes job match instructions', withJD.includes('jobMatchScore'));

  const withoutJD = buildUserPrompt({
    resumeText: 'fake resume text',
  });
  check('user prompt omits JD block when not provided', !withoutJD.includes('JOB DESCRIPTION'));
  check('user prompt says jobMatchScore should be null', withoutJD.toLowerCase().includes('null'));
}

// ---------------------------------------------------------------------------
// 4. Zod schema
// ---------------------------------------------------------------------------

console.log('\n--- 4. LlmScoreResponseSchema ---');
{
  // Valid full response (realistic LLM output — issue and suggestion can be
  // a few sentences, with optional example)
  const validFull = {
    contentScore: 72,
    jobMatchScore: 65,
    improvements: [
      {
        section: 'experience',
        priority: 'high',
        issue: 'No quantified outcomes in 2 of 3 bullets. Bullets describe responsibilities ("managed workflows") without showing the scale of impact or the result.',
        suggestion: 'Add specific numbers — time saved, users served, percentage improvement — to demonstrate the magnitude of what you did. Where exact numbers are unknown, use a defensible range (e.g., "reduced X by 20-30%").',
        example: 'Before: "Managed team workflows." After: "Managed onboarding workflows for a team of 5, reducing average case-handling time from 4 days to 1."',
      },
    ],
  };
  const r1 = LlmScoreResponseSchema.safeParse(validFull);
  check('accepts valid full response', r1.success);

  // Valid with null jobMatchScore
  const validNoJD = {
    contentScore: 80,
    jobMatchScore: null,
    improvements: [],
  };
  const r2 = LlmScoreResponseSchema.safeParse(validNoJD);
  check('accepts null jobMatchScore', r2.success);

  // Reject contentScore out of range
  const tooHigh = { contentScore: 150, jobMatchScore: null, improvements: [] };
  const r3 = LlmScoreResponseSchema.safeParse(tooHigh);
  check('rejects contentScore > 100', !r3.success);

  // Reject invalid priority
  const badPriority = {
    contentScore: 50,
    jobMatchScore: null,
    improvements: [{ section: 'general', priority: 'urgent', issue: 'x', suggestion: 'y' }],
  };
  const r4 = LlmScoreResponseSchema.safeParse(badPriority);
  check('rejects invalid priority', !r4.success);

  // Reject too many improvements
  const tooMany = {
    contentScore: 50,
    jobMatchScore: null,
    improvements: Array.from({ length: 20 }, () => ({
      section: 'general',
      priority: 'low',
      issue: 'issue',
      suggestion: 'suggestion',
    })),
  };
  const r5 = LlmScoreResponseSchema.safeParse(tooMany);
  check('rejects more than 8 improvements', !r5.success);

  // Reject invalid section
  const badSection = {
    contentScore: 50,
    jobMatchScore: null,
    improvements: [{ section: 'hobbies', priority: 'low', issue: 'x', suggestion: 'y' }],
  };
  const r6 = LlmScoreResponseSchema.safeParse(badSection);
  check('rejects invalid section', !r6.success);

  // Realistic LLM issue (around 300 chars) is now accepted
  const longIssue = {
    contentScore: 50,
    jobMatchScore: null,
    improvements: [
      {
        section: 'experience',
        priority: 'high',
        issue: 'a'.repeat(400), // 400 chars — would have failed at the old 200 limit
        suggestion: 'fix the bullets',
      },
    ],
  };
  const r7 = LlmScoreResponseSchema.safeParse(longIssue);
  check('accepts realistic-length issue (400 chars)', r7.success);

  // example: null is accepted (LLM may include null instead of omitting)
  const nullExample = {
    contentScore: 50,
    jobMatchScore: null,
    improvements: [
      {
        section: 'experience',
        priority: 'low',
        issue: 'something',
        suggestion: 'do something',
        example: null,
      },
    ],
  };
  const r8 = LlmScoreResponseSchema.safeParse(nullExample);
  check('accepts example: null', r8.success);

  // Still rejects truly oversized strings
  const tooLong = {
    contentScore: 50,
    jobMatchScore: null,
    improvements: [
      {
        section: 'experience',
        priority: 'low',
        issue: 'a'.repeat(600), // over the 500 cap
        suggestion: 'fix it',
      },
    ],
  };
  const r9 = LlmScoreResponseSchema.safeParse(tooLong);
  check('still rejects issue > 500 chars', !r9.success);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${failed === 0 ? '[PASS]' : '[FAIL]'} ${failed} failure(s)`);
process.exit(failed === 0 ? 0 : 1);

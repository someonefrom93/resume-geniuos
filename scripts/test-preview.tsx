/**
 * Smoke test for the builder components.
 *
 * Tests:
 *   1. ResumePreview renders without crashing on an empty resume
 *   2. ResumePreview renders correctly with the user's actual CV data
 *   3. Design tokens are consistent (ptToPx math is right)
 *
 * This is a server-render test using react-dom/server, so we can catch
 * SSR-specific bugs (like missing 'use client' or bad imports) without
 * needing a browser.
 *
 * Run: npx tsx scripts/test-preview.tsx
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { ResumePreview } from '../components/builder/ResumePreview';
import { TOKENS, ptToPx } from '../lib/pdf/tokens';
import { createEmptyResume, type Resume } from '../types/resume';

let failed = 0;

function check(name: string, pass: boolean, detail?: string) {
  console.log(`  ${pass ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failed++;
}

// ---------------------------------------------------------------------------
// 1. Design token math
// ---------------------------------------------------------------------------

console.log('--- 1. Design tokens ---');
{
  // 10.5pt should be 14px at 96 DPI
  const got = ptToPx(TOKENS.size.body);
  check('ptToPx(10.5) ≈ 14', Math.abs(got - 14) < 0.01, `got ${got}`);
  // 22pt name → ~29.33px
  check('ptToPx(22) ≈ 29.33', Math.abs(ptToPx(TOKENS.size.name) - 29.333) < 0.01);
  // 48pt margin → 64px
  check('ptToPx(48) = 64', ptToPx(TOKENS.page.marginPt) === 64);
}

// ---------------------------------------------------------------------------
// 2. Empty resume renders without crash
// ---------------------------------------------------------------------------

console.log('\n--- 2. Empty resume ---');
let emptyHtml = '';
try {
  emptyHtml = renderToStaticMarkup(createElement(ResumePreview, { resume: createEmptyResume() }));
  check('renders without throwing', true);
} catch (err) {
  check('renders without throwing', false, err instanceof Error ? err.message : String(err));
}
check('shows placeholder name when empty', emptyHtml.includes('Your name'));
check('does NOT show Summary section when empty', !emptyHtml.includes('>Summary<'));
check('does NOT show Experience section when empty', !emptyHtml.includes('>Experience<'));
check('does NOT show Skills section when empty', !emptyHtml.includes('>Skills<'));

// ---------------------------------------------------------------------------
// 3. Filled resume renders all sections
// ---------------------------------------------------------------------------

console.log('\n--- 3. Filled resume (the user\'s CV shape) ---');

const filled: Resume = {
  version: 1,
  contact: {
    name: 'Juan Diego Angeles Hernandez',
    email: 'j.diego93@outlook.com',
    phone: '+52 442 123 4567',
    location: 'Querétaro, Mexico',
    linkedin: 'https://linkedin.com/in/juan-diego',
  },
  summary: 'Data engineering professional with 5+ years of experience.',
  experience: [
    {
      id: 'e1',
      position: 'Data Engineer',
      company: 'Santander',
      startDate: 'Jun 2024',
      endDate: null,
      location: 'Querétaro',
      bullets: [
        'Led KYC processes for new and existing customers',
        'Built ELT pipelines with Snowflake and AWS',
      ],
    },
    {
      id: 'e2',
      position: 'Parts Specialist',
      company: 'Makino',
      startDate: 'May 2023',
      endDate: 'Jun 2024',
      bullets: ['Managed spare parts supply chain'],
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
    technical: ['Snowflake', 'AWS S3', 'dbt', 'Apache Airflow', 'SQL', 'Python'],
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
      link: 'https://github.com/me/resume-scorer',
    },
  ],
  updatedAt: new Date().toISOString(),
};

let filledHtml = '';
try {
  filledHtml = renderToStaticMarkup(createElement(ResumePreview, { resume: filled }));
  check('renders without throwing', true);
} catch (err) {
  check('renders without throwing', false, err instanceof Error ? err.message : String(err));
}
check('shows actual name', filledHtml.includes('Juan Diego Angeles Hernandez'));
check('shows email', filledHtml.includes('j.diego93@outlook.com'));
check('shows summary section', filledHtml.includes('>Summary<'));
check('shows experience section', filledHtml.includes('>Experience<'));
check('shows projects section', filledHtml.includes('>Projects<'));
check('shows skills section', filledHtml.includes('>Skills<'));
check('shows education section', filledHtml.includes('>Education<'));
check('shows first job position', filledHtml.includes('Data Engineer'));
check('shows first job company', filledHtml.includes('Santander'));
check('shows first bullet', filledHtml.includes('Led KYC processes'));
check('shows project name', filledHtml.includes('Resume Scorer'));
check('shows first skill', filledHtml.includes('Snowflake'));
check('shows first education institution', filledHtml.includes('Universidad Politécnica'));
check('does NOT show empty soft skills group', !filledHtml.includes('Soft skills:'));

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${failed === 0 ? '[PASS]' : '[FAIL]'} ${failed} failure(s)`);
process.exit(failed === 0 ? 0 : 1);

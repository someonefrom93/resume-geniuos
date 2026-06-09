/**
 * Smoke test for the heuristic parser.
 *
 * Runs the parser against multiple sample resume texts and prints the
 * results. This catches browser-only bugs (like the matchAll/g-flag
 * issue from real testing) that API tests miss.
 *
 * Run with: npx tsx scripts/test-parser.ts
 */

import { parseResumeText } from '../lib/ats/parser';

const SAMPLES: Array<{ name: string; text: string; expect: Record<string, unknown> }> = [
  {
    name: 'standard resume with LinkedIn + GitHub',
    text: `
JUAN DIEGO ANGELES HERNANDEZ
DATA ENGINEER
Querétaro, Mexico | j.diego93@outlook.com | +52 442 123 4567
https://linkedin.com/in/juan-diego | https://github.com/jdiego

PROFILE
Data engineering professional with 5+ years of experience.

PROFESSIONAL EXPERIENCE
Senior Engineer, Acme Corp
Jan 2023 to Present
• Led team of 5 engineers
• Reduced latency by 40%

EDUCATION
Universidad Politécnica
B.S. Computer Science
2015 to 2019
`,
    expect: {
      'contact.email': 'j.diego93@outlook.com',
      'contact.name': 'JUAN DIEGO ANGELES HERNANDEZ',
      'contact.linkedin': 'https://linkedin.com/in/juan-diego',
      'contact.github': 'https://github.com/jdiego',
      'sections.length >= 3': true,
    },
  },
  {
    name: 'resume with only LinkedIn (no GitHub)',
    text: `
María López
Product Designer
maria@example.com | +34 600 000 000
https://linkedin.com/in/marialopez

EXPERIENCE
Designer, Foo Inc
2020 - Present
`,
    expect: {
      'contact.email': 'maria@example.com',
      'contact.name': 'María López',
      'contact.linkedin': 'https://linkedin.com/in/marialopez',
      'contact.github': null,
    },
  },
  {
    name: 'minimal resume (no URLs at all)',
    text: `
John Smith
john@test.com

EXPERIENCE
Engineer at Co
`,
    expect: {
      'contact.email': 'john@test.com',
      'contact.name': 'John Smith',
      'contact.linkedin': null,
      'contact.github': null,
    },
  },
];

let failed = 0;
function check(name: string, pass: boolean, detail?: string) {
  console.log(`  ${pass ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failed++;
}

for (const sample of SAMPLES) {
  console.log(`\n--- ${sample.name} ---`);
  let result;
  try {
    result = parseResumeText(sample.text);
  } catch (err) {
    console.error(`  CRASH: ${err instanceof Error ? err.message : err}`);
    failed++;
    continue;
  }

  console.log(`  email:    ${result.contact.email}`);
  console.log(`  phone:    ${result.contact.phone}`);
  console.log(`  name:     ${result.contact.name}`);
  console.log(`  linkedin: ${result.contact.linkedin}`);
  console.log(`  github:   ${result.contact.github}`);
  console.log(`  sections: ${result.sections.length} (${result.sections.map((s) => s.name).join(', ')})`);

  for (const [check, expected] of Object.entries(sample.expect)) {
    const actual = getByPath(result, check);
    const pass = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`  ${pass ? 'OK ' : 'FAIL'}  ${check} ${pass ? '' : `(expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`}`);
    if (!pass) failed++;
  }
}

// ---------------------------------------------------------------------------
// Per-item parsing (experience and education items)
// ---------------------------------------------------------------------------

console.log('\n--- 4. Per-item experience parsing ---');
{
  // Two jobs with line-wrapped bullets. Verifies the trailing-space
  // signal is preserved and used to merge continuations.
  const text = `
EXPERIENCE
Senior Engineer, Acme Corp
Remote
Jan 2023 to Present
• Led migration of 12 services to Kubernetes, reducing infrastructure costs by 30%
• Built a real-time analytics pipeline processing 50M events per day with sub-second
  latency for downstream consumers
Engineer, Foo Inc
New York
Jun 2020 to Dec 2022
• Did things
• Did more things
`;
  const r = parseResumeText(text);
  const exp = r.sections.find((s) => s.name === 'experience');
  const items = exp?.items as any[] | undefined;
  check('experience section parsed', !!exp);
  check('2 items parsed', items?.length === 2, `got ${items?.length}`);
  check('item 0 position', items?.[0]?.position === 'Senior Engineer');
  check('item 0 company', items?.[0]?.company === 'Acme Corp');
  check('item 0 startDate', items?.[0]?.startDate === 'Jan 2023');
  check('item 0 endDate is null (present)', items?.[0]?.endDate === null);
  // 3 bullets: 1 empty placeholder + 2 real bullets
  check('item 0 has 3 bullets (1 placeholder + 2 real)', items?.[0]?.bullets.length === 3);
  check(
    'item 0 real bullet 0 contains migration text',
    items?.[0]?.bullets[1]?.includes('migration of 12 services'),
  );
  check(
    'item 0 real bullet 1 merges wrapped "sub-second latency" continuation',
    items?.[0]?.bullets[2]?.includes('sub-second latency'),
  );
  check('item 1 position', items?.[1]?.position === 'Engineer');
  check('item 1 company', items?.[1]?.company === 'Foo Inc');
  check('item 1 endDate is string (not null)', items?.[1]?.endDate === 'Dec 2022');
}

console.log('\n--- 5. Per-item education parsing ---');
{
  // Tests the common pattern: Institution, Degree (may wrap), Dates.
  const text = `
EDUCATION
Stanford University
B.S. Computer Science
2014 to 2018
`;
  const r = parseResumeText(text);
  const edu = r.sections.find((s) => s.name === 'education');
  const items = edu?.items as any[] | undefined;
  check('1 education item', items?.length === 1);
  check('institution', items?.[0]?.institution === 'Stanford University');
  check('degree', items?.[0]?.degree === 'B.S. Computer Science');
  check('startDate', items?.[0]?.startDate === '2014');
  check('endDate', items?.[0]?.endDate === '2018');
}

console.log('\n--- 6. Education with wrapped degree ---');
{
  // Common PDF wrap: "Ingeniería en Sistemas Automotrices in Mechanical \nEngineering"
  const text = `
EDUCATION
Universidad Politécnica
B.S. in Mechanical
Engineering
2010 to 2014
`;
  const r = parseResumeText(text);
  const edu = r.sections.find((s) => s.name === 'education');
  const items = edu?.items as any[] | undefined;
  check('1 item (degree lines merged)', items?.length === 1);
  check(
    'merged degree contains both lines',
    items?.[0]?.degree === 'B.S. in Mechanical Engineering',
  );
  check('startDate', items?.[0]?.startDate === '2010');
  check('endDate', items?.[0]?.endDate === '2014');
}

console.log('\n--- 7. Page-break artifacts filtered ---');
{
  // "Page 1" is a PDF page break marker, not real content.
  const text = `
EDUCATION
Page 1

MIT
M.S. CS
2015 to 2017
`;
  const r = parseResumeText(text);
  const edu = r.sections.find((s) => s.name === 'education');
  const items = edu?.items as any[] | undefined;
  check('Page 1 filtered out', items?.[0]?.institution === 'MIT');
  check('only 1 item (not 2 with Page 1 as institution)', items?.length === 1);
}

console.log(`\n${failed === 0 ? '[PASS]' : '[FAIL]'} ${SAMPLES.length - failed}/${SAMPLES.length} samples passed`);
process.exit(failed === 0 ? 0 : 1);

// Resolve dot-paths like "contact.email" or "sections.length >= 3" against
// a parsed-resume object. The `>= N` form is a numeric comparison.
function getByPath(obj: unknown, path: string): unknown {
  const m = path.match(/^(.+) (>=|<=|>|<|==) (.+)$/);
  if (m) {
    const [, left, op, rightStr] = m;
    const leftVal = getByPath(obj, left!);
    const rightVal = JSON.parse(rightStr!);
    switch (op) {
      case '>=': return (leftVal as number) >= rightVal;
      case '<=': return (leftVal as number) <= rightVal;
      case '>': return (leftVal as number) > rightVal;
      case '<': return (leftVal as number) < rightVal;
      case '==': return leftVal === rightVal;
    }
  }
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}


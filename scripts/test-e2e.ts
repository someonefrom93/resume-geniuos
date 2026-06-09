/**
 * End-to-end smoke test: POST a real PDF to the API, then run the
 * heuristic parser on the returned text. Catches both server-side
 * (PDF extraction) and client-side (parser) regressions.
 *
 * Requires the dev server to be running on localhost:3000.
 * Run: npx tsx scripts/test-e2e.ts <path-to-pdf>
 */

import { readFileSync } from 'node:fs';
import { parseResumeText } from '../lib/ats/parser';

const PDF_PATH = process.argv[2];
if (!PDF_PATH) {
  console.error('Usage: npx tsx scripts/test-e2e.ts <path-to-pdf>');
  process.exit(1);
}

async function main() {
  const form = new FormData();
  const file = readFileSync(PDF_PATH);
  form.append('file', new Blob([new Uint8Array(file)], { type: 'application/pdf' }), PDF_PATH.split('/').pop());

  const res = await fetch('http://localhost:3000/api/parse-resume', {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    console.error(`API returned ${res.status}`);
    const body = await res.text();
    console.error(body.slice(0, 500));
    process.exit(1);
  }

  const data = (await res.json()) as { text: string; filename: string; size: number };
  console.log(`[api] Got ${data.text.length} chars from ${data.filename}`);

  // Now run the parser (the part that broke in the browser)
  const parsed = parseResumeText(data.text);
  console.log('\n[parser] Contact:');
  console.log(JSON.stringify(parsed.contact, null, 2));
  console.log(`\n[parser] Sections found: ${parsed.sections.length}`);
  for (const s of parsed.sections) {
    console.log(`  - ${s.name} at line ${s.startLine}`);
  }
  console.log(`\n[parser] Total lines: ${parsed.lineCount}`);

  // Assertions: only check things that are expected to ALWAYS be present
  // in a real resume. Phone, LinkedIn, etc. are optional in the data, so
  // the parser returns null for them when they're absent — that's correct,
  // not a bug.
  const errors: string[] = [];
  if (!parsed.contact.email) errors.push('email not extracted');
  if (!parsed.contact.name) errors.push('name not extracted');
  if (parsed.sections.length === 0) errors.push('no sections detected');
  if (parsed.contact.email && !parsed.contact.email.includes('@')) {
    errors.push('email format looks wrong');
  }

  if (errors.length > 0) {
    console.error('\n[FAIL] ' + errors.join(', '));
    process.exit(1);
  }
  console.log('\n[PASS] Parser smoke test succeeded');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

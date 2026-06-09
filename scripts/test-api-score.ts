/**
 * Smoke test for the /api/score route handler.
 *
 * Tests error paths only — we don't call the LLM (costs money, requires
 * API key). What we verify:
 *   - 400 on empty body
 *   - 400 on malformed JSON
 *   - 400 on missing required fields
 *   - 400 on extra-long job description (>20k chars)
 *   - 500 on missing API key (when we reach the LLM call)
 *
 * The /api/score route is a Next.js route handler, not a plain function.
 * We invoke it directly through `POST()` with a fake Request.
 *
 * Run: npx tsx scripts/test-api-score.ts
 *
 * Requires the dev server to NOT be running (or running on a different
 * port) so that Next.js's auto-recompile doesn't fight us. This test
 * runs the handler in-process.
 */

import { POST } from '../app/api/score/route';
import { NextRequest } from 'next/server';

let failed = 0;
function check(name: string, pass: boolean, detail?: string) {
  console.log(`  ${pass ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failed++;
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function readJson(res: Response): Promise<unknown> {
  return res.json();
}

async function main() {
  // ---------------------------------------------------------------------------
  console.log('--- 1. Body validation ---');

  // Empty body → 400
  {
    const res = await POST(makeRequest({}));
    check('empty body returns 400', res.status === 400);
    const body = (await readJson(res)) as { error?: string };
    check('error message present', typeof body.error === 'string');
  }

  // Malformed JSON → 400
  {
    const res = await POST(makeRequest('not valid json {{{'));
    check('malformed JSON returns 400', res.status === 400);
  }

  // Missing resume → 400
  {
    const res = await POST(makeRequest({ jobDescription: 'some jd' }));
    check('missing resume returns 400', res.status === 400);
  }

  // Resume with wrong shape (e.g. resume is a string instead of object)
  {
    const res = await POST(makeRequest({ resume: 'not an object' }));
    check('wrong-shape resume returns 400', res.status === 400);
  }

  // Job description too long
  {
    const res = await POST(
      makeRequest({
        resume: { contact: { name: 'A', email: 'a@b.co' } },
        jobDescription: 'x'.repeat(20_001),
      }),
    );
    check('oversized JD returns 400', res.status === 400);
  }

  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Pipeline execution ---');

  // Minimal valid resume → should attempt the LLM call and fail with 500
  // (because DEEPSEEK_API_KEY is unset in this test env). We're verifying
  // the body validation passed and we got past it.
  {
    // Suppress console.error for the expected LLM failure
    const origError = console.error;
    console.error = () => {};

    const res = await POST(
      makeRequest({
        resume: {
          contact: { name: 'Test User', email: 'test@example.com' },
          summary: 'Test summary',
          experience: [],
          education: [],
          skills: { technical: [], soft: [], languages: [], tools: [] },
          projects: [],
        },
      }),
    );

    console.error = origError;

    // Should be 500 (LLM call fails because no API key), NOT 400 (body was valid).
    check('valid body proceeds to LLM (returns 500 because no API key)', res.status === 500);
    const body = (await readJson(res)) as { error?: string };
    check('error mentions AI', typeof body.error === 'string' && /AI/.test(body.error));
  }

  // ---------------------------------------------------------------------------
  console.log(`\n${failed === 0 ? '[PASS]' : '[FAIL]'} ${failed} failure(s)`);
  process.exit(failed === 0 ? 0 : 1);
}

main();

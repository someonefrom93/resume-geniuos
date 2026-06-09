/**
 * Job description persistence.
 *
 * The JD lives separately from the resume in localStorage so we can
 * change its format, key, or storage backend without bumping the
 * resume schema version. It's also small (max 20k chars enforced by
 * the scoring API), so it doesn't bloat the resume payload.
 *
 * SSR-safe: no-op on the server.
 */

const JOB_DESCRIPTION_KEY = 'resume-scorer:job-description:v1';
export { JOB_DESCRIPTION_KEY };
const MAX_JD_LENGTH = 20_000;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadJobDescription(): string {
  if (!isBrowser()) return '';
  try {
    const raw = window.localStorage.getItem(JOB_DESCRIPTION_KEY);
    return raw ?? '';
  } catch {
    return '';
  }
}

export function saveJobDescription(jd: string): void {
  if (!isBrowser()) return;
  const trimmed = jd.trim();
  if (!trimmed) {
    try {
      window.localStorage.removeItem(JOB_DESCRIPTION_KEY);
    } catch {
      // ignore
    }
    return;
  }
  // Truncate to MAX_JD_LENGTH to be safe. The API will reject longer anyway.
  const clamped = jd.length > MAX_JD_LENGTH ? jd.slice(0, MAX_JD_LENGTH) : jd;
  try {
    window.localStorage.setItem(JOB_DESCRIPTION_KEY, clamped);
  } catch (err) {
    // Quota exceeded or private-mode restriction. Silently degrade — the JD
    // is optional, losing it is annoying but not fatal.
    console.warn('[storage] Failed to save job description.', err);
  }
}

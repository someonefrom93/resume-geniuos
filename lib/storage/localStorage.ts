/**
 * Versioned localStorage persistence for the resume.
 *
 * Why versioned? If we change the schema later (new fields, renamed fields),
 * old data in the user's localStorage will be invalid. We use the `version`
 * field on the Resume object to detect this and either migrate or reset.
 *
 * SSR safety: localStorage is browser-only. All functions in this module
 * no-op gracefully on the server (return null for reads, do nothing for
 * writes) so the Zustand store can call them during hydration without
 * crashing.
 */

import { createEmptyResume, type Resume } from '@/types/resume';
import type { ScoreResult } from '@/types/resume';

const STORAGE_KEYS = {
  resume: 'resume-scorer:resume:v1',
  lastScore: 'resume-scorer:last-score:v1',
} as const;

const CURRENT_RESUME_VERSION = 1;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/**
 * Read the persisted resume. Returns null if:
 * - We're on the server
 * - Nothing is stored
 * - The stored JSON is corrupt
 *
 * If the stored version doesn't match the current version, we log a warning
 * and return a fresh empty resume. (Migration logic would go here when we
 * bump the version — for now, just reset.)
 */
export function loadResume(): Resume | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.resume);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<Resume> & { version?: number };

    if (typeof parsed.version !== 'number') {
      console.warn('[storage] Resume has no version field, ignoring.');
      return null;
    }

    if (parsed.version !== CURRENT_RESUME_VERSION) {
      console.warn(
        `[storage] Resume version mismatch: stored=${parsed.version}, current=${CURRENT_RESUME_VERSION}. Resetting.`,
      );
      // Future: dispatch to a migrate(parsed) function here.
      return null;
    }

    return parsed as Resume;
  } catch (err) {
    console.error('[storage] Failed to parse stored resume, ignoring.', err);
    return null;
  }
}

/**
 * Persist the resume. No-op on the server.
 */
export function saveResume(resume: Resume): void {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(STORAGE_KEYS.resume, JSON.stringify(resume));
  } catch (err) {
    // QuotaExceededError, private-mode restrictions, etc.
    console.error('[storage] Failed to save resume.', err);
  }
}

/**
 * Clear the persisted resume. No-op on the server.
 */
export function clearResume(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEYS.resume);
}

// ---------------------------------------------------------------------------
// Last score (separate key, same versioning idea)
// ---------------------------------------------------------------------------

export function loadLastScore(): ScoreResult | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.lastScore);
    if (!raw) return null;
    return JSON.parse(raw) as ScoreResult;
  } catch (err) {
    console.error('[storage] Failed to parse last score, ignoring.', err);
    return null;
  }
}

export function saveLastScore(score: ScoreResult): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.lastScore, JSON.stringify(score));
  } catch (err) {
    console.error('[storage] Failed to save last score.', err);
  }
}

// ---------------------------------------------------------------------------
// Dev helpers (not used in app code, exposed for debugging in the console)
// ---------------------------------------------------------------------------

export const __storageKeys = STORAGE_KEYS;

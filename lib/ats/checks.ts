/**
 * Deterministic ATS compatibility checks.
 *
 * These run with zero AI. They check for structural and content features
 * that real ATS systems (Workday, Greenhouse, Lever, iCIMS) look for when
 * parsing a resume. Each check is worth a fixed number of points; the
 * total is out of 100.
 *
 * The checks are not "is this a good resume" — they are "will an ATS
 * successfully parse this and find the basics." A high ATS score with
 * bad content is still a bad resume; that's what the LLM content score
 * (Phase 4) is for.
 */

import type { Resume } from '@/types/resume';

export interface AtsCheck {
  /** Stable identifier, used for the UI to show "this passed, this didn't". */
  id: string;
  /** Short label for the UI. */
  label: string;
  /** Did the check pass? */
  passed: boolean;
  /** Points awarded for this check. */
  points: number;
  /** Points actually earned (0 or points). */
  earned: number;
  /** Optional 1-sentence explanation. */
  detail?: string;
}

export interface AtsResult {
  /** Total score 0-100. */
  score: number;
  /** Individual checks, in display order. */
  checks: AtsCheck[];
}

// ---------------------------------------------------------------------------
// Weights (must sum to 100)
// ---------------------------------------------------------------------------

const WEIGHTS = {
  hasEmail: 15,
  hasPhone: 10,
  hasLocation: 5,
  hasExperience: 15,
  hasEducation: 10,
  hasSkills: 10,
  hasSummary: 5,
  bulletsReasonableLength: 5,
  bulletsQuantity: 10,
  hasQuantifiedAchievements: 10,
  hasLinkedinOrPortfolio: 5,
} as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function runAtsChecks(resume: Resume): AtsResult {
  const checks: AtsCheck[] = [
    checkHasEmail(resume),
    checkHasPhone(resume),
    checkHasLocation(resume),
    checkHasExperience(resume),
    checkHasEducation(resume),
    checkHasSkills(resume),
    checkHasSummary(resume),
    checkBulletsReasonableLength(resume),
    checkBulletsQuantity(resume),
    checkHasQuantifiedAchievements(resume),
    checkHasLinkedinOrPortfolio(resume),
  ];

  const earned = checks.reduce((sum, c) => sum + c.earned, 0);
  const possible = checks.reduce((sum, c) => sum + c.points, 0);
  // Normalize to 0-100 in case the weights ever change.
  const score = possible > 0 ? Math.round((earned / possible) * 100) : 0;

  return { score, checks };
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkHasEmail(r: Resume): AtsCheck {
  const passed = isMeaningful(r.contact.email) && /@/.test(r.contact.email);
  return {
    id: 'has-email',
    label: 'Email address present',
    passed,
    points: WEIGHTS.hasEmail,
    earned: passed ? WEIGHTS.hasEmail : 0,
    detail: passed ? undefined : 'Add a valid email so recruiters can contact you.',
  };
}

function checkHasPhone(r: Resume): AtsCheck {
  const passed = isMeaningful(r.contact.phone) && hasDigits(r.contact.phone!, 7);
  return {
    id: 'has-phone',
    label: 'Phone number present',
    passed,
    points: WEIGHTS.hasPhone,
    earned: passed ? WEIGHTS.hasPhone : 0,
    detail: passed ? undefined : 'Add a phone number with at least 7 digits.',
  };
}

function checkHasLocation(r: Resume): AtsCheck {
  const passed = isMeaningful(r.contact.location);
  return {
    id: 'has-location',
    label: 'Location present',
    passed,
    points: WEIGHTS.hasLocation,
    earned: passed ? WEIGHTS.hasLocation : 0,
    detail: passed ? undefined : 'Add city/region so recruiters know your location.',
  };
}

function checkHasExperience(r: Resume): AtsCheck {
  const valid = r.experience.filter(
    (e) => isMeaningful(e.company) && isMeaningful(e.position) && isMeaningful(e.startDate),
  );
  const passed = valid.length >= 1;
  return {
    id: 'has-experience',
    label: 'At least one experience entry with dates',
    passed,
    points: WEIGHTS.hasExperience,
    earned: passed ? WEIGHTS.hasExperience : 0,
  };
}

function checkHasEducation(r: Resume): AtsCheck {
  const valid = r.education.filter(
    (e) => isMeaningful(e.institution) && isMeaningful(e.degree),
  );
  const passed = valid.length >= 1;
  return {
    id: 'has-education',
    label: 'At least one education entry',
    passed,
    points: WEIGHTS.hasEducation,
    earned: passed ? WEIGHTS.hasEducation : 0,
  };
}

function checkHasSkills(r: Resume): AtsCheck {
  const total = countSkills(r.skills);
  const passed = total >= 3;
  return {
    id: 'has-skills',
    label: 'Skills section with at least 3 entries',
    passed,
    points: WEIGHTS.hasSkills,
    earned: passed ? WEIGHTS.hasSkills : 0,
    detail: passed
      ? `${total} skills listed.`
      : 'List at least 3 skills relevant to your target role.',
  };
}

function checkHasSummary(r: Resume): AtsCheck {
  const passed = isMeaningful(r.summary) && r.summary.length >= 40;
  return {
    id: 'has-summary',
    label: 'Professional summary (2+ sentences)',
    passed,
    points: WEIGHTS.hasSummary,
    earned: passed ? WEIGHTS.hasSummary : 0,
    detail: passed ? undefined : 'A 2-3 sentence summary helps recruiters scan quickly.',
  };
}

function checkBulletsReasonableLength(r: Resume): AtsCheck {
  // A "reasonable" bullet is between 20 and 240 characters.
  // Below 20: too vague. Above 240: probably two ideas smushed together.
  const allBullets = r.experience.flatMap((e) => e.bullets).filter(isMeaningful);
  if (allBullets.length === 0) {
    return {
      id: 'bullets-length',
      label: 'Bullet points are a reasonable length',
      passed: false,
      points: WEIGHTS.bulletsReasonableLength,
      earned: 0,
    };
  }
  const reasonable = allBullets.filter((b) => b.length >= 20 && b.length <= 240);
  const ratio = reasonable.length / allBullets.length;
  const passed = ratio >= 0.8;
  return {
    id: 'bullets-length',
    label: 'Bullet points are a reasonable length',
    passed,
    points: WEIGHTS.bulletsReasonableLength,
    earned: passed ? WEIGHTS.bulletsReasonableLength : 0,
    detail: passed
      ? `${Math.round(ratio * 100)}% of bullets are 20-240 characters.`
      : 'Aim for bullets between 20 and 240 characters.',
  };
}

function checkBulletsQuantity(r: Resume): AtsCheck {
  const counts = r.experience
    .filter((e) => isMeaningful(e.company) && isMeaningful(e.position))
    .map((e) => e.bullets.filter(isMeaningful).length);
  const goodJobs = counts.filter((c) => c >= 3).length;
  const passed = counts.length > 0 && goodJobs / counts.length >= 0.7;
  return {
    id: 'bullets-quantity',
    label: 'Most experience entries have 3+ bullet points',
    passed,
    points: WEIGHTS.bulletsQuantity,
    earned: passed ? WEIGHTS.bulletsQuantity : 0,
  };
}

function checkHasQuantifiedAchievements(r: Resume): AtsCheck {
  // A quantified achievement contains at least one digit, OR a "%" sign,
  // OR a $ sign. The heuristic is intentionally simple.
  const allBullets = r.experience.flatMap((e) => e.bullets).filter(isMeaningful);
  const quantified = allBullets.filter(
    (b) => /\d/.test(b) || b.includes('%') || b.includes('$'),
  );
  const passed = quantified.length >= 2;
  return {
    id: 'has-quantified',
    label: 'At least 2 bullets include numbers/metrics',
    passed,
    points: WEIGHTS.hasQuantifiedAchievements,
    earned: passed ? WEIGHTS.hasQuantifiedAchievements : 0,
    detail: passed
      ? `${quantified.length} bullets include metrics.`
      : 'Add numbers (%, $, time saved, users served) to at least 2 bullets.',
  };
}

function checkHasLinkedinOrPortfolio(r: Resume): AtsCheck {
  const passed =
    isMeaningful(r.contact.linkedin) || isMeaningful(r.contact.portfolio);
  return {
    id: 'has-linkedin-or-portfolio',
    label: 'LinkedIn or portfolio link',
    passed,
    points: WEIGHTS.hasLinkedinOrPortfolio,
    earned: passed ? WEIGHTS.hasLinkedinOrPortfolio : 0,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isMeaningful(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasDigits(s: string, min: number): boolean {
  const digits = s.replace(/\D/g, '');
  return digits.length >= min;
}

function countSkills(s: Resume['skills']): number {
  return s.technical.length + s.soft.length + s.languages.length + s.tools.length;
}

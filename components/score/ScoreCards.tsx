'use client';

import type { ScoreResult } from '@/types/resume';

interface ScoreCardsProps {
  result: ScoreResult;
  hasJobDescription: boolean;
}

/**
 * Visual display of the three sub-scores (ATS, content, job match)
 * and the holistic score. The holistic is the headline; the
 * sub-scores give the user a sense of where the points came from.
 */
export function ScoreCards({ result, hasJobDescription }: ScoreCardsProps) {
  return (
    <div className="space-y-4">
      <HolisticCard score={result.holistic} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SubScore
          label="ATS"
          value={result.ats}
          hint="Structural checks: contact info, section presence, bullet quality."
          source="Deterministic"
        />
        <SubScore
          label="Content"
          value={result.content}
          hint="Bullet quality, action verbs, quantification, clarity."
          source="AI"
        />
        {hasJobDescription ? (
          <SubScore
            label="Job match"
            value={result.jobMatch ?? 0}
            hint="How well your experience aligns with the target role."
            source="AI"
          />
        ) : (
          <SubScore
            label="Job match"
            value={null}
            hint="Add a job description to see how well your resume matches a specific role."
            source="Not scored"
            muted
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Holistic
// ---------------------------------------------------------------------------

function HolisticCard({ score }: { score: number }) {
  const tier = scoreTier(score);
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 flex items-center gap-6">
      <ScoreRing score={score} />
      <div className="flex-1 min-w-0">
        <p className="text-xs uppercase tracking-wide text-zinc-500">Holistic score</p>
        <p className="text-2xl font-semibold mt-0.5">{tier.label}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          {tier.description}
        </p>
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - score / 100);
  const tier = scoreTier(score);
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 90 90" className="h-full w-full -rotate-90">
        <circle
          cx="45"
          cy="45"
          r={r}
          stroke="currentColor"
          strokeWidth="6"
          fill="none"
          className="text-zinc-200 dark:text-zinc-800"
        />
        <circle
          cx="45"
          cy="45"
          r={r}
          stroke="currentColor"
          strokeWidth="6"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={tier.ringColor}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums">{score}</span>
        <span className="text-[10px] text-zinc-500 -mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-score
// ---------------------------------------------------------------------------

function SubScore({
  label,
  value,
  hint,
  source,
  muted = false,
}: {
  label: string;
  value: number | null;
  hint: string;
  source: 'Deterministic' | 'AI' | 'Not scored';
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${
        muted
          ? 'border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50'
          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950'
      }`}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{label}</p>
        <p className="text-[10px] uppercase tracking-wide text-zinc-400">{source}</p>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {value === null ? '—' : value}
      </p>
      <p className="mt-1 text-[11px] text-zinc-500 leading-snug">{hint}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score tiering
// ---------------------------------------------------------------------------

interface ScoreTier {
  label: string;
  description: string;
  ringColor: string;
}

function scoreTier(score: number): ScoreTier {
  if (score >= 85) {
    return {
      label: 'Strong resume',
      description: 'You\'re likely to pass ATS filters and impress recruiters. Minor polish only.',
      ringColor: 'text-emerald-600 dark:text-emerald-400',
    };
  }
  if (score >= 70) {
    return {
      label: 'Solid, with room to sharpen',
      description: 'Good foundation. A few targeted improvements below will move the needle.',
      ringColor: 'text-sky-600 dark:text-sky-400',
    };
  }
  if (score >= 50) {
    return {
      label: 'Needs work',
      description: 'Recruiters will likely skim past this. The improvements below are worth the effort.',
      ringColor: 'text-amber-600 dark:text-amber-400',
    };
  }
  return {
    label: 'Significant rework needed',
    description: 'This resume isn\'t landing. Focus on the high-priority improvements below first.',
    ringColor: 'text-red-600 dark:text-red-400',
  };
}

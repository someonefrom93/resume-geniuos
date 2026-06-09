'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UploadAndReview } from '@/components/upload/UploadAndReview';
import { ScoreCards } from '@/components/score/ScoreCards';
import { ImprovementList } from '@/components/score/ImprovementList';
import { useResumeStore } from '@/store/resumeStore';
import { loadJobDescription, saveJobDescription } from '@/lib/storage/jobDescription';
import type { ScoreResult } from '@/types/resume';

type Phase = 'loading' | 'no-resume' | 'ready-to-score' | 'scoring' | 'scored' | 'error';

/**
 * /score — the resume scoring page.
 *
 * Three top-level states:
 *   1. No resume yet → show the upload + review flow.
 *   2. Resume in store, not scored → show the job-description textarea
 *      and a "Score my resume" button.
 *   3. Scored → show the ScoreCards + ImprovementList + re-score / edit actions.
 *
 * "Hydration" matters: the page is client-rendered and the store
 * hydrates from localStorage on mount. We briefly show a "Loading..."
 * state until that finishes, otherwise we'd briefly show "No resume yet"
 * even when one exists.
 */
export default function ScorePage() {
  const router = useRouter();
  const resume = useResumeStore((s) => s.resume);
  const isHydrated = useResumeStore((s) => s.isHydrated);
  const lastScore = useResumeStore((s) => s.lastScore);
  const setLastScore = useResumeStore((s) => s.setLastScore);
  const clearLastScore = useResumeStore((s) => s.clearLastScore);

  const [phase, setPhase] = useState<Phase>('loading');
  const [jobDescription, setJobDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<ScoreResult | null>(lastScore);

  // Initial hydration: read the JD from localStorage, decide the phase.
  useEffect(() => {
    if (!isHydrated) return;
    setJobDescription(loadJobDescription());
    if (hasAnyContent(resume)) {
      setPhase(lastScore ? 'scored' : 'ready-to-score');
    } else {
      setPhase('no-resume');
    }
    // Intentionally excluding `resume` and `lastScore` from deps:
    // we only want this to run once on hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]);

  const runScore = useCallback(async () => {
    setPhase('scoring');
    setError(null);
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume,
          jobDescription: jobDescription.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const result = (await res.json()) as ScoreResult;
      setScore(result);
      setLastScore(result);
      setPhase('scored');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Scoring failed.';
      setError(message);
      setPhase('ready-to-score');
    }
  }, [resume, jobDescription, setLastScore]);

  const onRescore = () => {
    clearLastScore();
    setScore(null);
    setPhase('ready-to-score');
  };

  /**
   * User wants to start fresh with a different uploaded resume. Wipe
   * the in-memory store, the persisted score, and the JD, then drop
   * back into the upload flow. This is the only way to get back to
   * "no-resume" state once a resume is loaded.
   */
  const onReplaceResume = () => {
    useResumeStore.getState().resetResume();
    clearLastScore();
    saveJobDescription('');
    setJobDescription('');
    setScore(null);
    setError(null);
    setPhase('no-resume');
  };

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Score your resume</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {phase === 'no-resume'
              ? 'Upload a PDF or DOCX to get started.'
              : 'Score against ATS rules, content quality, and your target job.'}
          </p>
        </header>

        {/* Privacy disclosure — always visible so users know what we're doing with their data. */}
        <PrivacyNote />

        {phase === 'loading' && <p className="text-sm text-zinc-500">Loading…</p>}

        {phase === 'no-resume' && <UploadAndReview />}

        {(phase === 'ready-to-score' || phase === 'scoring') && (
          <ReadyToScore
            jobDescription={jobDescription}
            setJobDescription={(v) => {
              setJobDescription(v);
              saveJobDescription(v);
            }}
            isLoading={phase === 'scoring'}
            error={error}
            onScore={runScore}
            onEdit={() => router.push('/builder')}
            onReplace={onReplaceResume}
          />
        )}

        {phase === 'scored' && score && (
          <ScoredView
            score={score}
            hasJobDescription={jobDescription.trim().length > 0}
            onRescore={onRescore}
            onEdit={() => router.push('/builder')}
            onReplace={onReplaceResume}
          />
        )}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Current resume banner
// ---------------------------------------------------------------------------

/**
 * Shown when a resume is loaded. Tells the user WHICH resume will be
 * scored (so they're not confused if they have an old one in storage)
 * and gives them two ways out: edit it, or upload a different one.
 *
 * Why a banner and not just buttons in the corners: visibility. The
 * user should never wonder "wait, what resume is this scoring?".
 */
function CurrentResumeBanner({
  onEdit,
  onReplace,
}: {
  onEdit: () => void;
  onReplace: () => void;
}) {
  const resume = useResumeStore((s) => s.resume);
  const { name, email } = resume.contact;

  const displayName = name.trim() || 'Untitled resume';
  const subline = email.trim() || 'No email on file';

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-zinc-500">
          Scoring this resume
        </p>
        <p className="text-sm font-medium truncate">
          {displayName}{' '}
          <span className="text-zinc-500 font-normal">· {subline}</span>
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 underline"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onReplace}
          className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 underline"
        >
          Upload a different file
        </button>
      </div>
    </div>
  );
}

function PrivacyNote() {
  return (
    <details className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400 group">
      <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-300 list-none flex items-center gap-1.5">
        <span className="text-zinc-400 group-open:rotate-90 transition-transform">›</span>
        What we send to the AI
      </summary>
      <p className="mt-2 leading-relaxed">
        When you click <span className="font-medium">Score my resume</span>, your
        resume text and (if provided) the job description are sent to
        DeepSeek&apos;s API for evaluation. We do not store the resume text or
        the AI response on our servers. Your resume data lives only in your
        browser&apos;s localStorage.
      </p>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Ready-to-score: JD + Score button
// ---------------------------------------------------------------------------

function ReadyToScore({
  jobDescription,
  setJobDescription,
  isLoading,
  error,
  onScore,
  onEdit,
  onReplace,
}: {
  jobDescription: string;
  setJobDescription: (v: string) => void;
  isLoading: boolean;
  error: string | null;
  onScore: () => void;
  onEdit: () => void;
  onReplace: () => void;
}) {
  return (
    <div className="space-y-6">
      <CurrentResumeBanner onEdit={onEdit} onReplace={onReplace} />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">
          Job description{' '}
          <span className="text-zinc-500 text-sm font-normal">(optional)</span>
        </h2>
        <p className="text-xs text-zinc-500">
          Add a job description to also get a job-match score. Skip for general
          content feedback.
        </p>
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          rows={6}
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          placeholder="Paste the job description here…"
          disabled={isLoading}
        />
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 px-4 py-3 text-sm text-red-800 dark:text-red-200"
        >
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={onEdit}
          disabled={isLoading}
          className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Edit resume in builder
        </button>
        <button
          type="button"
          onClick={onScore}
          disabled={isLoading}
          className="rounded-md bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Scoring…' : 'Score my resume →'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scored: results + actions
// ---------------------------------------------------------------------------

function ScoredView({
  score,
  hasJobDescription,
  onRescore,
  onEdit,
  onReplace,
}: {
  score: ScoreResult;
  hasJobDescription: boolean;
  onRescore: () => void;
  onEdit: () => void;
  onReplace: () => void;
}) {
  return (
    <div className="space-y-8">
      <CurrentResumeBanner onEdit={onEdit} onReplace={onReplace} />

      <ScoreCards result={score} hasJobDescription={hasJobDescription} />

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">How to improve</h2>
          <p className="text-xs text-zinc-500">
            {score.improvements.length === 0
              ? 'No suggestions'
              : `${score.improvements.length} suggestion${score.improvements.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <ImprovementList improvements={score.improvements} />
      </section>

      <div className="flex items-center justify-between gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <p className="text-xs text-zinc-500">
          Scored {new Date(score.generatedAt).toLocaleString()}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRescore}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            Re-score
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 px-3 py-1.5 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
          >
            Edit resume →
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasAnyContent(resume: ReturnType<typeof useResumeStore.getState>['resume']): boolean {
  const c = resume.contact;
  if (c.name.trim() || c.email.trim()) return true;
  if (resume.summary.trim()) return true;
  if (
    resume.experience.some(
      (e) => e.company.trim() || e.position.trim() || e.bullets.some((b) => b.trim()),
    )
  ) {
    return true;
  }
  if (resume.education.some((e) => e.institution.trim() || e.degree.trim())) return true;
  if (resume.projects.some((p) => p.name.trim() || p.description.trim())) return true;
  if (
    resume.skills.technical.length +
      resume.skills.tools.length +
      resume.skills.languages.length +
      resume.skills.soft.length >
    0
  ) {
    return true;
  }
  return false;
}

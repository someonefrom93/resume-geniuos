'use client';

import type { Improvement, ImprovementPriority, ResumeSection } from '@/types/resume';

interface ImprovementListProps {
  improvements: Improvement[];
}

/**
 * Renders the actionable improvements list. Each item shows:
 *   - priority (high/medium/low) as a colored chip
 *   - which section it applies to
 *   - the issue (what's wrong)
 *   - the suggestion (how to fix it)
 *   - an optional example (a concrete rewrite)
 *
 * Ordered by priority (high first) — the LLM sorts them.
 */
export function ImprovementList({ improvements }: ImprovementListProps) {
  if (improvements.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-6 text-center">
        <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
          Nothing flagged. Your resume is in good shape.
        </p>
        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
          Re-score after edits to keep the score fresh.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {improvements.map((imp, i) => (
        <li key={i}>
          <ImprovementItem imp={imp} />
        </li>
      ))}
    </ul>
  );
}

function ImprovementItem({ imp }: { imp: Improvement }) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <PriorityChip priority={imp.priority} />
        <SectionBadge section={imp.section} />
      </div>
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {imp.issue}
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
        {imp.suggestion}
      </p>
      {imp.example && (
        <div className="mt-2 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-0.5">
            Example
          </p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
            {imp.example}
          </p>
        </div>
      )}
    </div>
  );
}

const PRIORITY_STYLES: Record<ImprovementPriority, { label: string; className: string }> = {
  high: {
    label: 'High',
    className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  },
  medium: {
    label: 'Medium',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  },
  low: {
    label: 'Low',
    className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  },
};

function PriorityChip({ priority }: { priority: ImprovementPriority }) {
  const s = PRIORITY_STYLES[priority];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.className}`}>
      {s.label}
    </span>
  );
}

const SECTION_LABELS: Record<ResumeSection, string> = {
  header: 'Header',
  summary: 'Summary',
  experience: 'Experience',
  skills: 'Skills',
  education: 'Education',
  projects: 'Projects',
  general: 'General',
};

function SectionBadge({ section }: { section: ResumeSection }) {
  return (
    <span className="inline-flex items-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
      {SECTION_LABELS[section]}
    </span>
  );
}

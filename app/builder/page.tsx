'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useResumeStore } from '@/store/resumeStore';
import { ResumePreview } from '@/components/builder/ResumePreview';
import { HeaderSection } from '@/components/builder/sections/HeaderSection';
import { SummarySection } from '@/components/builder/sections/SummarySection';
import { ExperienceSection } from '@/components/builder/sections/ExperienceSection';
import { EducationSection } from '@/components/builder/sections/EducationSection';
import { SkillsSection } from '@/components/builder/sections/SkillsSection';
import { ProjectsSection } from '@/components/builder/sections/ProjectsSection';
import type { Resume } from '@/types/resume';

type MobileView = 'edit' | 'preview';

/**
 * Lazy-load the PDF export button. @react-pdf/renderer bundles Node-y
 * internals (Buffer, fs, etc.) that break Next.js's static rendering.
 * By loading it client-only via next/dynamic with ssr:false, the
 * rest of the builder remains server-renderable.
 */
const ExportPdfButton = dynamic(
  () => import('@/components/builder/ExportPdfButton').then((m) => m.ExportPdfButton),
  { ssr: false, loading: () => <ExportPdfPlaceholder /> },
);

function ExportPdfPlaceholder() {
  // Visual placeholder so the layout doesn't shift when the button loads.
  return (
    <div className="rounded-md bg-zinc-200 dark:bg-zinc-800 px-3 py-1.5 text-sm font-medium text-transparent select-none">
      Export PDF
    </div>
  );
}

/**
 * /builder — the main editor page.
 *
 * Layout:
 *   - Desktop (>= lg): two columns, form on the left, sticky preview on the right.
 *   - Mobile (< lg): a tab switcher at the top toggles between "Edit" and "Preview".
 *
 * Why client component: we read from the Zustand store, which uses React state
 * and is browser-only.
 *
 * The preview and the form both read from the same store, so any edit updates
 * the preview instantly. The preview is NOT scaled to fit the viewport — we
 * render it at the actual page size and let it overflow. In Phase 5 we will
 * replace this visual approximation with a real PDF iframe (still driven by the
 * same store) so what you see is what you get at export time.
 */
export default function BuilderPage() {
  const resume = useResumeStore((s) => s.resume);
  const isHydrated = useResumeStore((s) => s.isHydrated);
  const resetResume = useResumeStore((s) => s.resetResume);
  const [mobileView, setMobileView] = useState<MobileView>('edit');

  return (
    <div className="min-h-screen flex flex-col">
      <BuilderTopBar
        onReset={resetResume}
        resume={resume}
        resumeName={resume.contact.name}
      />

      {/* Mobile tab switcher. Hidden on lg+ where we use the two-column layout. */}
      <div className="lg:hidden border-b border-zinc-200 dark:border-zinc-800 sticky top-[57px] bg-white/80 dark:bg-zinc-950/80 backdrop-blur z-10">
        <div className="flex" role="tablist">
          <button
            role="tab"
            aria-selected={mobileView === 'edit'}
            onClick={() => setMobileView('edit')}
            className={`flex-1 py-2.5 text-sm font-medium border-b-2 ${
              mobileView === 'edit'
                ? 'border-zinc-900 dark:border-zinc-100'
                : 'border-transparent text-zinc-500'
            }`}
          >
            Edit
          </button>
          <button
            role="tab"
            aria-selected={mobileView === 'preview'}
            onClick={() => setMobileView('preview')}
            className={`flex-1 py-2.5 text-sm font-medium border-b-2 ${
              mobileView === 'preview'
                ? 'border-zinc-900 dark:border-zinc-100'
                : 'border-transparent text-zinc-500'
            }`}
          >
            Preview
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,720px)]">
        {/* Form column. Hidden on mobile when preview is active. */}
        <div
          className={`p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:overflow-y-auto lg:max-h-[calc(100vh-57px)] ${
            mobileView === 'preview' ? 'hidden lg:block' : ''
          }`}
        >
          {!isHydrated && (
            <p className="text-sm text-zinc-500">Loading your saved resume…</p>
          )}
          <HeaderSection />
          <SummarySection />
          <ExperienceSection />
          <ProjectsSection />
          <SkillsSection />
          <EducationSection />
          <p className="text-xs text-zinc-500 text-center pt-4">
            Auto-saved to your browser. No account needed.
          </p>
        </div>

        {/* Preview column. Hidden on mobile when edit is active. Sticky on desktop. */}
        <div
          className={`bg-zinc-100 dark:bg-zinc-900 p-4 sm:p-6 lg:p-8 lg:overflow-y-auto lg:max-h-[calc(100vh-57px)] ${
            mobileView === 'edit' ? 'hidden lg:block' : ''
          }`}
        >
          <ResumePreview resume={resume} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

function BuilderTopBar({
  onReset,
  resume,
  resumeName,
}: {
  onReset: () => void;
  resume: Resume;
  resumeName: string;
}) {
  return (
    <header className="h-[57px] border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 sm:px-6 sticky top-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur z-20">
      <div className="flex items-center gap-3">
        <a
          href="/"
          className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Home
        </a>
        <span className="text-zinc-300 dark:text-zinc-700">/</span>
        <h1 className="text-sm font-medium">
          {resumeName ? `Editing: ${resumeName}` : 'New resume'}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/score"
          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          View score
        </Link>
        <ExportPdfButton resume={resume} />
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Reset all fields? This cannot be undone.')) {
              onReset();
            }
          }}
          className="text-xs text-zinc-500 hover:text-red-600"
        >
          Reset
        </button>
      </div>
    </header>
  );
}

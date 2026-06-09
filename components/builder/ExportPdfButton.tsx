'use client';

import { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { ResumePdf } from '@/lib/pdf/ResumePdf';
import type { Resume } from '@/types/resume';

interface ExportPdfButtonProps {
  resume: Resume;
}

/**
 * "Export PDF" button. Generates a PDF from the resume data and triggers
 * a browser download.
 *
 * Why this is a separate file:
 *   `@react-pdf/renderer` bundles Node-y internals (Buffer, fs, etc.)
 *   that break Next.js's static rendering. By isolating the import
 *   here and lazy-loading this component via `next/dynamic` with
 *   `ssr: false`, we keep the rest of the app server-renderable.
 *
 * Loading state: while the PDF is generating, we show "Exporting…" and
 * disable the button. For a typical resume this is 1-2 seconds.
 *
 * Filename: derived from the contact name. Sanitized (lowercased,
 * non-alphanumerics replaced with hyphens) and falls back to "resume"
 * if the name is empty.
 */
export function ExportPdfButton({ resume }: ExportPdfButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const blob = await pdf(<ResumePdf resume={resume} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = makeFilename(resume.contact.name);
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Free the blob URL after a short delay so the download has time
      // to start.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('[export-pdf] generation failed:', err);
      setError(err instanceof Error ? err.message : 'PDF generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleExport}
        disabled={isGenerating}
        className="rounded-md bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 px-3 py-1.5 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGenerating ? 'Exporting…' : 'Export PDF'}
      </button>
      {error && (
        <p className="text-[11px] text-red-600 dark:text-red-400 max-w-[200px] text-right">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Build a filename from the contact name.
 *
 *   "Juan Diego Angeles Hernandez" → "juan-diego-angeles-hernandez-resume.pdf"
 *   "" → "resume.pdf"
 *
 * We lowercase, replace whitespace with hyphens, strip everything that
 * isn't a letter/digit/hyphen, and collapse multiple hyphens.
 */
export function makeFilename(name: string | undefined | null): string {
  const base = (name ?? '').trim().toLowerCase();
  if (!base) return 'resume.pdf';
  const slug = base
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'resume'}-resume.pdf`;
}

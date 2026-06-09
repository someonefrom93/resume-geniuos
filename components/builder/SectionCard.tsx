'use client';

import type { ReactNode } from 'react';

/**
 * Card wrapper for a section in the editor form. Title, optional helper
 * text, and children. Visually distinct from the preview pane so the
 * user can tell at a glance which side is the form.
 */
export function SectionCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-6 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

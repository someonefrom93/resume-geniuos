'use client';

import { useState, type KeyboardEvent } from 'react';

interface TagInputProps {
  label: string;
  placeholder?: string;
  values: string[];
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
  /** Optional hint shown below the input. */
  hint?: string;
}

/**
 * Tag-style input: type a value, press Enter or comma to add. Values
 * render as chips with a remove button. Used for skills, languages, etc.
 *
 * Empty input is silently ignored. Duplicate values are not added
 * (the store dedupes; we just don't bother trying).
 */
export function TagInput({ label, placeholder, values, onAdd, onRemove, hint }: TagInputProps) {
  const [draft, setDraft] = useState('');

  const commit = (raw: string) => {
    const value = raw.trim().replace(/,$/, '').trim();
    if (value) onAdd(value);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      // Convenience: empty backspace removes the last tag.
      onRemove(values.length - 1);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
      <div className="flex flex-wrap gap-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 focus-within:ring-2 focus-within:ring-zinc-900 dark:focus-within:ring-zinc-100">
        {values.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="inline-flex items-center gap-1 rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs"
          >
            {v}
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label={`Remove ${v}`}
              className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => commit(draft)}
          placeholder={values.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-zinc-400"
        />
      </div>
      {hint && <p className="text-[11px] text-zinc-500">{hint}</p>}
    </div>
  );
}

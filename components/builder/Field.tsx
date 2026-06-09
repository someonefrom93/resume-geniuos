'use client';

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const BASE_INPUT =
  'rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string;
  required?: boolean;
  containerClassName?: string;
  hint?: string;
}

/**
 * Labeled text input. The label sits above the field, required marker
 * is a red asterisk.
 */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, required, containerClassName = '', hint, ...rest },
  ref,
) {
  return (
    <label className={`flex flex-col gap-1 ${containerClassName}`}>
      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      <input ref={ref} className={BASE_INPUT} required={required} {...rest} />
      {hint && <span className="text-[11px] text-zinc-500">{hint}</span>}
    </label>
  );
});

interface TextareaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  label: string;
  required?: boolean;
  containerClassName?: string;
  hint?: string;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(function TextareaField(
  { label, required, containerClassName = '', hint, ...rest },
  ref,
) {
  return (
    <label className={`flex flex-col gap-1 ${containerClassName}`}>
      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      <textarea ref={ref} className={BASE_INPUT} required={required} {...rest} />
      {hint && <span className="text-[11px] text-zinc-500">{hint}</span>}
    </label>
  );
});

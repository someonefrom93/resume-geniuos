'use client';

import { useCallback, useId, useRef, useState } from 'react';

interface ResumeUploaderProps {
  /** Called with the extracted text after a successful upload + parse. */
  onParsed: (result: { text: string; filename: string; size: number }) => void;
  /** Called when the user picks a file but parsing fails. */
  onError: (message: string) => void;
}

const ACCEPT = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_BYTES = 10 * 1024 * 1024; // matches the API limit

/**
 * Drag-and-drop / click-to-select file uploader.
 *
 * On drop or selection:
 *   1. Validate type and size locally (faster feedback than waiting for the API)
 *   2. POST the file to /api/parse-resume
 *   3. On success, call onParsed with the extracted text
 *   4. On failure, call onError with a user-readable message
 *
 * While the request is in flight we disable the input and show a spinner.
 */
export function ResumeUploader({ onParsed, onError }: ResumeUploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      // Local validation: cheap and avoids a roundtrip for obvious errors.
      const lower = file.name.toLowerCase();
      if (!lower.endsWith('.pdf') && !lower.endsWith('.docx')) {
        onError('Unsupported file type. Please upload a PDF or DOCX.');
        return;
      }
      if (file.size > MAX_BYTES) {
        onError(`File too large. Max ${MAX_BYTES / 1024 / 1024} MB.`);
        return;
      }
      if (file.size === 0) {
        onError('File is empty.');
        return;
      }

      setFilename(file.name);
      setIsLoading(true);

      try {
        const form = new FormData();
        form.append('file', file);

        const res = await fetch('/api/parse-resume', {
          method: 'POST',
          body: form,
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }

        const data = (await res.json()) as { text: string; filename: string; size: number };
        if (!data.text || data.text.trim().length === 0) {
          throw new Error('No text could be extracted. The file may be image-based.');
        }
        onParsed(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Something went wrong parsing the file.';
        onError(message);
        setFilename(null);
      } finally {
        setIsLoading(false);
      }
    },
    [onError, onParsed],
  );

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const onDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <div>
      <label
        htmlFor={inputId}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={[
          'flex flex-col items-center justify-center gap-2',
          'w-full min-h-[180px] px-6 py-8',
          'rounded-lg border-2 border-dashed cursor-pointer',
          'transition-colors',
          isDragging
            ? 'border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-900'
            : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600',
          isLoading ? 'pointer-events-none opacity-60' : '',
        ].join(' ')}
      >
        <div className="text-sm font-medium">
          {isLoading
            ? 'Reading your resume…'
            : isDragging
              ? 'Drop to upload'
              : 'Drag a PDF or DOCX here, or click to select'}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-500">
          {filename ? filename : 'Max 10 MB. Your file is processed server-side and never stored.'}
        </div>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            // Reset so the same file can be re-selected.
            e.target.value = '';
          }}
          disabled={isLoading}
        />
      </label>
    </div>
  );
}

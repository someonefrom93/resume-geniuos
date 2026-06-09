/**
 * POST /api/parse-resume
 *
 * Accepts a multipart/form-data upload with a single `file` field.
 * Returns JSON: { text: string, filename: string, size: number }
 *
 * Supports PDF and DOCX. Anything else returns 415.
 *
 * Server-side only: pdf-parse and mammoth are Node libraries and we don't
 * want to ship them to the client.
 */

import { NextRequest } from 'next/server';
// pdf-parse v1 has a known bug in its index.js: it has a debug block at the
// bottom that tries to read './test/data/05-versions-space.pdf' on first
// require, which crashes when running inside a bundler. We sidestep this by
// importing the inner `lib/pdf-parse.js` directly — the actual implementation
// we need — and skipping the broken entry. v1 disables workers internally
// (PDFJS.disableWorker = true), so there's no worker-bundling concern.
// See https://gitlab.com/autokent/pdf-parse known issues.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';

// File size limit: 10 MB. Resumes are small; this is generous.
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: 'Expected multipart/form-data with a `file` field.' },
      { status: 400 },
    );
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return Response.json(
      { error: 'Missing `file` field in form data.' },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: `File too large. Max ${MAX_BYTES / 1024 / 1024} MB.` },
      { status: 413 },
    );
  }

  if (file.size === 0) {
    return Response.json({ error: 'File is empty.' }, { status: 400 });
  }

  // The filename extension is the source of truth for format. We don't trust
  // the MIME type because browsers lie sometimes and we want to be strict.
  const lowerName = file.name.toLowerCase();
  const isPdf = lowerName.endsWith('.pdf');
  const isDocx = lowerName.endsWith('.docx');

  if (!isPdf && !isDocx) {
    return Response.json(
      { error: 'Unsupported file type. Please upload a PDF or DOCX.' },
      { status: 415 },
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let text: string;
    if (isPdf) {
      text = await extractPdfText(buffer);
    } else {
      text = await extractDocxText(buffer);
    }

    return Response.json({
      text: text.trim(),
      filename: file.name,
      size: file.size,
    });
  } catch (err) {
    console.error('[parse-resume] extraction failed:', err);
    return Response.json(
      {
        error:
          'Could not extract text from this file. The file may be scanned/image-based or corrupted.',
      },
      { status: 422 },
    );
  }
}

// ---------------------------------------------------------------------------
// Extractors
// ---------------------------------------------------------------------------

async function extractPdfText(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  return result.text ?? '';
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

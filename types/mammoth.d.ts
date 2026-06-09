/**
 * Ambient module declarations for packages without bundled types.
 *
 * We only declare the surface we use, not the full library shape.
 */

declare module 'mammoth' {
  export interface ExtractRawTextOptions {
    buffer: Buffer;
  }
  export interface ExtractRawTextResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }
  export function extractRawText(
    options: ExtractRawTextOptions,
  ): Promise<ExtractRawTextResult>;
}

declare module 'pdf-parse' {
  export interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: unknown | null;
    metadata: unknown | null;
    text: string;
    version: string;
  }
  /** Accepts a Buffer, returns a Promise resolving to text + metadata. */
  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;
  export default pdfParse;
}

declare module 'pdf-parse/lib/pdf-parse.js' {
  export interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: unknown | null;
    metadata: unknown | null;
    text: string;
    version: string;
  }
  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;
  export default pdfParse;
}

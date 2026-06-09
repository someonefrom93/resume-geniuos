/**
 * Heuristic parser for raw resume text.
 *
 * What we extract:
 *   - Email, phone, URLs (LinkedIn / GitHub / portfolio) — high confidence
 *   - Name (best guess from the first few lines) — medium confidence
 *   - Section boundaries (where does "Experience" start, etc.) — high confidence
 *   - Individual experience items: position, company, location, dates, bullets
 *   - Individual education items: institution, degree, dates
 *
 * What we deliberately do NOT do:
 *   - Parse skills from free text (50+ different formats; a heuristic
 *     misses more than it catches).
 *   - Parse dates into Date objects — we keep them as the user wrote them.
 *
 * The per-item parsing is BEST-EFFORT. It targets the common pattern:
 *
 *   Position, Company
 *   Location
 *   Start Date to End Date
 *   • bullet
 *   • bullet
 *
 * ...and breaks down the section into discrete items based on detected
 * job headers. If a CV doesn't follow this pattern, the parser will
 * fall back to creating one item per non-bullet block, which the user
 * can correct in the builder. The output is a STARTING POINT, not a
 * finished resume.
 */

import type { ResumeSection } from '@/types/resume';

// ---------------------------------------------------------------------------
// Regexes
// ---------------------------------------------------------------------------

// Standard email pattern. Permissive on purpose; we don't want to miss
// valid addresses that have unusual but legal characters.
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// Phone: matches common international and US formats.
// We look for 7+ digits with optional separators and country code.
const PHONE_RE =
  /(\+?\d{1,3}[\s.-]?)?(\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}([\s.-]?\d{2,4})?/;

// URLs. Must have the `g` flag for matchAll. (Caught in browser testing.)
const URL_RE = /https?:\/\/[^\s)<>"]+/gi;

// Recognized section names. Order matters: we match the first one that fits.
const SECTION_PATTERNS: Array<{ name: ResumeSection; pattern: RegExp }> = [
  { name: 'summary', pattern: /^(professional\s+)?summary|^(profile|objective)$/i },
  { name: 'experience', pattern: /^(work\s+)?experience$|^employment(\s+history)?$|^professional\s+experience$/i },
  { name: 'education', pattern: /^education(al)?(\s+background)?$|^academic(\s+background)?$/i },
  { name: 'skills', pattern: /^skills?$|^technical\s+skills$|^core\s+competencies$|^areas?\s+of\s+expertise$/i },
  { name: 'projects', pattern: /^projects?$|^personal\s+projects$|^selected\s+projects$/i },
];

// Matches a "date range" line. Examples that match:
//   "Jun 2024 to Present"
//   "May 2023 - Jun 2024"
//   "Jan 2013 – Jan 2016"   (en-dash)
//   "2020 - Present"
//   "Oct 2025 to Feb 2026"
// We require at least one of the two halves to look like a date
// (month name OR 4-digit year OR "Present"). This is intentionally
// permissive — false positives in the date detector are OK because
// we'll only USE the line as a date if it ALSO looks date-shaped.
const DATE_RANGE_RE =
  /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\w*\.?\s+\d{2,4}|\d{4}|present|current)\s*[-–—to]+\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\w*\.?\s+\d{2,4}|\d{4}|present|current)/i;

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface ParsedContact {
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  github: string | null;
  portfolio: string | null;
  /** Best-guess full name from the first lines. Null if we couldn't find one. */
  name: string | null;
}

/**
 * One experience entry extracted from the Experience section.
 *
 * Fields may be empty strings if the heuristic couldn't find them;
 * the UI shows empty inputs so the user can fill them in.
 *
 * `bullets` is an array — a job with no detected bullets has [''] so
 * the user has one empty input row to start typing.
 */
export interface ParsedExperienceItem {
  position: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string | null; // null = current/present job
  bullets: string[];
}

/**
 * One education entry extracted from the Education section.
 */
export interface ParsedEducationItem {
  institution: string;
  degree: string;
  startDate: string;
  endDate: string;
}

export interface ParsedSection {
  /** Section name we matched. */
  name: ResumeSection;
  /** 0-based line number where the section header was found. */
  startLine: number;
  /** Section body, with the header line removed. */
  body: string;
  /** Parsed items, present only for experience/education sections. */
  items?: ParsedExperienceItem[] | ParsedEducationItem[];
}

export interface ParsedResume {
  contact: ParsedContact;
  /** Detected sections, in document order. */
  sections: ParsedSection[];
  /** Original text, normalized (CRLF→LF, trailing whitespace stripped). */
  rawText: string;
  /** Total line count, useful for the UI. */
  lineCount: number;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function parseResumeText(text: string): ParsedResume {
  const rawText = text.replace(/\r\n/g, '\n').replace(/ /g, ' ');
  const lines = rawText.split('\n');

  return {
    contact: extractContact(rawText, lines),
    sections: extractSections(lines),
    rawText,
    lineCount: lines.length,
  };
}

// ---------------------------------------------------------------------------
// Contact extraction
// ---------------------------------------------------------------------------

function extractContact(text: string, lines: string[]): ParsedContact {
  const email = firstMatch(text, EMAIL_RE);
  const phone = firstMatch(text, PHONE_RE);

  const urls = Array.from(text.matchAll(URL_RE), (m) => m[0]);
  const { linkedin, github, portfolio } = classifyUrls(urls);

  return {
    email,
    phone,
    linkedin,
    github,
    portfolio,
    name: guessName(lines),
  };
}

function firstMatch(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[0].trim() : null;
}

function classifyUrls(urls: string[]): {
  linkedin: string | null;
  github: string | null;
  portfolio: string | null;
} {
  let linkedin: string | null = null;
  let github: string | null = null;
  const portfolioCandidates: string[] = [];

  for (const raw of urls) {
    const url = raw.replace(/[.,;:!?)]+$/, '');
    const lower = url.toLowerCase();
    if (lower.includes('linkedin.com/in/')) {
      linkedin = url;
    } else if (lower.includes('github.com/')) {
      github = url;
    } else {
      portfolioCandidates.push(url);
    }
  }

  return {
    linkedin,
    github,
    portfolio: portfolioCandidates[0] ?? null,
  };
}

function guessName(lines: string[]): string | null {
  const blacklist = [
    'resume', 'curriculum', 'vitae', 'cv', 'engineer', 'developer',
    'designer', 'manager', 'consultant', 'specialist', 'email',
    'phone', 'address', 'linkedin', 'github', 'portfolio',
  ];

  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.length < 4 || line.length > 60) continue;
    if (/\d/.test(line)) continue;
    if (line.includes('@')) continue;
    if (/[:|·•]/.test(line)) continue;
    const lower = line.toLowerCase();
    if (blacklist.some((word) => lower.includes(word))) continue;

    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 4) continue;
    const allCapitalized = words.every(
      (w) => /^[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü'-]*$/.test(w) || /^[A-Z]+$/.test(w),
    );
    if (!allCapitalized) continue;

    return line;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Section detection
// ---------------------------------------------------------------------------

function extractSections(lines: string[]): ParsedSection[] {
  const sections: ParsedSection[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.length > 60) continue;

    const match = matchSectionHeader(line);
    if (!match) continue;

    const bodyLines: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (matchSectionHeader(lines[j].trim())) break;
      bodyLines.push(lines[j]);
    }

    const section: ParsedSection = {
      name: match,
      startLine: i,
      // We trim END-of-section whitespace but NOT line-internal
      // whitespace, because trailing spaces inside lines are a real
      // signal: they indicate a line wrap (PDF extraction broke a long
      // sentence onto a new line). The per-item parser uses that
      // signal to distinguish job headers from wrap continuations.
      body: bodyLines.join('\n').replace(/^\s+|\s+$/g, ''),
    };

    // Per-item parsing for the structured sections. Skills and
    // projects stay as raw text for now — the heuristic for those
    // is harder to get right and the user fills them in manually.
    if (match === 'experience') {
      section.items = parseExperienceItems(bodyLines);
    } else if (match === 'education') {
      section.items = parseEducationItems(bodyLines);
    }

    sections.push(section);
  }

  return sections;
}

function matchSectionHeader(line: string): ResumeSection | null {
  const cleaned = line.replace(/^[^A-Za-z]+/, '').replace(/[:.]\s*$/, '').trim();
  if (!cleaned) return null;

  for (const { name, pattern } of SECTION_PATTERNS) {
    if (pattern.test(cleaned)) return name;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Per-item parsing
// ---------------------------------------------------------------------------

/**
 * Parse the lines of an Experience section into individual job entries.
 *
 * Strategy:
 *   1. Identify "job header" lines. The strongest signal is a comma
 *      ("Position, Company"). We also accept a few single-position
 *      fallbacks. The header MUST be the start of a new job — i.e., it
 *      must come before the first bullet of that job.
 *   2. Each job header starts a new item.
 *   3. Between job headers, classify lines as: location, date, bullet, or
 *      bullet continuation. Bullet continuations are merged into the
 *      previous bullet.
 *
 * This two-pass structure handles the most common PDF extraction mess:
 * long bullets wrapped to a new line (with the wrap point potentially
 * starting with a capital letter like "AWS Athena" after a bullet
 * that's mid-sentence).
 */
function parseExperienceItems(bodyLines: string[]): ParsedExperienceItem[] {
  // Trim LEADING whitespace only. We do NOT trim trailing whitespace,
  // because a line ending in whitespace is a real signal: PDF extraction
  // broke a long sentence onto a new line, and the original line ends
  // with a space (the wrap point). We use this to distinguish job
  // headers from wrap continuations.
  const lines = bodyLines.map((l) => l.replace(/^\s+/, '')).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  // Pathological case: section is all bullets, no header.
  const nonBulletLines = lines.filter((l) => !isBulletLine(l));
  if (nonBulletLines.length === 0) {
    return [makeItem({ bullets: lines.map(stripBullet) })];
  }

  // Pass 1: find job headers. Two-stage filter:
  //   a) The line must "look like" a job header (comma, or single-position
  //      fallback) and pass the "is not bullet/date/url" check.
  //   b) The line must come BEFORE at least one bullet (so it's the
  //      start of a job, not a location/continuation in the middle of one).
  //      Exception: the very first non-bullet line is always a header,
  //      even if no bullet follows.
  const jobHeaderIndices = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!looksLikeJobHeader(line)) continue;

    // Does this line lead a job? Check: either it's the first non-bullet
    // line, or there's a bullet between here and the previous header.
    const prevHeader = lastIndexOf(jobHeaderIndices, i);
    const nextBullet = findNextBullet(lines, i);
    const hasNextBullet = nextBullet !== -1;

    if (!hasNextBullet && jobHeaderIndices.size > 0) {
      // No bullets after this line and there are already other headers.
      // This is a continuation/stray line, not a header.
      continue;
    }
    if (prevHeader !== -1) {
      // Is there a bullet between prevHeader and i? If yes, i is the
      // start of a new job. If no, i is still part of the prev job.
      const bulletBetween = findNextBullet(lines, prevHeader + 1);
      if (bulletBetween === -1 || bulletBetween >= i) {
        continue; // no bullet between, i is not a new header
      }
    }
    // First non-bullet: always a header (if it looks like one).
    jobHeaderIndices.add(i);
  }

  // Fallback: no job headers found. One item with all bullets.
  if (jobHeaderIndices.size === 0) {
    return [makeItem({ bullets: lines.map(stripBullet) })];
  }

  // Pass 2: build items.
  const items: ParsedExperienceItem[] = [];
  let current = makeItem({});

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (jobHeaderIndices.has(i)) {
      if (hasAnyContent(current)) {
        items.push(finalizeItem(current));
      }
      current = makeItem({});
      const { position, company } = splitPositionCompany(line);
      current.position = position;
      current.company = company;
      continue;
    }

    if (isBulletLine(line)) {
      current.bullets.push(stripBullet(line));
      continue;
    }

    const dateRange = parseDateRange(line);
    if (dateRange && !current.startDate) {
      current.startDate = dateRange.start;
      current.endDate = dateRange.end;
      continue;
    }
    if (dateRange) continue;

    // If we've already seen a bullet for this item, this non-bullet line
    // is most likely a wrapped bullet continuation. Append to last bullet.
    if (hasNonEmptyBullet(current)) {
      const lastIdx = current.bullets.length - 1;
      const last = current.bullets[lastIdx] ?? '';
      current.bullets[lastIdx] = (last ? last + ' ' : '') + line.trim();
      continue;
    }

    // Otherwise: location.
    if (!current.location) {
      current.location = line;
    }
  }

  if (hasAnyContent(current)) {
    items.push(finalizeItem(current));
  }

  return items;
}

/**
 * A line "looks like" a job header if it has a comma (so "Position,
 * Company") and is 10-200 chars. We also accept a few single-position
 * fallbacks (very short, no comma, no period, capitalized).
 *
 * NOT a header: a bullet line, a date, a line with an @ or URL, a line
 * that's clearly a sentence (has both a period AND no comma at the
 * natural break).
 */
function looksLikeJobHeader(line: string): boolean {
  if (line.length < 5 || line.length > 200) return false;
  if (line.includes('•')) return false;
  if (line.includes('@')) return false;
  if (line.toLowerCase().includes('http')) return false;
  if (DATE_RANGE_RE.test(line)) return false;

  // Wrap-continuation guard: PDF extraction that wraps a long bullet
  // often leaves a trailing space at the end of the line. Real job
  // headers are complete thoughts; they don't have trailing whitespace.
  if (line !== line.trimEnd()) return false;

  // Strong signal: has a comma. "Position, Company" or "Position, Department".
  if (line.includes(',')) return true;

  // Weaker signal: single-position line (no comma). Must be short,
  // start with a capital, not end with a period, and look like a
  // title (not a sentence). We use a word-count cap to filter out
  // sentences like "Led the migration of legacy systems."
  if (
    line.length <= 80 &&
    /^[A-Z]/.test(line) &&
    !line.endsWith('.') &&
    line.split(/\s+/).length <= 8
  ) {
    return true;
  }

  return false;
}

/**
 * True if the item has any user-meaningful content (header OR bullets).
 */
function hasAnyContent(item: ParsedExperienceItem): boolean {
  return (
    item.position.trim().length > 0 ||
    item.company.trim().length > 0 ||
    item.location.trim().length > 0 ||
    item.startDate.trim().length > 0 ||
    hasNonEmptyBullet(item)
  );
}

/**
 * Find the largest index in `set` that is < bound.
 * O(n) but the set is always small (one entry per job in the section).
 */
function lastIndexOf(set: Set<number>, bound: number): number {
  let result = -1;
  for (const v of set) {
    if (v < bound && v > result) result = v;
  }
  return result;
}

/**
 * Find the index of the first bullet line at or after `from`.
 * Returns -1 if none.
 */
function findNextBullet(lines: string[], from: number): number {
  for (let i = from; i < lines.length; i++) {
    if (isBulletLine(lines[i]!)) return i;
  }
  return -1;
}

function makeItem(partial: Partial<ParsedExperienceItem>): ParsedExperienceItem {
  return {
    position: partial.position ?? '',
    company: partial.company ?? '',
    location: partial.location ?? '',
    startDate: partial.startDate ?? '',
    endDate: partial.endDate ?? null,
    bullets: partial.bullets ?? [''],
  };
}

/**
 * True if the item has at least one non-empty bullet. We use this
 * (not bullets.length) because `makeItem({})` initializes bullets to
 * [''] as a UI placeholder — and we don't want to treat that placeholder
 * as "this item has content."
 */
function hasNonEmptyBullet(item: ParsedExperienceItem): boolean {
  return item.bullets.some((b) => b.trim().length > 0);
}

/**
 * Heuristic: is this non-bullet line a CONTINUATION of the previous
 * bullet (PDF text extraction broke a long bullet across two lines)?
 *
 * Signals that point to "yes, continuation":
 *   - Starts with a lowercase letter (so it's not a new "Position" or
 *     "Company" header — those almost always start with a capital).
 *   - Doesn't contain a date (those are date lines).
 *   - Is reasonably short (under 200 chars — continuation lines are
 *     almost always part of one wrapped sentence).
 *
 * False-positive risk: a section header that happens to start with a
 * lowercase letter (rare). False-negative risk: a continuation that
 * starts with a proper noun (e.g., "Snowflake"). The 70-80% accuracy
 * target applies here too.
 */
function looksLikeBulletContinuation(line: string): boolean {
  if (line.length > 200) return false;
  if (!line) return false;
  if (DATE_RANGE_RE.test(line)) return false;
  const first = line[0]!;
  return first === first.toLowerCase() && first !== first.toUpperCase();
}

function finalizeItem(item: ParsedExperienceItem): ParsedExperienceItem {
  // Normalize: empty bullet array becomes [''] so the UI has a slot.
  if (item.bullets.length === 0) item.bullets = [''];
  return item;
}

function isBulletLine(line: string): boolean {
  // The PDF extraction in our pipeline produces bullets that start with
  // "• " (or sometimes "•  "). Some PDFs use "-" or "*" instead. Be
  // permissive.
  return /^[•\-\*]\s/.test(line) || /^\u2022\s/.test(line);
}

function stripBullet(line: string): string {
  return line.replace(/^[•\-\*]\s*/, '').replace(/^\u2022\s*/, '').trim();
}

/**
 * Split a "Position, Company" line. The split point is the LAST comma,
 * because company names often contain commas ("Acme, Inc.") but
 * position names rarely do. If no comma, the whole line is the position.
 */
function splitPositionCompany(line: string): { position: string; company: string } {
  const lastComma = line.lastIndexOf(',');
  if (lastComma < 0) {
    return { position: line.trim(), company: '' };
  }
  return {
    position: line.slice(0, lastComma).trim(),
    company: line.slice(lastComma + 1).trim(),
  };
}

/**
 * Try to parse a line as a date range. Returns null if it doesn't look
 * like one. The end date is `null` for "Present" / "Current" / "Now".
 */
function parseDateRange(line: string): { start: string; end: string | null } | null {
  const m = line.match(DATE_RANGE_RE);
  if (!m) return null;
  const matched = m[0];
  // Split on the literal separator words/symbols. We can't use a
  // character class that includes 't' because that would split words
  // like "Present" (which contains a 't'). Use a regex that matches
  // the separator as a unit.
  const parts = matched.split(/\s*(?:[-–—]|to)\s*/i);
  if (parts.length < 2) return null;
  const start = (parts[0] ?? '').trim();
  const endStr = (parts[1] ?? '').trim();
  const isPresent = /present|current|now/i.test(endStr);
  return {
    start,
    end: isPresent ? null : endStr,
  };
}

// ---------------------------------------------------------------------------
// Education parsing
// ---------------------------------------------------------------------------

/**
 * Parse the lines of an Education section into individual entries.
 *
 * The structure is simpler than experience:
 *
 *   Institution
 *   Degree (may wrap to a 2nd line)
 *   Start Date to End Date
 *
 * Each entry is a contiguous run of 2-3 non-empty non-bullet lines,
 * terminated by either another run starting or end of section.
 *
 * Heuristics that handle common mess:
 *   - PDF page-break artifacts ("Page 1", "Page 2 of 3") are filtered.
 *   - Degree lines can wrap. We detect this by: the line doesn't look
 *     like a date, doesn't look like a new institution (doesn't start
 *     with a capital + has no comma or short word count that suggests
 *     a university name), and isn't followed by a date.
 */
function parseEducationItems(bodyLines: string[]): ParsedEducationItem[] {
  // Trim leading whitespace only. Keep trailing spaces (signal for
  // line wrap). Filter out PDF page-break artifacts.
  const lines = bodyLines
    .map((l) => l.replace(/^\s+/, ''))
    .filter((l) => l.length > 0)
    .filter((l) => !isPageBreakArtifact(l));

  if (lines.length === 0) return [];

  const items: ParsedEducationItem[] = [];
  let i = 0;

  while (i < lines.length) {
    const institution = lines[i] ?? '';
    let degree = '';
    let startDate = '';
    let endDate = '';
    let consumed = 1;

    if (i + 1 < lines.length) {
      const next = lines[i + 1] ?? '';
      const dateRange = parseDateRange(next);
      if (dateRange) {
        // Line 2 is the date. Degree is missing.
        startDate = dateRange.start;
        endDate = dateRange.end ?? '';
        consumed = 2;
      } else {
        // Line 2 is the start of the degree. It may wrap to a 3rd line.
        degree = next;
        consumed = 2;

        // Check if line 3 is a date OR a continuation of the degree.
        if (i + 2 < lines.length) {
          const after = lines[i + 2] ?? '';
          const dateRange2 = parseDateRange(after);
          if (dateRange2) {
            startDate = dateRange2.start;
            endDate = dateRange2.end ?? '';
            consumed = 3;
          } else if (looksLikeDegreeContinuation(degree, after)) {
            // Merge: degree is degree + " " + after.
            degree = (degree + ' ' + after).trim();
            consumed = 3;

            // Check line 4 for the date.
            if (i + 3 < lines.length) {
              const after4 = lines[i + 3] ?? '';
              const dateRange3 = parseDateRange(after4);
              if (dateRange3) {
                startDate = dateRange3.start;
                endDate = dateRange3.end ?? '';
                consumed = 4;
              }
            }
          }
        }
      }
    }

    items.push({
      institution,
      degree,
      startDate,
      endDate,
    });

    i += consumed;
  }

  return items;
}

/**
 * PDF page-break artifact: "Page 1", "Page 2 of 3", "1 / 5", etc.
 */
function isPageBreakArtifact(line: string): boolean {
  return (
    /^page\s+\d+(\s+(of|\/)\s+\d+)?$/i.test(line.trim()) ||
    /^\d+\s*\/\s*\d+$/.test(line.trim())
  );
}

/**
 * Heuristic: is `continuation` a wrap of the previous degree line?
 *
 * Signals:
 *   - Doesn't look like a date.
 *   - Doesn't look like an institution (no comma, doesn't end with a
 *     university-type word like "University", "Institute", "College").
 *   - The combined length of (degree + continuation) is under 200 chars
 *     (real degree + wrap is a few lines of text, never huge).
 */
function looksLikeDegreeContinuation(degree: string, continuation: string): boolean {
  if (continuation.length > 200) return false;
  // If continuation looks like a new institution (has "University" /
  // "Institute" / "College" / "School" / "Academy"), it's probably a
  // new entry, not a wrap.
  if (/\b(university|institute|college|school|academy|polytechnic)\b/i.test(continuation)) {
    return false;
  }
  return true;
}

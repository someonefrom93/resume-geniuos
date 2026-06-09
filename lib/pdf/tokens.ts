/**
 * Design tokens for the resume PDF template.
 *
 * Single source of truth for both the HTML live preview (Phase 3) and
 * the @react-pdf/renderer export (Phase 5). Both consumers must read
 * from here so the preview and the export stay in visual sync.
 *
 * Units: numbers are in PDF points (1pt = 1/72 inch). We use points
 * because @react-pdf works in points natively. For the HTML preview,
 * the consumer multiplies by (96/72) ≈ 1.333 to get CSS pixels at
 * standard 96 DPI.
 *
 * Font choice: we standardize on "Helvetica" (and "Helvetica-Bold" /
 * "Helvetica-Oblique") because @react-pdf ships them built-in — no
 * font file registration needed. Calibri would require a TTF file we
 * don't have rights to ship. The HTML preview uses the system sans-serif
 * stack which renders close enough at the sizes we use.
 */

export const TOKENS = {
  // Page geometry. US Letter (612 × 792 pt).
  page: {
    widthPt: 612,
    heightPt: 792,
    marginPt: 48, // 0.5 inch all around
  },

  // Typography. Sizes in points.
  font: {
    body: 'Helvetica',
    bodyBold: 'Helvetica-Bold',
    bodyItalic: 'Helvetica-Oblique',
    bodyBoldItalic: 'Helvetica-BoldOblique',
  },

  size: {
    name: 22,
    sectionHeader: 12,
    body: 10.5,
    small: 9.5,
  },

  // Colors. Grayscale only — no color in an ATS-friendly resume.
  color: {
    text: '#111111',
    muted: '#555555',
    rule: '#222222', // the line under section headers
  },

  // Spacing. Multiples of 4 for visual rhythm.
  spacing: {
    afterName: 2,
    afterContact: 14,
    betweenSections: 12,
    betweenJobs: 10,
    betweenBullets: 3,
  },

  // Bullet style. We use a small filled disc; the PDF renderer supports
  // it natively, and the HTML preview mirrors it with a CSS pseudo-element.
  bulletChar: '\u2022', // •
} as const;

/** Convert PDF points to CSS pixels at 96 DPI. */
export function ptToPx(pt: number): number {
  return pt * (96 / 72);
}

/**
 * React-PDF Style objects derived from the tokens.
 *
 * We pre-build the most-used styles here so the PDF template (Phase 5)
 * can spread them. Using `as const` would break the Style type, so we
 * use a satisfies clause-free object literal that @react-pdf accepts.
 */
export const PDF_STYLES = {
  page: {
    paddingTop: TOKENS.page.marginPt,
    paddingBottom: TOKENS.page.marginPt,
    paddingLeft: TOKENS.page.marginPt,
    paddingRight: TOKENS.page.marginPt,
    fontFamily: TOKENS.font.body,
    fontSize: TOKENS.size.body,
    color: TOKENS.color.text,
    lineHeight: 1.35,
  },
  name: {
    fontFamily: TOKENS.font.bodyBold,
    fontSize: TOKENS.size.name,
    marginBottom: TOKENS.spacing.afterName,
  },
  contactLine: {
    fontSize: TOKENS.size.body,
    color: TOKENS.color.muted,
    marginBottom: TOKENS.spacing.afterContact,
  },
  sectionHeader: {
    fontFamily: TOKENS.font.bodyBold,
    fontSize: TOKENS.size.sectionHeader,
    borderBottom: `0.75pt solid ${TOKENS.color.rule}`,
    paddingBottom: 2,
    marginTop: TOKENS.spacing.betweenSections,
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  jobTitle: {
    fontFamily: TOKENS.font.bodyBold,
    fontSize: TOKENS.size.body,
  },
  jobMeta: {
    fontSize: TOKENS.size.body,
    color: TOKENS.color.muted,
  },
  bulletRow: {
    flexDirection: 'row' as const,
    marginBottom: TOKENS.spacing.betweenBullets,
  },
  bulletGlyph: {
    width: 12,
    fontSize: TOKENS.size.body,
  },
  bulletText: {
    flex: 1,
    fontSize: TOKENS.size.body,
  },
  summary: {
    fontSize: TOKENS.size.body,
    marginBottom: 2,
  },
} as const;

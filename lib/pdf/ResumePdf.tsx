/**
 * @react-pdf/renderer template for the resume.
 *
 * Renders the same `Resume` data structure that the live HTML preview
 * consumes, but produces an actual PDF file the user can download.
 *
 * This is THE source of truth for the export's visual design. The
 * HTML preview in `components/builder/ResumePreview.tsx` is meant to
 * mirror this as closely as web fonts allow, but if you change styles
 * here, change them there too.
 *
 * Why this is in a separate file (not inside ResumePreview.tsx):
 *   - `@react-pdf/renderer` bundles Node-y internals (Buffer, etc.) and
 *     breaks Next.js's static rendering. We need a `'use client'`
 *     wrapper that loads THIS file via `next/dynamic` with `ssr: false`.
 *   - The HTML preview is rendered server-side; the PDF is rendered
 *     entirely in the browser. Different lifecycles.
 *
 * Tokens (font sizes, margins, colors) come from `lib/pdf/tokens.ts`,
 * which is also the source for the HTML preview styles. This is
 * intentional: keeping both consumers reading from the same tokens
 * prevents drift.
 */

import { Document, Page, Text, View, StyleSheet, Link } from '@react-pdf/renderer';
import { TOKENS, PDF_STYLES } from './tokens';
import type {
  Resume,
  ExperienceItem,
  EducationItem,
  ProjectItem,
} from '@/types/resume';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
//
// We compose the styles from PDF_STYLES (which uses the same tokens as
// the HTML preview) and add a few that are specific to the PDF rendering
// (page layout, link styling).
//
// The `as any` casts below are because @react-pdf's Style type is strict
// about allowed values (e.g., no CSS shorthand), and our shared
// PDF_STYLES object uses some CSS conventions that the strict type
// rejects. The values are still valid at runtime.

const styles = StyleSheet.create({
  page: {
    ...PDF_STYLES.page,
  } as any,
  name: {
    ...PDF_STYLES.name,
    textAlign: 'center',
  } as any,
  contactLine: {
    ...PDF_STYLES.contactLine,
    textAlign: 'center',
  } as any,
  // Section: the h2 + body
  section: {
    marginTop: PDF_STYLES.sectionHeader.marginTop,
  } as any,
  sectionHeader: {
    ...PDF_STYLES.sectionHeader,
  } as any,
  // Contact bits separated by · with proper spacing
  contactBit: {
    fontSize: TOKENS.size.body,
    color: TOKENS.color.muted,
  } as any,
  contactSeparator: {
    fontSize: TOKENS.size.body,
    color: TOKENS.color.muted,
    marginHorizontal: 4,
  } as any,
  // Experience: each job is a row with title/meta on top, bullets below
  jobBlock: {
    marginBottom: TOKENS.spacing.betweenJobs,
  } as any,
  jobHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  } as any,
  jobTitleLine: {
    flexDirection: 'row',
  } as any,
  jobTitle: {
    ...PDF_STYLES.jobTitle,
  } as any,
  jobCompany: {
    fontSize: TOKENS.size.body,
  } as any,
  jobSeparator: {
    fontSize: TOKENS.size.body,
    color: TOKENS.color.muted,
    marginHorizontal: 4,
  } as any,
  jobMeta: {
    ...PDF_STYLES.jobMeta,
  } as any,
  jobLocation: {
    fontSize: TOKENS.size.body,
    color: TOKENS.color.muted,
  } as any,
  // Bullets: a small glyph + the text
  bulletRow: {
    ...PDF_STYLES.bulletRow,
  } as any,
  bulletGlyph: {
    ...PDF_STYLES.bulletGlyph,
  } as any,
  bulletText: {
    ...PDF_STYLES.bulletText,
  } as any,
  // Summary
  summaryText: {
    ...PDF_STYLES.summary,
  } as any,
  // Skills
  skillsLine: {
    flexDirection: 'row',
    marginBottom: 2,
  } as any,
  skillsLabel: {
    fontSize: TOKENS.size.body,
    fontFamily: TOKENS.font.bodyBold,
  } as any,
  skillsValue: {
    fontSize: TOKENS.size.body,
  } as any,
  // Education
  eduBlock: {
    marginBottom: TOKENS.spacing.betweenJobs,
  } as any,
  eduHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  } as any,
  eduLine: {
    flexDirection: 'row',
  } as any,
  eduDegree: {
    ...PDF_STYLES.jobTitle,
  } as any,
  eduInstitution: {
    fontSize: TOKENS.size.body,
  } as any,
  eduMeta: {
    ...PDF_STYLES.jobMeta,
  } as any,
  // Project
  projectBlock: {
    marginBottom: TOKENS.spacing.betweenJobs,
  } as any,
  projectHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  } as any,
  projectName: {
    ...PDF_STYLES.jobTitle,
  } as any,
  projectTech: {
    fontSize: TOKENS.size.body,
    color: TOKENS.color.muted,
    marginLeft: 4,
  } as any,
  projectLink: {
    fontSize: TOKENS.size.body,
    color: TOKENS.color.muted,
  } as any,
  projectDescription: {
    fontSize: TOKENS.size.body,
    marginTop: 2,
  } as any,
});

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function ResumePdf({ resume }: { resume: Resume }) {
  return (
    <Document
      title={`${resume.contact.name || 'Resume'}`}
      author={resume.contact.name || ''}
      creator="Resume Scorer"
    >
      <Page size="LETTER" style={styles.page}>
        <Header resume={resume} />

        {hasContent(resume.summary) && <Summary text={resume.summary} />}

        {resume.experience.some(hasExperienceContent) && (
          <Section title="Experience">
            {resume.experience
              .filter(hasExperienceContent)
              .map((e) => (
                <ExperienceBlock key={e.id} item={e} />
              ))}
          </Section>
        )}

        {resume.projects.some(hasProjectContent) && (
          <Section title="Projects">
            {resume.projects
              .filter(hasProjectContent)
              .map((p) => (
                <ProjectBlock key={p.id} item={p} />
              ))}
          </Section>
        )}

        {hasAnySkill(resume) && (
          <Section title="Skills">
            <SkillsBlock resume={resume} />
          </Section>
        )}

        {resume.education.some(hasEducationContent) && (
          <Section title="Education">
            {resume.education
              .filter(hasEducationContent)
              .map((e) => (
                <EducationBlock key={e.id} item={e} />
              ))}
          </Section>
        )}
      </Page>
    </Document>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function Header({ resume }: { resume: Resume }) {
  const c = resume.contact;
  const bits: Array<{ kind: 'text'; value: string } | { kind: 'link'; value: string }> = [];

  if (c.location) bits.push({ kind: 'text', value: c.location });
  if (c.email) bits.push({ kind: 'text', value: c.email });
  if (c.phone) bits.push({ kind: 'text', value: c.phone });
  if (c.linkedin) bits.push({ kind: 'link', value: c.linkedin });
  if (c.github) bits.push({ kind: 'link', value: c.github });
  if (c.portfolio) bits.push({ kind: 'link', value: c.portfolio });

  return (
    <View>
      <Text style={styles.name}>{c.name || 'Your Name'}</Text>
      {bits.length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            marginBottom: TOKENS.spacing.afterContact,
          }}
        >
          {bits.map((bit, i) => (
            <View key={i} style={{ flexDirection: 'row' }}>
              {i > 0 && <Text style={styles.contactSeparator}>·</Text>}
              {bit.kind === 'link' ? (
                <Link src={bit.value} style={styles.contactBit}>
                  {prettifyUrl(bit.value)}
                </Link>
              ) : (
                <Text style={styles.contactBit}>{bit.value}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * For LinkedIn/GitHub/portfolio URLs, show a human-friendly form
 * (linkedin.com/in/handle) instead of the full https://...
 */
function prettifyUrl(url: string): string {
  try {
    const u = new URL(url);
    // For LinkedIn, show "linkedin.com/in/handle" — recognizable and short
    if (u.hostname.includes('linkedin.com') && u.pathname.startsWith('/in/')) {
      return `linkedin.com${u.pathname}`;
    }
    if (u.hostname.includes('github.com') && u.pathname.length > 1) {
      return `github.com${u.pathname}`;
    }
    // For everything else, drop www. and trailing slash
    return u.hostname.replace(/^www\./, '') + (u.pathname === '/' ? '' : u.pathname);
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>{title}</Text>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function Summary({ text }: { text: string }) {
  return (
    <Section title="Summary">
      <Text style={styles.summaryText}>{text}</Text>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

function ExperienceBlock({ item }: { item: ExperienceItem }) {
  const dateRange = formatDateRange(item.startDate, item.endDate);
  const nonEmptyBullets = item.bullets.filter((b) => b.trim().length > 0);
  return (
    <View style={styles.jobBlock}>
      <View style={styles.jobHeaderRow}>
        <View style={styles.jobTitleLine}>
          {item.position && <Text style={styles.jobTitle}>{item.position}</Text>}
          {item.position && item.company && (
            <Text style={styles.jobSeparator}>·</Text>
          )}
          {item.company && <Text style={styles.jobCompany}>{item.company}</Text>}
        </View>
        {dateRange && <Text style={styles.jobMeta}>{dateRange}</Text>}
      </View>
      {item.location && <Text style={styles.jobLocation}>{item.location}</Text>}
      {nonEmptyBullets.length > 0 && (
        <View style={{ marginTop: 2 }}>
          {nonEmptyBullets.map((b, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bulletGlyph}>{TOKENS.bulletChar}</Text>
              <Text style={styles.bulletText}>{b}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

function ProjectBlock({ item }: { item: ProjectItem }) {
  return (
    <View style={styles.projectBlock}>
      <View style={styles.projectHeaderRow}>
        <View style={styles.jobTitleLine}>
          {item.name && <Text style={styles.projectName}>{item.name}</Text>}
          {item.techStack.length > 0 && (
            <Text style={styles.projectTech}>
              | {item.techStack.join(', ')}
            </Text>
          )}
        </View>
        {item.link && <Text style={styles.projectLink}>{item.link}</Text>}
      </View>
      {item.description && <Text style={styles.projectDescription}>{item.description}</Text>}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

function SkillsBlock({ resume }: { resume: Resume }) {
  const groups: Array<[string, string[]]> = [
    ['Technical', resume.skills.technical],
    ['Tools', resume.skills.tools],
    ['Languages', resume.skills.languages],
    ['Soft skills', resume.skills.soft],
  ].filter(([, items]) => items.length > 0) as Array<[string, string[]]>;

  return (
    <View>
      {groups.map(([label, items]) => (
        <View key={label} style={styles.skillsLine}>
          <Text style={styles.skillsLabel}>{label}: </Text>
          <Text style={styles.skillsValue}>{items.join(', ')}</Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------

function EducationBlock({ item }: { item: EducationItem }) {
  const dateRange = formatDateRange(item.startDate, item.endDate);
  return (
    <View style={styles.eduBlock}>
      <View style={styles.eduHeaderRow}>
        <View style={styles.eduLine}>
          {item.degree && <Text style={styles.eduDegree}>{item.degree}</Text>}
          {item.degree && item.institution && (
            <Text style={styles.jobSeparator}>·</Text>
          )}
          {item.institution && (
            <Text style={styles.eduInstitution}>{item.institution}</Text>
          )}
        </View>
        {dateRange && <Text style={styles.eduMeta}>{dateRange}</Text>}
      </View>
      {item.gpa && <Text style={styles.jobLocation}>GPA: {item.gpa}</Text>}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasContent(s: string | undefined | null): boolean {
  return typeof s === 'string' && s.trim().length > 0;
}

function hasExperienceContent(e: ExperienceItem): boolean {
  return Boolean(
    e.company.trim() ||
      e.position.trim() ||
      e.startDate.trim() ||
      e.endDate?.trim() ||
      e.bullets.some((b) => b.trim()),
  );
}

function hasEducationContent(e: EducationItem): boolean {
  return Boolean(
    e.institution.trim() || e.degree.trim() || e.startDate.trim() || e.endDate.trim(),
  );
}

function hasProjectContent(p: ProjectItem): boolean {
  return Boolean(
    p.name.trim() || p.description.trim() || p.techStack.length > 0,
  );
}

function hasAnySkill(resume: Resume): boolean {
  return (
    resume.skills.technical.length +
      resume.skills.tools.length +
      resume.skills.languages.length +
      resume.skills.soft.length >
    0
  );
}

function formatDateRange(start: string, end: string | null): string {
  const s = start.trim();
  const e = (end ?? '').trim();
  if (!s && !e) return '';
  if (s && !e) return s;
  if (!s && e) return e;
  return `${s} – ${e}`;
}

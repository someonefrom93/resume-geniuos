/**
 * Live HTML preview of the resume, visually matching the PDF template.
 *
 * Why HTML and not the actual PDF renderer:
 *   - The HTML preview updates instantly on every keystroke. Re-rendering
 *     a PDF on every edit would be slow and visually flickery.
 *   - The PDF export (Phase 5) is the source of truth for the final look.
 *     The HTML preview is "good enough" feedback during editing.
 *
 * Empty-state rules:
 *   - Hidden sections are NOT rendered (so the preview shows only what
 *     the user has filled in).
 *   - Empty optional fields within a rendered section are NOT rendered.
 *   - The header (name + contact) IS always rendered, even if empty, so
 *     the user sees a visible "fill me in" placeholder area.
 *
 * The visual design (font, sizes, spacing, dividers) mirrors
 * `lib/pdf/tokens.ts` exactly. Both consumers read from the same tokens.
 */

import { TOKENS, ptToPx } from '@/lib/pdf/tokens';
import type {
  Resume,
  ExperienceItem,
  EducationItem,
  ProjectItem,
} from '@/types/resume';

interface ResumePreviewProps {
  resume: Resume;
}

export function ResumePreview({ resume }: ResumePreviewProps) {
  const px = (pt: number) => `${ptToPx(pt)}px`;

  return (
    <div
      className="bg-white text-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-800 mx-auto"
      style={{
        width: px(TOKENS.page.widthPt),
        minHeight: px(TOKENS.page.heightPt),
        padding: px(TOKENS.page.marginPt),
        fontFamily: 'var(--font-geist-sans), system-ui, -apple-system, sans-serif',
        fontSize: px(TOKENS.size.body),
        lineHeight: 1.35,
      }}
    >
      <Header resume={resume} px={px} />

      {resume.summary.trim() && <Summary text={resume.summary} px={px} />}

      {resume.experience.some(hasContent) && (
        <Section title="Experience" px={px}>
          {resume.experience.filter(hasContent).map((e) => (
            <ExperienceBlock key={e.id} item={e} px={px} />
          ))}
        </Section>
      )}

      {resume.projects.some(hasProjectContent) && (
        <Section title="Projects" px={px}>
          {resume.projects.filter(hasProjectContent).map((p) => (
            <ProjectBlock key={p.id} item={p} px={px} />
          ))}
        </Section>
      )}

      {hasAnySkill(resume) && (
        <Section title="Skills" px={px}>
          <SkillsBlock resume={resume} />
        </Section>
      )}

      {resume.education.some(hasContent) && (
        <Section title="Education" px={px}>
          {resume.education.filter(hasContent).map((e) => (
            <EducationBlock key={e.id} item={e} px={px} />
          ))}
        </Section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section subcomponents
// ---------------------------------------------------------------------------

function Header({ resume, px }: { resume: Resume; px: (n: number) => string }) {
  const c = resume.contact;
  const contactBits = [
    c.location,
    c.email,
    c.phone,
    c.linkedin,
    c.github,
    c.portfolio,
  ].filter((s): s is string => Boolean(s && s.trim()));

  return (
    <header className="text-center">
      <h1
        className="font-bold"
        style={{ fontSize: px(TOKENS.size.name), marginBottom: px(TOKENS.spacing.afterName) }}
      >
        {c.name || <span className="text-zinc-400">Your name</span>}
      </h1>
      {contactBits.length > 0 && (
        <p
          style={{
            fontSize: px(TOKENS.size.body),
            color: TOKENS.color.muted,
            marginBottom: px(TOKENS.spacing.afterContact),
          }}
        >
          {contactBits.map((bit, i) => (
            <span key={i}>
              {i > 0 && <span className="mx-2">·</span>}
              {bit}
            </span>
          ))}
        </p>
      )}
    </header>
  );
}

function Summary({ text, px }: { text: string; px: (n: number) => string }) {
  return (
    <Section title="Summary" px={px}>
      <p style={{ fontSize: px(TOKENS.size.body) }}>{text}</p>
    </Section>
  );
}

function Section({
  title,
  children,
  px,
}: {
  title: string;
  children: React.ReactNode;
  px: (n: number) => string;
}) {
  return (
    <section
      style={{ marginTop: px(TOKENS.spacing.betweenSections) }}
    >
      <h2
        className="font-bold uppercase"
        style={{
          fontSize: px(TOKENS.size.sectionHeader),
          borderBottom: `0.75px solid ${TOKENS.color.rule}`,
          paddingBottom: '2px',
          marginBottom: '6px',
          letterSpacing: '0.5px',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function ExperienceBlock({ item, px }: { item: ExperienceItem; px: (n: number) => string }) {
  const dateRange = formatDateRange(item.startDate, item.endDate);
  return (
    <div style={{ marginBottom: px(TOKENS.spacing.betweenJobs) }}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <span className="font-bold">{item.position || <span className="text-zinc-400">Position</span>}</span>
          {item.company && (
            <>
              <span className="mx-1.5 text-zinc-500">·</span>
              <span>{item.company}</span>
            </>
          )}
        </div>
        <div className="text-zinc-600 text-[0.95em] whitespace-nowrap">
          {dateRange || <span className="text-zinc-400">Dates</span>}
        </div>
      </div>
      {item.location && (
        <div className="text-zinc-600 text-[0.95em]">{item.location}</div>
      )}
      {item.bullets.filter((b) => b.trim()).length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {item.bullets.filter((b) => b.trim()).map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="select-none">{TOKENS.bulletChar}</span>
              <span className="flex-1">{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProjectBlock({ item, px }: { item: ProjectItem; px: (n: number) => string }) {
  return (
    <div style={{ marginBottom: px(TOKENS.spacing.betweenJobs) }}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <span className="font-bold">{item.name || <span className="text-zinc-400">Project name</span>}</span>
          {item.techStack.length > 0 && (
            <span className="text-zinc-600 text-[0.95em] ml-2">
              | {item.techStack.join(', ')}
            </span>
          )}
        </div>
        {item.link && (
          <div className="text-zinc-600 text-[0.95em]">{item.link}</div>
        )}
      </div>
      {item.description && <p className="mt-0.5">{item.description}</p>}
    </div>
  );
}

function SkillsBlock({ resume }: { resume: Resume }) {
  const groups = [
    { label: 'Technical', items: resume.skills.technical },
    { label: 'Tools', items: resume.skills.tools },
    { label: 'Languages', items: resume.skills.languages },
    { label: 'Soft skills', items: resume.skills.soft },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-1">
      {groups.map((g) => (
        <div key={g.label}>
          <span className="font-semibold">{g.label}: </span>
          <span>{g.items.join(', ')}</span>
        </div>
      ))}
    </div>
  );
}

function EducationBlock({ item, px }: { item: EducationItem; px: (n: number) => string }) {
  const dateRange = formatDateRange(item.startDate, item.endDate);
  return (
    <div style={{ marginBottom: px(TOKENS.spacing.betweenJobs) }}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <span className="font-bold">{item.institution || <span className="text-zinc-400">Institution</span>}</span>
          {item.degree && (
            <>
              <span className="mx-1.5 text-zinc-500">·</span>
              <span>{item.degree}</span>
            </>
          )}
        </div>
        <div className="text-zinc-600 text-[0.95em] whitespace-nowrap">
          {dateRange || <span className="text-zinc-400">Dates</span>}
        </div>
      </div>
      {item.gpa && (
        <div className="text-zinc-600 text-[0.95em]">GPA: {item.gpa}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasContent(e: ExperienceItem | EducationItem): boolean {
  return Boolean(
    (e as ExperienceItem).position ||
      (e as ExperienceItem).company ||
      (e as EducationItem).institution ||
      (e as EducationItem).degree ||
      e.startDate ||
      e.endDate,
  );
}

function hasProjectContent(p: ProjectItem): boolean {
  return Boolean(p.name || p.description || p.techStack.length > 0);
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
  const e = end?.trim();
  if (!s && !e) return '';
  if (s && !e) return s;
  if (!s && e) return e;
  return `${s} – ${e}`;
}

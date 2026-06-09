/**
 * Convert a structured Resume into a plain-text representation suitable
 * for the LLM prompt. We want a faithful but compact rendering — the
 * LLM cares about content, not styling.
 *
 * Format:
 *   Name
 *   email · phone · location · linkedin · github · portfolio
 *
 *   SUMMARY
 *   <text>
 *
 *   EXPERIENCE
 *   Position, Company (start – end)
 *   Location
 *   • bullet
 *   • bullet
 *
 *   PROJECTS
 *   Name | tech stack
 *   <description>
 *   <link>
 *
 *   SKILLS
 *   Technical: a, b, c
 *   Tools: d, e
 *   ...
 *
 *   EDUCATION
 *   Degree, Institution (start – end)
 *   GPA: x
 *
 * Empty sections are omitted. Empty fields within a section are also
 * omitted. This keeps the prompt small (cheap) and focused (the model
 * doesn't waste attention on blanks).
 */

import type { Resume } from '@/types/resume';

export function resumeToText(resume: Resume): string {
  const lines: string[] = [];

  // Header
  const c = resume.contact;
  const contactBits = [c.name, c.email, c.phone, c.location, c.linkedin, c.github, c.portfolio]
    .filter((s): s is string => Boolean(s && s.trim()));
  if (contactBits.length > 0) {
    lines.push(contactBits.join(' · '));
    lines.push('');
  }

  // Summary
  if (resume.summary.trim()) {
    lines.push('SUMMARY');
    lines.push(resume.summary.trim());
    lines.push('');
  }

  // Experience
  const validExp = resume.experience.filter(
    (e) => e.company.trim() || e.position.trim() || e.startDate.trim(),
  );
  if (validExp.length > 0) {
    lines.push('EXPERIENCE');
    for (const e of validExp) {
      const head = [e.position, e.company].filter(Boolean).join(', ');
      const dates = formatDateRange(e.startDate, e.endDate ?? '');
      lines.push(head + (dates ? ` (${dates})` : ''));
      if (e.location?.trim()) lines.push(e.location.trim());
      for (const b of e.bullets) {
        const trimmed = b.trim();
        if (trimmed) lines.push(`• ${trimmed}`);
      }
      lines.push('');
    }
  }

  // Projects
  const validProj = resume.projects.filter(
    (p) => p.name.trim() || p.description.trim() || p.techStack.length > 0,
  );
  if (validProj.length > 0) {
    lines.push('PROJECTS');
    for (const p of validProj) {
      const head = p.name.trim();
      const tech = p.techStack.length > 0 ? ` | ${p.techStack.join(', ')}` : '';
      lines.push(head + tech);
      if (p.description.trim()) lines.push(p.description.trim());
      if (p.link?.trim()) lines.push(p.link.trim());
      lines.push('');
    }
  }

  // Skills
  const skillGroups: Array<[string, string[]]> = [
    ['Technical', resume.skills.technical],
    ['Tools', resume.skills.tools],
    ['Languages', resume.skills.languages],
    ['Soft skills', resume.skills.soft],
  ].filter(([, items]) => items.length > 0) as Array<[string, string[]]>;
  if (skillGroups.length > 0) {
    lines.push('SKILLS');
    for (const [label, items] of skillGroups) {
      lines.push(`${label}: ${items.join(', ')}`);
    }
    lines.push('');
  }

  // Education
  const validEdu = resume.education.filter(
    (e) => e.institution.trim() || e.degree.trim(),
  );
  if (validEdu.length > 0) {
    lines.push('EDUCATION');
    for (const e of validEdu) {
      const head = [e.degree, e.institution].filter(Boolean).join(', ');
      const dates = formatDateRange(e.startDate, e.endDate);
      lines.push(head + (dates ? ` (${dates})` : ''));
      if (e.gpa?.trim()) lines.push(`GPA: ${e.gpa.trim()}`);
      lines.push('');
    }
  }

  return lines.join('\n').trim();
}

function formatDateRange(start: string, end: string): string {
  const s = start.trim();
  const e = end.trim();
  if (!s && !e) return '';
  if (s && !e) return s;
  if (!s && e) return e;
  return `${s} – ${e}`;
}

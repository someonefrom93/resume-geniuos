/**
 * Core data model for the resume.
 *
 * This is the single source of truth for what a resume looks like in our app.
 * It is used by:
 * - The Zustand store (in-memory state)
 * - localStorage persistence (serialized as JSON)
 * - The PDF template (`@react-pdf/renderer` reads from this)
 * - The live HTML preview (mirrors the PDF styles)
 * - The AI scoring API (we serialize this and send to the LLM)
 *
 * Design rules:
 * - All fields are explicit. Optional fields are `T | undefined`, not `T | null`,
 *   unless the meaning of "empty" is different from "missing" (e.g. endDate for
 *   "current job" is `null`).
 * - Every list item has an `id` so React keys are stable and we can address
 *   items for add/remove/reorder operations.
 * - Dates are strings in a human-friendly format ("Jan 2023", "2023", "Present")
 *   because that's what the user types and what the PDF shows. We do NOT parse
 *   them to Date objects internally — that's a job for the ATS module, not
 *   the data model.
 */

// ---------------------------------------------------------------------------
// Contact / Header
// ---------------------------------------------------------------------------

export interface ContactInfo {
  name: string;
  email: string;
  phone?: string;
  location?: string; // "City, State" or "City, Country"
  linkedin?: string; // full URL, e.g. "https://linkedin.com/in/..."
  github?: string;
  portfolio?: string;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export interface ExperienceItem {
  id: string;
  company: string;
  position: string;
  startDate: string; // e.g. "Jan 2023" or "2023"
  endDate: string | null; // null means "current" / "present"
  location?: string; // "Remote", "San Francisco, CA", etc.
  bullets: string[]; // each bullet is one achievement or responsibility
}

export interface EducationItem {
  id: string;
  institution: string;
  degree: string; // "B.S. Computer Science"
  startDate: string;
  endDate: string;
  gpa?: string;
  relevantCoursework?: string[];
}

export interface ProjectItem {
  id: string;
  name: string;
  description: string; // 1-2 sentences
  techStack: string[];
  link?: string;
}

export interface SkillsData {
  technical: string[];
  soft: string[];
  languages: string[]; // spoken languages, e.g. ["English", "Spanish"]
  tools: string[]; // e.g. ["Git", "Docker", "Figma"]
}

// ---------------------------------------------------------------------------
// Resume (top-level)
// ---------------------------------------------------------------------------

/**
 * The complete resume. `version` lets us evolve the schema later and migrate
 * localStorage data on read.
 */
export interface Resume {
  version: number; // bump when shape changes; see lib/storage/migrate.ts
  contact: ContactInfo;
  summary: string; // optional, but field always present (empty string = absent)
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: SkillsData;
  projects: ProjectItem[];
  updatedAt: string; // ISO timestamp of last edit
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export type ResumeSection =
  | 'header'
  | 'summary'
  | 'experience'
  | 'skills'
  | 'education'
  | 'projects'
  | 'general';

export type ImprovementPriority = 'high' | 'medium' | 'low';

export interface Improvement {
  section: ResumeSection;
  priority: ImprovementPriority;
  issue: string; // what's wrong, in 1 short sentence
  suggestion: string; // how to fix, in 1-2 sentences
  example?: string; // optional before/after or concrete rewrite
}

export interface ScoreResult {
  /** Deterministic ATS compatibility score (0-100). */
  ats: number;
  /** LLM-evaluated content quality score (0-100). */
  content: number;
  /** LLM-evaluated job match score (0-100), or null if no JD was provided. */
  jobMatch: number | null;
  /** Weighted holistic score (0-100), exposed as the main number to the user. */
  holistic: number;
  /** Actionable list, max 8, ordered high → low priority. */
  improvements: Improvement[];
  /** ISO timestamp. */
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Factory: produce a blank resume
// ---------------------------------------------------------------------------

/**
 * Empty resume factory. Used by "Start from scratch" and as the initial
 * state for the Zustand store. Centralized here so we never hand-write
 * the same default object twice.
 */
export function createEmptyResume(): Resume {
  return {
    version: 1,
    contact: {
      name: '',
      email: '',
    },
    summary: '',
    experience: [],
    education: [],
    skills: {
      technical: [],
      soft: [],
      languages: [],
      tools: [],
    },
    projects: [],
    updatedAt: new Date().toISOString(),
  };
}

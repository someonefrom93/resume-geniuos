/**
 * Zustand store for the resume.
 *
 * Why a single store (not slices): the resume is one cohesive object and the
 * MVP is small enough that a flat store is clearer than sliced stores with
 * cross-slice action dependencies. We can split later if it grows.
 *
 * Why manual persistence (not `zustand/middleware` `persist`): we need to
 * handle the SSR case (no localStorage on the server) and the schema-version
 * mismatch case (reset on old data). Doing it ourselves is ~10 lines and
 * removes a layer of magic.
 *
 * Hydration model: on the client, after mount, we read localStorage. If we
 * find data, we replace the store's initial empty state with it. Until that
 * happens, `isHydrated` is false and consumers can show a loading state.
 *
 * We deliberately do NOT call `loadResume()` at module-import time. Doing so
 * would break Next.js's static rendering pass for any component that reads
 * the store. Hydration is triggered explicitly by the top-level client
 * component (see components/StoreHydrator.tsx).
 */

'use client';

import { create } from 'zustand';
import { createEmptyResume, type Resume, type ScoreResult, type ExperienceItem, type EducationItem, type ProjectItem } from '@/types/resume';
import { loadResume, saveResume, loadLastScore, saveLastScore } from '@/lib/storage/localStorage';

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

interface ResumeStoreState {
  resume: Resume;
  lastScore: ScoreResult | null;
  isHydrated: boolean;
}

interface ResumeStoreActions {
  /** Called once on the client, after mount. Idempotent. */
  hydrate: () => void;

  // Top-level
  resetResume: () => void;
  setLastScore: (score: ScoreResult) => void;
  clearLastScore: () => void;

  // Contact
  updateContact: (patch: Partial<Resume['contact']>) => void;

  // Summary
  setSummary: (summary: string) => void;

  // Experience
  addExperience: () => void;
  addExperienceWithData: (item: Omit<ExperienceItem, 'id'>) => void;
  updateExperience: (id: string, patch: Partial<ExperienceItem>) => void;
  removeExperience: (id: string) => void;
  reorderExperience: (fromIndex: number, toIndex: number) => void;
  setExperience: (items: ExperienceItem[]) => void;

  // Projects
  addProject: () => void;
  updateProject: (id: string, patch: Partial<ProjectItem>) => void;
  removeProject: (id: string) => void;
  reorderProjects: (fromIndex: number, toIndex: number) => void;

  // Education
  addEducation: () => void;
  addEducationWithData: (item: Omit<EducationItem, 'id'>) => void;
  updateEducation: (id: string, patch: Partial<EducationItem>) => void;
  removeEducation: (id: string) => void;
  setEducation: (items: EducationItem[]) => void;

  // Skills
  addSkill: (category: keyof Resume['skills'], skill: string) => void;
  removeSkill: (category: keyof Resume['skills'], index: number) => void;
}

export type ResumeStore = ResumeStoreState & ResumeStoreActions;

// ---------------------------------------------------------------------------
// ID helper
// ---------------------------------------------------------------------------

function makeId(): string {
  // crypto.randomUUID exists in all modern browsers and Node 19+.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback (should never hit in practice for our targets).
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useResumeStore = create<ResumeStore>((set, get) => ({
  resume: createEmptyResume(),
  lastScore: null,
  isHydrated: false,

  hydrate: () => {
    if (get().isHydrated) return; // idempotent
    const stored = loadResume();
    const storedScore = loadLastScore();
    set({
      resume: stored ?? createEmptyResume(),
      lastScore: storedScore,
      isHydrated: true,
    });
  },

  resetResume: () => {
    set({ resume: createEmptyResume(), lastScore: null });
  },

  setLastScore: (score) => {
    set({ lastScore: score });
    saveLastScore(score);
  },

  clearLastScore: () => {
    set({ lastScore: null });
  },

  // ---- Contact ----
  updateContact: (patch) => {
    set((state) => {
      const next = {
        ...state,
        resume: {
          ...state.resume,
          contact: { ...state.resume.contact, ...patch },
          updatedAt: new Date().toISOString(),
        },
      };
      saveResume(next.resume);
      return { resume: next.resume };
    });
  },

  // ---- Summary ----
  setSummary: (summary) => {
    set((state) => {
      const nextResume = {
        ...state.resume,
        summary,
        updatedAt: new Date().toISOString(),
      };
      saveResume(nextResume);
      return { resume: nextResume };
    });
  },

  // ---- Experience ----
  addExperience: () => {
    set((state) => {
      const item: ExperienceItem = {
        id: makeId(),
        company: '',
        position: '',
        startDate: '',
        endDate: null,
        bullets: [''],
      };
      // Insert at the TOP of the list. Newest roles go first — the
      // conventional resume order. Users can drag to reorder.
      const nextResume = {
        ...state.resume,
        experience: [item, ...state.resume.experience],
        updatedAt: new Date().toISOString(),
      };
      saveResume(nextResume);
      return { resume: nextResume };
    });
  },

  addExperienceWithData: (item) => {
    set((state) => {
      const withId: ExperienceItem = { ...item, id: makeId() };
      // Preserve empty bullets: replace placeholder with '' if all empty.
      const bullets =
        withId.bullets.length === 0 ? [''] : withId.bullets;
      const nextResume = {
        ...state.resume,
        experience: [{ ...withId, bullets }, ...state.resume.experience],
        updatedAt: new Date().toISOString(),
      };
      saveResume(nextResume);
      return { resume: nextResume };
    });
  },

  setExperience: (items) => {
    set((state) => {
      // Ensure every item has an id and at least one bullet slot.
      const normalized: ExperienceItem[] = items.map((item) => ({
        ...item,
        id: item.id || makeId(),
        bullets: item.bullets.length === 0 ? [''] : item.bullets,
      }));
      const nextResume = {
        ...state.resume,
        experience: normalized,
        updatedAt: new Date().toISOString(),
      };
      saveResume(nextResume);
      return { resume: nextResume };
    });
  },

  updateExperience: (id, patch) => {
    set((state) => {
      const nextResume = {
        ...state.resume,
        experience: state.resume.experience.map((e) =>
          e.id === id ? { ...e, ...patch } : e,
        ),
        updatedAt: new Date().toISOString(),
      };
      saveResume(nextResume);
      return { resume: nextResume };
    });
  },

  removeExperience: (id) => {
    set((state) => {
      const nextResume = {
        ...state.resume,
        experience: state.resume.experience.filter((e) => e.id !== id),
        updatedAt: new Date().toISOString(),
      };
      saveResume(nextResume);
      return { resume: nextResume };
    });
  },

  reorderExperience: (fromIndex, toIndex) => {
    set((state) => {
      const list = [...state.resume.experience];
      if (fromIndex < 0 || fromIndex >= list.length) return state;
      if (toIndex < 0 || toIndex >= list.length) return state;
      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved);
      const nextResume = {
        ...state.resume,
        experience: list,
        updatedAt: new Date().toISOString(),
      };
      saveResume(nextResume);
      return { resume: nextResume };
    });
  },

  // ---- Education ----
  addEducation: () => {
    set((state) => {
      const item: EducationItem = {
        id: makeId(),
        institution: '',
        degree: '',
        startDate: '',
        endDate: '',
      };
      const nextResume = {
        ...state.resume,
        education: [...state.resume.education, item],
        updatedAt: new Date().toISOString(),
      };
      saveResume(nextResume);
      return { resume: nextResume };
    });
  },

  addEducationWithData: (item) => {
    set((state) => {
      const withId: EducationItem = { ...item, id: makeId() };
      const nextResume = {
        ...state.resume,
        education: [...state.resume.education, withId],
        updatedAt: new Date().toISOString(),
      };
      saveResume(nextResume);
      return { resume: nextResume };
    });
  },

  setEducation: (items) => {
    set((state) => {
      const normalized: EducationItem[] = items.map((item) => ({
        ...item,
        id: item.id || makeId(),
      }));
      const nextResume = {
        ...state.resume,
        education: normalized,
        updatedAt: new Date().toISOString(),
      };
      saveResume(nextResume);
      return { resume: nextResume };
    });
  },

  updateEducation: (id, patch) => {
    set((state) => {
      const nextResume = {
        ...state.resume,
        education: state.resume.education.map((e) =>
          e.id === id ? { ...e, ...patch } : e,
        ),
        updatedAt: new Date().toISOString(),
      };
      saveResume(nextResume);
      return { resume: nextResume };
    });
  },

  removeEducation: (id) => {
    set((state) => {
      const nextResume = {
        ...state.resume,
        education: state.resume.education.filter((e) => e.id !== id),
        updatedAt: new Date().toISOString(),
      };
      saveResume(nextResume);
      return { resume: nextResume };
    });
  },

  // ---- Skills ----
  addSkill: (category, skill) => {
    const trimmed = skill.trim();
    if (!trimmed) return;
    set((state) => {
      const list = state.resume.skills[category];
      if (list.includes(trimmed)) return state; // dedupe
      const nextResume = {
        ...state.resume,
        skills: { ...state.resume.skills, [category]: [...list, trimmed] },
        updatedAt: new Date().toISOString(),
      };
      saveResume(nextResume);
      return { resume: nextResume };
    });
  },

  removeSkill: (category, index) => {
    set((state) => {
      const list = state.resume.skills[category];
      if (index < 0 || index >= list.length) return state;
      const nextResume = {
        ...state.resume,
        skills: {
          ...state.resume.skills,
          [category]: list.filter((_, i) => i !== index),
        },
        updatedAt: new Date().toISOString(),
      };
      saveResume(nextResume);
      return { resume: nextResume };
    });
  },

  // ---- Projects ----
  addProject: () => {
    set((state) => {
      const item: ProjectItem = {
        id: makeId(),
        name: '',
        description: '',
        techStack: [],
      };
      // Insert at the TOP of the list, same reasoning as addExperience.
      const nextResume = {
        ...state.resume,
        projects: [item, ...state.resume.projects],
        updatedAt: new Date().toISOString(),
      };
      saveResume(nextResume);
      return { resume: nextResume };
    });
  },

  updateProject: (id, patch) => {
    set((state) => {
      const nextResume = {
        ...state.resume,
        projects: state.resume.projects.map((p) =>
          p.id === id ? { ...p, ...patch } : p,
        ),
        updatedAt: new Date().toISOString(),
      };
      saveResume(nextResume);
      return { resume: nextResume };
    });
  },

  removeProject: (id) => {
    set((state) => {
      const nextResume = {
        ...state.resume,
        projects: state.resume.projects.filter((p) => p.id !== id),
        updatedAt: new Date().toISOString(),
      };
      saveResume(nextResume);
      return { resume: nextResume };
    });
  },

  reorderProjects: (fromIndex, toIndex) => {
    set((state) => {
      const list = [...state.resume.projects];
      if (fromIndex < 0 || fromIndex >= list.length) return state;
      if (toIndex < 0 || toIndex >= list.length) return state;
      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved);
      const nextResume = {
        ...state.resume,
        projects: list,
        updatedAt: new Date().toISOString(),
      };
      saveResume(nextResume);
      return { resume: nextResume };
    });
  },
}));

'use client';

import { useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SectionCard } from '../SectionCard';
import { Field, TextareaField } from '../Field';
import { SortableItemShell, SortableHandle } from '../SortableItem';
import { useResumeStore } from '@/store/resumeStore';
import type { ProjectItem } from '@/types/resume';

export function ProjectsSection() {
  const projects = useResumeStore((s) => s.resume.projects);
  const addProject = useResumeStore((s) => s.addProject);
  const updateProject = useResumeStore((s) => s.updateProject);
  const removeProject = useResumeStore((s) => s.removeProject);
  const reorderProjects = useResumeStore((s) => s.reorderProjects);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = projects.findIndex((p) => p.id === active.id);
    const toIndex = projects.findIndex((p) => p.id === over.id);
    if (fromIndex < 0 || toIndex < 0) return;
    reorderProjects(fromIndex, toIndex);
  };

  return (
    <SectionCard
      title="Projects"
      description="Side projects, OSS contributions, or notable work outside your job history."
      action={
        <button
          type="button"
          onClick={addProject}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          + Add project
        </button>
      }
    >
      {projects.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No projects yet. Click <span className="font-medium">Add project</span> to start.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {projects.map((item) => (
                <SortableItemShell key={item.id} id={item.id}>
                  <ProjectItemCard
                    item={item}
                    onChange={(patch) => updateProject(item.id, patch)}
                    onRemove={() => removeProject(item.id)}
                  />
                </SortableItemShell>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </SectionCard>
  );
}

function ProjectItemCard({
  item,
  onChange,
  onRemove,
}: {
  item: ProjectItem;
  onChange: (patch: Partial<ProjectItem>) => void;
  onRemove: () => void;
}) {
  const [techDraft, setTechDraft] = useState('');

  const addTech = () => {
    const t = techDraft.trim().replace(/,$/, '').trim();
    if (!t) return;
    if (item.techStack.includes(t)) return;
    onChange({ techStack: [...item.techStack, t] });
    setTechDraft('');
  };
  const removeTech = (i: number) => {
    onChange({ techStack: item.techStack.filter((_, idx) => idx !== i) });
  };

  return (
    <div
      className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 sm:p-4 space-y-3 transition-shadow data-[dragging]:shadow-lg data-[dragging]:border-zinc-400 dark:data-[dragging]:border-zinc-500 data-[dragging]:rotate-[0.5deg]"
    >
      <div className="flex items-center gap-2">
        <SortableHandle id={item.id} />
        <h3 className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
          {item.name || 'New project'}
        </h3>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-zinc-500 hover:text-red-600 shrink-0"
        >
          Remove
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field
          label="Name"
          value={item.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Resume Scorer"
        />
        <Field
          label="Link (optional)"
          type="url"
          value={item.link ?? ''}
          onChange={(e) => onChange({ link: e.target.value })}
          placeholder="https://github.com/you/project"
        />
      </div>
      <TextareaField
        label="Description"
        value={item.description}
        onChange={(e) => onChange({ description: e.target.value })}
        rows={2}
        placeholder="What it does and why it matters. 1-2 sentences."
      />
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Tech stack</label>
        <div className="flex flex-wrap gap-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 focus-within:ring-2 focus-within:ring-zinc-900 dark:focus-within:ring-zinc-100">
          {item.techStack.map((t, i) => (
            <span
              key={`${t}-${i}`}
              className="inline-flex items-center gap-1 rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs"
            >
              {t}
              <button
                type="button"
                onClick={() => removeTech(i)}
                aria-label={`Remove ${t}`}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={techDraft}
            onChange={(e) => setTechDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addTech();
              }
            }}
            onBlur={addTech}
            placeholder={item.techStack.length === 0 ? 'React, TypeScript, PostgreSQL' : ''}
            className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-zinc-400"
          />
        </div>
      </div>
    </div>
  );
}

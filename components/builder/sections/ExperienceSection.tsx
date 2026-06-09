'use client';

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
import { Field } from '../Field';
import { SortableItemShell, SortableHandle } from '../SortableItem';
import { useResumeStore } from '@/store/resumeStore';
import type { ExperienceItem } from '@/types/resume';

/**
 * Experience section editor. A draggable, reorderable list of jobs.
 *
 * Reordering:
 *   - Drag the dotted handle on the left of each card.
 *   - Keyboard: focus the handle, press Space/Enter to pick up, Arrow
 *     keys to move, Space/Enter to drop, Escape to cancel. dnd-kit's
 *     KeyboardSensor handles this.
 *   - Click distance threshold (5px) prevents clicks from starting drags.
 *
 * New items insert at the top of the list (see addExperience in the store),
 * matching the conventional resume order: most recent role first.
 */
export function ExperienceSection() {
  const experience = useResumeStore((s) => s.resume.experience);
  const addExperience = useResumeStore((s) => s.addExperience);
  const updateExperience = useResumeStore((s) => s.updateExperience);
  const removeExperience = useResumeStore((s) => s.removeExperience);
  const reorderExperience = useResumeStore((s) => s.reorderExperience);

  // Sensors: pointer (mouse + pen), touch, keyboard. The PointerSensor
  // activation constraint of 5px means a click on the handle does NOT
  // start a drag — only an actual drag does.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = experience.findIndex((e) => e.id === active.id);
    const toIndex = experience.findIndex((e) => e.id === over.id);
    if (fromIndex < 0 || toIndex < 0) return;
    reorderExperience(fromIndex, toIndex);
  };

  // dnd-kit requires stable string ids. We have them.
  const itemIds = experience.map((e) => e.id);

  return (
    <SectionCard
      title="Experience"
      description="One entry per role. Drag the handle to reorder. Lead with position; bullets should quantify."
      action={
        <button
          type="button"
          onClick={addExperience}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          + Add experience
        </button>
      }
    >
      {experience.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No experience yet. Click <span className="font-medium">Add experience</span> to start.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {experience.map((item) => (
                <SortableItemShell key={item.id} id={item.id}>
                  <ExperienceItemCard
                    item={item}
                    onChange={(patch) => updateExperience(item.id, patch)}
                    onRemove={() => removeExperience(item.id)}
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

// ---------------------------------------------------------------------------
// Single experience item
// ---------------------------------------------------------------------------

function ExperienceItemCard({
  item,
  onChange,
  onRemove,
}: {
  item: ExperienceItem;
  onChange: (patch: Partial<ExperienceItem>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 sm:p-4 space-y-3 transition-shadow data-[dragging]:shadow-lg data-[dragging]:border-zinc-400 dark:data-[dragging]:border-zinc-500 data-[dragging]:rotate-[0.5deg]"
    >
      <div className="flex items-center gap-2">
        <SortableHandle id={item.id} />
        <h3 className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
          {item.position || item.company || 'New experience'}
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
          label="Position"
          value={item.position}
          onChange={(e) => onChange({ position: e.target.value })}
          placeholder="Senior Software Engineer"
        />
        <Field
          label="Company"
          value={item.company}
          onChange={(e) => onChange({ company: e.target.value })}
          placeholder="Acme Corp"
        />
        <Field
          label="Start date"
          value={item.startDate}
          onChange={(e) => onChange({ startDate: e.target.value })}
          placeholder="Jan 2023"
          hint="Free-form: 'Jan 2023' or '2023' both work."
        />
        <Field
          label="End date"
          value={item.endDate ?? ''}
          onChange={(e) => onChange({ endDate: e.target.value || null })}
          placeholder="Present"
          hint="Leave blank or type 'Present' for current roles."
        />
        <Field
          label="Location"
          value={item.location ?? ''}
          onChange={(e) => onChange({ location: e.target.value })}
          placeholder="Remote"
          containerClassName="sm:col-span-2"
        />
      </div>

      <BulletsEditor
        bullets={item.bullets}
        onChange={(bullets) => onChange({ bullets })}
      />
    </div>
  );
}

function BulletsEditor({
  bullets,
  onChange,
}: {
  bullets: string[];
  onChange: (next: string[]) => void;
}) {
  const updateAt = (i: number, value: string) => {
    const next = [...bullets];
    next[i] = value;
    onChange(next);
  };
  const addBullet = () => {
    onChange([...bullets, '']);
  };
  const removeBullet = (i: number) => {
    if (bullets.length === 1) {
      onChange(['']);
      return;
    }
    onChange(bullets.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Bullets</label>
      {bullets.map((b, i) => (
        <div key={i} className="flex gap-2">
          <span className="mt-2 select-none text-zinc-400">•</span>
          <textarea
            value={b}
            onChange={(e) => updateAt(i, e.target.value)}
            rows={2}
            placeholder="Led migration of 12 services to Kubernetes, reducing infra cost by 30%."
            className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          />
          <button
            type="button"
            onClick={() => removeBullet(i)}
            aria-label="Remove bullet"
            className="text-zinc-400 hover:text-red-600 px-1 self-start mt-1"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addBullet}
        className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        + Add bullet
      </button>
    </div>
  );
}

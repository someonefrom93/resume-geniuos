'use client';

import { SectionCard } from '../SectionCard';
import { Field } from '../Field';
import { useResumeStore } from '@/store/resumeStore';
import type { EducationItem } from '@/types/resume';

export function EducationSection() {
  const education = useResumeStore((s) => s.resume.education);
  const addEducation = useResumeStore((s) => s.addEducation);
  const updateEducation = useResumeStore((s) => s.updateEducation);
  const removeEducation = useResumeStore((s) => s.removeEducation);

  return (
    <SectionCard
      title="Education"
      description="One entry per degree or program."
      action={
        <button
          type="button"
          onClick={addEducation}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          + Add education
        </button>
      }
    >
      {education.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No education yet. Click <span className="font-medium">Add education</span> to start.
        </p>
      ) : (
        <div className="space-y-4">
          {education.map((item) => (
            <EducationItemForm
              key={item.id}
              item={item}
              onChange={(patch) => updateEducation(item.id, patch)}
              onRemove={() => removeEducation(item.id)}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function EducationItemForm({
  item,
  onChange,
  onRemove,
}: {
  item: EducationItem;
  onChange: (patch: Partial<EducationItem>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {item.institution || item.degree || 'New education'}
        </h3>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-zinc-500 hover:text-red-600"
        >
          Remove
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field
          label="Institution"
          value={item.institution}
          onChange={(e) => onChange({ institution: e.target.value })}
          placeholder="Universidad Politécnica de Madrid"
        />
        <Field
          label="Degree"
          value={item.degree}
          onChange={(e) => onChange({ degree: e.target.value })}
          placeholder="B.S. Computer Science"
        />
        <Field
          label="Start date"
          value={item.startDate}
          onChange={(e) => onChange({ startDate: e.target.value })}
          placeholder="Sep 2018"
        />
        <Field
          label="End date"
          value={item.endDate}
          onChange={(e) => onChange({ endDate: e.target.value })}
          placeholder="Jun 2022"
        />
        <Field
          label="GPA (optional)"
          value={item.gpa ?? ''}
          onChange={(e) => onChange({ gpa: e.target.value })}
          placeholder="3.8 / 4.0"
        />
      </div>
    </div>
  );
}

'use client';

import { SectionCard } from '../SectionCard';
import { TagInput } from '../TagInput';
import { useResumeStore } from '@/store/resumeStore';
import type { SkillsData } from '@/types/resume';

type SkillCategory = keyof SkillsData;

const CATEGORIES: Array<{ key: SkillCategory; label: string; placeholder: string; hint?: string }> = [
  { key: 'technical', label: 'Technical skills', placeholder: 'TypeScript, Python, SQL…', hint: 'Languages, frameworks, libraries.' },
  { key: 'tools', label: 'Tools', placeholder: 'Git, Docker, Figma…', hint: 'Specific software and platforms.' },
  { key: 'languages', label: 'Spoken languages', placeholder: 'English, Spanish…', hint: 'Human languages you speak.' },
  { key: 'soft', label: 'Soft skills', placeholder: 'Mentoring, public speaking…', hint: 'Use sparingly — better demonstrated in bullets.' },
];

export function SkillsSection() {
  const skills = useResumeStore((s) => s.resume.skills);
  const addSkill = useResumeStore((s) => s.addSkill);
  const removeSkill = useResumeStore((s) => s.removeSkill);

  return (
    <SectionCard
      title="Skills"
      description="Type a skill, press Enter or comma to add. Click × to remove."
    >
      <div className="grid sm:grid-cols-2 gap-4">
        {CATEGORIES.map((c) => (
          <TagInput
            key={c.key}
            label={c.label}
            placeholder={c.placeholder}
            values={skills[c.key]}
            onAdd={(v) => addSkill(c.key, v)}
            onRemove={(i) => removeSkill(c.key, i)}
            hint={c.hint}
          />
        ))}
      </div>
    </SectionCard>
  );
}

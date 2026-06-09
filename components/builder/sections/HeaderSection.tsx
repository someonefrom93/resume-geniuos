'use client';

import { SectionCard } from '../SectionCard';
import { Field } from '../Field';
import { useResumeStore } from '@/store/resumeStore';

/**
 * Contact info + name. Single source for the resume header.
 * Wires each input directly to the store via updateContact.
 */
export function HeaderSection() {
  const contact = useResumeStore((s) => s.resume.contact);
  const updateContact = useResumeStore((s) => s.updateContact);

  return (
    <SectionCard
      title="Contact"
      description="The header recruiters see first. Name and email are required."
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <Field
          label="Full name"
          value={contact.name}
          onChange={(e) => updateContact({ name: e.target.value })}
          required
          autoComplete="name"
        />
        <Field
          label="Email"
          type="email"
          value={contact.email}
          onChange={(e) => updateContact({ email: e.target.value })}
          required
          autoComplete="email"
        />
        <Field
          label="Phone"
          type="tel"
          value={contact.phone ?? ''}
          onChange={(e) => updateContact({ phone: e.target.value })}
          autoComplete="tel"
          placeholder="+1 555 123 4567"
        />
        <Field
          label="Location"
          value={contact.location ?? ''}
          onChange={(e) => updateContact({ location: e.target.value })}
          placeholder="City, Country"
        />
        <Field
          label="LinkedIn URL"
          type="url"
          value={contact.linkedin ?? ''}
          onChange={(e) => updateContact({ linkedin: e.target.value })}
          placeholder="https://linkedin.com/in/your-handle"
        />
        <Field
          label="GitHub URL"
          type="url"
          value={contact.github ?? ''}
          onChange={(e) => updateContact({ github: e.target.value })}
          placeholder="https://github.com/your-handle"
        />
        <Field
          label="Portfolio URL"
          type="url"
          value={contact.portfolio ?? ''}
          onChange={(e) => updateContact({ portfolio: e.target.value })}
          placeholder="https://yourdomain.com"
          containerClassName="sm:col-span-2"
        />
      </div>
    </SectionCard>
  );
}

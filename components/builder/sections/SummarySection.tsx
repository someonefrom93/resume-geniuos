'use client';

import { SectionCard } from '../SectionCard';
import { TextareaField } from '../Field';
import { useResumeStore } from '@/store/resumeStore';

const SAMPLE_SUMMARY = `Data engineering professional with 5+ years of experience designing and operating cloud data platforms on AWS and Snowflake. Track record of shipping reliable ELT pipelines, improving data quality, and partnering with analytics teams to deliver business outcomes.`;

export function SummarySection() {
  const summary = useResumeStore((s) => s.resume.summary);
  const setSummary = useResumeStore((s) => s.setSummary);

  return (
    <SectionCard
      title="Summary"
      description="2-3 sentences. Who you are, what you do, what you bring."
    >
      <TextareaField
        label="Professional summary"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        rows={4}
        placeholder={SAMPLE_SUMMARY}
        hint="Aim for 40-200 characters. Specific beats generic."
      />
    </SectionCard>
  );
}

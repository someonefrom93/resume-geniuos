/**
 * Render a real resume to a PDF using @react-pdf/renderer in Node,
 * and write the PDF to /tmp for manual inspection.
 *
 * We do this in a script (not in a test) because @react-pdf needs a
 * real React render. We just want to verify the template doesn't
 * crash and produces a non-empty PDF.
 *
 * Run: npx tsx scripts/test-pdf-render.ts
 */
import * as fs from 'fs';
import { pdf } from '@react-pdf/renderer';
import { ResumePdf } from '../lib/pdf/ResumePdf';
import { createEmptyResume, type Resume } from '../types/resume';

const sample: Resume = {
  ...createEmptyResume(),
  contact: {
    name: 'Juan Diego Angeles Hernandez',
    email: 'j.diego93@outlook.com',
    phone: '+52 442 123 4567',
    location: 'Querétaro, Mexico',
    linkedin: 'https://linkedin.com/in/juan-diego',
  },
  summary:
    'Data engineering professional with 5+ years of experience designing and operating cloud data platforms on AWS and Snowflake.',
  experience: [
    {
      id: 'e1',
      company: 'Santander',
      position: 'Data Engineer',
      startDate: 'Jun 2024',
      endDate: null,
      location: 'Querétaro',
      bullets: [
        'Led KYC processes for new and existing customers, ensuring compliance with AML and regulatory standards',
        'Built ELT pipelines with Snowflake and AWS Glue, reducing data latency by 30%',
      ],
    },
    {
      id: 'e2',
      company: 'Makino',
      position: 'Parts Specialist',
      startDate: 'May 2023',
      endDate: 'Jun 2024',
      bullets: [
        'Managed spare parts supply chain for machining centers across 3 regions',
        'Developed a Power BI dashboard to monitor Fill-Rate KPIs',
      ],
    },
  ],
  education: [
    {
      id: 'ed1',
      institution: 'Universidad Politécnica de Santa Rosa Jáuregui',
      degree: 'B.S. Mechanical Engineering',
      startDate: 'Jan 2013',
      endDate: 'Jan 2016',
    },
  ],
  skills: {
    technical: ['Snowflake', 'AWS S3', 'dbt', 'SQL', 'Python'],
    tools: ['Git', 'Docker'],
    languages: ['English', 'Spanish'],
    soft: [],
  },
  projects: [
    {
      id: 'p1',
      name: 'Resume Scorer',
      description: 'Web app that scores resumes against ATS rules and LLM content quality.',
      techStack: ['Next.js', 'TypeScript'],
    },
  ],
};

async function main() {
  const start = Date.now();
  console.log('Rendering PDF...');
  const blob = await pdf(<ResumePdf resume={sample} />).toBlob();
  const elapsed = Date.now() - start;
  console.log(`Done in ${elapsed}ms`);
  console.log(`Size: ${blob.size} bytes`);

  const buf = Buffer.from(await blob.arrayBuffer());
  const out = '/tmp/test-resume.pdf';
  fs.writeFileSync(out, buf);
  console.log(`Wrote: ${out}`);

  // Sanity-check the PDF header
  const header = buf.slice(0, 5).toString('ascii');
  console.log(`Header: ${JSON.stringify(header)}`);
  if (header !== '%PDF-') {
    throw new Error('Output is not a valid PDF (missing %PDF- header)');
  }
  console.log('Looks like a valid PDF.');
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});

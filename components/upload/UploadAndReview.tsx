'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ResumeUploader } from '@/components/upload/ResumeUploader';
import {
  parseResumeText,
  type ParsedResume,
  type ParsedExperienceItem,
  type ParsedEducationItem,
} from '@/lib/ats/parser';
import { useResumeStore } from '@/store/resumeStore';
import { Field } from '@/components/builder/Field';
import { JOB_DESCRIPTION_KEY, loadJobDescription, saveJobDescription } from '@/lib/storage/jobDescription';

/**
 * The upload + extract + review flow. Shown on /score when the user has
 * no resume in the store yet.
 *
 * State machine inside this component:
 *   - "idle"      : show the uploader
 *   - "reviewing" : show extracted fields + JD textarea + continue button
 *
 * On "Continue to builder" we:
 *   1. Reset the store
 *   2. Apply the (possibly user-edited) contact info
 *   3. Pre-fill the summary if we found one
 *   4. Add one empty experience/education/project entry for each section
 *      the parser detected (gives the user a place to start in the builder)
 *   5. Save the JD to localStorage
 *   6. Navigate to /builder
 *
 * Note: we don't pre-fill bullets or dates in experience entries. The
 * heuristic parser can't reliably do that without making things worse.
 * The user fills those in the builder.
 */
export function UploadAndReview() {
  const router = useRouter();
  const updateContact = useResumeStore((s) => s.updateContact);
  const setSummary = useResumeStore((s) => s.setSummary);
  const setExperience = useResumeStore((s) => s.setExperience);
  const setEducation = useResumeStore((s) => s.setEducation);
  const addProject = useResumeStore((s) => s.addProject);

  const [parsed, setParsed] = useState<ParsedResume | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobDescription, setJobDescription] = useState('');

  // Hydrate JD from localStorage on mount (covers: user came back later, or
  // entered it on a previous visit).
  useEffect(() => {
    setJobDescription(loadJobDescription());
  }, []);

  // Editable copies of the parsed contact fields. Committed to the store
  // only on "Continue", so the user can experiment without mutating the
  // stored resume.
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [github, setGithub] = useState('');
  const [portfolio, setPortfolio] = useState('');

  const handleParsed = (result: { text: string; filename: string; size: number }) => {
    setError(null);
    const p = parseResumeText(result.text);
    setParsed(p);
    setFilename(result.filename);

    setName(p.contact.name ?? '');
    setEmail(p.contact.email ?? '');
    setPhone(p.contact.phone ?? '');
    setLocation('');
    setLinkedin(p.contact.linkedin ?? '');
    setGithub(p.contact.github ?? '');
    setPortfolio(p.contact.portfolio ?? '');
  };

  const handleContinue = () => {
    useResumeStore.getState().resetResume();

    updateContact({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      location: location.trim() || undefined,
      linkedin: linkedin.trim() || undefined,
      github: github.trim() || undefined,
      portfolio: portfolio.trim() || undefined,
    });

    const summarySection = parsed?.sections.find((s) => s.name === 'summary');
    if (summarySection?.body) {
      setSummary(summarySection.body);
    }

    // Commit parsed experience items. The parser gives us a list of
    // pre-filled items (position, company, dates, bullets). We pass them
    // to the store as-is. If parsing failed or the section is empty,
    // we add one empty placeholder so the user has a UI row to start.
    const expSection = parsed?.sections.find((s) => s.name === 'experience');
    if (expSection?.items && (expSection.items as ParsedExperienceItem[]).length > 0) {
      setExperience(
        (expSection.items as ParsedExperienceItem[]).map((it) => ({
          id: '', // store will assign
          company: it.company,
          position: it.position,
          location: it.location,
          startDate: it.startDate,
          endDate: it.endDate,
          bullets: it.bullets.length > 0 ? it.bullets : [''],
        })),
      );
    } else if (expSection) {
      // Section detected but no parseable items. One empty placeholder.
      setExperience([
        {
          id: '',
          company: '',
          position: '',
          location: '',
          startDate: '',
          endDate: null,
          bullets: [''],
        },
      ]);
    }

    // Same pattern for education.
    const eduSection = parsed?.sections.find((s) => s.name === 'education');
    if (eduSection?.items && (eduSection.items as ParsedEducationItem[]).length > 0) {
      setEducation(
        (eduSection.items as ParsedEducationItem[]).map((it) => ({
          id: '',
          institution: it.institution,
          degree: it.degree,
          startDate: it.startDate,
          endDate: it.endDate,
          gpa: '',
        })),
      );
    } else if (eduSection) {
      setEducation([
        {
          id: '',
          institution: '',
          degree: '',
          startDate: '',
          endDate: '',
          gpa: '',
        },
      ]);
    }

    if (parsed?.sections.some((s) => s.name === 'projects')) {
      addProject();
    }

    saveJobDescription(jobDescription);

    router.push('/builder');
  };

  const canContinue = name.trim().length > 0 && email.trim().length > 0;

  if (!parsed) {
    return (
      <div className="space-y-4">
        <ResumeUploader
          onParsed={handleParsed}
          onError={(msg) => {
            setError(msg);
            setParsed(null);
          }}
        />
        {error && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 px-4 py-3 text-sm text-red-800 dark:text-red-200"
          >
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {filename}
          </span>{' '}
          — {parsed.lineCount} lines extracted.{' '}
          {parsed.sections.length > 0 && (
            <>
              Found {parsed.sections.length} section
              {parsed.sections.length === 1 ? '' : 's'}:{' '}
              {parsed.sections.map((s) => s.name).join(', ')}.
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setParsed(null);
            setFilename(null);
            setError(null);
          }}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline"
        >
          Upload a different file
        </button>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Contact</h2>
        <p className="text-xs text-zinc-500">
          We pre-filled what we found. Fix anything that&apos;s wrong.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Field
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
          <Field
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
          />
          <Field
            label="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City, Country"
          />
          <Field
            label="LinkedIn URL"
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            type="url"
          />
          <Field
            label="GitHub URL"
            value={github}
            onChange={(e) => setGithub(e.target.value)}
            type="url"
          />
          <Field
            label="Portfolio URL"
            value={portfolio}
            onChange={(e) => setPortfolio(e.target.value)}
            type="url"
            containerClassName="sm:col-span-2"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">
          Job description <span className="text-zinc-500 text-sm font-normal">(optional)</span>
        </h2>
        <p className="text-xs text-zinc-500">
          Paste the job description you&apos;re targeting. We&apos;ll use it to score
          keyword match.
        </p>
        <textarea
          value={jobDescription}
          onChange={(e) => {
            setJobDescription(e.target.value);
            // Persist on every change so the builder sees it too.
            saveJobDescription(e.target.value);
          }}
          rows={5}
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          placeholder="Paste the job description here…"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">What we found</h2>
        <p className="text-xs text-zinc-500">
          A preview of the items we&apos;ll load into the builder. Anything
          missing or wrong can be fixed there.
        </p>
        <DetectedItems parsed={parsed} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Extracted text</h2>
        <p className="text-xs text-zinc-500">
          This is what came out of the file. You&apos;ll use the builder to fill in
          the rest.
        </p>
        <pre className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4 text-xs overflow-auto max-h-96 whitespace-pre-wrap">
          {parsed.rawText}
        </pre>
      </section>

      <div className="flex items-center justify-between gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <p className="text-xs text-zinc-500">
          {canContinue
            ? 'Ready to continue.'
            : 'Name and email are required to continue.'}
        </p>
        <button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue}
          className="rounded-md bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue to builder →
        </button>
      </div>
    </div>
  );
}

// Re-export the storage key so other components can reference it.
export { JOB_DESCRIPTION_KEY };

// ---------------------------------------------------------------------------
// Detected items preview
// ---------------------------------------------------------------------------

/**
 * Compact preview of what the parser found. Shows counts and a few
 * titles per section. The user verifies at a glance that we found the
 * right things; the full edit happens in the builder.
 */
function DetectedItems({ parsed }: { parsed: ParsedResume }) {
  const expSection = parsed.sections.find((s) => s.name === 'experience');
  const eduSection = parsed.sections.find((s) => s.name === 'education');
  const summarySection = parsed.sections.find((s) => s.name === 'summary');

  const expItems = (expSection?.items ?? []) as ParsedExperienceItem[];
  const eduItems = (eduSection?.items ?? []) as ParsedEducationItem[];

  if (
    !summarySection &&
    expItems.length === 0 &&
    eduItems.length === 0
  ) {
    return (
      <p className="text-sm text-zinc-500">
        We didn&apos;t detect a summary, experience, or education section. The
        builder will start empty — fill in your details there.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {summarySection && (
        <div className="rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-2">
          <p className="text-xs font-medium text-zinc-500">Summary</p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-2">
            {summarySection.body.slice(0, 200)}
            {summarySection.body.length > 200 ? '…' : ''}
          </p>
        </div>
      )}

      {expItems.length > 0 && (
        <div className="rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-2">
          <p className="text-xs font-medium text-zinc-500">
            Experience ({expItems.length})
          </p>
          <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-0.5 mt-1">
            {expItems.map((it, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="truncate">
                  {it.position || '(no position)'}{' '}
                  <span className="text-zinc-500">· {it.company || '(no company)'}</span>
                </span>
                <span className="text-zinc-400 text-xs shrink-0">
                  {[it.startDate, it.endDate ?? 'Present'].filter(Boolean).join(' – ') || ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {eduItems.length > 0 && (
        <div className="rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-2">
          <p className="text-xs font-medium text-zinc-500">
            Education ({eduItems.length})
          </p>
          <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-0.5 mt-1">
            {eduItems.map((it, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="truncate">
                  {it.institution || '(no institution)'}{' '}
                  <span className="text-zinc-500">· {it.degree || '(no degree)'}</span>
                </span>
                <span className="text-zinc-400 text-xs shrink-0">
                  {[it.startDate, it.endDate].filter(Boolean).join(' – ') || ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

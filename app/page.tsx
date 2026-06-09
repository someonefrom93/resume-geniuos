import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 max-w-3xl mx-auto w-full">
        <div className="w-full space-y-12">
          <header className="space-y-3 text-center sm:text-left">
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
              Resume Scorer
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-xl">
              Upload your resume, get a score, edit what needs work, and export
              an ATS-friendly PDF. No account, no signup.
            </p>
          </header>

          <div className="grid sm:grid-cols-2 gap-4">
            <Link
              href="/score"
              className="group block p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
            >
              <h2 className="text-xl font-medium mb-2">Score my resume</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Upload a PDF or DOCX, optionally paste a job description, and
                get a breakdown of what&apos;s working and what to fix.
              </p>
            </Link>

            <Link
              href="/builder"
              className="group block p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
            >
              <h2 className="text-xl font-medium mb-2">Start from scratch</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Build a clean, ATS-friendly resume from a blank slate. Live
                preview as you type, export to PDF when you&apos;re done.
              </p>
            </Link>
          </div>

          <footer className="pt-8 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-500">
            <p>
              Your resume stays in your browser. Nothing is uploaded to a
              server except the text sent to the AI scorer.
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}

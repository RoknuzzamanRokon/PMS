import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white/85 p-10 text-center shadow-xl shadow-slate-900/5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <span className="material-symbols-outlined text-3xl">travel_explore</span>
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
          Page Not Found
        </p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900 dark:text-slate-100">
          This page does not exist yet.
        </h1>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Return to the dashboard and continue exploring the PMS workspace.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-90"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
}

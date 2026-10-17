import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col justify-center px-6 py-24">
      <p className="font-mono text-sm text-emerald-700 dark:text-emerald-400">404</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Off the chart</h1>
      <p className="mt-4 text-lg leading-relaxed text-zinc-700 dark:text-zinc-300">That page does not exist, or has moved.</p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-emerald-700 sm:w-auto dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-emerald-400"
      >
        Back to Haav
      </Link>
    </main>
  );
}

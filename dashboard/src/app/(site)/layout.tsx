import Link from "next/link";
import pkg from "../../../package.json";
import { ModeToggle } from "@/components/mode-toggle";
import { MarginArt } from "./margin-art";

const link = "py-2 text-sm text-zinc-600 hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-400";

export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-zinc-900 px-4 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 dark:bg-zinc-100 dark:text-zinc-900"
      >
        Skip to content
      </a>
      <MarginArt />
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col px-6">
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-zinc-200/70 bg-white/80 py-3 backdrop-blur sm:gap-6 dark:border-zinc-800/70 dark:bg-zinc-950/80">
          <Link href="/" className="font-semibold tracking-tight">Haav</Link>
          <nav className="ml-auto flex items-center gap-x-4 sm:gap-x-6">
            <Link href="/#timeline" className={link}>Timeline</Link>
            <Link href="/#team" className={link}>Team</Link>
            <Link href="/simulation" className={link}>Simulation</Link>
            <Link href="/#contact" className={link}>Contact</Link>
            <ModeToggle />
          </nav>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 outline-none">{children}</main>
        <footer className="mt-24 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6 border-t border-zinc-200 py-8 text-sm text-zinc-500 dark:border-zinc-800">
          <span>
            Contact:{" "}
            <a href="mailto:mhbarrett@wisc.edu" className="underline-offset-4 hover:text-emerald-700 hover:underline dark:hover:text-emerald-400">mhbarrett@wisc.edu</a>
          </span>
          <span>
            Affiliated with the DI Lab at UW-Madison (
            <a href="https://making.engr.wisc.edu" className="underline-offset-4 hover:text-emerald-700 hover:underline dark:hover:text-emerald-400">making.engr.wisc.edu</a>)
          </span>
          <span className="flex items-center gap-4 sm:ml-auto">
            <a href="#main" className="underline-offset-4 hover:text-emerald-700 hover:underline dark:hover:text-emerald-400">Back to top ↑</a>
            <span className="tabular-nums">v{pkg.version}</span>
          </span>
        </footer>
      </div>
    </>
  );
}

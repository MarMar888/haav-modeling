import Link from "next/link";
import pkg from "../../../package.json";
import { MarginArt } from "./margin-art";

const link = "text-sm text-zinc-600 hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-400";

export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <MarginArt />
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col px-6">
        <header className="flex items-baseline gap-6 py-6">
          <Link href="/" className="font-semibold tracking-tight">Haav</Link>
          <nav className="ml-auto flex gap-6">
            <Link href="/#timeline" className={link}>Timeline</Link>
            <Link href="/#team" className={link}>Team</Link>
            <Link href="/simulation" className={link}>Simulation</Link>
            <Link href="/#contact" className={link}>Contact</Link>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mt-24 flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-200 py-8 text-sm text-zinc-500 dark:border-zinc-800">
          <span>
            Contact:{" "}
            <a href="mailto:mhbarrett@wisc.edu" className="hover:text-emerald-700">mhbarrett@wisc.edu</a>
          </span>
          <span className="ml-auto tabular-nums">v{pkg.version}</span>
        </footer>
      </div>
    </>
  );
}

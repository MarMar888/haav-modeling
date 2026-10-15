import type { Metadata } from "next";
import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";

// Working tools: editable by anyone with the link, so kept out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

const nav = "text-sm text-zinc-500 hover:text-emerald-600";

export default function WorkshopLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <header className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-4 px-5 py-3">
          <Link href="/bom" className="font-semibold">Haav workshop</Link>
          <Link href="/bom" className={nav}>BOM</Link>
          <Link href="/optimization" className={nav}>Optimization</Link>
          <a href="/viz/hull.html" target="_blank" rel="noopener noreferrer" className={nav}>3D hull ↗</a>
          <Link href="/" className="ml-auto text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            ← Public site
          </Link>
          <ModeToggle />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </>
  );
}

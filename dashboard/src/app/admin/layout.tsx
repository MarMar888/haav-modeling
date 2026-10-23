import type { Metadata } from "next";
import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";
import { isAdmin } from "@/lib/admin-auth";
import { logout } from "./actions";

// A private tool: kept out of search results.
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const signedIn = await isAdmin();
  return (
    <>
      <header className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-4 px-5 py-3">
          <span className="font-semibold">Haav admin</span>
          <Link href="/" className="ml-auto text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">← Public site</Link>
          {signedIn && (
            <form action={logout}>
              <button type="submit" className="min-h-9 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">Sign out</button>
            </form>
          )}
          <ModeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">{children}</main>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/site";
import { JoinForm } from "./join-form";

export const metadata: Metadata = pageMetadata({
  title: "Become a member",
  description: "Join Haav, a UW-Madison student team building an autonomous boat. Tell us about yourself and which group you want to join.",
  path: "/join",
});

export default function Page() {
  return (
    <section className="pt-8">
      <Link href="/" className="inline-flex min-h-9 items-center text-sm text-zinc-500 underline-offset-4 hover:text-emerald-700 hover:underline dark:hover:text-emerald-400">
        ← Back to home
      </Link>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Become a member</h1>
      <p className="mt-4 text-lg leading-relaxed text-zinc-700 dark:text-zinc-300">
        We are a student team at UW-Madison building an autonomous boat. If you are a student and want to help build it,
        tell us a little about yourself and which group you would like to join.
      </p>
      <p className="mt-3 text-lg leading-relaxed text-zinc-700 dark:text-zinc-300">
        We especially need people to help build our bill of materials (BOM) as we design.
      </p>
      <div className="mt-8">
        <JoinForm />
      </div>
    </section>
  );
}

"use client";

import { useActionState, useEffect, useRef } from "react";
import { INTERESTS } from "@/lib/sponsors";
import { sendInquiry, type InquiryState } from "./actions";

const field =
  "user-invalid:border-red-500 user-invalid:focus-visible:ring-red-500/30 mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none placeholder:text-zinc-400 focus:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600/30 sm:py-2 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900";
const spinner = "mr-2 inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px] motion-reduce:animate-none";
const label = "block text-sm font-medium";

export function InquiryForm() {
  const [state, action, pending] = useActionState<InquiryState, FormData>(sendInquiry, { ok: false });

  const done = useRef<HTMLParagraphElement>(null);
  // Move focus to the confirmation so keyboard and screen-reader users land on it, and it scrolls into view on phones.
  useEffect(() => {
    if (state.ok) done.current?.focus();
  }, [state.ok]);

  if (state.ok) {
    return (
      <p ref={done} tabIndex={-1} role="status" className="flex scroll-mt-24 items-start gap-3 rounded-lg outline-none border border-emerald-600/40 bg-emerald-50 p-5 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
        <span aria-hidden className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">✓</span>
        <span>Thanks. Your message reached the team.</span>
      </p>
    );
  }

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className={label}>
        Name
        <input name="name" required maxLength={200} autoComplete="name" autoCapitalize="words" enterKeyHint="next" className={field} />
      </label>
      <label className={label}>
        Email
        <input name="email" type="email" inputMode="email" required maxLength={320} autoComplete="email" autoCapitalize="none" spellCheck={false} enterKeyHint="next" className={field} />
      </label>
      <label className={label}>
        Company or organization <span className="font-normal text-zinc-500">(optional)</span>
        <input name="org" maxLength={200} autoComplete="organization" autoCapitalize="words" enterKeyHint="next" className={field} />
      </label>
      <label className={label}>
        How would you like to help?
        <span className="relative block">
          <select name="interest" defaultValue={INTERESTS[0]} className={`${field} appearance-none pr-9`}>
            {INTERESTS.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
          <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-zinc-500">▾</span>
        </span>
      </label>
      <label className={`${label} sm:col-span-2`}>
        Anything we should know <span className="font-normal text-zinc-500">(optional)</span>
        <textarea name="message" rows={4} maxLength={5000} className={`${field} min-h-24 resize-y`} />
      </label>
      {/* honeypot: hidden from people, filled in by bots */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <div className="flex flex-col gap-4 sm:col-span-2 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:py-2.5 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-emerald-400"
        >
          {pending ? <><span aria-hidden className={spinner} />Sending…</> : "Talk to the team"}
        </button>
        {state.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      </div>
    </form>
  );
}

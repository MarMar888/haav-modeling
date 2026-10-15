"use client";

import { useActionState } from "react";
import { GROUPS } from "@/lib/team";
import { sendApplication, type JoinState } from "./actions";

const field =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-emerald-600 sm:py-2 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900";
const label = "block text-sm font-medium";

export function JoinForm() {
  const [state, action, pending] = useActionState<JoinState, FormData>(sendApplication, { ok: false });

  if (state.ok) {
    return (
      <p role="status" className="rounded-lg border border-emerald-600/40 bg-emerald-50 p-5 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
        Thanks. Your message reached the team, and we will be in touch.
      </p>
    );
  }

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className={label}>
        Name
        <input name="name" required maxLength={200} autoComplete="name" className={field} />
      </label>
      <label className={label}>
        Email
        <input name="email" type="email" required maxLength={320} autoComplete="email" className={field} />
      </label>
      <label className={label}>
        Year and major <span className="font-normal text-zinc-500">(optional)</span>
        <input name="program" maxLength={200} className={field} />
      </label>
      <label className={label}>
        Which group interests you?
        <select name="interest" defaultValue="Not sure yet" className={field}>
          {[...GROUPS, "Not sure yet"].map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
      </label>
      <label className={`${label} sm:col-span-2`}>
        Anything we should know <span className="font-normal text-zinc-500">(optional)</span>
        <textarea name="message" rows={4} maxLength={5000} className={field} />
      </label>
      {/* honeypot: hidden from people, filled in by bots */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <div className="flex flex-col gap-4 sm:col-span-2 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:py-2.5 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-emerald-400"
        >
          {pending ? "Sending…" : "Join the team"}
        </button>
        {state.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { addSubscribers, type AdminState } from "./actions";
import { field, primary, spinner } from "./ui";

export function AddSubscribers() {
  const [state, action, pending] = useActionState<AdminState, FormData>(addSubscribers, { ok: false });
  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm font-medium">
        Add people
        <textarea
          key={state.ok && !state.error ? "added" : "editing"}
          name="emails"
          rows={3}
          required
          placeholder="one@example.com, two@example.com"
          aria-describedby="emails-hint"
          className={`${field} mt-1 min-h-20 resize-y`}
        />
      </label>
      <p id="emails-hint" className="text-sm text-zinc-500">One or many addresses, separated by commas, spaces or new lines.</p>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={primary}>
          {pending ? <><span aria-hidden className={spinner} />Adding…</> : "Add to newsletter"}
        </button>
        {state.message && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{state.message}</p>}
        {state.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      </div>
    </form>
  );
}

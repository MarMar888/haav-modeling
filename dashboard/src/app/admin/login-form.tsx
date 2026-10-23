"use client";

import { useActionState } from "react";
import { login, type AdminState } from "./actions";
import { field, primary, spinner } from "./ui";

export function LoginForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(login, { ok: false });
  return (
    <form action={action} className="mx-auto mt-8 max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <label className="block text-sm font-medium">
        Passcode
        <input name="passcode" type="password" required autoFocus autoComplete="current-password" className={`${field} mt-1`} />
      </label>
      <button type="submit" disabled={pending} className={primary}>
        {pending ? <><span aria-hidden className={spinner} />Checking…</> : "Sign in"}
      </button>
      {state.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { sendPreview, sendToList, type AdminState } from "./actions";
import { primary, secondary, spinner } from "./ui";

type Props = {
  slug: string;
  subject: string;
  date: string | null;
  /** ISO time the broadcast went out, or "" when it is queued but has no time yet; null when not sent. */
  sentAt: string | null;
  recipients: number;
  previewTo: string;
  canSend: boolean;
};

const idle: AdminState = { ok: false };

export function NewsletterCard({ slug, subject, date, sentAt, recipients, previewTo, canSend }: Props) {
  const [showPreview, setShowPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [previewState, previewAction, previewPending] = useActionState(sendPreview.bind(null, slug), idle);
  const [sendState, sendAction, sendPending] = useActionState(sendToList.bind(null, slug), idle);
  const sent = sentAt !== null || sendState.ok;

  return (
    <li className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-semibold">{subject}</h3>
        <span className="font-mono text-xs text-zinc-500">{slug}{date ? ` · ${date}` : ""}</span>
        {sent && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            Sent{sentAt ? ` ${new Date(sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setShowPreview((v) => !v)} aria-expanded={showPreview} className={secondary}>
          {showPreview ? "Hide preview" : "Preview"}
        </button>
        <form action={previewAction}>
          <button type="submit" disabled={previewPending} className={secondary}>
            {previewPending ? <><span aria-hidden className={spinner} />Sending…</> : "Send preview to me"}
          </button>
        </form>
        {!sent && !confirming && (
          <button type="button" disabled={!canSend || recipients === 0} onClick={() => setConfirming(true)} className={primary}>
            Send to everyone
          </button>
        )}
      </div>

      {!previewState.ok && !previewState.error && <p className="mt-2 text-sm text-zinc-500">Previews go to {previewTo}.</p>}
      {previewState.message && <p role="status" className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">{previewState.message}</p>}
      {previewState.error && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{previewState.error}</p>}

      {confirming && !sent && (
        <form action={sendAction} className="mt-4 rounded-md border border-amber-500/50 bg-amber-50 p-4 dark:bg-amber-950/40">
          <p className="text-sm">
            Send <strong>{subject}</strong> to <strong>{recipients}</strong> {recipients === 1 ? "subscriber" : "subscribers"}? This can&rsquo;t be undone.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={sendPending} className={primary}>
              {sendPending ? <><span aria-hidden className={spinner} />Sending…</> : "Yes, send it"}
            </button>
            <button type="button" disabled={sendPending} onClick={() => setConfirming(false)} className={secondary}>Cancel</button>
          </div>
        </form>
      )}
      {sendState.message && <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">{sendState.message}</p>}
      {sendState.error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{sendState.error}</p>}

      {showPreview && (
        <iframe
          title={`Preview of ${subject}`}
          src={`/admin/preview/${slug}`}
          sandbox=""
          className="mt-4 h-[36rem] w-full rounded-md border border-zinc-200 bg-white dark:border-zinc-700"
        />
      )}
    </li>
  );
}

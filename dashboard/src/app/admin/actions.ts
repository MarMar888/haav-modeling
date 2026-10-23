"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { endSession, isAdmin, passcodeMatches, startSession } from "@/lib/admin-auth";
import { UNSUBSCRIBE_PLACEHOLDER, renderNewsletter, validSlug } from "@/lib/newsletter";
import { PREVIEW_EMAIL } from "@/lib/newsletter-config";
import { addSubscriber, listSubscribers, sendBroadcast, sendPreviewEmail, sentBroadcasts } from "@/lib/resend";
import { SITE_URL } from "@/lib/site";

export type AdminState = { ok: boolean; message?: string; error?: string };

const fail = (error: string): AdminState => ({ ok: false, error });
const message = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function login(_prev: AdminState, f: FormData): Promise<AdminState> {
  const ok = passcodeMatches(String(f.get("passcode") ?? ""));
  if (!ok) {
    await sleep(1000); // slows down guessing
    return fail("That passcode isn't right.");
  }
  await startSession();
  redirect("/admin");
}

export async function logout() {
  await endSession();
  redirect("/admin");
}

// Resend allows two API calls a second, so a pasted list is added at a gentle pace.
const MAX_PER_SUBMIT = 40;

export async function addSubscribers(_prev: AdminState, f: FormData): Promise<AdminState> {
  if (!(await isAdmin())) return fail("Sign in again.");
  const emails = [...new Set(String(f.get("emails") ?? "").split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (emails.length === 0) return fail("Enter at least one email address.");
  if (emails.length > MAX_PER_SUBMIT) return fail(`Add at most ${MAX_PER_SUBMIT} addresses at a time.`);
  const invalid = emails.filter((e) => !z.email().safeParse(e).success);
  if (invalid.length) return fail(`Not valid email addresses: ${invalid.join(", ")}`);

  const failed: string[] = [];
  let added = 0;
  for (const [i, email] of emails.entries()) {
    if (i > 0) await sleep(600);
    try {
      await addSubscriber(email);
      added++;
    } catch (e) {
      failed.push(`${email} (${message(e)})`);
    }
  }
  revalidatePath("/admin");
  if (failed.length) return { ok: added > 0, message: added ? `Added ${added}.` : undefined, error: `Couldn't add ${failed.join("; ")}` };
  return { ok: true, message: added === 1 ? `Added ${emails[0]}.` : `Added ${added} addresses.` };
}

export async function sendPreview(slug: string): Promise<AdminState> {
  if (!(await isAdmin())) return fail("Sign in again.");
  try {
    const n = await renderNewsletter(slug, { assetBase: SITE_URL, unsubscribeUrl: "#" });
    await sendPreviewEmail(PREVIEW_EMAIL, n);
    return { ok: true, message: `Preview sent to ${PREVIEW_EMAIL}.` };
  } catch (e) {
    return fail(message(e));
  }
}

export async function sendToList(slug: string): Promise<AdminState> {
  if (!(await isAdmin())) return fail("Sign in again.");
  if (!validSlug(slug)) return fail("Unknown newsletter.");
  try {
    if ((await sentBroadcasts()).has(slug)) return fail("This newsletter has already been sent.");
    const recipients = (await listSubscribers()).filter((s) => !s.unsubscribed).length;
    if (recipients === 0) return fail("The list is empty.");
    const n = await renderNewsletter(slug, { assetBase: SITE_URL, unsubscribeUrl: UNSUBSCRIBE_PLACEHOLDER });
    // The same content twice in a row (a double click) maps to one broadcast.
    const key = `newsletter-${slug}-${createHash("sha1").update(n.html).digest("hex")}`;
    await sendBroadcast(slug, n, key);
    revalidatePath("/admin");
    return { ok: true, message: `Sending to ${recipients} ${recipients === 1 ? "subscriber" : "subscribers"}.` };
  } catch (e) {
    return fail(message(e));
  }
}

// Everything the newsletter needs from Resend: the subscriber list (a Resend segment), the preview email and the
// broadcast. The only module besides notify.ts that talks to Resend.
import { Resend } from "resend";
import { NEWSLETTER_FROM, SEGMENT_NAME } from "./newsletter-config";

export const resendConfigured = () => Boolean(process.env.RESEND_API_KEY);

let client: Resend | undefined;
function resend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return (client ??= new Resend(key));
}

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error || r.data === null) throw new Error(r.error?.message ?? "Resend returned no data");
  return r.data;
}

// The segment holds the subscribers: the one named SEGMENT_NAME, found or created on first use.
let segmentId: string | undefined;
async function segment(): Promise<string> {
  if (segmentId) return segmentId;
  let after: string | undefined;
  for (let page = 0; page < 10; page++) {
    const list = must(await resend().segments.list({ limit: 100, ...(after && { after }) }));
    const found = list.data.find((s) => s.name === SEGMENT_NAME);
    if (found) return (segmentId = found.id);
    if (!list.has_more || list.data.length === 0) break;
    after = list.data[list.data.length - 1].id;
  }
  return (segmentId = must(await resend().segments.create({ name: SEGMENT_NAME })).id);
}

export type Subscriber = { id: string; email: string; createdAt: string; unsubscribed: boolean };

/** Everyone in the newsletter segment, newest first as Resend returns them. */
export async function listSubscribers(): Promise<Subscriber[]> {
  const segmentId = await segment();
  const out: Subscriber[] = [];
  let after: string | undefined;
  for (let page = 0; page < 50; page++) {
    const list = must(await resend().contacts.list({ segmentId, limit: 100, ...(after && { after }) }));
    for (const c of list.data) out.push({ id: c.id, email: c.email, createdAt: c.created_at, unsubscribed: c.unsubscribed });
    if (!list.has_more || list.data.length === 0) break;
    after = list.data[list.data.length - 1].id;
  }
  return out;
}

/** Adds one address to the list. An existing contact that isn't in the segment yet is added to it. */
export async function addSubscriber(email: string): Promise<void> {
  const id = await segment();
  const created = await resend().contacts.create({ email, segments: [{ id }] });
  if (!created.error) return;
  const joined = await resend().contacts.segments.add({ email, segmentId: id });
  if (joined.error) throw new Error(created.error.message);
}

export type SentInfo = { status: "sent" | "queued"; at: string | null };

/** Broadcasts that already went out (or are going out), keyed by name. A newsletter's broadcast is named after its slug. */
export async function sentBroadcasts(): Promise<Map<string, SentInfo>> {
  const out = new Map<string, SentInfo>();
  let after: string | undefined;
  for (let page = 0; page < 20; page++) {
    const list = must(await resend().broadcasts.list({ limit: 100, ...(after && { after }) }));
    for (const b of list.data) {
      if ((b.status === "sent" || b.status === "queued") && !out.has(b.name)) out.set(b.name, { status: b.status, at: b.sent_at ?? b.created_at });
    }
    if (!list.has_more || list.data.length === 0) break;
    after = list.data[list.data.length - 1].id;
  }
  return out;
}

type Message = { subject: string; preview: string | null; html: string; text: string };

export async function sendPreviewEmail(to: string, m: Message): Promise<void> {
  must(await resend().emails.send({ from: NEWSLETTER_FROM, to: [to], subject: `[Preview] ${m.subject}`, html: m.html, text: m.text }));
}

/** Creates the broadcast and sends it to the whole segment right away. `key` makes a repeated click a no-op. */
export async function sendBroadcast(name: string, m: Message, key: string): Promise<string> {
  const created = await resend().broadcasts.create(
    { name, segmentId: await segment(), from: NEWSLETTER_FROM, subject: m.subject, previewText: m.preview ?? undefined, html: m.html, text: m.text, send: true },
    { headers: { "Idempotency-Key": key } }
  );
  return must(created).id;
}

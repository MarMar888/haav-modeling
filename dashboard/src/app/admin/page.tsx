import { isAdmin } from "@/lib/admin-auth";
import { listNewsletters } from "@/lib/newsletter";
import { PREVIEW_EMAIL } from "@/lib/newsletter-config";
import { listSubscribers, resendConfigured, sentBroadcasts, type SentInfo, type Subscriber } from "@/lib/resend";
import { AddSubscribers } from "./add-subscribers";
import { LoginForm } from "./login-form";
import { NewsletterCard } from "./newsletter-card";

const h2 = "text-xl font-semibold tracking-tight";

export default async function Page() {
  if (!resendConfigured()) {
    return <p className="rounded-lg border border-amber-500/50 bg-amber-50 p-4 text-sm dark:bg-amber-950/40">The admin is locked until <code>RESEND_API_KEY</code> is set in the environment.</p>;
  }
  if (!(await isAdmin())) return <LoginForm />;

  const newsletters = await listNewsletters();
  let subscribers: Subscriber[] = [];
  let sent = new Map<string, SentInfo>();
  let problem: string | null = null;
  try {
    [subscribers, sent] = await Promise.all([listSubscribers(), sentBroadcasts()]);
  } catch (e) {
    problem = `Couldn't reach Resend: ${e instanceof Error ? e.message : "unknown error"}`;
  }
  const active = subscribers.filter((s) => !s.unsubscribed);
  const canSend = !problem;

  return (
    <div className="space-y-14">
      {problem && <p role="alert" className="rounded-lg border border-red-500/50 bg-red-50 p-4 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-100">{problem}</p>}

      <section aria-labelledby="newsletters">
        <h2 id="newsletters" className={h2}>Newsletters</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Drafts are the folders in <code className="font-mono">dashboard/newsletters/</code>. Write one, push it, then send it from here.
        </p>
        {newsletters.length === 0 ? (
          <p className="mt-6 text-zinc-500">No newsletters yet. Copy <code className="font-mono">newsletters/welcome/</code> to start one.</p>
        ) : (
          <ul className="mt-6 space-y-4">
            {newsletters.map((n) => (
              <NewsletterCard
                key={n.slug}
                slug={n.slug}
                subject={n.subject}
                date={n.date}
                sentAt={sent.has(n.slug) ? (sent.get(n.slug)!.at ?? "") : null}
                recipients={active.length}
                previewTo={PREVIEW_EMAIL}
                canSend={canSend}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="subscribers">
        <h2 id="subscribers" className={h2}>Subscribers</h2>
        <p className="mt-2 text-sm text-zinc-500">
          {active.length} {active.length === 1 ? "person" : "people"} will get the next newsletter
          {subscribers.length > active.length ? `; ${subscribers.length - active.length} unsubscribed` : ""}.
        </p>
        <div className="mt-6">
          <AddSubscribers />
        </div>
        {subscribers.length > 0 && (
          <ul className="mt-6 max-h-80 divide-y divide-zinc-200 overflow-y-auto rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
            {subscribers.map((s) => (
              <li key={s.id} className="flex items-baseline justify-between gap-4 px-4 py-2">
                <span className={`break-all ${s.unsubscribed ? "text-zinc-400 line-through" : ""}`}>{s.email}</span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {s.unsubscribed ? "unsubscribed" : new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

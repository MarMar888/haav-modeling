// The newsletter as it will look in an inbox, for the admin page's preview frame.
import { isAdmin } from "@/lib/admin-auth";
import { renderNewsletter } from "@/lib/newsletter";

const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
const escape = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAdmin())) return new Response("Sign in at /admin first.", { status: 401, headers: { "Cache-Control": "no-store" } });
  const { slug } = await params;
  try {
    // Images load from this origin, so a new picture shows before the site is deployed with it.
    const { html } = await renderNewsletter(slug, { assetBase: "", unsubscribeUrl: "#" });
    return new Response(html, { headers });
  } catch (e) {
    const detail = escape(e instanceof Error ? e.message : String(e));
    return new Response(`<body style="font-family:system-ui;padding:1rem;color:#b91c1c"><strong>Can't render this newsletter.</strong><pre style="white-space:pre-wrap">${detail}</pre>`, { status: 500, headers });
  }
}

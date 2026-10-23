// The Haav newsletter email: the layout plus the pieces newsletters/*/newsletter.mdx can use. Email clients ignore most
// modern CSS, so this is table layout with inline styles (the dark-mode block at the top is the one exception).
// Colors and type follow the website: zinc text, emerald links, a monospace tagline.
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { CONTACT_EMAIL, SITE_NAME, SITE_URL } from "@/lib/site";

const sans = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const ink = "#18181b";
const body = "#3f3f46";
const muted = "#71717a";
const rule = "#e4e4e7";
const emerald = "#047857";

const darkMode = `
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (prefers-color-scheme: dark) {
    .bg { background-color: #0a0a0a !important; }
    .card { background-color: #0a0a0a !important; }
    .ink { color: #ededed !important; }
    .body { color: #d4d4d8 !important; }
    .muted { color: #a1a1aa !important; }
    .rule { border-color: #27272a !important; }
    .link { color: #34d399 !important; }
    .button { background-color: #ededed !important; color: #18181b !important; }
  }
`;

export type NewsletterEmailProps = {
  /** Inbox preview text, hidden in the body. */
  preview?: string;
  /** Shown under the wordmark, e.g. "November 2026". */
  dateLabel?: string;
  /** Where the footer's unsubscribe link points. Resend replaces {{{RESEND_UNSUBSCRIBE_URL}}} in a broadcast. */
  unsubscribeUrl: string;
  children: ReactNode;
};

export function NewsletterEmail({ preview, dateLabel, unsubscribeUrl, children }: NewsletterEmailProps) {
  return (
    <html lang="en">
      {/* eslint-disable-next-line @next/next/no-head-element -- email HTML, not a Next page */}
      <head>
        <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style dangerouslySetInnerHTML={{ __html: darkMode }} />
      </head>
      <body className="bg" style={{ margin: 0, padding: 0, backgroundColor: "#ffffff", fontFamily: sans }}>
        {preview && (
          <div style={{ display: "none", overflow: "hidden", maxHeight: 0, maxWidth: 0, opacity: 0, lineHeight: "1px", fontSize: "1px" }}>
            {preview}
            {/* Pad with invisible characters so the inbox doesn't pull in body text after the preview. */}
            {"‌ ".repeat(80)}
          </div>
        )}
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} className="bg" style={{ backgroundColor: "#ffffff" }}>
          <tbody>
            <tr>
              <td align="center" style={{ padding: "24px 16px" }}>
                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} className="card" style={{ maxWidth: 600, backgroundColor: "#ffffff" }}>
                  <tbody>
                    <tr>
                      <td className="rule" style={{ padding: "0 0 16px", borderBottom: `1px solid ${rule}` }}>
                        <a href={SITE_URL} className="ink" style={{ color: ink, fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", textDecoration: "none" }}>
                          {SITE_NAME}
                        </a>
                        <div className="muted" style={{ marginTop: 4, color: muted, fontFamily: mono, fontSize: 12 }}>
                          Highly Amphibious / Autonomous Vessel{dateLabel ? ` · ${dateLabel}` : ""}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "28px 0 8px" }}>{children}</td>
                    </tr>
                    <tr>
                      <td className="rule muted" style={{ padding: "20px 0 0", borderTop: `1px solid ${rule}`, color: muted, fontSize: 13, lineHeight: "20px" }}>
                        You are getting this because you signed up for updates from the Haav student team at UW-Madison.
                        <br />
                        Questions? Reply to this email or write <a href={`mailto:${CONTACT_EMAIL}`} className="link" style={{ color: emerald }}>{CONTACT_EMAIL}</a>.
                        <br />
                        <a href={unsubscribeUrl} className="link" style={{ color: emerald }}>Unsubscribe</a>
                        {" · "}
                        <a href={SITE_URL} className="link" style={{ color: emerald }}>haav.build</a>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

// ---- Building blocks. newsletter.mdx maps plain Markdown onto these, so most newsletters never name them. ----

const block: CSSProperties = { margin: "0 0 16px", fontFamily: sans };

export const H1 = (p: ComponentProps<"h1">) => (
  <h1 {...p} className="ink" style={{ ...block, margin: "0 0 16px", color: ink, fontSize: 28, lineHeight: "34px", fontWeight: 600, letterSpacing: "-0.02em" }} />
);
export const H2 = (p: ComponentProps<"h2">) => (
  <h2 {...p} className="ink" style={{ ...block, margin: "28px 0 12px", color: ink, fontSize: 20, lineHeight: "26px", fontWeight: 600, letterSpacing: "-0.01em" }} />
);
export const H3 = (p: ComponentProps<"h3">) => (
  <h3 {...p} className="ink" style={{ ...block, margin: "24px 0 8px", color: ink, fontSize: 16, lineHeight: "24px", fontWeight: 600 }} />
);
export const P = (p: ComponentProps<"p">) => (
  <p {...p} className="body" style={{ ...block, color: body, fontSize: 16, lineHeight: "26px" }} />
);
export const A = (p: ComponentProps<"a">) => (
  <a {...p} className="link" style={{ color: emerald, textDecoration: "underline" }} />
);
export const UL = (p: ComponentProps<"ul">) => (
  <ul {...p} className="body" style={{ ...block, color: body, fontSize: 16, lineHeight: "26px", paddingLeft: 24 }} />
);
export const OL = (p: ComponentProps<"ol">) => (
  <ol {...p} className="body" style={{ ...block, color: body, fontSize: 16, lineHeight: "26px", paddingLeft: 24 }} />
);
export const LI = (p: ComponentProps<"li">) => <li {...p} style={{ margin: "0 0 6px" }} />;
export const Quote = (p: ComponentProps<"blockquote">) => (
  <blockquote {...p} className="body" style={{ ...block, margin: "0 0 16px", padding: "2px 0 2px 16px", borderLeft: `3px solid ${emerald}`, color: body, fontSize: 16, lineHeight: "26px" }} />
);
export const Code = (p: ComponentProps<"code">) => (
  <code {...p} style={{ fontFamily: mono, fontSize: 14, backgroundColor: "#f4f4f5", color: ink, padding: "1px 5px", borderRadius: 4 }} />
);
export const Hr = () => (
  <hr className="rule" style={{ margin: "28px 0", border: 0, borderTop: `1px solid ${rule}` }} />
);

const imageStyle: CSSProperties = { display: "block", width: "100%", maxWidth: "100%", height: "auto", border: `1px solid ${rule}`, borderRadius: 8 };

export const Img = ({ alt = "", ...p }: ComponentProps<"img">) => (
  // eslint-disable-next-line @next/next/no-img-element -- this renders to email HTML, not a Next page
  <img {...p} alt={alt} style={imageStyle} />
);

/** An image with a caption underneath, like the figures on the website. */
export function Figure({ caption, ...img }: ComponentProps<"img"> & { caption?: string }) {
  return (
    <div style={{ margin: "0 0 20px" }}>
      <Img {...img} />
      {caption && (
        <div className="muted" style={{ marginTop: 8, color: muted, fontSize: 13, lineHeight: "18px", fontFamily: sans }}>{caption}</div>
      )}
    </div>
  );
}

/** A call-to-action button: <Button href="/join">Become a member</Button>. */
export function Button({ href, children }: { href: string; children: ReactNode }) {
  return (
    <div style={{ margin: "8px 0 20px" }}>
      <a
        href={href}
        className="button"
        style={{ display: "inline-block", backgroundColor: ink, color: "#ffffff", fontFamily: sans, fontSize: 15, fontWeight: 500, lineHeight: "20px", padding: "12px 22px", borderRadius: 6, textDecoration: "none" }}
      >
        {children}
      </a>
    </div>
  );
}

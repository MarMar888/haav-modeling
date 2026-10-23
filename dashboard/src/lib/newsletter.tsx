// Newsletters are files: newsletters/<slug>/newsletter.mdx plus the images next to it (see newsletters/README.md).
// This module lists them, and renders one into the HTML and plain text that go to Resend.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ComponentProps } from "react";
import * as runtime from "react/jsx-runtime";
import { evaluate } from "@mdx-js/mdx";
import { render } from "@react-email/render";
import { A, Button, Code, Figure, H1, H2, H3, Hr, Img, LI, NewsletterEmail, OL, P, Quote, UL } from "@/emails/newsletter";
import { SITE_URL } from "./site";

export const NEWSLETTER_DIR = path.join(process.cwd(), "newsletters");
const FILE = "newsletter.mdx";
export const UNSUBSCRIBE_PLACEHOLDER = "{{{RESEND_UNSUBSCRIBE_URL}}}";

// Slugs become folder names and URL segments, so keep them boring (and traversal-proof).
export const validSlug = (s: string) => /^[a-z0-9][a-z0-9_-]*$/i.test(s);

export type Newsletter = { slug: string; subject: string; preview: string | null; date: string | null };

/** Splits the leading `---` block (simple `key: value` lines) from the MDX body. */
function parse(source: string): { meta: Record<string, string>; body: string } {
  const match = source.replace(/^﻿/, "").match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!match) return { meta: {}, body: source };
  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
    if (kv) meta[kv[1].toLowerCase()] = kv[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return { meta, body: source.slice(match[0].length) };
}

async function read(slug: string) {
  if (!validSlug(slug)) throw new Error("Unknown newsletter.");
  let source: string;
  try {
    source = await readFile(path.join(NEWSLETTER_DIR, slug, FILE), "utf8");
  } catch {
    throw new Error(`No newsletters/${slug}/${FILE} file.`);
  }
  const { meta, body } = parse(source);
  if (!meta.subject) throw new Error(`newsletters/${slug}/${FILE} needs a "subject:" line in its header.`);
  return { meta, body };
}

/** All newsletters, newest first (by `date:`, then folder name). Folders starting with _ or . are skipped. */
export async function listNewsletters(): Promise<Newsletter[]> {
  const entries = await readdir(NEWSLETTER_DIR, { withFileTypes: true }).catch(() => []);
  const found = await Promise.all(
    entries
      .filter((e) => e.isDirectory() && validSlug(e.name))
      .map(async ({ name: slug }): Promise<Newsletter | null> => {
        try {
          const { meta } = await read(slug);
          return { slug, subject: meta.subject, preview: meta.preview ?? null, date: meta.date ?? null };
        } catch {
          return null; // a folder without a newsletter.mdx is just a folder
        }
      })
  );
  return found
    .filter((n): n is Newsletter => n !== null)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.slug.localeCompare(a.slug));
}

const isAbsolute = (url: string) => /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url);

/** Maps the Markdown elements (and the extra tags) a newsletter may use onto the email building blocks. */
function components(slug: string, assetBase: string) {
  // Images sit next to the newsletter and are served from /newsletters/<slug>/; links to site pages need the full origin.
  const image = (src = "") => (isAbsolute(src) ? src : `${assetBase}/newsletters/${slug}/${src.replace(/^\.?\//, "")}`);
  const link = (href = "") => (isAbsolute(href) ? href : new URL(href, SITE_URL).toString());
  return {
    h1: H1, h2: H2, h3: H3, p: P, ul: UL, ol: OL, li: LI, blockquote: Quote, code: Code, hr: Hr,
    a: ({ href, ...p }: ComponentProps<"a">) => <A {...p} href={link(href)} />,
    img: ({ src, ...p }: ComponentProps<"img">) => <Img {...p} src={image(typeof src === "string" ? src : "")} />,
    Figure: ({ src, ...p }: ComponentProps<typeof Figure>) => <Figure {...p} src={image(typeof src === "string" ? src : "")} />,
    Button: ({ href, children }: ComponentProps<typeof Button>) => <Button href={link(href)}>{children}</Button>,
  };
}

export type RenderedNewsletter = { subject: string; preview: string | null; html: string; text: string };

/**
 * @param assetBase  Origin that images are loaded from. "" (same origin) for the admin preview, the site origin for email.
 * @param unsubscribeUrl  The footer's unsubscribe link: Resend's placeholder for a broadcast, "#" for a test email.
 */
export async function renderNewsletter(slug: string, { assetBase, unsubscribeUrl }: { assetBase: string; unsubscribeUrl: string }): Promise<RenderedNewsletter> {
  const { meta, body } = await read(slug);
  let Content;
  try {
    ({ default: Content } = await evaluate(body, { ...runtime, development: false }));
  } catch (err) {
    throw new Error(`Couldn't read newsletters/${slug}/${FILE}: ${err instanceof Error ? err.message : String(err)}`);
  }
  const email = (
    <NewsletterEmail preview={meta.preview} dateLabel={dateLabel(meta.date)} unsubscribeUrl={unsubscribeUrl}>
      <Content components={components(slug, assetBase)} />
    </NewsletterEmail>
  );
  const [html, text] = await Promise.all([render(email), render(email, { plainText: true })]);
  return { subject: meta.subject, preview: meta.preview ?? null, html, text };
}

// "2026-11-04" -> "November 2026"
function dateLabel(date?: string) {
  const m = date?.match(/^(\d{4})-(\d{2})/);
  if (!m) return undefined;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

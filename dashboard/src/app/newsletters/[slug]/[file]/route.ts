// Serves the images that sit next to a newsletter (newsletters/<slug>/hull.jpg), so the sent email can load them
// from https://haav.build/newsletters/<slug>/hull.jpg. Only image files in a newsletter's own folder are served.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NEWSLETTER_DIR, validSlug } from "@/lib/newsletter";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; file: string }> }) {
  const { slug, file } = await params;
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type || !validSlug(slug) || !/^[\w.-]+$/.test(file) || file.startsWith(".")) return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(path.join(NEWSLETTER_DIR, slug, file));
    return new Response(bytes, { headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

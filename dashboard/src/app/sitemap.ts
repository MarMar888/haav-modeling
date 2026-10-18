import type { MetadataRoute } from "next";
import { PUBLIC_PATHS, absoluteUrl } from "@/lib/site";

// No lastModified: nothing here tracks real edit dates, and a wrong date is worse than none.
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((p) => ({ url: absoluteUrl(p.path) }));
}

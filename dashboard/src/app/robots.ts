import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Search engines and AI crawlers (answer/search bots and training bots) are all welcome on the public pages. A named
// group replaces the `*` group for that bot, so the disallow list is repeated. The workshop pages carry `noindex`
// instead of a Disallow here, because a bot must be able to fetch a page to see its `noindex`.
const AI_CRAWLERS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-SearchBot", "Claude-User",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot-Extended", "CCBot", "Bytespider", "meta-externalagent", "cohere-ai", "Amazonbot",
];
const disallow = ["/api/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      { userAgent: AI_CRAWLERS, allow: "/", disallow },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

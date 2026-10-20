import Link from "next/link";
import pkg from "../../../package.json";
import { ModeToggle } from "@/components/mode-toggle";
import { CONTACT_EMAIL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { MarginArt } from "./margin-art";
import { NavLinks } from "./nav-links";

// Structured data for search engines and AI answer engines: who we are and what the site is.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      alternateName: "Highly Amphibious / Autonomous Vessel",
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
      email: CONTACT_EMAIL,
      parentOrganization: { "@type": "CollegeOrUniversity", name: "University of Wisconsin–Madison", url: "https://www.wisc.edu" },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      inLanguage: "en",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <a
        href="#main"
        className="sr-only z-50 min-h-11 items-center rounded-md bg-zinc-900 px-4 py-2 text-sm focus:inline-flex text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 dark:bg-zinc-100 dark:text-zinc-900"
      >
        Skip to content
      </a>
      <MarginArt />
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col px-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))]">
        <header data-site-chrome className="scroll-progress sticky top-0 z-30 flex items-center gap-3 border-b border-zinc-200/70 bg-white/80 py-3 backdrop-blur sm:gap-6 dark:border-zinc-800/70 dark:bg-zinc-950/80">
          <Link href="/" className="-mx-2 inline-flex min-h-11 items-center px-2 font-semibold tracking-tight">Haav</Link>
          <nav className="ml-auto flex items-center gap-x-2.5 sm:gap-x-6">
            <NavLinks />
            <ModeToggle />
          </nav>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 outline-none">{children}</main>
        <footer data-site-chrome className="mt-24 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6 border-t border-zinc-200 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] text-sm text-zinc-500 dark:border-zinc-800">
          <span className="break-words">
            Contact:{" "}
            <a href="mailto:mhbarrett@wisc.edu" className="inline-flex min-h-11 items-center underline-offset-4 hover:text-emerald-700 hover:underline dark:hover:text-emerald-400">mhbarrett@wisc.edu</a>
          </span>
          <span>
            Affiliated with the DI Lab at UW-Madison (
            <a href="https://making.engr.wisc.edu" className="inline-flex min-h-11 items-center underline-offset-4 hover:text-emerald-700 hover:underline dark:hover:text-emerald-400">making.engr.wisc.edu</a>)
          </span>
          <span className="flex items-center gap-4 sm:ml-auto">
            <a href="#main" className="inline-flex min-h-11 items-center underline-offset-4 hover:text-emerald-700 hover:underline dark:hover:text-emerald-400">Back to top ↑</a>
            <span className="tabular-nums">v{pkg.version}</span>
          </span>
        </footer>
      </div>
    </>
  );
}

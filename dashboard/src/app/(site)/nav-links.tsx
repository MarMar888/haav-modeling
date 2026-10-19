"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/#timeline", label: "Timeline", id: "timeline" },
  { href: "/#team", label: "Team", id: "team" },
  { href: "/simulation", label: "Simulation" },
  { href: "/#contact", label: "Contact", id: "contact" },
] as const;

const base =
  "inline-flex min-h-11 items-center whitespace-nowrap border-b-2 text-sm hover:text-emerald-700 dark:hover:text-emerald-400";

// Header links; the one for the section in view (or the current page) is underlined and marked aria-current.
export function NavLinks() {
  const pathname = usePathname();
  const [section, setSection] = useState<string | null>(null);

  useEffect(() => {
    if (pathname !== "/") return;
    const els = LINKS.flatMap((l) => ("id" in l ? [document.getElementById(l.id)] : [])).filter((e): e is HTMLElement => !!e);
    const seen = new Set<string>();
    // A section counts as "in view" while it crosses a band just below the sticky header.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) seen.add(e.target.id);
          else seen.delete(e.target.id);
        }
        setSection(els.map((el) => el.id).findLast((id) => seen.has(id)) ?? null);
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  return LINKS.map((l) => {
    const current = "id" in l ? pathname === "/" && section === l.id : pathname === l.href;
    return (
      <Link
        key={l.href}
        href={l.href}
        aria-current={current ? "location" : undefined}
        className={`${base} ${current ? "border-emerald-600 text-emerald-700 dark:text-emerald-400" : "border-transparent text-zinc-600 dark:text-zinc-400"}`}
      >
        {l.label}
      </Link>
    );
  });
}

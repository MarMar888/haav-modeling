import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ADVISORS, GROUPS, TEAM } from "@/lib/team";
import { CONTACT_EMAIL, SITE_DESCRIPTION, pageMetadata } from "@/lib/site";
import { TIMELINE } from "@/lib/timeline";
import { InquiryForm } from "./inquiry-form";

export const metadata: Metadata = pageMetadata({ description: SITE_DESCRIPTION, path: "/" });

const h2 ="text-2xl font-semibold tracking-tight";
const section = "scroll-mt-20 border-t border-zinc-200 pt-12 dark:border-zinc-800";
const cta = "inline-flex min-h-11 items-center justify-center rounded-md px-5 text-sm font-medium transition-colors sm:w-auto";
const prose = "mt-4 text-pretty text-lg leading-relaxed text-zinc-700 dark:text-zinc-300";


export default function Page() {
  return (
    <div className="space-y-20">
      <section className="pt-8">
        <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight">Haav</h1>
        <p className="mt-3 font-mono text-sm text-zinc-500">Highly Amphibious / Autonomous Vessel</p>
        <figure className="mt-10">
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-700">
          <Image
            src="/haav-hull.webp"
            alt="CAD rendering of the Haav hull, hybrid planing hull"
            width={1202}
            height={1008}
            priority
            className="mx-auto h-auto max-h-[24rem] w-full object-contain"
          />
        </div>
        <figcaption className="mt-2 text-sm text-zinc-500">Our current hull design.</figcaption>
        </figure>
        <p className="mt-10 text-xl leading-relaxed">
          We are a student team building an autonomous boat from the ground up at UW-Madison.
        </p>
        <Image
          src="/uw-logo-horizontal.png"
          alt="University of Wisconsin–Madison"
          width={1542}
          height={527}
          className="mt-4 h-auto w-48 max-w-full rounded bg-white p-2 sm:w-64"
        />
        <p className={prose}>
          The goal is a planing hull with a 30 pound added payload on a 2 mile long course.
        </p>
        <p className={prose}>
          We are planning to participate in the PEP2027 Autonomous Uncrewed Division, a 2 mile point to point time
          challenge.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/join" className={`${cta} bg-zinc-900 text-white hover:bg-emerald-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-emerald-400`}>
            Become a member
          </Link>
          <Link href="/#contact" className={`${cta} border border-zinc-300 hover:border-emerald-600 hover:text-emerald-700 dark:border-zinc-700 dark:hover:text-emerald-400`}>
            Sponsor the build
          </Link>
        </div>
      </section>

      <section id="boat" className={section}>
        <h2 className={h2}>Basic Spec</h2>
        <p className={prose}>
          A 4-6 foot composite hull. Autonomy using GPS, IMU and LIDAR.
        </p>
        <ul aria-label="Key specs" className="mt-6 flex flex-wrap gap-2 font-mono text-sm">
          {["4–6 ft composite hull", "GPS", "IMU", "LIDAR", "30 lb payload", "2 mile course"].map((t) => (
            <li key={t} className="rounded-full border border-zinc-200 px-3 py-1 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">{t}</li>
          ))}
        </ul>
      </section>

      <section id="groups" className={section}>
        <h2 className={h2}>Primary groups</h2>
        <ol className="mt-8 grid gap-3 sm:grid-cols-2">
          {GROUPS.map((g, i) => (
            <li key={g} className="flex items-baseline gap-x-4 rounded-lg border border-zinc-200 px-4 py-3 transition-[border-color,transform] hover:border-emerald-600/60 motion-safe:hover:-translate-y-0.5 dark:border-zinc-800">
              <span className="shrink-0 font-mono text-sm tabular-nums text-emerald-700 dark:text-emerald-400">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-lg leading-snug">{g}</span>
            </li>
          ))}
        </ol>
        <p className={prose}>
          Want to work on one of these?{" "}
          <Link href="/join" className="text-emerald-700 underline underline-offset-4 hover:text-emerald-600 dark:text-emerald-400">
            Become a member
          </Link>
          .
        </p>
      </section>

      <section id="timeline" className={section}>
        <h2 className={h2}>Timeline</h2>
        <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-zinc-500">
          <span className="inline-flex items-center gap-2"><span aria-hidden className="size-3 rounded-full border-2 border-emerald-600 bg-emerald-600" />A single day</span>
          <span className="inline-flex items-center gap-2"><span aria-hidden className="size-3 rounded-full border-2 border-emerald-600" />A stretch of work</span>
        </p>
        {/* A rail with a marker per milestone: a filled dot for a day, a hollow ring for a stretch of work. */}
        <ol className="relative ml-3 mt-8 border-l-2 sm:ml-32 border-zinc-200 dark:border-zinc-700">
          {TIMELINE.map((m) => {
            const stretch = /–|^From |^Until /.test(m.when);
            return (
              <li key={m.label} className="relative pb-8 pl-6 last:pb-0">
                <span
                  aria-hidden
                  className={`absolute -left-[8px] top-[7px] size-3.5 rounded-full border-2 border-emerald-600 ring-4 ring-white dark:ring-zinc-950 ${
                    stretch ? "bg-white dark:bg-zinc-950" : "bg-emerald-600"
                  }`}
                />
                <time dateTime={m.date} className="block text-sm text-zinc-500 sm:absolute sm:right-full sm:top-1 sm:mr-5 sm:w-28 sm:text-right">
                  {m.when}
                </time>
                <div className="text-lg font-semibold leading-snug">{m.label}</div>
                {m.detail && <p className="mt-1 leading-relaxed text-zinc-600 dark:text-zinc-400">{m.detail}</p>}
              </li>
            );
          })}
        </ol>
      </section>

      <section id="team" className={section}>
        <h2 className={h2}>Team</h2>
        <People people={TEAM} />
      </section>

      <section id="advisors" className={section}>
        <h2 className={h2}>Advisors</h2>
        <People people={ADVISORS} />
      </section>

      <section id="contact" className={section}>
        <h2 className={h2}>Sponsor the build</h2>
        <p className={prose}>
          We are looking for funds, parts and skills. If your company or lab would like to help, or would like to learn more, please fill out the form below! 
        </p>
        
        <p className={prose}>
As a sponsor, you can get your logo on our hull, merch and website, access to our team talent and more soon!
        </p>
        <div className="mt-8">
          <InquiryForm />
        </div>
        <p className="mt-6 text-sm text-zinc-500">
          Prefer email?{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-emerald-700 underline underline-offset-4 hover:text-emerald-600 dark:text-emerald-400">
            {CONTACT_EMAIL}
          </a>
        </p>
      </section>
    </div>
  );
}

function People({ people }: { people: readonly { name: string; role: string; bio: string; linkedin?: string }[] }) {
  return (
    <dl className="mt-8 space-y-8">
      {people.map((m) => (
        <div key={m.name} className="flex gap-4">
          <span
            aria-hidden
            className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          >
            {m.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("")}
          </span>
          <div className="min-w-0">
          <dt className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-lg font-semibold">{m.name}</span>
            <span className="text-zinc-500">{m.role}</span>
          </dt>
          <dd className="mt-2 leading-relaxed text-zinc-700 dark:text-zinc-300">{m.bio}</dd>
          {m.linkedin && (
            <dd className="mt-3 text-sm">
              <a
                href={m.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${m.name} on LinkedIn`}
                className="inline-flex min-h-9 items-center rounded-full border border-emerald-600/40 px-3 text-emerald-700 transition-colors hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
              >
                LinkedIn ↗
              </a>
            </dd>
          )}
          </div>
        </div>
      ))}
    </dl>
  );
}

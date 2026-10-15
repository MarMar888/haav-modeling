import Image from "next/image";
import Link from "next/link";
import { ADVISORS, GROUPS, TEAM } from "@/lib/team";
import { TIMELINE } from "@/lib/timeline";
import { InquiryForm } from "./inquiry-form";

const h2 ="text-2xl font-semibold tracking-tight";
const section = "scroll-mt-8 border-t border-zinc-200 pt-12 dark:border-zinc-800";
const prose = "mt-4 text-lg leading-relaxed text-zinc-700 dark:text-zinc-300";


export default function Page() {
  return (
    <div className="space-y-20">
      <section className="pt-8">
        <h1 className="text-6xl font-semibold tracking-tight">Haav</h1>
        <p className="mt-3 font-mono text-sm text-zinc-500">Highly Amphibious / Autonomous Vessel</p>
        <div className="mt-10 overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <Image
            src="/haav-hull.webp"
            alt="CAD rendering of the Haav hull, hybrid planing hull"
            width={1202}
            height={1008}
            priority
            className="mx-auto h-auto max-h-[24rem] w-full object-contain"
          />
        </div>
        <p className="mt-2 text-sm text-zinc-500">Our current hull design.</p>
        <p className="mt-10 text-xl leading-relaxed">
          We are a student team building an autonomous boat from the ground up at UW-Madison.
        </p>
        <Image
          src="/uw-logo-horizontal.png"
          alt="University of Wisconsin–Madison"
          width={1542}
          height={527}
          className="mt-4 h-auto w-64"
        />
        <p className={prose}>
          The goal is a planing hull with a 30 pound added payload on a 2 mile long course.
        </p>
        <p className={prose}>
          We are planning to participate in the PEP2027 Autonomous Uncrewed Division, a 2 mile point to point time
          challenge.
        </p>
      </section>

      <section id="boat" className={section}>
        <h2 className={h2}>Basic Spec</h2>
        <p className={prose}>
          A 4-6 foot composite hull. Autonomy using GPS, IMU and LIDAR.
        </p>
      </section>

      <section id="groups" className={section}>
        <h2 className={h2}>Primary groups</h2>
        <ol className="mt-8 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {GROUPS.map((g, i) => (
            <li key={g} className="flex items-baseline gap-x-6 py-3">
              <span className="w-8 shrink-0 tabular-nums text-zinc-500">{i + 1}</span>
              <span className="text-lg">{g}</span>
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
        {/* A rail with a marker per milestone: a filled dot for a day, a hollow ring for a stretch of work. */}
        <ol className="relative ml-32 mt-8 border-l-2 border-zinc-200 dark:border-zinc-700">
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
                <time dateTime={m.date} className="absolute right-full top-1 mr-5 w-28 text-right text-sm text-zinc-500">
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
      </section>
    </div>
  );
}

function People({ people }: { people: readonly { name: string; role: string; bio: string; linkedin?: string }[] }) {
  return (
    <dl className="mt-8 space-y-8">
      {people.map((m) => (
        <div key={m.name}>
          <dt className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-lg font-semibold">{m.name}</span>
            <span className="text-zinc-500">{m.role}</span>
          </dt>
          <dd className="mt-2 leading-relaxed text-zinc-700 dark:text-zinc-300">{m.bio}</dd>
          {m.linkedin && (
            <dd className="mt-2 text-sm">
              <a
                href={m.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${m.name} on LinkedIn`}
                className="text-emerald-700 underline underline-offset-4 hover:text-emerald-600 dark:text-emerald-400"
              >
                LinkedIn
              </a>
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

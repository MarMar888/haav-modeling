import type { Metadata } from "next";
import Image from "next/image";
import { TEAM } from "@/lib/team";
import { TIMELINE } from "@/lib/timeline";

// A one-page, letter-size handout. Open /handout and print (or save as PDF); `public/haav-handout.pdf`
// is the same page exported. Relaxed on purpose: white page, a few plain grey cards, the site's own sans font,
// black, white and grey only, plus red for the UW–Madison mark. Colours are fixed so it prints the same in dark mode.

export const metadata: Metadata = { title: "Team handout", robots: { index: false } };

const PAPER = "#ffffff";
const CARD = "#f5f5f5";
const EDGE = "#f5f5f5";
const INK = "#111111";
const SOFT = "#555555";
const RED = "#c5050c"; // the UW–Madison mark only
const COMPANIES = "Tesla, Northrop Grumman, Xcel Energy, Fincantieri and Milwaukee Tool";

// The team's engineering majors, and the part of the boat each one covers. No names on this page.
const DISCIPLINES = [
  { name: "Industrial", covers: "Optimization, composites and manufacturing" },
  { name: "Mechanical", covers: "Structures, CAD, fabrication" },
  { name: "Electrical", covers: "Power, battery and high voltage" },
  { name: "Computer", covers: "Firmware, software, controls" },
];

// The three parts of the boat and the approach to each. Names stay off this page except the contact in the footer.
const COMPONENTS = [
  {
    title: "Hull",
    strategy: "Plane fast and stay light.",
    points: ["Hybrid planing composite hull", "Dimensions shaped by weight", "Optimization shaped by hydrodynamics"],
  },
  {
    title: "Electric",
    strategy: "Every watt-hour to speed.",
    points: ["High-voltage battery storage", "Propulsion sized by the model", "Propulsion and cooling co-designed"],
  },
  {
    title: "Autonomous",
    strategy: "Manage drift and controls.",
    points: ["GPS, IMU and LIDAR sensing", "Fundamental feedback protocols", "Software plans the route"],
  },
];

// A few quick facts about the boat.
const FEATURES = [
  { value: "30 mph", label: "Autonomously" },
  { value: "Integrated", label: "Software and controller" },
  { value: "Realtime LTE", label: "With LoRa backup" },
];

const h2 = "text-[17px] font-semibold leading-tight tracking-tight";
const card = "rounded-2xl border px-4 py-3";

export default function Page() {
  return (
    <main className="min-h-screen bg-zinc-300 py-8 print:bg-white print:py-0">
      <style>{`@page { size: 8.5in 11in; margin: 0 } html { -webkit-print-color-adjust: exact; print-color-adjust: exact }`}</style>
      <article
        className="mx-auto flex h-[11in] w-[8.5in] flex-col overflow-hidden px-[0.55in] pb-[0.45in] pt-[0.45in] shadow-2xl print:shadow-none"
        style={{ backgroundColor: PAPER, color: INK }}
      >
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-[48px] font-bold leading-none tracking-tight">HaaV</h1>
            <p className="mt-1.5 text-[13px]" style={{ color: SOFT }}>Highly amphibious / autonomous Vessel</p>
          </div>
          <div className="text-right">
            <div className="text-[26px] font-bold leading-none tracking-tight" style={{ color: RED }}>Team: UW–Madison</div>
            <div className="mt-1 text-[13px]" style={{ color: SOFT }}>College of Engineering</div>
          </div>
        </header>

        <section className="relative -mt-3 flex items-center">
          <p className="relative z-10 max-w-[4.9in] text-[30px] font-bold leading-[1.1] tracking-tight">
            We are a student team building an uncrewed autonomous boat from the ground up.
          </p>
          <Image
            src="/haav-hull.webp"
            alt="CAD rendering of the Haav hull"
            width={1202}
            height={1008}
            className="ml-auto h-auto w-[1.9in] -rotate-3 mix-blend-multiply"
          />
        </section>

        <section className="mt-3 grid grid-cols-3 gap-3">
          {FEATURES.map((f) => (
            <div key={f.label} className="rounded-2xl px-[0.15in] py-[0.1in]" style={{ backgroundColor: CARD }}>
              <div className="text-[22px] font-bold leading-tight tracking-tight">{f.value}</div>
              <div className="text-[11.5px] leading-snug" style={{ color: SOFT }}>{f.label}</div>
            </div>
          ))}
        </section>

        <section className={`${card} mt-4`} style={{ backgroundColor: CARD, borderColor: EDGE }}>
          <h2 className={h2}>Ground up means simulation + modeling first</h2>
          <p className="mt-1 text-[11.5px] leading-[1.45]" style={{ color: SOFT }}>
            We are building the model from first principles, mixing empirical and rule-of-thumb decisions with dynamic
            programming. Each constraint cuts the space of possible boats, and our model finds the fastest one based on
            current variables. As we build and test, we keep updating the model and adding constraints: a hybrid of
            simulation and empirical data.
          </p>
        </section>

        <section className="mt-4">
          <h2 className={h2}>Engineers from across UW–Madison</h2>
          <p className="mt-1 text-balance text-[12px] leading-[1.5]" style={{ color: SOFT }}>
            Lead members have interned at {COMPANIES}.
          </p>
          <dl className="mt-1.5 grid grid-cols-4 gap-x-6">
            {DISCIPLINES.map((d) => (
              <div key={d.name}>
                <dt className="text-[12.5px] font-semibold">{d.name}</dt>
                <dd className="text-[11.5px] leading-snug" style={{ color: SOFT }}>{d.covers}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-4">
          <h2 className={h2}>Our primary phases</h2>
          <div className="mt-1.5 grid grid-cols-3 gap-3">
            {COMPONENTS.map((c) => (
              <div key={c.title} className="rounded-2xl px-[0.15in] py-[0.16in]" style={{ backgroundColor: CARD }}>
                <h3 className="text-[15px] font-semibold leading-tight">{c.title}</h3>
                <p className="mt-0.5 text-[12px] font-semibold leading-snug">{c.strategy}</p>
                <ul className="mt-2 space-y-1 text-[10.5px] leading-snug" style={{ color: SOFT }}>
                  {c.points.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4">
          <h2 className={h2}>Timeline</h2>
          <ol className="mt-1.5 grid grid-flow-col grid-cols-2 grid-rows-[repeat(6,auto)] gap-x-8 gap-y-[2px]">
            {TIMELINE.map((m) => (
              <li key={m.label} className="flex items-baseline gap-3 text-[11px] leading-snug">
                <span className="w-[0.98in] shrink-0 font-semibold tabular-nums">{m.when}</span>
                <span style={{ color: SOFT }}>{m.label}</span>
              </li>
            ))}
          </ol>
        </section>

        <footer
          className="mt-auto flex items-center justify-between gap-6 rounded-2xl px-5 py-3.5"
          style={{ backgroundColor: INK, color: PAPER }}
        >
          <div className="max-w-[3.5in]">
            <div className="text-[19px] font-semibold leading-tight tracking-tight">Want to get involved?</div>
            <p className="mt-0.5 text-[12px] leading-snug opacity-80">
              We are looking for funds, parts, advisors and supporters. Email Marley or head to our site for more information.
            </p>
          </div>
          <div className="text-right text-[12px] leading-snug">
            <a href="https://bit.ly/haav" className="text-[19px] font-semibold leading-tight">bit.ly/haav</a>
            <div className="mt-0.5 font-medium">{TEAM[0].name}, {TEAM[0].role}</div>
            <div className="opacity-80">mhbarrett@wisc.edu</div>
          </div>
        </footer>
      </article>
    </main>
  );
}

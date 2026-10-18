import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Simulation",
  description: "Simulation studies for Haav, a four-foot autonomous boat built from the ground up.",
  path: "/simulation",
});

export default function Page() {
  return (
    <div className="pt-8">
      <Link href="/" className="inline-flex min-h-9 items-center text-sm text-zinc-500 underline-offset-4 hover:text-emerald-700 hover:underline dark:hover:text-emerald-400">
        ← Back to home
      </Link>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Simulation</h1>
      <p className="mt-4 text-lg leading-relaxed text-zinc-700 dark:text-zinc-300">
        Early sizing studies for the propulsion system: how much thrust the hull needs and which propeller and motor can deliver it.
      </p>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">Study #1</h2>
        {/* The charts are dense, so the figure breaks out of the narrow reading column. */}
        {/* On phones the charts keep a readable width and scroll sideways instead of shrinking to illegible. */}
        <div className="relative left-1/2 mt-6 w-screen max-w-6xl -translate-x-1/2 overflow-x-auto px-6">
          <Image
            src="/simulation/study-1.png"
            alt="Six charts relating propeller, thrust, motor drive and force against boat speed: thrust needed by the hull against thrust available from 2, 4, 6 and 10 kilowatt motors; propeller efficiency by diameter; blade tip speed against a 150 feet per second limit; propeller rpm by pitch; the motor Kv needed; and shaft torque."
            width={1612}
            height={826}
            priority
            quality={92}
            sizes="(min-width: 1152px) 1152px, 100vw"
            className="h-auto w-full min-w-[40rem] rounded-lg bg-white"
          />
        </div>
        <p className="mt-3 text-sm text-zinc-500 sm:hidden">Swipe the charts sideways to see all of them.</p>
        <p className="mt-3 text-sm">
          <a
            href="/simulation/study-1.png"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-700 underline underline-offset-4 hover:text-emerald-600 dark:text-emerald-400"
          >
            Open full size
          </a>
        </p>
      </section>
    </div>
  );
}

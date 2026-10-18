import type { Metadata } from "next";
import Image from "next/image";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Simulation",
  description: "Simulation studies for Haav, a four-foot autonomous boat built from the ground up.",
  path: "/simulation",
});

export default function Page() {
  return (
    <div className="pt-8">
      <h1 className="text-4xl font-semibold tracking-tight">Simulation</h1>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">Study #1</h2>
        {/* The charts are dense, so the figure breaks out of the narrow reading column. */}
        <div className="relative left-1/2 mt-6 w-screen max-w-6xl -translate-x-1/2 px-6">
          <Image
            src="/simulation/study-1.png"
            alt="Six charts relating propeller, thrust, motor drive and force against boat speed: thrust needed by the hull against thrust available from 2, 4, 6 and 10 kilowatt motors; propeller efficiency by diameter; blade tip speed against a 150 feet per second limit; propeller rpm by pitch; the motor Kv needed; and shaft torque."
            width={1612}
            height={826}
            priority
            quality={92}
            sizes="(min-width: 1152px) 1152px, 100vw"
            className="h-auto w-full rounded-lg"
          />
        </div>
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

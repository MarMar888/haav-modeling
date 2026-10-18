// Markdown for LLMs, built from the same data as the pages so it cannot drift from them.
import { ADVISORS, GROUPS, TEAM } from "@/lib/team";
import { TIMELINE } from "@/lib/timeline";
import { CONTACT_EMAIL, PUBLIC_PATHS, SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from "@/lib/site";

const header = `# ${SITE_NAME}\n\n> ${SITE_DESCRIPTION}`;

const facts = [
  "Haav is a student team at the University of Wisconsin–Madison, affiliated with the DI Lab (https://making.engr.wisc.edu).",
  "The goal is a planing hull (4–6 ft, composite) carrying a 30 lb added payload over a 2 mile point-to-point course.",
  "Autonomy uses GPS, IMU and LIDAR.",
  "The team plans to enter the PEP2027 Autonomous Uncrewed Division, a 2 mile point-to-point time challenge.",
  "The boat has not been built or put in the water yet; the timeline below is a plan.",
];

export function llmsTxt() {
  return [
    header,
    "## About\n\n" + facts.map((f) => `- ${f}`).join("\n"),
    "## Pages\n\n" +
      PUBLIC_PATHS.map((p) => `- [${p.title}](${absoluteUrl(p.path)}): ${p.description}`).join("\n"),
    "## Optional\n\n" +
      `- [Full text of this site](${absoluteUrl("/llms-full.txt")}): team, advisors, groups and the whole timeline in one file\n` +
      `- Contact: ${CONTACT_EMAIL}`,
  ].join("\n\n") + "\n";
}

export function llmsFullTxt() {
  const people = (list: readonly { name: string; role: string; bio: string }[]) =>
    list.map((m) => `### ${m.name}: ${m.role}\n\n${m.bio}`).join("\n\n");
  return [
    header,
    "## About\n\n" + facts.map((f) => `- ${f}`).join("\n"),
    "## Primary groups\n\n" + GROUPS.map((g) => `- ${g}`).join("\n") + `\n\nStudents can join at ${absoluteUrl("/join")}.`,
    "## Timeline\n\n" +
      TIMELINE.map((m) => `- ${m.when}: ${m.label}${m.detail ? `. ${m.detail}` : ""}`).join("\n"),
    "## Team\n\n" + people(TEAM),
    "## Advisors\n\n" + people(ADVISORS),
    "## Sponsoring\n\n" +
      `The team is looking for funds, parts and skills. Sponsors can get their logo on the hull, merch and website. Use the form at ${absoluteUrl("/#contact")} or email ${CONTACT_EMAIL}.`,
    "## Pages\n\n" + PUBLIC_PATHS.map((p) => `- [${p.title}](${absoluteUrl(p.path)}): ${p.description}`).join("\n"),
  ].join("\n\n") + "\n";
}

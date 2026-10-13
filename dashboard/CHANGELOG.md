# Dashboard changelog

See [`../docs/VERSIONING.md`](../docs/VERSIONING.md) for how this file and `package.json`'s `version`
are kept — this folder versions independently of `cad/`, `optimization/`, and `docs/`.

## 0.7.1 — 2026-10-13

Added faint blueprint-style boat schematics to the side margins of the public site (wide screens only), drawn
in light ink and changing as you scroll: hull lines plan, a Savitsky planing-hull free-body and wetted-area
diagram (the hull trims up and the wetted area shrinks as it scrolls past), a general arrangement, and an
exploded parts view (GPS, lidar, avionics box, battery, hull with hatch cover, motor, driveshaft, propeller, rudder). Drawings are in `src/app/(site)/margin-scenes.tsx`, scroll logic in `margin-art.tsx`,
styling in `globals.css` (`.ma`). Motion is toned down under `prefers-reduced-motion`. Issue #55.

## 0.7.0 — 2026-10-08

Added a one-page, letter-size handout at `/handout` (hero, how we model the boat with first-principles mixed-integer
linear programming and Savitsky's planing-hull model, the engineering disciplines we pull from across UW–Madison, our approach to the Hull, Electric and
Autonomous parts, timeline, contact), with the exported PDF at `public/haav-handout.pdf`. No names on it except the
project lead's contact in the footer. Re-export the PDF after changing the page: print `/handout` to PDF from
Chrome with headers and footers off.
Removed the motor pods from the site's Basic Spec and from the handout; the boat no longer uses pod motors.
New timeline with hard dates (`src/lib/timeline.ts`): hull design frozen (Oct 25), preliminary design review (Nov 1),
critical and long-lead parts ordered (Nov 10), mechanical and electrical design frozen with full BOM and order (Nov 20),
the Nov 20 to Dec 20 hull build, first float and tow test (Jan 8), manufacturing and assembly and spare parts
(Jan 8-30), first nautical mile (Jan 31), slow drives (Feb 1-14), more speed (Feb 15) and testing and tuning until April.
Entries keep the team plan's wording on the site and in `timeline.txt`; the handout and PowerPoint show the dates and titles only. The site
shows it as a rail with a marker per milestone (a filled dot for a day, a hollow ring for a stretch of work). The full
plan is also written out in `timeline.txt`, and the PowerPoint reads `src/lib/timeline.ts` directly. The handout footer and the `/join` page now say we need people to build the BOM
as we design.
The handout is laid out as a relaxed one-pager: a plain white page, a few soft grey cards (model, the three parts and
the footer), the site's own sans font, black, white and grey only, and red just for the "UW–Madison / College of
Engineering" mark at the top right.
The handout also shows three quick facts about the boat (30 mph autonomously, integrated software and controller, realtime LTE with LoRa backup).
The handout is also available as an editable PowerPoint (imports into Canva with live text and shapes): `public/haav-handout.pptx`, built by
`scripts/handout-pptx.py` (the team's wording edits are in the script and the page).

## 0.6.2 — 2026-10-08

Added the official UW–Madison horizontal logo (`public/uw-logo-horizontal.png`) under the intro sentence on the home page.

## 0.6.1 — 2026-10-07

Merged the embedded, firmware and low voltage groups into one on the home page and the `/join` form (Software stays
its own group), and made the footer read "Contact: mhbarrett@wisc.edu" with the site version on the right.

## 0.6.0 — 2026-10-07

Added a Primary groups list to the home page, named for the group leads (`GROUPS` in `src/lib/team.ts`), with a
"Become a member" link to a new `/join` form for prospective students. Submissions email the team through Resend
(same `RESEND_API_KEY` / `NOTIFY_EMAIL` as the sponsor form; shared in `src/lib/notify.ts`) and are not stored.
Added the contact email and the site version to the footer, removed the Workshop footer link, and updated Will's bio and Ryan's role.

## 0.5.1 — 2026-10-07

Replaced the hero image under the Haav title with the new blue hull CAD image, on a white panel, with the caption
"Our current hull design." Removed the old render.

## 0.5.0 — 2026-10-07

New public page, `/simulation`, listing Study #1 (propeller, thrust, motor drive and force against boat speed),
with a Simulation link in the header. The figure is `public/simulation/study-1.png`; add later studies as
further sections on the page.

## 0.4.7 — 2026-10-07

Added optional LinkedIn links to the team profiles (Marley, Patrick, Ryan, Peyton). Set `linkedin` on a person
in `src/lib/team.ts` to show one.

## 0.4.6 — 2026-10-07

Added an Advisors section to the home page (Vincent Rasse, Kevin Macauley), after the team. Bios live in
`src/lib/team.ts` next to the team's.

## 0.4.5 — 2026-10-07

The sponsor form now emails the team through Resend on every submission (`RESEND_API_KEY`, `NOTIFY_EMAIL`).
Saving to the `sponsor_inquiries` table is now optional: the form succeeds if either the email or the save
worked, so it works in production without a database.

## 0.4.4 — 2026-10-07

Removed the "Explore it in 3D" link under the hero render, and the click-through on the image itself. The
interactive viewer is still at `/viz/hull.html` and in the workshop header.

## 0.4.3 — 2026-10-07

Added Peyton Olson (structural and mechanical lead) to the team profiles.

## 0.4.2 — 2026-10-07

Added a build timeline to the home page (rough hull dimensions in Oct 2026 through tuning and testing in
Mar 2027), with a Timeline link in the header. Dates live in `src/lib/timeline.ts`.

## 0.4.1 — 2026-10-07

Added a rendering of the hull CAD on the home page, directly under the Haav title, linking to the interactive
3D viewer. See [`README.md`](README.md) for how it was made.

## 0.4.0 — 2026-10-07

Public site cut back to one plain page: what Haav is, the boat, the team (new profiles in `src/lib/team.ts`)
and the sponsor form. Messaging now leads with the team's mix of skills and modeling up front. The public pages
don't name a competition yet, since eligibility isn't confirmed. Removed the dark hero, card grids, race-stat tiles and live build status from
the public page; `/sponsors` redirects to the form. The workshop (`/bom`, `/optimization`) is unchanged.

## 0.3.0 — 2026-10-03

Split the site into a public half and a team workshop. `/` is now a public project page (race rules, the
boat, live build status, sponsor call to action) and the BOM moved to `/bom`, alongside `/optimization`, under
a separate "workshop" layout marked `noindex`. Added a logo, favicon and share image, and fixed the body
font (Geist was loaded but overridden by Arial). The project is now called Haav (Highly Amphibious / Autonomous
Vehicle) across the site. `/sponsors` now shares the public header and footer.

## 0.2.0 — 2026-10-02

New public page, `/sponsors`, for finding sponsors: a hero, links into the live 3D hull viewer, optimizer
results and BOM, three ways to back the build, and a contact form that stores inquiries in a new
`sponsor_inquiries` table. Modeled on hello.aecync.com. See [`README.md`](README.md).

## 0.1.0 — 2026-10-01

First version tracked here. One page: the BOM, a Postgres table on Neon with weight/cost totals and an
editable table per active phase. A second page, `/optimization`, reads completed optimizer runs and
compares candidates. See [`README.md`](README.md).

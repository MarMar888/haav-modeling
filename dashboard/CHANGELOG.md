# Dashboard changelog

See [`../docs/VERSIONING.md`](../docs/VERSIONING.md) for how this file and `package.json`'s `version`
are kept — this folder versions independently of `cad/`, `optimization/`, and `docs/`.

## 0.7.23 — 2026-10-23

Six more responsive UI tweaks: anchored headings stop below the sticky header; the search clear button is muted and larger on
touch screens; dropdown option-group labels read bold; busy regions dim with a progress cursor; table footers get a heavier
rule and semibold text; and heading-group subtitles tuck tight under the title.

## 0.7.22 — 2026-10-23

Six more responsive UI tweaks: checkboxes, radios and sliders take the emerald (and larger hit areas on touch screens); inline
quotes get curly quotation marks; open sections' summaries turn emerald; nested lists indent less; touch taps no longer flash
the grey highlight; and broken images show wrapped alt text.

## 0.7.21 — 2026-10-23

Six more responsive UI tweaks: hidden elements stay hidden whatever their display class; expandable-section triangles take the
emerald; defined terms are semibold italic; program output and variables use the monospace font; embedded frames lose their
border and fit the column; and the file-picker button keeps a gap from the file name.

## 0.7.20 — 2026-10-22

The timeline legend now names its two markers: a filled dot is a "Milestone" and a hollow ring is a "Phase".

## 0.7.19 — 2026-10-22

Six more responsive UI tweaks: fieldsets lose the browser frame and min-width so form groups fit a phone; small print is
smaller and muted; citations stay italic while addresses read upright; embedded media is capped to its container; text areas
resize vertically only; and dialogs fit the viewport with a dimmed, softly blurred backdrop.

## 0.7.18 — 2026-10-22

Six more responsive UI tweaks: inline code becomes a muted chip that breaks inside long identifiers; table headers and captions
align to the column start; bold text gets a firmer weight; deleted and inserted text are styled as edits; definition lists get
bold terms and indented definitions; and progress and meter bars take the emerald and never overflow a phone.

## 0.7.17 — 2026-10-22

Six more responsive UI tweaks: block quotes get an emerald rule; table numbers line up and wide tables scroll inside their
wrapper; list markers take the emerald; sub/superscripts no longer stretch line spacing; highlighted text reads as a
highlighter pen; and buttons dip slightly when pressed (unless reduced motion is requested).

## 0.7.16 — 2026-10-21

Six more responsive UI tweaks: keyboard keys render as small chips; expandable summaries are full-width pointer targets with a
touch-sized height; horizontal rules are one thin muted line; abbreviations with a tooltip get a dotted underline; figure
captions balance their lines; and labels, dropdowns and file-picker buttons show a pointer.

## 0.7.15 — 2026-10-21

Six more responsive UI tweaks: form controls inherit the page font and letter spacing; fields turn red only after the visitor
has filled them in wrongly; images and video never outgrow their column; code samples scroll inside their box; disabled fields
look and feel disabled; and number fields drop the tiny spinner arrows that are hard to hit on touch screens.

## 0.7.14 — 2026-10-21

Six more responsive UI tweaks: paragraphs and list items avoid a lone last word; anchored sections and focused fields clear
the sticky header; text renders crisper on macOS and iOS; buttons show a pointer and disabled ones look disabled; fields are
16px on touch screens so iOS does not zoom on focus; and long words in headings wrap instead of overflowing.

## 0.7.13 — 2026-10-20

Six more responsive UI tweaks: autofilled fields keep the page palette; placeholders are one readable grey in both themes;
the text cursor in fields is emerald; text areas resize vertically only; underlined links get a thin line that skips
descenders; and the page no longer rubber-bands sideways while buttons ignore long-press text selection.

## 0.7.12 — 2026-10-20

Six more responsive UI tweaks: scrollbars take the page palette in light and dark; text areas grow as you type; photos are
slightly dimmed in dark mode; links ease into their hover colour; timeline dates use tabular digits; and the external
DI Lab link in the footer carries a ↗ marker.

## 0.7.11 — 2026-10-20

Six more responsive UI tweaks: form controls use the site's emerald accent; paragraphs hyphenate on narrow screens; the 404
page respects the notch and offers a "Become a member" button next to "Back to Haav"; the skip link is a 44px target;
a high-contrast preference strengthens borders and the focus ring; and Windows high-contrast mode gets system-colour focus
and progress lines.

## 0.7.10 — 2026-10-19

Six more responsive UI tweaks: the viewport covers notched phones so the safe-area insets actually apply (the footer already
used them); the page keeps its side padding clear of the notch in landscape; the browser bar takes the page colour in light
and dark; a thin progress line under the header fills as you scroll; jumping to a section briefly highlights its heading; and
the hull image requests a size that fits the screen, dark-mode text selection is readable, and the footer email wraps on narrow phones.

## 0.7.9 — 2026-10-19

Six more responsive UI tweaks: the "Haav" home link in the header is a 44px tap target; taps no longer wait for double-tap-zoom
and phones keep the text size on rotate; form fields that fail validation get a red border; the sponsor form uses the right
mobile keyboard and capitalisation per field, and focus moves to the confirmation after sending; paragraphs wrap without
orphan words; and the group cards lift slightly on hover (the spec chips are a labelled list for screen readers).

## 0.7.8 — 2026-10-19

Six more responsive UI tweaks: the header link for the section in view (or the current page) is underlined and marked
`aria-current`; the theme toggle is a 44px tap target on phones; buttons dip slightly when pressed; the page reserves the
scrollbar gutter (no sideways jump between short and long pages) and native controls follow the theme; a print stylesheet
drops the header, footer and margin art and spells out link addresses; the footer links are 44px tall and the sponsor form
has a plain "Prefer email?" fallback.

## 0.7.7 — 2026-10-18

Six more responsive UI tweaks: "Become a member" and "Sponsor the build" buttons in the home page hero (stacked full width on
phones); 44px nav tap targets that never wrap on narrow phones; a legend for the timeline markers; a visible chevron on the
form dropdowns; the Simulation page gets a back link, an intro line, and charts that scroll sideways on phones instead of
shrinking; and the footer clears the iOS home indicator.

## 0.7.6 — 2026-10-17

Search and AI-crawler readiness (#67): `robots.txt` (public pages open to search engines and named AI crawlers, `/api/` closed),
`sitemap.xml`, `/llms.txt` and `/llms-full.txt` (markdown summaries built from the same team and timeline data as the pages),
canonical URLs plus Open Graph and Twitter tags on every public page, and Organization and WebSite JSON-LD. The canonical
origin is `https://haav.build`, set in `src/lib/site.ts`. The workshop stays `noindex`.

## 0.7.5 — 2026-10-17

Six more responsive UI tweaks: a branded 404 page; the Basic Spec section gets a row of spec chips; LinkedIn links are
tappable pills (36px high); forms get a spinner while sending, a resizable textarea and a check mark on the success message;
the footer gets a "Back to top" link; and the Become a member page gets a "Back to home" link.

## 0.7.4 — 2026-10-16

Six more responsive UI tweaks to the public site: the hull render is a proper figure with a caption and a dark-mode border;
the UW-Madison logo sits on a white chip so it stays visible in dark mode and shrinks on phones; the primary groups are a
numbered card grid (two columns from `sm`, one on phones); team and advisor entries get initials avatars; form fields get
a visible focus ring and placeholder colour; and a "Skip to content" link was added for keyboard users.

## 0.7.3 — 2026-10-15

Six small UI polish changes to the public site, all responsive: the header is now sticky with a blurred backdrop and
tighter nav spacing on phones; the timeline stacks each date above its milestone on small screens instead of reserving a
wide left gutter; form fields use 16px text on phones (no iOS zoom-on-focus) and the submit button stacks below the fields; keyboard focus
rings, smooth anchor scrolling (off under `prefers-reduced-motion`) and balanced headings were added in `globals.css`; footer links stack on
phones and get hover underlines and dark-mode colours; anchor sections clear the sticky header.

## 0.7.2 — 2026-10-13

Added a site footer line, "Affiliated with the DI Lab at UW-Madison (making.engr.wisc.edu)", linking to
making.engr.wisc.edu. Haav now stands for Highly Amphibious / Autonomous **Vessel** (was Vehicle) on the site, page titles,
share image, handout page and PowerPoint script, and the README. The exported `public/haav-handout.pdf` and
`haav-handout.pptx` still say Vehicle until they are re-exported. Issue #57.

Added a line to the home page intro: we are planning to participate in the PEP2027 Autonomous Uncrewed Division, a 2 mile
point to point time challenge. Issue #58.

The margin schematics now only scroll through their scenes on the home page. Short pages (`/join`, `/simulation`) hold the first
drawing on each side, since the whole sequence was sweeping past in a few pixels of scroll. Issue #59. The simulation page has no margin
drawings at all, since its figures fill the width.

Added a light / dark / system theme switcher (shadcn/ui dropdown plus `next-themes`) to the site header and the workshop
header. Dark mode now follows the `.dark` class on `<html>` instead of only the OS setting (`@custom-variant dark` and the
shadcn tokens in `globals.css`, `.dark` rules in `optimization.css`); the choice is remembered and defaults to the OS setting.
New: `components.json`, `src/components/{mode-toggle,theme-provider}.tsx`, `src/components/ui/`, `src/lib/utils.ts`. Issue #60.

Tightened the project lead's bio on the team page (same facts, smoother wording). Issue #61.

Redrew the Section A-A margin schematic as a proper general-arrangement sheet: hull shell with inner deck and floor lines, raked
transom and a hatch cover, real part shapes (motor with end bell and windings, avionics board with pins, battery cells and
terminal, GPS puck, lidar on a mast, propeller blades, rudder with arm), numbered balloons with leaders, a parts list and a
centre-of-gravity mark. The bow is a low, raked planing-hull stem with a small rounded head (no sharp tip). The driveline is an inboard motor with the shaft angled 14° aft and down through the hull bottom to a strut, propeller and rudder behind the transom. Issue #62.

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

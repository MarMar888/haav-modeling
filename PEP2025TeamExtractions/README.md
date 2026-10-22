# PEP25 team papers — 2025

## Collection status

**15 paper-text JSONs created / 27 linked papers cataloged.**
The web PDF reader supplied all 5,171 indexed text lines for 15 papers (225
pages). Twelve linked papers remain inaccessible; two additional entries have
no paper link. See `index.json` and `extraction-status.json` for per-paper status.
No PDFs are saved in this collection.

These JSONs follow the existing 2026 per-paper schema, with explicit
`competition_year: 2025`. Because direct downloads failed DNS resolution, their
`extractor` identifies the web PDF reader. Layout text, embedded-image counts,
and PDF SHA-256 are null, not guessed. Only page count is available in `pdf_info`.
`source_lines` preserves the complete indexed source text and zero-based page
spans. Lines crossing page boundaries are assigned to their starting page in
`pages`; page boundaries can therefore be approximate. Figures and image-only
tables are not transcribed. Empty extracted pages do not prove blank PDF pages.

## Sources and scope

The source is the [official PEP25 archive](https://www.navalengineers.org/PEP25)
and its linked team pages. `sources.json` catalogs 27 linked uncrewed papers plus
two entries with no paper link (Delaware and Vanderbilt). This is a collection of
located papers, not a claim of complete coverage of all 30 competition entries.
It includes relevant predecessors to the PEP26 boats and additional PEP25 teams.
Kentucky's three boats are separate entries. Crewed papers are excluded.

Year is established from the team's **2025 archive section**, supplemented by the
PDF cover/date where the web reader could open it. Many actual 2025 papers live
under `/PEP/2024/` on the source website. Do not reclassify them from that URL.
`web_pdf_readable` records whether the web reader opened the linked PDF; it does
not indicate a successful local download. Original links are retained verbatim.

- Princeton's link labeled “Le Papillon” opens the 2025 **Tiger RC** paper. The PDF
  labels itself Autonomous Division; the 2025 results page groups the entry under
  Uncrewed. Its crewed Phoenix and Tiger papers are excluded.
- NC State and Virginia Tech link to SharePoint. The web reader could not retrieve
  these documents; they may require sign-in. The extractor rejects login HTML
  instead of saving it as a PDF.
- Delaware's 2025 section links a presentation but no paper.
- Vanderbilt has a 2025 paper label without a clickable link.
- Rank and score fields remain null. Current team pages mix multiple years and
  sometimes disagree with the event summary; 2026 values are never carried over.
- No 2025 paper link was found in the inspected pages for JHU, Longwood, Mass
  Maritime, ECU, Norfolk State, or Toledo. Stevens and Georgia's linked 2025 papers
  are crewed entries and are outside this collection's scope.

## Existing extractor

The original script supports both years; its default remains 2026. A normal
Poppler extraction can be run when direct network access is available:

```sh
python3 PEP2026TeamExtractions/extract.py --year 2025
```

PDF inputs are cached outside this collection in `.context/pep25_pdfs/`.
No PDFs were downloaded during this run. Poppler requires its executables on
PATH or in the bundled Codex runtime.

This collection was generated through the same script's web-text import mode:

```sh
python3 PEP2026TeamExtractions/extract.py --year 2025 --web-text /path/to/bundle.json
```

The bundle has `competition_year` and a `documents` array. Each document contains
`source_url`, `page_count`, `total_lines`, and `lines` (the saved `source_lines`
array). Each line contains `line`, `page_start`, `page_end`, and `text`. The script
validates contiguous line coverage and page bounds before writing any paper.
The temporary import bundle is not required to read the resulting JSONs.

| Path | Contents |
|---|---|
| `sources.json` | Discovered links, year evidence, and source exceptions |
| `json/` | 15 raw paper-text extractions, with year and source metadata |
| `index.json` | Per-team results; unavailable papers have no JSON path |
| `extraction-status.json` | Run timestamp and success/failure totals |

An incomplete collection run exits nonzero after saving successful extractions.

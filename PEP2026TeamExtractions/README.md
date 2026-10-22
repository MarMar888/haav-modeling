# PEP26 team extractions

Raw text extractions of the PEP26 white papers for the Autonomy and Uncrewed Open divisions, plus the
analysis built on them (motors, batteries, race results, TFL SSS motor catalog). Source: the team pages
linked from <https://www.navalengineers.org/Education/PEP26>. Race results are from the competition held
2026-04-14 to 16 in Portsmouth, VA.

| Path | What it is |
|---|---|
| `json/` | One raw JSON per white paper (27 teams): metadata, official score, team-page score blocks, and per-page text (reading order and `-layout`). |
| `index.json` | Every team, its division, rank, scores and extracted documents. |
| `extract.py` | Downloads the papers and writes `json/` and `index.json`. Needs poppler (`pdftotext`, `pdfinfo`, `pdfimages`). PDFs are cached in `.context/pep26_pdfs/` (gitignored). |
| `autonomy_variables.json`, `plot_autonomy.py`, `charts/` | Hand-compiled design variables for the 12 Autonomy teams (motors, pack voltage, Ah, energy, target speed, race points) and the charts built from them. |
| `sss_motors.json`, `sss_motors.py`, `charts/sss_*.png` | The 50 SSS brushless motors from TFL North America joined with TFL's spec sheet (price, KV, size, weight, power), charted. The script reads TFL pages saved under `.context/tfl/`. |
| `email_madison_matc.txt` | Draft outreach email to the Madison Area Technical College team. |

## Notes

- The same `extract.py` now accepts `--year 2025` and reads the separate
  [`../PEP2025TeamExtractions/sources.json`](../PEP2025TeamExtractions/sources.json)
  manifest. That year's PDFs, extracted JSON, and run status stay in the 2025
  folder. The default remains 2026; existing 2026 extractions were not regenerated.

- Only the paper linked as the team's white paper is extracted; resumes, slide decks and other divisions' papers are skipped. Longwood posted no paper.
- Text only. Figures and tables that are images are not captured.
- Official scores come from the PEP26 page. The team pages sometimes disagree (VCU, Norfolk State, JHU, NC State, Illinois, Longwood); both are kept in `index.json`.
- Plotting scripts run with matplotlib (`python3 -m venv .context/venv && .context/venv/bin/pip install matplotlib`).

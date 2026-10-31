# v4 Savitsky speed sweep

User-verified geometry: **72 in long; 14 in outer transom chine beam b**. Supplied loading: **125.107 lb**, CG **23.734254 in forward / 6.023536 in above aft keel**. Two propellers and the previous 15° thrust line are retained. Each speed is independently solved for vertical-force and pitch-moment equilibrium.

Baseline uses the 20° main-panel transom angle. The comparison uses the 18.358212° keel-to-outer-chine chord angle. These are alternative constant-V approximations, **not upper/lower uncertainty bounds**. Neither represents the real reverse-chine strip, varying beam or keel rocker explicitly.

[Performance curves](performance.svg) · [CSV curves](curves.csv) · [Complete reloadable study](study.json) · [Finite-change comparisons](sensitivities.csv) · [Boat and input review](../../../hull/boats/v4-2026-10-30/README.md)

## Selected results

| Speed (mph) | Baseline trim (°) | Baseline resistance (N) | Baseline effective power (kW) | Chord-comparison power (kW) | Wetted keel, baseline (in) |
|---:|---:|---:|---:|---:|---:|
| 10 | 10.873 | 110.603 | 0.494 | 0.489 | 45.68 |
| 15 | 8.132 | 99.181 | 0.665 | 0.655 | 41.50 |
| 20 | 5.778 | 94.290 | 0.843 | 0.829 | 42.30 |
| 25 | 4.281 | 100.580 | 1.124 | 1.105 | 44.63 |
| 30 | 3.313 | 115.600 | 1.550 | 1.526 | 47.75 |

## Coverage and interpretation

Each approximation solves at 26 of the 31 requested speeds. At 0 mph, motion resistance/power are zero and static trim is not solved. Speeds 1–4 mph have no displacement-model result. Speeds 5–6 mph solve outside the implemented empirical screen; speeds 7–30 mph pass that screen.

**Every solved point has geometry_ok = false.** No uniform aft region was established for this hull; `uniform_aft_length_m` is explicitly null. The previous boat's 38-inch threshold was not reused. Passing the engine screen does not establish real-hull applicability, and curve differences between the two angles do not bound the approximation error.

Power is effective hull power (R × V), not shaft or battery power. There is no available-thrust curve, transition resistance, planing-onset result, dynamic-stability result or predicted top speed. Blank low-speed fields are unavailable, not zero.

Blank mass rows were excluded exactly as supplied; no additional mass was estimated. All inputs, assumptions, source hashes, equation fingerprint, statuses, intermediate quantities and geometry warnings are retained in study.json and CSV.

Open [the sensitivity notebook](../../../hull/sensitivity-analysis.ipynb) to change the baseline, parameter adjustments and speed grid. Its user-selected adjustment lists and plot choices were retained; it now loads v4.

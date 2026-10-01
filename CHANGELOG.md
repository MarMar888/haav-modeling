# Optimization changelog

See [`../docs/VERSIONING.md`](../docs/VERSIONING.md) for how this file and `VERSION` are kept — this
folder versions independently of `cad/`, `dashboard/`, and `docs/`.

## 0.1.2 — 2026-10-01

Added three variable-dependency diagrams under `../diagrams/` (decisions → mass/balance, mass/speed →
power → objective, and the constraint margins), traced directly from `model.py`/`continuous.py`. Found
and documented that `system_voltage_v`/`drive_voltage_v` don't depend on any decision variable - they're
a fixed catalog-compatibility check once a drive/battery pair is chosen, not a real optimization tradeoff.

## 0.1.1 — 2026-10-01

Added `openplaning-reference.ipynb`: a reference notebook for the `PlaningBoat` class itself (hull vs
propulsion inputs/outputs), built on the openplaning README's own documented Savitsky '76 example rather
than this project's hull. Separate from `explore.ipynb`, which models this project's actual hull.

## 0.1.0 — 2026-10-01

First version tracked here. A continuous multistart SLSQP search (`continuous.py`) over hull geometry,
battery capacity, placement and speed, plus a discrete drive/propeller choice, feeding a single
finalops selection model. Objective: minimize time over the PEP27 2-mile course (see
[`../docs/PEP-Rules/`](../docs/PEP-Rules/)). Component catalog, prices, and resistance model are
synthetic fixtures — every result carries `build_ready: false`. `/optimization` on the dashboard reads
completed runs and compares candidates. See [`README.md`](README.md) for the full model and its limits.

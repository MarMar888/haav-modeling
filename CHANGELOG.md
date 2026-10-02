# Optimization changelog

See [`../docs/VERSIONING.md`](../docs/VERSIONING.md) for how this file and `VERSION` are kept — this
folder versions independently of `cad/`, `dashboard/`, and `docs/`.

## 0.1.4 — 2026-10-02

`explore.ipynb`: added a propeller model, so pitch and diameter now change the answer. Efficiency comes from ideal
actuator-disk theory (a bigger diameter is more efficient at the same thrust) with placeholder blade losses and a
pitch/diameter penalty, replacing the constant 0.65 (the default design lands at about 0.66, so its top speed is
unchanged). Propeller mass scales with diameter cubed and moves the center of gravity aft. Two new constraints bring
the total to twenty-two: `prop_fits` (diameter no more than the hull depth, geometry) and `tip_speed` (blade tip speed
at most 150 ft/s, limit). `pitch_in` and `prop_diam_in` are now searched, so there are twelve decision variables.
`Fixed.prop_efficiency` and `prop_mass_lb` became `prop_blade_eff`, `prop_pd_opt`, `prop_pd_penalty`,
`prop_mass_ref_lb`, `prop_ref_diam_in` and `max_tip_speed_fps`. Added an eleven-chart overview of how the model
operates after section 7 (including how propeller, thrust, motor drive and force relate), and rebuilt Part II as a set
of exploration lenses (several search approaches, three objectives, parameter and assumption sweeps).

Updated `explore-model.tex` and rebuilt `explore-model.pdf`: twelve choices, the propeller model, twenty-two margins,
and the worked example tables recomputed from `fastest_feasible(DESIGN, FIXED)`.

## 0.1.3 — 2026-10-01

`explore.ipynb`: added a second sweep grid (series count, thrust angle and height, payload, fixed
equipment, voltage limit, rating fraction, freeboard rule, gyradius) beside the first; `sweep` now
accepts `Fixed` fields as well as `Design` fields. Added Part II (the model as a data story). The setup
cell now prints the model version (`VERSION` plus git commit and a dirty flag) on every run, so a
saved chart or result can be traced to the code that made it. Widened the search `BOUNDS` (length 3-10 ft,
beam 10-40 in, depth 8-20 in).

`explore.ipynb` now runs in Google Colab: a first code cell installs `openplaning` (with `setuptools<81`, which
it needs for `pkg_resources`), and the intro links to an open-in-Colab URL.

Added `explore-model.tex` and `explore-model.pdf`, a plain-English write-up of the explore model (decision
variables, calculated values, the twenty constraints and the objective), linked from the notebook's first
cell. Added `AGENTS.md`: whenever the model in `explore.ipynb` changes, the write-up must be updated and
rebuilt, and the version bumped, in the same change.

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

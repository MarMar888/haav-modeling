# Optimization changelog

See [`../docs/VERSIONING.md`](../docs/VERSIONING.md) for how this file and `VERSION` are kept — this
folder versions independently of `cad/`, `dashboard/`, and `docs/`.

## 0.2.4 — 2026-10-23

`willmarley.ipynb`: simplified the speed section again, per direction — the motor catalog is out of the chain for now
(#85). Speed is one equation with three inputs, `speed = rpm × pitch × slip / 1056`, where rpm is just an input
(whatever the motor ends up turning) and slip stands in for all the hull physics. Bounds and per-input sweeps as
everywhere else; midpoint lands at 28.2 mph. The per-winding speed bar chart is removed; the motor torque/speed chart
and the propeller-load crossing remain as their own earlier sections, ready to pick the rpm later.

## 0.2.3 — 2026-10-23

`willmarley.ipynb`: simplified the speed section to the bare chain, per discussion — start simple, make sense of it,
then add constraints back (#85). The on-plane drag check, the tip-speed cap and their inputs (`eta_p`, weight, L/D) are
removed; what remains is two lines on top of the motor–prop crossing: the crossing fixes the rpm, and
`speed = rpm × pitch × slip / 1056`. The notes say plainly that all the hull physics hides inside `slip` for now, so
the absolute speeds are the drive's, not the boat's. Sweeps cover `K_Q`, diameter (2–5 in), pitch and slip; the
per-winding bar chart loses its runnability graying. Subject motor back to the 56154-V2 5Y.

## 0.2.2 — 2026-10-23

`willmarley.ipynb`: closed the loop to boat speed with an idealized on-plane chain (#85): drag = weight / (L/D)
(speed-independent planing drag), speed = rpm × pitch × slip / 1056, rpm from the motor–propeller crossing, runnable only
if propeller thrust (`eta_p × power / speed`) covers the drag **and** the blade tip stays under 150 ft/s. Each input
(`K_Q`, diameter, pitch, slip, `eta_p`, weight, L/D) gets bounds and a sweep against the speed we can run, with
off-plane / cavitating points marked, plus a per-winding bar chart of on-plane speed. Propeller diameter bounds set to
2–5 in throughout. The sweeps' subject is the 56133-V2 5Y — at the midpoint prop it is the only winding that both planes
and keeps its tip under the cap (bigger motors overspeed, smaller ones can't make the thrust). The notes say plainly that
the absolute speeds are what the idealization believes; the shapes and crossovers are the useful part. Still numpy +
matplotlib only; no change to `explore.ipynb` or its model/write-up.

## 0.2.1 — 2026-10-23

`willmarley.ipynb`: added the propeller torque equation (`Q = K_Q * rho * n^2 * D^5`) in the notebook's own style — one
equation, bounds on each input (`K_Q`, diameter, rpm), a sweep of each input alone — then the load curve overlaid on the
5Y motor torque/speed chart, with each winding's operating point (the crossing) marked and tabulated: operating rpm,
torque, shaft power, and that power against the sheet's continuous rating. The `K_Q` range is sanity-checked against
`explore.ipynb`'s baseline (5.3 N·m at 2640 rpm, 6 in ⇒ `K_Q ≈ 0.033`). Still numpy + matplotlib only; no change to
`explore.ipynb` or its model/write-up (#85).

## 0.2.0 — 2026-10-23

`explore.ipynb`: real hydrostatics and visibility work (#87).

Model changes: the closed-form prism hydrostatics and the guessed prismatic coefficient (0.85) are replaced by mesh
hydrostatics from [navaltoolbox](https://github.com/NavalToolbox/navaltoolbox-lib) on a watertight hull mesh the notebook
generates (V-bottom, vertical sides, the chine beam tapering linearly to the stem over a new placeholder `Fixed.bow_fraction`,
0.25). Draft, freeboard, the metacentric height GM and the at-rest trim all come from that mesh (level trim in `evaluate()`,
cached per design; free trim in the charts), and the hull skin mass is now the mesh area times the laminate weight. One new
margin, `stability` (GM at rest ≥ new placeholder `Fixed.min_gmt_m`, 0.05 m), makes twenty-four margins; a hull too narrow to
stand up is now infeasible instead of merely unwise. A new Modes cell in section 2 collects the explicit switches —
`MOTOR_LIMITS` ("sheet" caps the motor by the spec sheet's max current/voltage as before; "theoretical" derives caps from the
DC model: back-EMF at the rpm ceiling and the current carrying the continuous power), `ENFORCE_VALIDITY`, `INCLUDE_SUSPECT_R`,
`COURSE_MODE` — and `BOUNDS` moved beside the inputs. Baseline top speed moves from 21.38 to 21.25 mph (the mesh floats the
real bow, so draft and hull mass change slightly).

Visibility (no further model changes): a problem card in section 9 — modes, every decision variable against its bounds, every
margin sorted tightest-first, the at-rest equilibrium — all computed live, and reprinted for the search winner; section 10
redrawn so the first constraint to cross zero is named at its crossing; the section 14 search now records every candidate
(`SEARCH_LOG`) and charts its own convergence, feasible share and which constraint killed the infeasible candidates; a
relaxation chart prices each limit (fastest feasible speed gained if that limit alone were loosened 10%); the interactive
sliders follow `BOUNDS`; the Assumptions lens sweeps the new placeholders instead of the removed prismatic coefficient.

Updated `explore-model.tex` and rebuilt `explore-model.pdf`: the mesh/navaltoolbox hydrostatics, the stability margin
(twenty-four margins), the motor limit modes, the changed constants, and the worked example recomputed from
`fastest_feasible(DESIGN, FIXED)`. `requirements-notebook.txt` adds `navaltoolbox`, which ships wheels for
CPython 3.9–3.13 only; the setup cell now says so on a newer kernel instead of failing into a Rust compile log.

## 0.1.7 — 2026-10-22

`explore.ipynb`: the placeholder motor is replaced by the real SSS motors from the supplier spec sheet (`sss_motors.csv`, 27 motors, 263 windings; weights added to the file).
The motor is now one integer decision, `motor`, an index into the catalog (smallest motor first), replacing the two continuous variables `motor_kw` and `motor_eff`, so there are
eleven decision variables. The winding's Kv, max current, max voltage, resistance, no-load current, continuous power and weight come from the sheet; motor mass is the listed weight.
Motor efficiency and current are no longer fixed numbers: a DC motor model (`motor_point`) gives the torque, current, voltage needed and efficiency at the propeller's rpm, and bus power
now includes a placeholder speed controller efficiency (`Fixed.drive_eff`, 0.97). `Fixed.motor_max_voltage_v` is gone. Three margins now read the sheet (`motor_max_voltage`, `shaft_power`,
`motor_current`) and one is new, `motor_voltage` (loaded pack voltage must cover the back-voltage plus the winding drop), so there are twenty-three margins. The 33 windings with a
doubtful resistance entry on the sheet are left out of the catalog by default. The baseline top speed moves from 22.56 to 21.38 mph because the real motor is lighter than the old placeholder.
Charts and sweeps that used `motor_kw` and `motor_eff` now use the catalog.
Added a "Why the search chose this design" cell after the search (which constraints bind, how hard the motor is working against its own and the strongest winding's torque ceiling,
and what every other winding would do for the same boat), and fixed the interactive panel, whose callback broke after Part II rebound the global name `out`.

Updated `explore-model.tex` and rebuilt `explore-model.pdf`: eleven choices, the motor data and DC motor model, twenty-three margins, the changed constants, and the worked example tables recomputed from
`fastest_feasible(DESIGN, FIXED)`. Tracking issue: #86.

## 0.1.6 — 2026-10-22

Added `willmarley.ipynb`: a standalone battery runtime notebook built on one equation,
`0.8 * Capacity (Ah) * Voltage (V) * battery efficiency / (load power * motor efficiency) * 60`, with bounds on each
input and a sweep of each input on its own, plus a torque vs speed graph of the 5Y winding of every SSS motor on the supplier
spec sheet, highlighting the motors earlier PEP teams used (27 models, 263 windings, data in `sss_motors.csv`)
(#85). No changes to `explore.ipynb` or its model/write-up.

## 0.1.5 — 2026-10-21

Added a standalone local Savitsky sample calculator in `savitsky/`, with editable
SI inputs, a speed sweep starting at zero, trim and effective-power plots, CSV
export and dependency-free Node JSON reports. Low-speed displacement resistance
is explicitly unavailable; extrapolations and geometry violations are flagged.
The calm-water engine adapts OpenPlaning equations and is checked against its
published worked example. No changes to `explore.ipynb` or its model/write-up.

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

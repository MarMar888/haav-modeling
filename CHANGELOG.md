# Optimization changelog

See [`VERSIONING.md`](VERSIONING.md) for how this file and `VERSION` are kept. This repo was split out
of [`MarMar888/hav`](https://github.com/MarMar888/hav)'s `optimization/` folder with its full history
(MarMar888/hav#98) and keeps the same version line.

## 0.6.2 — 2026-10-30

The flat root becomes two folders (#1), no model change. `prop_motor_battery/` holds the one active
model, `willmarley.ipynb`, with the `sss_motors.csv` it reads beside it. Everything else — the SciPy
optimizer (now a package named `optimizer`, run from `archive/`), `explore.ipynb` with its LaTeX
write-up, the planning notes, the dependency diagrams and the Savitsky calculator — is frozen under
`archive/`, each with a line in `archive/README.md` saying what it was. The root README now just lists
the models and how to run the notebook, and `explore.ipynb`'s GitHub fallback and write-up links point
at this repo instead of hav.

## 0.6.1 — 2026-10-30

Split into its own repo, `Haav-modeling`, from `MarMar888/hav` (MarMar888/hav#98). No model change. The
`opt-*` variable-dependency diagrams moved in under `diagrams/`, `VERSIONING.md` is now a local copy of
the versioning rules, and links that used to climb out of `optimization/` (diagrams, PEP rules) were
repointed — the PEP race rules stay in hav and are linked by URL.

## 0.6.0 — 2026-10-28

`willmarley.ipynb`: three more inputs stop being decision variables (#85), minor bump because the solve's structure
changes. (1) **Capacity** is solved, not sampled: `C = amps · (course/speed) · reserve / usable`, iterated with weight
and speed to a fixed point inside `steady_state` (the pack weighs on the boat, the heavier boat races slower and needs
more pack); the race-finish check disappears — it holds by construction — and `RACE` moves to the battery section.
(2) **Pitch** is derived at a fixed 80% slip target (`pitch = speed·1056/(rpm·0.8)`), replacing the pitch input, the
zero-slip cap and the slip sanity check with one buyable-thread check (6–14 in). (3) **Usable fraction** is a fixed 0.8
policy constant. Inputs drop to 14 (13 ranges + the motor count); the battery section's charts become
capacity-the-race-demands and pack weight; the prop section's right chart becomes pitch-to-buy vs rpm; the D×pitch map
becomes a diameter × voltage speed map; the MC scatter becomes speed vs pack demanded; shopping lists grow explicit
"to BUY" rows (capacity, pack weight, C-rating, pitch). Noted in the results: the C-rating requirement reduces to
`speed / (course · reserve)`, so the 10C buyability ceiling caps a 5-mile race near 65 mph — the fastest valid catalog
combo lands at 64.7 mph (twin 56154-V2), and all three picks choose 43–48 V packs sized within amp-hours of their need.

## 0.5.2 — 2026-10-28

`willmarley.ipynb`: the pack's discharge rating is no longer a sampled input to optimize — it's a requirement the
design writes on the shopping list (#85). `C_rate` leaves the battery bounds (and the map, sweeps, heatmap and
pressure chart); the solve outputs `C_rate_needed = amps / (0.8·C)` instead, printed per pick as "pack rating NEEDED",
with one fixed buyability ceiling (`C_RATE_MAX = 10`) as a validity check. The current cap in the solve reverts to the
motor's `I_max` alone. Downstream effect worth noting: freed from sampling pack ratings, the ideal set now presses
pack voltage against its upper bound (median ~45 V) — higher volts cut amps and the C-rating the pack must carry —
independently confirming the 48 V-class recommendation; the 20–50 V bound reads as "buy the bound", since ~50 V is a
real touch-safe/rules threshold rather than a guess.

## 0.5.1 — 2026-10-26

`willmarley.ipynb`: the K_T thrust ceiling is in (#85, "level 1"). New prop input `K_T` (0.05–0.15, the disk's grip);
after the solve, a design is valid only if `n_motors · K_T·ρ·n²·D⁴` covers `R_water` at the solved speed. It is the
single toughest check (14% lone pass rate); the valid space tightens to ~0.3%, the magic tiny-prop sprint rigs die
(fastest valid drops 62 → 58 mph, now on 3.6 in props with real thrust headroom), and the catalog ideal set moves back
to mid-size diameters. The shopping lists print "push available vs needed (lbf)" per pick; the map gains the K_T node.
Bounds pressure now sits on C_rate, LD0 (both high) and bare hull weight (low) — all buy-the-bound items. Missing-list
item 1 updated: the constant-K_T ceiling is in; the full K_T(J)/K_Q(J) curves remain the next step.

## 0.5.0 — 2026-10-24

`willmarley.ipynb`: lift-to-drag is now a function of speed (#85) — `L/D(v) = LD0 / (1 + (v/26)²)`, one hull-quality
knob (`LD0`, 5–10, replacing the constant `LD` input) and one fixed shape constant (26 mph, where friction has doubled
the push-back), both calibrated against the Savitsky cross-check. The power balance becomes a cubic in speed with one
real root (solved in closed form), the 45 mph sanity wall is removed — going fast now gets expensive for the real
reason — and with it the ballast loophole: valid designs no longer benefit from carrying surplus battery to stay under
a cap, so packs shrink to their binding need (every current pick carries within a few Ah of max(energy, amps) need).
Section 4's charts now draw L/D-vs-speed and the upward-bending towing bill; the solve reports the operating L/D, shown
as a new shopping-list row. The catalog ideal set becomes the 50 fastest valid combos (the 5% band collapsed once speed
stopped saturating). Fastest valid now reaches ~62 mph on twin 56133-V2 5Y at operating L/D ~1.5 — flagged in the
deliberately-missing list: constant `η_p` lets tiny props claim unlimited thrust, so a `K_T` thrust cap is the next
fidelity step and will pull the top end down. Bounds pressure moved to `LD0` and `C_rate` (both hugged high: the fast
designs want the best hull and the most discharge-capable pack).

## 0.4.12 — 2026-10-24

`willmarley.ipynb`: the shopping-list table closes with a new "if you just keep driving at this speed" block (#85) —
full runtime on the chosen battery (`60·usable·C / I_pack`) and the distance that covers, replacing the runtime row
that sat mid-table. At current picks: the fastest ideal cruises 59 min / 44 mi on its 164 Ah pack; the lightest-battery
pick, 13 min / 10 mi on its 9 lb pack — the race plus reserve and little more, by design.

## 0.4.11 — 2026-10-24

`willmarley.ipynb`: propeller diameter upper bound widened from 5 to 7 inches after the fastest ideal designs were
found hugging the old lid (#85). Verdict from the re-run: the pressure came off — ideal designs settle around
4.3–4.4 in ("leans low" in the new range, both edges clear), preferring a mid-size prop with more pitch and higher
efficiency over 5-plus-inch props, so the physics, not the bound, is now choosing the diameter. The fastest ideal
becomes a single 56154-V2 10Y (4.4 in × 13 in prop, 32 V, 45 mph at 0.84 efficiency); the lightest-battery pick drops
to a 9 lb, 40 Ah pack (pack-limited); twins still take 71% of the ideal set.

## 0.4.10 — 2026-10-24

`willmarley.ipynb`: the motor count is a design choice (#85). New discrete input `n_motors` (1 or 2, sampled in the
Monte-Carlo and catalog sections; sweeps and example charts hold it at one): twins multiply shaft power and motor
weight by two, the pack draw doubles (`I_pack = n·I`, runtime and the amp-feed capacity scale with it), and each motor
gets half the pack's discharge ceiling. The map gains the node; the valid-space and ideal-set cells print the
single-vs-twin split; the shopping lists show the count, pack-level current, and per-motor ceiling. At the shipped
ranges twins win: 58% of valid designs and 72% of the ideal set are twin-motor — the fastest ideal is now a pair of
56154-V2 9Y, while the lightest-battery and most-efficient picks stay single.

## 0.4.9 — 2026-10-24

`willmarley.ipynb`: the pack's continuous-discharge limit is in the solve (#85). New battery input `C_rate` (1–10, the
pack's discharge rating); the steady-state current cap is now the smaller of the motor's `I_max` and 80% of
`C_rate · C` (`DISCHARGE_DERATE = 0.8`, printed in section 3), so a pack sized only for the race's energy can be too
small to feed the current — amp-hours buy amps, not just minutes. The map gains the `C_rate` node (and `C`) feeding the
torque balance; the shopping lists add "capacity needed to feed amps" and a "current ceiling" row naming which limit —
motor or pack — binds each pick. The lightest-battery pick now carries ~50 Ah at a high C-rating; at a gentler-rated
pack the same current would force the capacity up, which is the oversizing this models.

## 0.4.8 — 2026-10-24

`willmarley.ipynb`: runtime is no longer a goal, only a race-finish requirement (#85). A new editable `RACE` constant
(course miles + energy reserve; placeholder 5 mi + 30% — set to the real course) replaces the flat minimum-runtime
requirement: a design is valid if its carried runtime clears `60·miles/speed·reserve`, which is drawn as the dashed
hyperbola on section 8's chart — anything far above it is battery towed for nothing. Ideal is now simply the fastest
valid (at constant drive, race time = course/speed): section 8 prints the top three by speed, section 10's pooled ideal
set becomes "within 5% of the fastest valid," and the shopping lists repick as fastest / lightest battery / most
efficient, with new computed rows: race time, battery used in the race, and the capacity actually needed with reserve —
making pack oversizing visible (the lightest-battery pick races 5 mi at ~43 mph on an 11 lb, 46 Ah pack sized within
1 Ah of its need).

## 0.4.7 — 2026-10-24

`willmarley.ipynb`: the motor section now explains, in plain words, how many volts a motor actually needs (#85) — the
speed equation flipped into `V_needed = rpm/Kv + I·R` (push-back plus winding loss), with the points that the propeller
load sets the rpm, that volts beyond `V_needed` only shove more current (heat), and that a winding's `v_max` is a
ceiling (`max_rpm/Kv`, the no-load spin limit), not a requirement. A new chart draws `V_needed` versus rpm for low/mid/
high Kv at the full mid-range current, and the section-10 shopping lists print a computed "volts actually needed" row
next to each ideal design's chosen pack — the knee and longest picks sized their packs to within a tenth of a volt of
it.

## 0.4.6 — 2026-10-24

`willmarley.ipynb`: the weight build-up is now the real one (#85): `W = W_hull + W_batt + W_motor + payload + margin`,
where `W_hull` is the bare hull (range narrowed to 30–90 lb), `W_motor` is a new motor input (0.4–5 lb as a range;
taken from the sheet's `weight_g` column in the catalog sections), and payload (30 lb) and safety margin (5 lb) are
fixed constants printed in section 4 and drawn on the map. Every downstream result reflects the heavier boat: median
all-up weight rises to ~152 lb, the random valid space tightens to ~0.6%, 174 of 263 sheet windings have no valid
combo, and the ideal picks shift (fastest: 56133-V2 6Y at ~45 mph; knee: 56154-V2 11Y at ~28 mph with ~3 h). No bound
is pressed. The deliberately-missing list now notes only the sheet's power ratings as uncounted.

## 0.4.5 — 2026-10-24

`willmarley.ipynb`: section 9's text now defines a combo (one winding + one sampled prop/battery/hull) and says plainly
that its table ranks *forgiveness* — the share of combos that stay valid — not top performance, which is section 10's
job (#85). After section 10's bounds chart, a new shopping-list cell prints three complete ideal designs — fastest,
balanced knee, longest — each as a buyable SSS winding (name, Kv, I_max, v_max) plus the full propeller, battery and
hull parameters and what you get (speed, runtime, amps, battery weight, all-up weight, efficiency, solved slip). At the
shipped ranges all three picks are 56154-V2 windings: the 5Y for 45 mph / 26 min, the 12Y for 28 mph / ~200 min at the
knee.

## 0.4.4 — 2026-10-24

`willmarley.ipynb`: new section 10, "Are the ideal designs pressed against our bounds?" (#85). Section 9 now pools
every valid (winding, prop, battery, hull) combo across the whole SSS sheet; the ideal set is the 5%-tolerance Pareto
front of that pool — real, buyable motors only (~490 designs, dominated by 56154-V2 windings). For each non-motor
input, a range bar shows where the ideal designs sit (p10–p90 and median) with a computed verdict: pressed at the
upper/lower bound, leans high/low, or comfortably interior; pressed verdicts print a widen-it-or-buy-the-bound line.
At the shipped ranges nothing is pressed against a bound — lift-to-drag leans high and pitch and hull weight lean low,
everything else sits interior — so the ranges are wide enough that the physics, not the bounds, is choosing.

## 0.4.3 — 2026-10-24

`willmarley.ipynb`: new section 9, "What's actually out there: the SSS catalog" (#85). Every winding of every SSS
motor on the supplier sheet (`sss_motors.csv`, 263 windings) runs through the same model and the same section-8
validity checks, with the motor's four numbers off the sheet, pack voltage clamped to the winding's `v_max`, and
`max_rpm` enforced. Output: a ranked table of windings by valid share of the prop/battery/hull space, a Kv-vs-valid
chart of the whole sheet (the room collapses above Kv ≈ 400, matching section 8's shop-low-Kv verdict; 164 of 263
windings have no valid combo at all), and the best winding's own cloud and Pareto front. At the shipped requirements
the sheet's winner is the 56133-V2 11Y (Kv 200), with ~15% of the sampled space valid — fifteen times the room of a
random motor from the section-1 ranges. The deliberately-missing list notes the sheet columns not yet enforced
(power ratings, motor weight).

## 0.4.2 — 2026-10-24

`willmarley.ipynb`: new section 8, "Conclusions: the valid space and the ideal space" (#85), and the Monte-Carlo
sample grows to 20,000 solves. Valid = editable requirements (min speed, min runtime, max weight) plus sanity bounds
where the model's own assumptions hold (motor efficiency ≥ 0.5, solved slip ≥ 0.5, and speed ≤ 45 mph — past which the
constant-L/D planing assumption is fiction); each criterion's lone pass-rate and the combined valid fraction are
printed. A per-input chart shows where valid designs sit inside each range (full range in gray, valid p10–p90 in blue,
median dotted), sorted most-decisive first with computed shop-low/shop-high verdicts. Ideal = the speed-runtime Pareto
front among valid designs, drawn over the sampled cloud with three picks — fastest, balanced knee, longest — printed
as full input/output columns. At the shipped bounds ~1% of the space is valid; the decisive directions are low Kv, low
pack voltage and low pitch.

## 0.4.1 — 2026-10-24

`willmarley.ipynb`: the map (section 5) now names every node in plain words with the short symbol in parentheses —
"pack voltage (V)", "speed constant (Kv)", "weight before battery (W_hull)", and so on — so the ontology reads without
having to remember the symbols (#85). Chart-only change; the model is untouched.

## 0.4.0 — 2026-10-24

`willmarley.ipynb`: the loop is closed — minor bump because speed is now a different (honest) quantity (#85). The water
is in the solve: speed comes from power balance (`speed = η_p · P_shaft / R_water`) with the zero-slip ceiling
(`rpm · pitch / 1056`) as a cap, so slip is an output, not a guessed input (`slip` and the old speed-section inputs are
gone; `η_p`, prop efficiency 0.5–0.7, replaces them). The battery's weight counts against the boat: new `e_batt`
(Wh/lb) input, `W_batt = C·V/e_batt`, `W = W_hull + W_batt`, `R_water = W/(L/D)` with `W_hull` and `L/D` as ranged
inputs — so volts and amp-hours each live double lives (power and weight). The midpoint headline table, reality check,
and "mid of every range" markers are removed (sweeps still hold other inputs mid-range, stated as such). Two new
sections: "The map" draws the model's ontology — every input, grouped by component, with an arrow per equation into
the intermediate quantities and the outputs — and "How the variables move together" samples every input range uniformly
(4000 whole-model solves), prints p10/median/p90 for speed, runtime, amps and weight, and charts an input×output
correlation heatmap plus a speed-vs-runtime scatter of every sampled design. Median speed across the whole space is
~16 mph, which is what the 0.3.1 reality check predicted once the water got a vote.

## 0.3.1 — 2026-10-24

`willmarley.ipynb`: new section 5, "How big should R_water be?", ahead of the combined solve (#85). On plane,
resistance ≈ weight / (L/D); for the assumed 130 lb all-up boat the section computes the expected band — roughly
20 lbf just on plane (L/D ~6.5), ~26 lbf planing pretty well (L/D 5, the starting number), up to ~52 lbf driven hard
(L/D ~2.5, cross-checked against the Savitsky model in explore's library) — and charts both R vs L/D and the towing
power it implies (P = R × speed). The combined solve (now section 6) gains a computed reality check comparing the
towing power band at its solved speed against the shaft power delivered, stating dynamically whether the headline mph
is optimistic, conservative, or consistent; at the midpoint of every range it is optimistic (the slip stand-in still
hides the hull physics until R_water is fed into the solve).

## 0.3.0 — 2026-10-24

`willmarley.ipynb`: rebuilt from scratch for followability (#85) — minor bump because the notebook's structure is new,
not an increment on the old one. One section per purchase choice, each with its raw equations and a low/high range on
every input (nothing picked): 1 the motor, 2 the propeller, 3 the battery, and 4 the water — the hull's planing
resistance `R_water`, deliberately declared as the one still-undefined input, with the slip range standing in for it
until it's defined. Section 5 brings them together (motor torque = prop torque, a quadratic in rpm with the current
limit as the one special case) and shows the solve three ways: the torque-balance chart, per-input speed sweeps, and a
diameter × pitch speed map. The SSS catalog chart, the separate runtime/speed sections, and the efficiency charts from
0.1.6–0.2.8 are removed; battery runtime now falls out of the combined solve instead.

## 0.2.8 — 2026-10-23

`willmarley.ipynb`: three explanatory charts added to the "Super simple model" (#85). The torque balance itself — the
motor's available-torque line (flat at the current cap, falling once the voltage runs out) against propeller parabolas
for three diameters, crossings marked with their rpm; an efficiency row of the same per-input sweeps, which shows what
the speed view hides (when current-limited, more supply voltage buys no speed while efficiency falls as 1/V); and a
diameter × pitch map of steady-state speed with mph contours, covering the two numbers printed on a propeller.

## 0.2.7 — 2026-10-23

`willmarley.ipynb`: the "Super simple model" no longer assumes a picked motor (#85). Every input — the five motor
numbers (`Kv`, `R`, `I0`, `I_max`, `V`) and the prop/speed inputs (`K_Q`, diameter, pitch, slip) — gets a lower and an
upper bound roughly bracketing the SSS sheet, with the midpoint as baseline, and each input is swept alone against the
steady-state speed (orange marks where the motor is held at its current limit). At the midpoints the solve is
current-limited, which the sweeps make visible: supply voltage and winding resistance are flat lines there, while
`I_max`, `Kv`, `K_Q`, diameter and pitch carry all the leverage.

## 0.2.6 — 2026-10-23

`willmarley.ipynb`: the "Super simple model" section is now the full computation, self-contained — motor, propeller and
speed at steady-state planing, with the battery/runtime piece removed from it (#85). One cell holds every input (the
56154-V2 5Y row typed in, supply voltage, `K_Q`, diameter, pitch, slip) and the whole solve: the motor-torque =
prop-torque balance reduces to one quadratic in rpm (closed form, no solver), the current limit handled as the one
special case, then speed = rpm × pitch × slip / 1056, with shaft power, electrical power and motor efficiency falling
out at the end. The result reproduces the catalog-based crossing from the earlier section (11.8k rpm, 7.56 N·m) with
nothing imported from it.

## 0.2.5 — 2026-10-23

`willmarley.ipynb`: added a closing "Super simple model" section (#85) — the four one-line pieces (battery runtime,
motor, propeller torque, speed) on one screen, one shared `INPUTS` dict, and the outputs computed together: speed,
runtime, and `range = speed × runtime`, checked against the 2-mile course. `rpm` and `P` stay free inputs, with the
later one-line connections (crossing picks the rpm, motor draw becomes `P`, constraints return) listed in the notes.

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

Added three variable-dependency diagrams under `diagrams/` (decisions → mass/balance, mass/speed →
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
[`docs/PEP-Rules/` in hav](https://github.com/MarMar888/hav/tree/master/docs/PEP-Rules)). Component catalog, prices, and resistance model are
synthetic fixtures — every result carries `build_ready: false`. `/optimization` on the dashboard reads
completed runs and compares candidates. See [`README.md`](README.md) for the full model and its limits.

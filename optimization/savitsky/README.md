# Savitsky sample calculator

## Python calculation notebook

For an audit of the **original 1964 paper**, open
[paper1964-reference.ipynb](paper1964-reference.ipynb). It replays Tables 1 and 2,
shows every arithmetic row against its printed value, and documents differences
from our engine. Transcribed graph readings are explicitly retained as reference
inputs in [paper1964-data.json](paper1964-data.json). The paper has some internal
arithmetic inconsistencies, so exact agreement with every printed answer is not
claimed. Run `python3 optimization/savitsky/paper1964_audit.py` to regenerate the
[audit report](../../outputs/savitsky/savitsky-1964-reference-2026-10-28/PAPER-REPLICATION.md)
and JSON/CSV using only the standard library. This audit does not change the
production model.

Open [current-hull.ipynb](current-hull.ipynb) to reproduce the October 21, 2026
current-hull run, inspect equations and intermediate values, and compare designs.
All geometry, force and solver code is visible in notebook cells. Editable,
documented SI defaults live in [current-hull-inputs.json](current-hull-inputs.json).
The historical results remain a separate, unchanged regression reference.

```sh
python -m pip install -r optimization/savitsky/requirements-notebook.txt
jupyter lab optimization/savitsky/current-hull.ipynb
```

Run all cells once. Change `OVERRIDES`, `SPEEDS_MPH`, and `DETAIL_MPH` in section 2,
then rerun that cell and everything below it. Section 7 exposes every intermediate
value and signed force/moment term at the selected speed. Section 9 compares input
changes. Section 10 optionally exports inputs and results to new JSON/CSV files.
The reference comparison always uses the original inputs, independently of edits.

This notebook supports the saved run's 1964 geometry with no flap; unsupported
1976/flap settings are rejected explicitly. The uniform-aft-section warning stays
visible separately from the empirical engine screen. No changes are made to
`explore.ipynb` or its model/write-up.

## Variable relationships and planing goals

Start with the [increase/decrease decision tree](../../hull/diagrams/decision-tree.md): it follows
beam and the other decision inputs through individual equations, then through
the trim/wetted-length re-solve. Includes both directions and numerical results.

See the [variable flow chart and adjustment guide](../../hull/diagrams/variable-flow.md) for the chain
from mass, CG, hull shape and thrust line to trim, wetting, drag and power. It
includes re-solved examples at 22 mph and explains the additional data needed to
evaluate earlier planing. The diagram is also displayed near the top of the notebook.

## Sensitivity across speed

Open [the sensitivity workspace](../../hull/sensitivity-analysis.ipynb)
to load these inputs or a saved study, vary multiple inputs one at a time, and
compare raw curves, percentage changes and normalized sensitivity across speed.
It also accepts coupled design scenarios and exports traceable JSON plus flat
curve/sensitivity CSV tables. The existing notebook remains the equation source.
See the [executed example export](../../outputs/savitsky/sensitivity/example/study.json).

## Browser calculator

Open **[index.html](index.html)** in a browser. It works locally with no server,
network, package installation or build. Keep `model.js` and `calculator.js` beside
it. Change the inputs, calculate, and move the speed slider. Save CSV exports all
model inputs alongside every speed/result/status so the curve remains traceable.

This is a standalone calculator; it does not modify `explore.ipynb` or its model.

## Inputs

All values are SI. Provide length, chine beam, constant deadrise, total loaded
mass, CG forward of transom and above keel, thrust angle and application-point
coordinates, water density, kinematic viscosity and hull roughness. Mass is
converted to force using 9.8066 m/s². Defaults describe a **generic example**,
not the current CAD hull. No geometry or weight is imported from CAD yet.

Positive thrust angle tilts the forward thrust vector upward relative to the
keel. Thrust-point coordinates are measured forward from transom and upward
from keel. A point on the thrust line, not its distance from CG, is entered.

Pitch radius of gyration and wave height are **not needed for this calm-water
equilibrium calculation**. They belong to additional dynamics/seaway analyses.

## Speed from zero

- At rest: motion resistance and effective power are zero. Static draft and trim
  need a separate hydrostatic model and are left unavailable.
- Positive speeds with `Cv = V / sqrt(g * beam) < 1`: no result is given because
  this sample has no displacement/wave-making resistance model. This is a
  conservative evaluation cutoff, **not a predicted planing-onset speed**.
- Higher speeds: solve vertical force and pitch-moment equilibrium. Passing
  implemented checks is not proof of planing or dynamic stability.
- Outside-limit estimates are dashed. Gaps are not interpolated, and the zero
  point is not connected to the first planing-model result.

The curve is therefore a speed sensitivity study with an explicit low-speed gap,
not a validated continuous displacement-to-planing resistance prediction.

## Model and validation

`model.js` adapts the calm-water empirical equations from
[OpenPlaning](https://github.com/elcf/python-openplaning) (MIT, see `NOTICE.txt`):
Savitsky lift and pressure location, 1964 or 1976 wetted geometry, ITTC 1957
friction with bottom-flow velocity, Townsin roughness allowance, and thrust-line
moment. The browser uses 1964 geometry, no flap and no air drag. A flap regression
and 1976 geometry are supported by the engine to reproduce the published example.

An independent nested bracketed solver balances lift at each trial trim, then
brackets pitch equilibrium between 0.5 and 35 degrees. If multiple roots exist,
it chooses the one closest to 3 degrees and reports the ambiguity. Lack of a
bracket is reported as failure, never replaced with an assumed trim. Normalized
vertical and pitch residuals must each be below 1e-6 before a result is returned.

Checks flag trim outside 2–15 degrees, lambda above 4, Cv above 13, predicted
wetting longer than the hull, dry chines, nonphysical resistance and deadrise
above 30 degrees. These are a screen, not a comprehensive applicability test.
Hull length is used for geometry checks; it does not clip the empirical wetting
prediction. Outside-limit estimates remain visible so the user can inspect them.

Tests reproduce the upstream published worked example: trim 2.878945 degrees,
keel wetted length 28.69256 m, area 175.5762 m², pressure drag 39245.86 N and
horizontal friction 31893.98 N. The worked example itself predicts wetting beyond
its overall length, which is flagged rather than hidden. This numerical agreement
is not experimental validation of the example hull or this project's boat.

The engine excludes displacement/wave-making resistance, waves, appendage drag,
air drag, roughness-induced lift change, porpoising and hydrofoils. The effective
power output is resistance × speed, **not shaft or battery power**. Warped-V,
stepped or multi-hull CAD needs a justified approximation or another method.

## Command line

Requires Node.js (no npm packages):

```sh
node optimization/savitsky/run.js --output outputs/savitsky/sample.json
node optimization/savitsky/run.js --config my-inputs.json --max-speed 12 --output outputs/savitsky/custom.json
node --test optimization/savitsky/model.test.js
```

For optional ordinary PNG and SVG charts (requires matplotlib):

```sh
python3 optimization/savitsky/plot.py outputs/savitsky/sample.json
```

Configuration is a JSON object with any numeric fields from `model.js` defaults.
Unspecified fields keep their documented defaults. The report includes complete
inputs, model version, timestamp, residuals, checks and all 31 sweep points.

# Hav in the original DBB application

The main deliverable is `dbb-project-10x.json`, a project for the original
Ship Design Building Block Editor. The earlier `static-model.html` is a separate
CAD-solid solver's visualization and should not be identified as a DBB result.

## Open the project

1. Open https://shiplab.github.io/dbb/ or the downloaded original app at
   `dbb/index.html` in a browser.
2. Use **Open** and select `dbb-project-10x.json` from the parent directory.
3. Confirm the project title says **10x hydrostatic similarity model**, freshwater
   density is **1.000 t/m³**, **Float** is enabled, and **Structure %** is **0**.
4. Open the **Hydrostatics** tab. The six small boxes are mass-center markers;
   their dimensions do not represent the components' actual sizes.

The browser interface could not be operated here because computer-use permissions
were denied. The file was loaded through the original app's project parser, with
no warnings, and its original calculation functions were executed in Node.

## Why this is a scaled project

The downloaded app's `sanitizeProject` function clamps hull depth to at least
0.5 m, beam to at least 0.5 m, and length to at least 1 m. The real hull is only
0.3048 m deep, so importing it at actual size would silently deepen it.

The project therefore scales **all positions and hull dimensions by 10** and
**all masses by 1,000**, at unchanged water density. Under static hydrostatic
similarity, lengths scale linearly, volumes/masses cubically, waterplane areas
quadratically, and angles remain unchanged. This uses the original app without
changing its source. In the app:

- Divide lengths, drafts, CG/CB coordinates and GM by **10** for full-size meters.
- Divide displayed tonnes by **1,000** for full-size tonnes.
- Divide volumes by **1,000** for full-size cubic meters.
- Trim angle and heel angle need no conversion.
- The model is 18.288 m long in the app, representing a 1.8288 m / 72 in boat.
- Displayed mass is about 56.7476 t, representing 56.7476 kg / 125.107 lb.

Do not use the scaled app's generic ship-size pass/fail thresholds as full-size
boat acceptance criteria. Resistance, seakeeping and structure estimates have not
been set up or validated for this project. This is only the hydrostatic case.

Positive DBB transverse Y maps to positive CAD X. The physical port/starboard
label is unconfirmed, so the reported heel direction remains **positive CAD X
side down**.

## Which original code was used

The app and its three script dependencies were downloaded from
https://shiplab.github.io/dbb/ on 2026-10-29. `dbb/index.html` and `dbb/vendor/`
contain those unmodified files. The app's own core reports `APP_VERSION = 1.2.0`;
source hashes in `dbb-results.json` identify the exact downloaded code rather
than relying on a version label.

`run_original_dbb.mjs` extracts the original **DBB core** script and executes it
unchanged, with the app's original Three.js dependency. It calls:

- `sanitizeProject`: load and validate the project.
- `weightSummary`: total mass and weighted center of gravity.
- `floatState`: solve draft, trim and heel using DBB's own hull integration.
- `stabilityState`: calculate DBB's upright initial stability.
- `serializeProject`, followed by a second load/solve: check saved-file rounding.

The extracted original core is also saved as `dbb-source/core.js` for inspection.
The runner is an adapter, not a replacement hydrostatics implementation.

## Results at full boat size

| Property | Original DBB | Separate CAD-solid calculation |
|---|---:|---:|
| Weight | 125.107 lb | 125.107 lb |
| Stern centerline waterline Z | 6.490896 in | 6.477249 in |
| Stern-down trim | 0.302574° | 0.195739° |
| Heel, positive CAD X side down | 0.099058° | 0.096832° |
| Initial upright transverse GM | 1.806851 in | Not calculated as GM |

DBB and the separate solid calculation agree within **0.013647 in at the stern**
and **0.002226° of heel**, but trim differs by **0.106836°**. Because the angles are
small, the relative difference in trim is substantial. These results support a
similar predicted floating depth; they do not independently establish a precise
trim angle. The source of the entire difference has not been isolated.

DBB's `floatState` initially integrates 40 vertical by 120 longitudinal strips.
Its coupled heel/trim solve uses 32 vertical by 90 longitudinal by 14 transverse
cells. It integrates the offsets representation, whereas the separate solver
intersects the STEP solid directly. Both geometry representation and numerical
integration can therefore contribute to differences. This is a plausible
explanation, not a demonstrated error attribution.

After saving through DBB and reloading its rounded project, the normalized
results were 125.107263 lb, 6.491071 in at the stern, 0.302658° trim, and 0.099265°
heel. There were no load warnings. Keeping the master input project retains
more precision than the app's four-decimal save format.

## Independent checks and remaining uncertainty

The original DBB core was checked against an analytical rectangular box hull:
draft = mass / (water density × length × beam), and
GM = draft/2 + beam²/(12 × draft) − KG. Draft and GM errors were below 0.000001%
in that simple centered-load case, with zero heel and effectively zero trim.
This validates those calculations in that case; it does not establish accuracy
for every complex hull or loading condition.

The input offset table had already been compared with direct CAD Boolean volumes
at six level waterlines, differing by less than 0.6%. That comparison used
trapezoidal integration of the table, not DBB's internal integration. It does not
bound all DBB errors at tilted waterlines.

For a physical comparison, weigh the assembled boat and measure its fore/aft and
side-to-side waterline positions in calm freshwater. Hull construction, actual
component mass/placement, sealed volume and appendage displacement affect the
result. Only the supplied hull contributes buoyancy in this case. Frame mass/CG
includes the hull as instructed; blank rows add no mass.

DBB's manual explicitly describes the software as educational and for early
concept exploration, with simplified estimates. Using the original software
does not by itself certify a physical prediction:
https://shiplab.github.io/dbb/docs/manual.md

## Rebuild

```sh
python outputs/hydrostatics/build_dbb_project.py
node outputs/hydrostatics/run_original_dbb.mjs \
  outputs/hydrostatics/dbb/index.html \
  outputs/hydrostatics/dbb/vendor/three.min.js
```

The runner requires the earlier `static-results.json` only to populate the
side-by-side comparison; DBB's solve uses the project file, its own code and
its own dependency. Its source is not patched by the runner.

# v5 hydrostatics

[NavalToolbox notebook](navaltoolbox.ipynb) · [Loading table](component-masses.csv) · [Geometry checks](geometry/geometry-report.json)

[Latest completed run and results](results/navaltoolbox-20261105T220511194489Z/REPORT.md): midship draft 6.02 in, minimum rim freeboard 5.32 in, initial transverse GM 2.47 in. The analytical-box, loading-CG and buoyancy-balance checks passed.

The dedicated v5 notebook uses the [November 5 STEP](../../geometry/v5-2026-11-05/README.md) and the supplied component masses. Open it with the existing Python 3.13 kernel and run from top to bottom; it loads NavalToolbox from `hull/hydrostatics/.venv`. The saved geometry is ready for routine runs. Geometry regeneration requires the Open CASCADE interpreter described in the notebook.

The loading currently contains seven filled rows totaling **148.595 lb**, including three 30.865 lb battery rows at different CG heights. All three repeated battery IDs are retained as independent components, distinguished by CSV line number. The thirteen blank rows are **intentionally excluded as requested**. Set `ALLOW_BLANK_MASSES = False` if a future case must require a mass for every row.

Results are written to a new timestamped folder under `results/`; earlier completed results are preserved on future runs. Each run has `REPORT.md`, `hydrostatics.csv`, `study.json`, `hydrostatics.png`, a loading snapshot and the included/excluded component lists. Earlier failed export attempts have been moved out of this folder; the two retained folders are completed runs of the same supplied-row case.

## Loading and assumptions to review

1. The new STEP is at `hull/geometry/v5-2026-11-05/hull.step`. Complete the remaining confirmations in its [geometry notes](../../geometry/v5-2026-11-05/README.md).
2. Edit [component-masses.csv](component-masses.csv): component mass in pounds and the location of each component's center of gravity in inches. Add or remove rows to match the case. Blank rows are explicitly excluded from the current supplied-row loading, as requested; the saved report records them.
3. Confirm the water and loading conditions below.

The proposed mass-table coordinates match the v4 convention: X transverse, Y forward from the transom, Z up from the aft keel. Confirm the transverse sign and that the new CAD uses this origin and orientation before entering positions. Every position is a component center of gravity, not a mounting point. No v4 masses or positions have been assumed for v5.

Include the complete boat: shell and finish, frame, tubes and fittings, batteries, motors and mounts, controls, electronics, wiring, fasteners and payload. Avoid counting an item both separately and within an assembly. Record whether each value is measured, from CAD, or estimated in `source` and `notes`.

A known total mass and whole-boat X/Y/Z center of gravity can replace the component breakdown; record their values, units and source here if using that approach.

## Conditions to confirm

- Water: proposed freshwater at 998.2 kg/m³, matching the v4 calculation; confirm or replace.
- Baseline loading: describe battery count, payload and equipment configuration.
- Additional cases: list any alternate payloads, battery positions or mass ranges. Moving components requires recalculating the whole-boat center of gravity; a fixed-CG weight sweep alone does not capture that change.
- Buoyancy: identify sealed volumes and openings in the geometry notes. A cap at the rim represents a dry interior only while that rim remains above water.

## Geometry and numerical checks

The reviewed exterior STEP faces 1–7 and a cap from rim face 0 form a valid flotation solid. The mesh has 13,272 triangles, is watertight with consistent winding, and differs from the exact envelope volume by 0.00944%. The rim is at 12 inches above the aft keel. Inner shell surfaces are excluded, and no extra tube or appendage buoyancy is added.

The notebook computes mass and all three center-of-gravity coordinates from the CSV, checks NavalToolbox against an analytical box, requires mass balance within 0.1%, and verifies the native loading CG against the mass-weighted input. These establish numerical consistency, not physical validation of the boat.

Target outputs are draft, trim, heel, minimum freeboard, waterline length, wetted area and initial transverse stability. These describe flotation at rest.

The [v4 setup](../v4-2026-10-30/README.md) remains a reference. This dedicated v5 notebook was created for the requested hydrostatics run; the active propulsion model remains [willmarley.ipynb](../../../prop_motor_battery/willmarley.ipynb).

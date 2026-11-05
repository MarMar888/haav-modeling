# Hull work

[v5 hydrostatics notebook and results](hydrostatics/v5-2026-11-05/README.md) use the new STEP and the 148.595 lb supplied-row loading. The v4 entry points below remain available for comparison.

| Analysis | Current v4 entry point | Older work |
|---|---|---|
| Hydrostatics | [NavalToolbox](hydrostatics/v4-2026-10-30/navaltoolbox.ipynb) · [quick displacement calculator](hydrostatics/v4-2026-10-30/displacement-calculator.ipynb) | [v3 DBB and static model](hydrostatics/v3-2026-10-29/) |
| Hydrodynamics — Savitsky | [Sensitivity analysis](hydrodynamics-savitsky/v4-2026-10-30/sensitivity-analysis.ipynb) · [results](hydrodynamics-savitsky/v4-2026-10-30/results/RESULTS.md) | [October 21](hydrodynamics-savitsky/legacy-2026-10-21/) · [reference cases](hydrodynamics-savitsky/references/) |

[Geometry](geometry/) holds the STEP sources by revision and the older parametric CAD. The active propulsion model remains in [prop_motor_battery](../prop_motor_battery/willmarley.ipynb).

For NavalToolbox, run `sh hull/hydrostatics/setup.sh` from the repository root. NavalToolbox 0.9.3 and the v4 solve have been verified; [validation status](hydrostatics/v4-2026-10-30/VALIDATION.md).

Savitsky checks: `python3 -m unittest discover -s hull/hydrodynamics-savitsky -p 'test_*.py'`.

[Relocation map](RELOCATION.json) records the old and new locations. Historical result payloads keep their original provenance paths. Existing notebook controls and loading edits were retained. CFD work is kept locally and excluded from this repository update.

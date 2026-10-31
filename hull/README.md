# Hull analysis

Open **[sensitivity-analysis.ipynb](sensitivity-analysis.ipynb)** to change boat inputs and compare resistance, effective power, trim, wetting and sensitivity across speed. Edit section 1 and Run All. Length displays and controls use inches (e.g. `lcg_in`); areas use square inches. CSV exports use inch-based columns and slope units; reloadable JSON and internal equations remain SI. Section 6 exports CSV/JSON into `outputs/savitsky/sensitivity/`; a saved [example study](../outputs/savitsky/sensitivity/example/study.json) is included.

```sh
python -m pip install -r optimization/savitsky/requirements-notebook.txt
jupyter lab hull/sensitivity-analysis.ipynb
```

- [savitsky_sensitivity.py](savitsky_sensitivity.py) loads the existing equation functions, re-solves variations, computes sensitivities and exports results.
- [diagrams/](diagrams/) holds the flow charts and decision-tree experiments from this analysis.
- The equation source remains [current-hull.ipynb](../optimization/savitsky/current-hull.ipynb), with its [baseline inputs](../optimization/savitsky/current-hull-inputs.json). The [active propulsion model](../prop_motor_battery/willmarley.ipynb) links to this workspace.

The notebook reports calm-water effective power, not electrical efficiency or planing onset. Empirical and hull-geometry warnings remain visible in curves and exports.

Run the regression and export checks from the repository root:

```sh
python3 -m unittest discover -s hull -p 'test_*.py'
```

## Boats

- [v4 — October 30, 2026](boats/v4-2026-10-30/README.md): verified STEP dimensions, supplied loading and completed 0–30 mph sweep. This is now the sensitivity notebook's default boat.

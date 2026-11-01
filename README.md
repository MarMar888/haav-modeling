# Haav modeling

Design-space models for [Haav](https://github.com/MarMar888/hav), a 4-foot autonomous RIB built for
the PEP race. Split out of hav's `optimization/` folder with its full git history (MarMar888/hav#98).

## Models

| Model | Status |
|---|---|
| [`prop_motor_battery/willmarley.ipynb`](prop_motor_battery/willmarley.ipynb) — pick motors, a propeller and a battery: inputs with bounds, the model, the fastest design inside the bounds, the SSS catalog run through the same search, and a shopping list | **Active** |
| [`hull/`](hull/README.md) — Savitsky resistance model of the current hull: the equation notebook and 1964 paper audit in `hull/savitsky/`, a sensitivity notebook, hull STEP exports, and decision diagrams. Hydrostatics and saved runs are in `outputs/` | Analysis |
| Everything in [`archive/`](archive/) — an earlier SciPy joint optimizer, the `explore.ipynb` model and its LaTeX write-up, planning notes, diagrams, a Savitsky calculator | Archived: kept for reference, frozen |

## Run the notebook

Needs Python 3.10+. One command builds `.venv` with everything the notebook uses (`requirements.txt`:
`numpy`, `matplotlib`, `jupyterlab`) and opens it:

```sh
make setup      # create .venv and install requirements.txt
make notebook   # open prop_motor_battery/willmarley.ipynb in JupyterLab
make clean      # delete .venv
```

`make setup PYTHON=python3.12` picks a different interpreter. Any other Jupyter works too, as long as
its kernel has `numpy` and `matplotlib`. The notebook reads `sss_motors.csv` from beside itself, so
run it from where it lives.

In VS Code: open the notebook, Select Kernel → Python Environments → `.venv` (or any Python 3.10+),
then Run All. Every input has a low/high range near the top of its section — edit, re-run, and the
charts, requirements and shopping lists recompute.

## Run the hull analysis

For how hull changes move resistance, trim and power across speed, open the
[Savitsky sensitivity notebook](hull/sensitivity-analysis.ipynb): edit its baseline, speed grid and
parameter values, then Run All. It needs pandas on top of the root requirements:
`.venv/bin/pip install -r hull/savitsky/requirements-notebook.txt`. The equations live in
[`hull/savitsky/current-hull.ipynb`](hull/savitsky/current-hull.ipynb); a saved
[example study](outputs/savitsky/sensitivity/example/study.json) is included. Regression checks:
`python3 -m unittest discover -s hull -p 'test_*.py'`.

Versions and changes: [`VERSION`](VERSION) + [`CHANGELOG.md`](CHANGELOG.md), kept per
[`VERSIONING.md`](VERSIONING.md).

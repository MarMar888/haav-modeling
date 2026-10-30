# Haav modeling

Design-space models for [Haav](https://github.com/MarMar888/hav), a 4-foot autonomous RIB built for
the PEP race. Split out of hav's `optimization/` folder with its full git history (MarMar888/hav#98).

## Models

| Model | Status |
|---|---|
| [`prop_motor_battery/willmarley.ipynb`](prop_motor_battery/willmarley.ipynb) — how to choose motors, a propeller and a battery: one section per choice, the raw equations, then one solved model that maps the valid and ideal design space and ends with real SSS windings to buy | **Active** |
| Everything in [`archive/`](archive/) — an earlier SciPy joint optimizer, the `explore.ipynb` model and its LaTeX write-up, planning notes, diagrams, a Savitsky calculator | Archived: kept for reference, frozen |

## Run the notebook

Needs Python 3.10+. One command builds `.venv` with everything the notebook uses (`requirements.txt`:
`numpy`, `matplotlib`, `jupyterlab`) and opens it:

```sh
make setup      # create .venv and install requirements.txt
make notebook   # open prop_motor_battery/willmarley.ipynb in JupyterLab
make clean      # delete .venv
```

`make setup PYTHON=python3.12` picks a different interpreter. Any other Jupyter works too: the
notebook's first cell installs `numpy` and `matplotlib` into whatever kernel runs it. It reads
`sss_motors.csv` from beside itself, so run it from where it lives.

In VS Code: open the notebook, Select Kernel → Python Environments → `.venv` (or any Python 3.10+),
then Run All. Every input has a low/high range near the top of its section — edit, re-run, and the
charts, requirements and shopping lists recompute.

Versions and changes: [`VERSION`](VERSION) + [`CHANGELOG.md`](CHANGELOG.md), kept per
[`VERSIONING.md`](VERSIONING.md).

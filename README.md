# Haav modeling

Design-space models for [Haav](https://github.com/MarMar888/hav), a 4-foot autonomous RIB built for
the PEP race. Split out of hav's `optimization/` folder with its full git history (MarMar888/hav#98).

## Models

| Model | Status |
|---|---|
| [`prop_motor_battery/willmarley.ipynb`](prop_motor_battery/willmarley.ipynb) — how to choose motors, a propeller and a battery: one section per choice, the raw equations, then one solved model that maps the valid and ideal design space and ends with real SSS windings to buy | **Active** |
| Everything in [`archive/`](archive/) — an earlier SciPy joint optimizer, the `explore.ipynb` model and its LaTeX write-up, planning notes, diagrams, a Savitsky calculator | Archived: kept for reference, frozen |

## Run the notebook

Any Jupyter works. The notebook needs only `numpy` and `matplotlib`, and its first cell installs them
into whatever kernel runs it (`%pip install -q matplotlib numpy`). It reads `sss_motors.csv` from
beside itself, so run it from where it lives:

```sh
python3 -m venv .venv
.venv/bin/pip install jupyterlab
.venv/bin/jupyter lab prop_motor_battery/willmarley.ipynb
```

In VS Code: open the notebook, Select Kernel → Python Environments → `.venv` (or any Python 3.10+),
then Run All. Every input has a low/high range near the top of its section — edit, re-run, and the
charts, requirements and shopping lists recompute.

Versions and changes: [`VERSION`](VERSION) + [`CHANGELOG.md`](CHANGELOG.md), kept per
[`VERSIONING.md`](VERSIONING.md).

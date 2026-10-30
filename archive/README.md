# Archive

Earlier modeling work, frozen — kept for the reasoning, not for use. The active model lives in
[`../prop_motor_battery/`](../prop_motor_battery/).

- `optimizer/` — a SciPy joint optimizer: one run picks hull geometry, drive, battery and speed
  together. From this folder, with Python 3.10+: `pip install -r optimizer/requirements.txt`, then
  `python -m optimizer.solve` (runs land in `optimizer/runs/`) and
  `python -m unittest optimizer.test_optimization -v`. The hav dashboard's `/optimization` viewer
  reads runs from a checkout placed as `optimization/` beside it (MarMar888/hav#99).
- `explore/` — `explore.ipynb`, a hand-exploration model of the full boat, its LaTeX write-up
  (`explore-model.tex` / `.pdf`), and `openplaning-reference.ipynb`, a notebook for learning the
  OpenPlaning library it uses. `AGENTS.md`, beside this file, was the rule keeping notebook and
  write-up in sync.
- `notes/` — the planning discussions the optimizer grew out of.
- `diagrams/` — variable-dependency diagrams traced line by line from the optimizer code.
- `savitsky/` — a JavaScript Savitsky planing calculator used as a cross-check.

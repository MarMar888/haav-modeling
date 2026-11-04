# CAD changelog

See [`../docs/VERSIONING.md`](../../../docs/VERSIONING.md) for how this file and `VERSION` are kept — this
folder versions independently of `optimization/`, `dashboard/`, and `docs/`.

`agentcad run hull.py --label <name>` already gives every build its own name under `build/` (gitignored,
local only). This file is the persistent record of what changed and why, since `build/` doesn't survive
a fresh clone — check `git log -- hull/geometry/legacy-parametric/hull.py` for exactly which commit shipped which version.

## 0.1.0 — 2026-10-01

First version tracked here. Current design, from build `v18_layup-baseboard-named` (see
[`README.md`](README.md)): 48.4 × 17.9 in hull, 7.8 in deep at the transom, 59.5 lb all-up against a
62 lb budget. Printed PETG shell, glass skin, aluminium backbone, marine-ply baseboard, inflatable
tubes. `reference/Hull.step` is the original Onshape collar; `hull.py` no longer reads it.

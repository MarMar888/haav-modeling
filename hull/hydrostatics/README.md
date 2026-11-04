# Hydrostatics

- [v4 NavalToolbox notebook](v4-2026-10-30/navaltoolbox.ipynb): actual hull geometry, weight sweeps, draft, freeboard and wetted area. [Current validation status](v4-2026-10-30/VALIDATION.md).
- [v4 quick displacement calculator](v4-2026-10-30/displacement-calculator.ipynb): mass ÷ density, with no hull-shape solve.
- [v3](v3-2026-10-29/): existing DBB projects, original detailed notebook and static HTML viewer. Its 10× DBB workaround applies only to those projects.

From the repository root:

```sh
sh hull/hydrostatics/setup.sh
```

This installs NavalToolbox 0.9.3 in `hull/hydrostatics/.venv`, checks an analytical box, then runs the v4 weight sweep. Successful output goes to `v4-2026-10-30/results/navaltoolbox/`: `REPORT.md`, `hydrostatics.csv`, `study.json`, and `hydrostatics.png`. Existing results are never overwritten; pass `--output NEW_FOLDER` for another run.

Use your existing Python 3.13 kernel; the v4 notebook loads the local `.venv` packages in its setup cell. The `.venv` interpreter is also supported. Rebuilding the checked-in geometry requires `requirements-geometry.txt` and `python hull/hydrostatics/v4-2026-10-30/prepare_geometry.py`.

On macOS, the wheel may need Homebrew `xz` (`brew install xz`). The current environment has already been repaired and verified. [v4 report](v4-2026-10-30/results/navaltoolbox/REPORT.md).

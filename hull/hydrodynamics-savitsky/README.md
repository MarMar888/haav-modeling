# Savitsky hydrodynamics

Open [v4 sensitivity-analysis.ipynb](v4-2026-10-30/sensitivity-analysis.ipynb), edit the controls, and Run All. Your existing scenarios and plotting choices are retained. [Boat inputs](v4-2026-10-30/savitsky-inputs.json) · [saved results](v4-2026-10-30/results/RESULTS.md).

- `engine/`: original Python equation notebook and JavaScript calculator; the equation notebook retains its October 21 baseline for regression checks.
- `legacy-2026-10-21/`: original run and example sensitivity export.
- `references/`: 1964/1976 paper checks and the sample calculator run.
- `diagrams/`: equation dependency maps.

```sh
python -m pip install -r hull/hydrodynamics-savitsky/engine/requirements-notebook.txt
python3 -m unittest discover -s hull/hydrodynamics-savitsky -p 'test_*.py'
```

New v4 sensitivity exports go under `v4-2026-10-30/results/sensitivity/`. The equivalent-V model does not calculate static freeboard or directly model the reverse chines.

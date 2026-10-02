# Optimization

## The explore model's write-up is the source of truth

`explore-model.tex` and its compiled `explore-model.pdf` describe the model in `explore.ipynb`: every decision
variable, calculated value, constraint and the objective. Readers are sent there from the notebook's first cell.

**Whenever you change the model in `explore.ipynb`, you must ALWAYS update `explore-model.tex` and rebuild
`explore-model.pdf` in the same change.** No exceptions, and not "later".

What counts as changing the model:

- a decision variable, its bounds, or its type (`Design`, `BOUNDS`, `INTEGER`)
- a constant or placeholder (`Fixed`, `Cell`, the OCV table, hard-coded positions inside `evaluate()`)
- any formula in the chain: hull, mass and balance, hydrostatics, the OpenPlaning call, power, battery
- a constraint: adding, removing, or changing a margin, its scale, or its group in `evaluate()`
- the objective, the speed scan (`fastest_feasible`), or the search settings and penalty (`objective`, `run_search`)

Charts, sweeps, widgets and other Part II storytelling do not change the model and need no update.

How to do it:

1. Edit the notebook, then edit the matching text in `explore-model.tex`. The main text explains in plain words;
   the appendices hold the exact formulas (A), constants (B) and the twenty margins (C). Update every place a changed
   value appears, including the margin counts and group counts in the main text.
2. If a change moves the baseline, re-run it and refresh the worked example tables (`fastest_feasible(DESIGN, FIXED)`).
   Do not hand-type the numbers.
3. Rebuild the PDF from this folder: `tectonic explore-model.tex`, or run `pdflatex explore-model.tex` twice so
   references resolve. Open the PDF and check the pages you touched.
4. Update the version, as `../docs/VERSIONING.md` requires: bump `VERSION` (patch by default) and add a dated entry
   at the top of `CHANGELOG.md`, in the same change. Mention in the entry that the write-up was updated.
5. Commit the `.ipynb`, `.tex`, `.pdf`, `VERSION` and `CHANGELOG.md` together.

If the notebook and the write-up disagree, treat that as a bug and fix whichever is wrong before doing anything else.
Say in your final message that you updated the write-up.

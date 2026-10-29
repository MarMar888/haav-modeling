# Savitsky 1976 reference check — 2026-10-28

Ran the existing `optimization/savitsky/run.js` locally with the OpenPlaning README reference inputs, `wetted_lengths_type=3` (1976 geometry), Townsin roughness allowance, and the specified flap. This is the large reference vessel, not our current hull. No wave-resistance model is included in this script.

**PASS:** all seven benchmark comparisons and all eight existing engine regression tests.

| Quantity | OpenPlaning README | Local script | Absolute difference | Tolerance |
|---|---:|---:|---:|---:|
| trim_deg | 2.878945 | 2.87894498458 | 1.54214e-08 | 1e-05 |
| keel_wetted_m | 28.69256 | 28.692562979 | 2.979e-06 | 0.0001 |
| chine_wetted_m | 17.67617 | 17.6761663833 | 3.61666e-06 | 0.0001 |
| wetted_area_m2 | 175.5762 | 175.576243048 | 4.30479e-05 | 0.001 |
| transom_draft_m | 1.441111 | 1.44111060047 | 3.99531e-07 | 1e-05 |
| pressure_drag_n | 39245.86 | 39245.8598954 | 0.00010455 | 0.02 |
| friction_drag_n | 31893.98 | 31893.9844116 | 0.00441156 | 0.02 |

At V = 13.07 m/s, force residual = 1.79625e-10 N; moment residual = -1.22236e-09 N·m.

## Files and reproduction

- [Exact inputs](inputs.json). SI units; weight 827400 N is converted to mass with g=9.8066 m/s².
- [Complete 31-point sweep](results.json). The final point is the reference speed, 13.07 m/s. The generic report label mentions the 1964 default; the actual input `wetted_lengths_type=3` selects 1976.

From the repository root (use your Node executable if `node` is not on PATH):

```sh
node --test optimization/savitsky/model.test.js
node optimization/savitsky/run.js --config outputs/savitsky/savitsky-1976-reference-2026-10-28/inputs.json --max-speed 13.07 --output /tmp/savitsky-1976-rerun.json
```

Node used on this device: `/Users/patri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`.

## Comparison source and paper

The expected numbers above come from the [OpenPlaning README example](https://github.com/elcf/python-openplaning#examples), not an independent transcription of the paper. Matching them confirms numerical agreement with that example, not independent validation of Savitsky’s equations or our hull.

Daniel Savitsky and P. Ward Brown (1976), *Procedures for Hydrodynamic Evaluation of Planing Hulls in Smooth and Rough Water*, Marine Technology and SNAME News, 13(4), 381–400.

- [Publisher / DOI](https://doi.org/10.5957/mt1.1976.13.4.381)
- [Publisher PDF](https://onepetro.org/MTSN/article-pdf/13/04/381/2203285/sname-mtsn-1976-13-4-381.pdf)

The full publisher PDF could not be retrieved by the browsing tool during this run; access may require a library/institutional login. No paper-derived numerical comparison is claimed.

## Geometry and regression warnings

- Predicted keel wetting exceeds actual hull length.
- Flap regression outside its documented chord/speed range.

The predicted wetting exceeds the reference vessel’s stated length. The flap check flags Cv below its supported range. These warnings are retained rather than clipped away. The reference uses modern friction/roughness choices; do not assume every paper table will match without reconciling these settings.

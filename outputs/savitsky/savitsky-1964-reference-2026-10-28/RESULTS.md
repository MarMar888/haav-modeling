# Savitsky 1964 paper comparison — 2026-10-28

**Follow-up:** the [exact arithmetic audit](PAPER-REPLICATION.md) and
[paper audit notebook](../../../optimization/savitsky/paper1964-reference.ipynb)
now replay the printed tables. Table 1's stated interpolation gives lambda=3.475,
not its printed 3.29, so the earlier wetting-length comparison below is against an
internally inconsistent printed result. Table 2's 2.23° trim is reproduced using
its rounded intermediate 2.42. See the audit for all rows, source-page references,
and the distinction between graph inputs and independently recalculated outputs.

**This run compares against the actual 1964 PDF, not the OpenPlaning README. It does not establish an exact match.** Ran the unchanged existing JavaScript engine twice with 1964 geometry, first with smooth-hull friction and then with its default 150 µm roughness and Townsin allowance. These cases use Table 1 geometry and loading, but retain the engine’s modern friction implementation. Neither case reproduces all original friction assumptions.

## Where to look in the supplied PDF

[Local copy of the supplied Slack PDF](Savitsky-1964.pdf) — 25 scanned pages; PDF page = printed page minus 70.

| PDF page (1-based) | Printed page | What to compare |
|---:|---:|---|
| 19 | 89 | Table 1, general case: given inputs, trial trims, interpolated equilibrium trim, drag, power, wetting and draft |
| 20 | 90 | Table 2, a different simplified case with all forces through CG; not the case used here |
| 18 | 88 | Force diagram, definitions of a and f, equilibrium equations (29)–(31) |
| 13 | 83 | Friction equation (19), Schoenherr coefficient, bottom-flow speed, drag equation (25) |
| 15 | 85 | Bottom-flow charts (Figure 14) and pressure-center equation (28) |

## Table 1 comparison

| Quantity | Paper Table 1 | Current script: smooth | Current script: 150 µm roughness |
|---|---:|---:|---:|
| Trim (degrees) | 2.3 | 2.245659 | 2.240176 |
| Mean wetting / beam | 3.29 | 3.436689 | 3.440298 |
| Wetted keel (ft) | 55.9 | 58.132619 | 58.207701 |
| Wetted chine (ft) | 36.1 | 38.094673 | 38.120652 |
| Transom draft (ft) | 2.24 | 2.277875 | 2.275251 |
| Horizontal resistance (lbf) | 9095 | 7675.551787 | 8997.186560 |
| Effective power (hp) | 1115 | 941.999538 | 1104.200169 |

Horizontal resistance discrepancy: smooth -15.61%; modern roughness -1.08%.

## Inputs and explicit reconstruction assumptions

- Paper Table 1: weight 60,000 lbf, LCG 29 ft, VCG 2 ft, average beam 14 ft, average deadrise 10°, speed 40 knots, shaft angle 4°, perpendicular thrust-line offset f=0.50 ft.
- Used the paper’s rounded speed 67.5 ft/s = 20.574 m/s, rather than an exact conversion of 40 knots.
- Density: 1.94 slug/ft³, inferred from the paper’s 0.97 factor in the lift-coefficient calculation.
- Kinematic viscosity: approximately 1e-5 ft²/s, inferred from Table 1’s printed V_m, lambda and Reynolds numbers (e.g. 67 × 3.85 × 14 / 3.61e8). This is reconstructed, not an explicitly listed input.
- Existing engine g=9.8066 m/s² is retained; paper uses approximately 32.2 ft/s².
- A point on the thrust line is chosen at x_T=LCG and z_T=VCG−f/cos(epsilon), giving the stated perpendicular offset. Paper a=1.39 ft is the friction lever arm, not an additional thrust-point coordinate.
- Hull length is absent from this table; 100 ft is an explicit screening-only placeholder, not a paper-specified dimension. It does not enter the force equations or clip wetting.
- No flaps or air drag. Case 1 uses zero roughness; case 2 uses the engine default 150 µm with Townsin roughness. Neither roughness choice was fitted to the paper output.

## Why this is not an exact reproduction

1. Paper Table 1 rows 7–9 use Schoenherr friction plus a fixed ATTC roughness allowance of 0.0004. Our engine uses ITTC 1957 and either no allowance or Townsin’s formula.
2. Paper equation (19), PDF p.13/printed p.83, uses bottom-flow speed squared in friction force. Our engine uses free-stream speed squared for force, while using corrected bottom-flow speed in Reynolds number.
3. Paper Table 1 interpolates graph-derived values at 2° and 3° to get about 2.3°. Our solver solves continuous equations for force and moment equilibrium. Some numerical difference follows from graph reading, rounding, and interpolation.
4. The paper’s friction force acts midway between keel and chine (lever a=VCG−b*tan(beta)/4). Our engine uses an area-weighted friction height, including its triangular wetted region.

The 150 µm result is close in total drag, but that proximity alone does not prove the same equations and assumptions were used. The smooth case makes the effect of the omitted roughness allowance clear. No original-table porpoising conclusion is independently checked by this script.

## Saved data and rerun

- [Smooth inputs](inputs.json) and [smooth results](results.json).
- [150 µm inputs](inputs-modern-roughness.json) and [150 µm results](results-modern-roughness.json).
- Results are 31-point sweeps; the final point is the worked-example speed.

```sh
node optimization/savitsky/run.js --config outputs/savitsky/savitsky-1964-reference-2026-10-28/inputs.json --max-speed 20.574 --output /tmp/savitsky64-smooth.json
node optimization/savitsky/run.js --config outputs/savitsky/savitsky-1964-reference-2026-10-28/inputs-modern-roughness.json --max-speed 20.574 --output /tmp/savitsky64-rough.json
```

On this device, Node was run as `/Users/patri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`.

Source: Daniel Savitsky, Hydrodynamic Design of Planing Hulls, Marine Technology, October 1964, pp. 71–95. PDF supplied by the user through Slack (file F0C2J6NF6LX).

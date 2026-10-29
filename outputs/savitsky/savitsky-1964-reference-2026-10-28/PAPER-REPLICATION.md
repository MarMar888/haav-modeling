# Savitsky 1964: exact arithmetic audit

This audit uses the original printed tables and graph readings. It reproduces the stated operations without adjusting constants to force agreement. **Some printed results do not follow from their displayed operands, so every printed number cannot be reproduced exactly by consistent arithmetic.**

Source: [supplied PDF](Savitsky-1964.pdf). Table 1: PDF p.19 / printed p.89. Table 2: PDF p.20 / printed p.90. Equilibrium Eq.35: PDF p.21 / printed p.91.

## Findings that matter

| Location | Printed | Recalculated from displayed operands | Interpretation |
|---|---:|---:|---|
| Table 1 trim interpolation | 2.3° | 2.30820454° | Consistent after rounding to one decimal |
| Table 1 drag interpolation | 9095 lbf | 9095.00000000 lbf | Exactly matches using table endpoints and rounded trim fraction 0.3 |
| Table 1 mean wetting ratio | 3.29 | 3.47500000 | 3.85 − (3.85 − 2.60) × 0.3 = 3.475; printed result does not follow |
| Table 1 power | 1115 hp | 1116.20454545 hp | 9095 × 67.5 / 550 |
| Table 2 trim from printed intermediate 2.42 | 2.23° | 2.23317656° | Consistent when rounded to two decimals |
| Table 2 trim without intermediate rounding | 2.23° | 2.24036605° | Keeping 0.085/0.035 at full precision gives a different rounded trim |
| Table 2 power | 1100 hp | 1105.77272727 hp | Printed power is coarsely rounded |

The displayed drag line starts with 9424, while Table 1 gives 9434. Taken literally that line gives 9085 lbf; using the table endpoint 9434 gives the printed 9095. This apparent typo is not silently treated as an exact match.

Table 1 wetting lengths propagate the printed 3.29. Correcting just its stated interpolation changes the calculated keel wetting to 58.43202 ft instead of the printed 55.9 ft. Consequently, our earlier wetted-length comparison overstated disagreement with the paper’s own interpolation procedure.

## Friction values cannot be exactly recovered from the displayed inputs

Eq.19 (PDF p.13 / printed p.83) uses bottom-flow speed squared and Schoenherr friction. The examples add a fixed 0.0004 roughness allowance. Using rho=1.94 slug/ft³ (inferred from the displayed 0.97 lift denominator), and the table’s other rounded operands:

| Case | Printed friction Df (lbf) | Eq.19 from displayed operands (lbf) |
|---|---:|---:|
| Table 1, 2° | 7340 | 7140.036878 |
| Table 1, 3° | 5160 | 4987.078120 |
| Table 1, 4° | 3760 | 3650.843820 |
| Table 2 | 6670 | 6457.077775 |

The density is inferred rather than separately specified. Table 2’s friction would require an effective density of 2.003972 slug/ft³ with its other printed operands held fixed. This points to an unstated convention, rounding, or transcription/arithmetic inconsistency; it is not evidence for changing water density to fit the target.

## Exact differences from our existing engine

1. **Inputs and water constants:** paper calculations use imperial rounded quantities; rho and nu are reconstructed where not explicitly stated. Our prior engine runs retain SI gravity and conversions.
2. **Lift/wetting procedure:** the worked tables calculate a load coefficient from weight and read lift/wetting from graphs. The engine solves vertical force and moment equilibrium together, including vertical thrust and friction. Graph readings are reference inputs in this audit, not independent verification of the graphs.
3. **Friction law:** paper uses Schoenherr coefficients. Engine uses ITTC 1957.
4. **Roughness:** paper adds fixed delta Cf=0.0004. Engine uses zero or the Townsin allowance from a dimensional roughness.
5. **Velocity in friction force:** paper Eq.19 uses bottom-flow speed squared. Engine uses forward speed squared; corrected bottom speed enters only Reynolds number.
6. **Friction lever arm:** paper Table 1 uses b*tan(beta)/4. Engine area-weights triangular and rectangular wetted regions.
7. **Equilibrium algorithm:** Table 1 uses approximate Eq.35 and linear interpolation between trial trims, then rounds trim before interpolating other outputs. Engine continuously bisects exact implemented residuals.
8. **Table 2 is a different force arrangement:** a=f=c=epsilon=0 by assumption. In particular, the friction line passes through CG; setting thrust angle to zero in the ordinary engine does not implement this case.
9. **Reporting:** the engine labels pressure and friction as horizontal components of its solved forces; the paper’s weight*tan(tau) and Df/cos(tau) are an algebraic resistance decomposition. Their component columns should not be treated as identical definitions in the general thrust case.

The close 8997-lbf modern result is not an exact validation. The 9095-lbf paper value is reproducible as a table interpolation; the full printed chain is not internally exact. No production equations or historical runs were changed.

## Every arithmetic row

Values below are recalculated from printed immediate parent rows, not propagated corrected values. A dash denotes a graph reading or specified coefficient retained as an input. Differences include normal graph/rounding precision as well as larger inconsistencies; no blanket pass/fail tolerance is imposed.

| Table | Trial trim | Row | Quantity | Printed | Recomputed | Difference |
|---:|---:|---:|---|---:|---:|---:|
| 1 | 2 | 1 | tau_power | 2.14 | 2.143546925 | +0.00354693 |
| 1 | 2 | 2 | cl0 | 0.085 | — | — |
| 1 | 2 | 3 | lift_ratio | 0.0397 | 0.03971962617 | +1.96262e-05 |
| 1 | 2 | 4 | lambda | 3.85 | — | — |
| 1 | 2 | 5 | vm_ft_s | 67 | — | — |
| 1 | 2 | 6 | re | 361000000 | 361130000 | +130000 |
| 1 | 2 | 7 | cf | 0.00174 | — | — |
| 1 | 2 | 8 | dcf | 0.0004 | — | — |
| 1 | 2 | 9 | cf_total | 0.00214 | 0.00214 | +0 |
| 1 | 2 | 10 | df_lbf | 7340 | 7140.036878 | -199.963 |
| 1 | 2 | 11 | tan_tau | 0.0349 | 0.03492076949 | +2.07695e-05 |
| 1 | 2 | 12 | sin_tau | 0.0349 | 0.0348994967 | -5.03297e-07 |
| 1 | 2 | 13 | cos_tau | 0.9994 | 0.999390827 | -9.17298e-06 |
| 1 | 2 | 14 | pressure_lbf | 2094 | 2094 | +0 |
| 1 | 2 | 15 | friction_drag_lbf | 7340 | 7344.406644 | +4.40664 |
| 1 | 2 | 16 | drag_lbf | 9434 | 9434 | +0 |
| 1 | 2 | 17 | cp_ratio | 0.59 | — | — |
| 1 | 2 | 18 | cp_ft | 31.6 | 31.801 | +0.201 |
| 1 | 2 | 19 | c_ft | -2.6 | -2.6 | -1.33227e-15 |
| 1 | 2 | 20 | friction_height_ft | 0.616 | 0.6171444325 | +0.00114443 |
| 1 | 2 | 21 | a_ft | 1.39 | 1.384 | -0.006 |
| 1 | 2 | 22 | sin_sum | 0.1045 | 0.1045284633 | +2.84633e-05 |
| 1 | 2 | 23 | vertical_factor | 0.9964 | 0.99635295 | -4.705e-05 |
| 1 | 2 | 24 | normal_arm_ft | -2.59 | -2.592195317 | -0.00219532 |
| 1 | 2 | 25 | thrust_arm_ft | 0.0174 | 0.01745 | +5e-05 |
| 1 | 2 | 26 | combined_arm_ft | -2.6 | -2.6074 | -0.0074 |
| 1 | 2 | 27 | normal_moment_lbft | -156500 | -156000 | +500 |
| 1 | 2 | 28 | friction_thrust_arm_ft | 0.89 | 0.89 | -1.11022e-16 |
| 1 | 2 | 29 | friction_moment_lbft | 6540 | 6532.6 | -7.4 |
| 1 | 2 | 30 | moment_lbft | -149960 | -149960 | +0 |
| 1 | 3 | 1 | tau_power | 3.35 | 3.348369522 | -0.00163048 |
| 1 | 3 | 2 | cl0 | 0.085 | — | — |
| 1 | 3 | 3 | lift_ratio | 0.0254 | 0.02537313433 | -2.68657e-05 |
| 1 | 3 | 4 | lambda | 2.6 | — | — |
| 1 | 3 | 5 | vm_ft_s | 66.6 | — | — |
| 1 | 3 | 6 | re | 242000000 | 242424000 | +424000 |
| 1 | 3 | 7 | cf | 0.00184 | — | — |
| 1 | 3 | 8 | dcf | 0.0004 | — | — |
| 1 | 3 | 9 | cf_total | 0.00224 | 0.00224 | +4.33681e-19 |
| 1 | 3 | 10 | df_lbf | 5160 | 4987.07812 | -172.922 |
| 1 | 3 | 11 | tan_tau | 0.0524 | 0.05240777928 | +7.77928e-06 |
| 1 | 3 | 12 | sin_tau | 0.0524 | 0.05233595624 | -6.40438e-05 |
| 1 | 3 | 13 | cos_tau | 0.9986 | 0.9986295348 | +2.95348e-05 |
| 1 | 3 | 14 | pressure_lbf | 3144 | 3144 | +0 |
| 1 | 3 | 15 | friction_drag_lbf | 5160 | 5167.234128 | +7.23413 |
| 1 | 3 | 16 | drag_lbf | 8304 | 8304 | +0 |
| 1 | 3 | 17 | cp_ratio | 0.65 | — | — |
| 1 | 3 | 18 | cp_ft | 23.5 | 23.66 | +0.16 |
| 1 | 3 | 19 | c_ft | 5.5 | 5.5 | +0 |
| 1 | 3 | 20 | friction_height_ft | 0.616 | 0.6171444325 | +0.00114443 |
| 1 | 3 | 21 | a_ft | 1.39 | 1.384 | -0.006 |
| 1 | 3 | 22 | sin_sum | 0.1219 | 0.1218693434 | -3.06566e-05 |
| 1 | 3 | 23 | vertical_factor | 0.9964 | 0.99361244 | -0.00278756 |
| 1 | 3 | 24 | normal_arm_ft | 5.46 | 5.487883036 | +0.027883 |
| 1 | 3 | 25 | thrust_arm_ft | 0.0262 | 0.0262 | +0 |
| 1 | 3 | 26 | combined_arm_ft | 5.53 | 5.4338 | -0.0962 |
| 1 | 3 | 27 | normal_moment_lbft | 332000 | 331800 | -200 |
| 1 | 3 | 28 | friction_thrust_arm_ft | 0.89 | 0.89 | -1.11022e-16 |
| 1 | 3 | 29 | friction_moment_lbft | 4600 | 4592.4 | -7.6 |
| 1 | 3 | 30 | moment_lbft | 336600 | 336600 | +0 |
| 1 | 4 | 1 | tau_power | 4.59 | 4.59479342 | +0.00479342 |
| 1 | 4 | 2 | cl0 | 0.085 | — | — |
| 1 | 4 | 3 | lift_ratio | 0.0185 | 0.01851851852 | +1.85185e-05 |
| 1 | 4 | 4 | lambda | 1.86 | — | — |
| 1 | 4 | 5 | vm_ft_s | 66.2 | — | — |
| 1 | 4 | 6 | re | 173000000 | 172384800 | -615200 |
| 1 | 4 | 7 | cf | 0.00192 | — | — |
| 1 | 4 | 8 | dcf | 0.0004 | — | — |
| 1 | 4 | 9 | cf_total | 0.00232 | 0.00232 | +0 |
| 1 | 4 | 10 | df_lbf | 3760 | 3650.84382 | -109.156 |
| 1 | 4 | 11 | tan_tau | 0.0698 | 0.06992681194 | +0.000126812 |
| 1 | 4 | 12 | sin_tau | 0.0698 | 0.06975647374 | -4.35263e-05 |
| 1 | 4 | 13 | cos_tau | 0.9976 | 0.9975640503 | -3.59497e-05 |
| 1 | 4 | 14 | pressure_lbf | 4188 | 4188 | +0 |
| 1 | 4 | 15 | friction_drag_lbf | 3760 | 3769.04571 | +9.04571 |
| 1 | 4 | 16 | drag_lbf | 7948 | 7948 | +0 |
| 1 | 4 | 17 | cp_ratio | 0.7 | — | — |
| 1 | 4 | 18 | cp_ft | 18.2 | 18.228 | +0.028 |
| 1 | 4 | 19 | c_ft | 10.8 | 10.8 | +0 |
| 1 | 4 | 20 | friction_height_ft | 0.616 | 0.6171444325 | +0.00114443 |
| 1 | 4 | 21 | a_ft | 1.39 | 1.384 | -0.006 |
| 1 | 4 | 22 | sin_sum | 0.1392 | 0.139173101 | -2.6899e-05 |
| 1 | 4 | 23 | vertical_factor | 0.9903 | 0.99028384 | -1.616e-05 |
| 1 | 4 | 24 | normal_arm_ft | 10.7 | 10.72097033 | +0.0209703 |
| 1 | 4 | 25 | thrust_arm_ft | 0.0349 | 0.0349 | +0 |
| 1 | 4 | 26 | combined_arm_ft | 10.73 | 10.6651 | -0.0649 |
| 1 | 4 | 27 | normal_moment_lbft | 645000 | 643800 | -1200 |
| 1 | 4 | 28 | friction_thrust_arm_ft | 0.89 | 0.89 | -1.11022e-16 |
| 1 | 4 | 29 | friction_moment_lbft | 3350 | 3346.4 | -3.6 |
| 1 | 4 | 30 | moment_lbft | 648350 | 648350 | +0 |
| 2 | — | 1 | cl0 | 0.085 | — | — |
| 2 | — | 2 | cp_over_beam | 2.07 | 2.071428571 | +0.00142857 |
| 2 | — | 3 | lambda | 3.45 | — | — |
| 2 | — | 4 | lift_ratio | 0.035 | — | — |
| 2 | — | 5 | tau_power | 2.42 | 2.428571429 | +0.00857143 |
| 2 | — | 6 | trim_deg | 2.23 | 2.233176556 | +0.00317656 |
| 2 | — | 7 | tan_tau | 0.039 | 0.03894050708 | -5.94929e-05 |
| 2 | — | 8 | pressure_lbf | 2340 | 2340 | +0 |
| 2 | — | 9 | lambda_b2_ft2 | 675 | 676.2 | +1.2 |
| 2 | — | 10 | vm_ft_s | 66.9 | — | — |
| 2 | — | 11 | re | 322000000 | 323127000 | +1.127e+06 |
| 2 | — | 12 | cf | 0.00177 | — | — |
| 2 | — | 13 | dcf | 0.0004 | — | — |
| 2 | — | 14 | cf_total | 0.00217 | 0.00217 | +0 |
| 2 | — | 15 | df_lbf | 6670 | 6457.077775 | -212.922 |
| 2 | — | 16 | friction_drag_lbf | 6670 | 6675.055155 | +5.05516 |
| 2 | — | 17 | drag_lbf | 9010 | 9010 | +0 |
| 2 | — | 18 | ehp | 1100 | 1105.772727 | +5.77273 |
| 2 | — | 19 | porpoising_axis | 0.186 | 0.1857417562 | -0.000258244 |

## Reproduce or inspect

Run `python3 optimization/savitsky/paper1964_audit.py` from the repository root. Requires only Python’s standard library.

- [Editable source transcription](../../../optimization/savitsky/paper1964-data.json)
- [Calculation code](../../../optimization/savitsky/paper1964_audit.py)
- [Audit notebook](../../../optimization/savitsky/paper1964-reference.ipynb)
- [Machine-readable audit](paper-arithmetic-audit.json) and [all rows as CSV](paper-arithmetic-rows.csv).

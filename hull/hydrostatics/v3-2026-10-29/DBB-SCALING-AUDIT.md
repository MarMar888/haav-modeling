# DBB scale audit — 2026-10-30

## Conclusion

For both current loading conditions, scaling lengths by 10 and masses by 1000
preserves computed static draft, trim, heel, volume, waterplane area and upright
GM after conversion to full size. Fixed dimensional numerical tolerances produce
tiny differences, so the results are not bit-for-bit identical.

This checks scale invariance of DBB's numerical model. It does not validate the
physical boat, eliminate discretization errors or test every possible loading.

## Method

Used unchanged `dbb-source/core.js` and original `dbb/vendor/three.min.js`.
The exact source hash and full results are in `dbb-scaling-audit.json`.
Both `dbb-project-10x.json` and `dbb-project-updated-weights-10x.json` were tested.

Each was run at 1x, 2x, 5x, 10x, 20x and 50x. Hull offsets, their internal L/B/D
references, dimensions and positions were scaled linearly; masses cubically;
water density stayed unchanged. Three paths were compared:

1. Rescale an already-loaded model in memory and call the original solver. This
   preserves geometry and bypasses the loader's size clamp for the 1x diagnostic.
   The solver code itself was unchanged. This diagnostic 1x case cannot be loaded
   from a full-size JSON into stock DBB without the loader changing its geometry.
2. Scale raw project inputs and use the ordinary original loader. The 2x and
   larger cases retain their intended dimensions; the 1x case is distorted.
3. Save through the original `serializeProject`, reload and solve again to
   measure the app's four-decimal saved-file rounding.

All floating solves converged for both trim and heel. No project inputs or
original app code were modified during this audit.

## Results with geometry preserved

All quantities below are converted to the real boat's size.

| Loading / quantity | 1x diagnostic | 10x project |
|---|---:|---:|
| Baseline stern waterline, in | 6.490916662 | 6.490895581 |
| Baseline trim, degrees stern down | 0.302599213 | 0.302574442 |
| Baseline heel, degrees | 0.099058099 | 0.099058099 |
| Baseline upright transverse GM, in | 1.806850860 | 1.806850860 |
| Updated stern waterline, in | 9.721391811 | 9.721395581 |
| Updated trim, degrees stern down | 7.761122636 | 7.761133853 |
| Updated heel, degrees | 0.046403525 | 0.046384847 |
| Updated upright transverse GM, in | 3.012298997 | 3.012298997 |

Across all six scales and both cases, the largest ranges were:

- Stern waterline: **0.00002440 in**.
- Trim: **0.00002979 degrees**.
- Heel: **0.00002038 degrees**.
- Upright GM: below **0.000000000001 in**.

Level submerged volumes and waterplane areas agreed to floating-point precision.
The coupled solver uses a fixed 0.004 m height differentiation step, 0.0002 m
positional stopping thresholds and a 0.5 m height update cap. Thus exact
computational scale invariance is not guaranteed, although differences were
negligible in these cases.

## Ordinary 1x import is distorted

The original loader silently changes the hull depth from **12 in to 19.685 in**,
then stretches the offsets to that depth. No warning is issued.

The distorted baseline predicts a **6.813 in** stern waterline and **1.496 degrees
bow down**, versus approximately 6.491 in and 0.303 degrees stern down with the
proper geometry. The distorted updated loading predicts 10.616 in at the stern
and 7.364 degrees stern down, versus 9.721 in and 7.761 degrees.

Therefore importing a naively reduced 1x project into the stock app would
introduce an actual geometry error. The 10x project avoids that clamp.

## Saving/reloading the 10x projects

Relative to the supplied full-precision projects, DBB's own save/reload changed:

| Quantity | Baseline | Updated loading |
|---|---:|---:|
| Weight, lb | +0.0002632 | +0.0002632 |
| Stern waterline, in | +0.0001755 | +0.0002077 |
| Trim, degrees | +0.0000839 | +0.0001581 |
| Heel, degrees | +0.0002074 | +0.0001011 |

These small rounding effects are separate from the scale comparison.

## Exceptions and scope

- **GM acceptance labels and highest KG:** the absolute 0.15 m threshold is not
  scaled by DBB. At 10x it represents only 0.015 m at full size. The GM number
  converts correctly; the app's generic pass/fail threshold does not.
- Angle thresholds and trim/length ratios are dimensionless, but remain generic
  design guides rather than independently established criteria for this boat.
- Lengths and GM divide by 10; areas divide by 100; volumes and masses divide
  by 1000. Angles and shape coefficients remain unchanged in theory.
- TPC (tonnes per centimeter) divides by 100, because it scales with waterplane
  area and its centimeter unit stays fixed.
- Large-angle GZ, resistance, propulsion, seakeeping, structural sizing and
  regulatory criteria were **not** included in this scale audit.

For other loading conditions, fixed solver tolerances and iteration limits can
produce different numerical behavior; these results establish the two tested
cases rather than a universal guarantee.

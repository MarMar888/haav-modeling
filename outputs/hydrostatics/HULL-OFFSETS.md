# Hull offsets

Source: `cad/stepfiles/v3 - solid hull. 10.29.26`.

The STEP geometry passes Open CASCADE's BRep validity check and contains one solid,
one shell, and eight faces. Dimensions: 72.000 in long (Y), 24.904061 in wide (X),
12.000 in high (Z). Coordinate limits: X = -12.452031 to +12.452031 in,
Y = 0 to 72 in, Z = 0 to 12 in. Full solid volume: 9,381.436375 in³.
The full volume is not the displacement at the floating waterline.

## Files and coordinates

- `hull-offsets-in.csv`: coordinates and half-widths in inches, for inspection.
- `hull-offsets-m.csv`: the same table in meters, for DBB offsets import.
- `component-masses.csv`: user-maintained mass and center-of-mass inputs in pounds
  and inches. This file was not changed during offsets extraction.

Both offset files have a blank top-left cell. The first row gives 145 longitudinal
station positions from Y = 0 to 72 in, spaced 0.5 in apart. The first column gives
97 heights from Z = 0 to 12 in, spaced 0.125 in apart. Body cells contain transverse
half-widths in X. Blanks mean no hull at that station and height; zero means a
present section has zero width. These are coordinates in the source CAD system.
DBB names its longitudinal axis X and transverse axis Y; the table has already
placed the source CAD coordinates in the required row/column order.

Widths come from horizontal line intersections with the STEP boundary surfaces,
not from the rendered mesh. At boundary faces the sampling position is nudged
0.00001 mm inward to avoid coincident-face intersection ambiguity; the table
retains the exact boundary coordinates.

## Checks

There were no samples with an unmatched number of boundary intersections.
Maximum sampled left/right half-width difference was below 0.000000001 in.
Both saved CSV files were parsed and their integrated volumes checked after export.

The table represents each section at a given height as one filled interval across
the centerline. At 144 sample locations, small bottom features produce multiple
intervals. Using the outermost intersections fills those local gaps. Consequently
the offsets are an approximation; direct solid hydrostatics preserve these details.

Trapezoidal integration of the table was compared with CAD Boolean intersections
below level, untrimmed waterlines:

| Waterline Z (in) | CAD volume (in³) | Table volume (in³) | Difference |
|---:|---:|---:|---:|
| 2 | 500.299 | 503.238 | +0.5875% |
| 4 | 1,695.092 | 1,701.107 | +0.3549% |
| 6 | 3,157.865 | 3,164.114 | +0.1979% |
| 8 | 4,842.601 | 4,849.051 | +0.1332% |
| 10 | 6,854.166 | 6,862.580 | +0.1228% |
| 12 | 9,381.436 | 9,388.147 | +0.0715% |

These errors describe this table and this integration check. They do not establish
DBB's final draft, trim, heel, or stability accuracy. Trimmed/heeled conditions
have not been checked. Additional tubes and appendages are not included.

## DBB setup

Import `hull-offsets-m.csv` as an offsets hull. Preserve its dimensions:
length 1.8288 m, beam 0.632563159 m, depth 0.3048 m. DBB rescales imported
offsets to its hull size fields; do not fit this hull to equipment blocks.

Convert mass inputs from pounds to tonnes using 0.00045359237 t/lb and positions
from inches to meters using 0.0254 m/in. Map CAD Y to DBB longitudinal X.
Map the transverse coordinate sign after confirming which CAD side is port;
DBB uses positive transverse Y toward port. Vertical Z is unchanged apart from
unit conversion. Set estimated structure share to zero when all structural
weights are supplied explicitly.

The actual floating position still requires a complete mass/center-of-mass table,
water density, and agreement that this solid represents the water-excluding
volume over the range of drafts being considered. The upper closure of a CAD
solid does not establish that the physical boat remains watertight when submerged.

DBB format and scaling reference: https://shiplab.github.io/dbb/docs/manual.md

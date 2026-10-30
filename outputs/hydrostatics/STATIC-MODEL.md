# Initial freshwater static model

Open `static-model.html` in a browser. It contains the geometry, results and
Three.js 0.160.0 library inline and requires no network connection. Drag to orbit,
scroll to zoom, use the view buttons, and toggle geometry and component markers.
Markers represent mass centers, not physical component dimensions.

`static-model-preview.png` is a static engineering view. `static-results.json`
contains the numerical results, source-file hashes and assumptions.

## Inputs and result

- Geometry: `cad/stepfiles/v3 - solid hull. 10.29.26`.
- Loading: six populated rows in `component-masses.csv`, totaling **125.107 lb**.
- Combined frame/hull: 35.107 lb, using the frame row's center of mass.
- Blank mass rows are excluded from this loading condition; no estimated masses
  are added for them.
- Nominal freshwater density: **1,000 kg/m³**. Temperature is not specified.

| Property | Result |
|---|---:|
| Displaced volume | 3,462.949839 in³ / 2.004022 ft³ |
| Buoyant force, expressed as equivalent weight | 125.107 lb |
| CG: X / Y / Z | 0.003087 / 23.734254 / 6.023536 in |
| CB: X / Y / Z | 0.006654 / 23.727043 / 3.912621 in |
| Waterline Z at stern centerline | 6.477249 in |
| Trim | 0.195739° stern down |
| Heel | 0.096832° positive-X side down |
| Waterline extent along CAD Y | 0 to 61.900005 in |

Coordinates use the STEP frame: X across the boat, Y from stern toward bow,
Z upward from the hull baseline. Port/starboard sign is not inferred from the
file. The waterline at the bow station is below the local rising hull, so it is
not reported as a bow draft. Waterline extent is measured along the CAD Y axis.

## Method and checks

The solver intersects the actual STEP solid with the half-space below a water
plane. Open CASCADE computes submerged volume and its centroid. A damped Newton
solve adjusts waterline height, roll and pitch until displaced water weight
equals total weight and the transformed centers of buoyancy and gravity align
horizontally. This calculation uses the solid directly, preserving the small
bottom details approximated in the DBB offsets table.

The world transform applies a rotation about longitudinal Y followed by a
rotation about transverse X, then translates the water surface to world Z = 0.
The displayed boat therefore has the solved attitude relative to a level surface.

Force mismatch was below 0.00001 lb and horizontal CG/CB alignment error below
0.00001 in. These are numerical convergence checks, not physical accuracy bounds.
The rotation matrix and transformed waterline coordinates were checked as well.

For an additional local check, roll and pitch were perturbed by ±0.05° and the
height re-solved to maintain displacement. The angular restoring response is
locally stable in both directions. This is not a large-angle stability or
downflooding calculation. No GM or GZ curve is claimed here.

The JavaScript passes Node's syntax check. Automated browser inspection was
unavailable because computer-use permission was not granted. The PNG preview
was rendered separately from the same solved geometry.

## Scope

Calm water at zero speed, with no thrust, waves, mooring forces or moving loads.
Only the supplied hull contributes buoyancy. Tubes, pods and other appendages
are not represented as buoyant solids. The supplied solid's top closure is
treated as watertight; physical openings and downflooding are not modeled.

## Regenerating after editing weights

The HTML is a saved result, not a live link to the CSV. In a Python environment
with `numpy` and `cadquery-ocp-novtk` (this build used 8.0.1.1.0), run from the
repository root:

```sh
python outputs/hydrostatics/static_model.py
python outputs/hydrostatics/build_static_viewer.py
```

The viewer builder reuses the Three.js library from the existing HTML bundle.
For the first build without that bundle, supply a local Three.js 0.160.0
`build/three.min.js` file using `--three-js PATH`. Library source:
https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js (MIT license).

To regenerate the optional preview with matplotlib installed:

```sh
python outputs/hydrostatics/render_static_preview.py
```

Use `--water-density KG_PER_M3` on the solver to change water density. Any later
change to source geometry or masses requires a fresh solve and viewer rebuild.

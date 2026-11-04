# CAD

The model is one parametric [build123d](https://github.com/gumyr/build123d) script, driven by
[agentcad](https://pypi.org/project/agentcad/). Every dimension in it is in millimetres.

```
hull/geometry/legacy-parametric/
├── hull.py              the model: print, glass skin, tubes, backbone, baseboard, payload, pods, waterline
├── exports/hav-rib.step latest geometry, for any CAD tool
├── reference/Hull.step  the original Onshape collar (see the units note below)
├── agentcad.toml        sends everything agentcad generates to build/
├── requirements.txt     agentcad 0.6.0, build123d 0.10.0, on Python 3.12
├── AGENTS.md, .claude/  agentcad's guide for coding agents working in this folder
└── build/               every version, viewer and mesh agentcad generates (gitignored)
```

## Just looking

- **Browser:** open [`../dashboard/public/viz/hull.html`](../../../dashboard/public/viz/hull.html). It's a
  single self-contained file: orbit, zoom, and toggle parts on and off.
- **CAD tool:** import [`exports/hav-rib.step`](exports/hav-rib.step). It's an assembly of separate
  bodies (the printed shell, its outside glass skin, both tubes, the backbone pieces, baseboard, payload,
  pods), not one fused solid.

## Changing it

One-time setup, from the repo root:

```bash
python3.12 -m venv .venv-cad
.venv-cad/bin/pip install -r hull/geometry/legacy-parametric/requirements.txt
cd hull/geometry/legacy-parametric && ../../../.venv-cad/bin/agentcad init --name hull   # fresh clone only: creates build/
```

Then edit `hull.py` and run:

```bash
cd hull/geometry/legacy-parametric && source ../../../.venv-cad/bin/activate
agentcad run hull.py --label my-change --dry-run                          # validate, writes nothing
agentcad run hull.py --label my-change --no-preview --no-diff --no-view   # light: STEP only
```

`agentcad run` on its own launches a 3D viewer server and opens a browser tab every time, and that's the
heavy part. The flags above skip it, along with the PNG renders and the diff. When a version is good and
you want to look at it or publish it, run it once without `--no-view`:

```bash
agentcad run hull.py --label my-change --no-preview --no-diff             # also writes viewer.html
cp build/vN_my-change/output.step exports/hav-rib.step
cp build/vN_my-change/viewer.html ../../../dashboard/public/viz/hull.html
agentcad viewer stop                                                      # free the memory after
```

The BOM site never loads any of this. The 3D hull is a separate page behind the "3D hull" link in its
header, so it only uses memory when you open it: about 10 MB of JS for the BOM page, against 71 MB plus
WebGL for the viewer.

## CFD

[CFD](../../hydrodynamics-cfd/README.md) holds the current OpenFOAM case (`hav-captive/`) and the scripts that export this hull's
surfaces into it (`export_surfaces.py`). See [`cfd/README.md`](../../hydrodynamics-cfd/README.md). The earlier catamaran-hull
CFD workflow is archived at [`../archive/hull/`](../../../archive/hull) — a different hull, kept for its
OpenFOAM scripting approach, not its result.

## Units and coordinates

- Millimetres throughout. **y** runs along the boat (transom at −390, stem at +840), **z** is up, **x**
  is athwartships. The waterline plane in the model is at z = −115.3, the 62 lb design weight.
- The outside shape is the **glassed** hull. The print is modelled `SKIN_OUT` (1.2 mm) smaller all round,
  so print it from the `hull` body, not the outside shape, and the glass brings it back to size.
- `reference/Hull.step` came out of Onshape at 3.33 × full size **in inches**; multiply by 7.62 to get
  this model's millimetres. `hull.py` doesn't read it any more. The tubes are generated from the hull's
  own sheer line.

## The current design at a glance

From build `v18_layup-baseboard-named`:

| | |
|---|---|
| Hull | 48.4 × 17.9 in, 7.8 in deep at the transom |
| Over the tubes | 53.7 × 23.3 in |
| Draft | 4.4 in at the hull, about 7.7 in to the prop tips |
| All-up weight | 59.5 lb, against a 62 lb budget |
| Printed shell | 7.8 kg of PETG at 3 mm walls |
| Outside glass skin | about 1.2 kg: 1 m² of 2 × 6 oz glass, faired and painted |
| Baseboard | 0.8 kg of 1/4 in marine ply, glassed both sides |
| Aluminium backbone | 2.0 kg of 6061 |
| Balance | LCG at 35% of length from the transom, VCG 11 mm below the waterline |

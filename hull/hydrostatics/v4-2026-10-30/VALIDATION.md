# Validation status

**NavalToolbox 0.9.3 is installed and the v4 solver test passed.** The user completed the package download. The macOS wheel then failed to load its hardcoded Homebrew `liblzma.5.dylib` dependency. This environment was repaired by copying the ABI-compatible ARM64 liblzma (compatibility 14.0.0, current 14.3.0) into the ignored virtual environment, updating the extension's library reference and re-signing it locally. The original extension is retained beside it as `.so.before-lzma-fix`. Other macOS installations can supply that dependency with `brew install xz`.

The actual NavalToolbox analytical-box test and six v4 mass cases passed. Maximum mass-balance error was 0.00923%. Box volume error was 0.00610%, waterplane-area error 0%, and wetted-area error 0.00210%. These checks establish successful execution and numerical consistency; they do not validate the physical boat.

[Report](results/navaltoolbox/REPORT.md) · [CSV](results/navaltoolbox/hydrostatics.csv) · [Complete study and checks](results/navaltoolbox/study.json) · [Graphs](results/navaltoolbox/hydrostatics.png)

Completed geometry checks:

- Actual v4 STEP source hash matches the reviewed CFD geometry source.
- Outer STEP faces and a rim cap form one valid flotation solid.
- Exported mesh: 17,226 triangles, watertight, consistent winding and positive volume.
- Length 1.8288 m; height 0.3048 m; axes rotated to X-forward, Y-transverse, Z-up.
- Mesh envelope volume differs from exact STEP envelope volume by 0.01355%.

See [geometry-report.json](geometry/geometry-report.json). The 12-inch cap represents a dry interior below the rim, not a physical deck or a flooding model.

To repeat the run without overwriting these results, use:

```sh
hull/hydrostatics/.venv/bin/python hull/hydrostatics/v4-2026-10-30/run_navaltoolbox.py --output NEW_FOLDER
```

Inspect actual rim freeboard and convergence before interpreting results.

Relocation verification: the quick displacement calculator, v4 sensitivity notebook, original equation notebook and v3 detailed hydrostatics notebook execute from their new folders. All 10 Savitsky Python tests and 8 JavaScript tests pass. The existing DBB core also passes its analytical box check after relocation. CFD meshes/logs were moved intact; no mesh build or CFD solve was launched. The edited v3 CSV contents were retained; readers now accept its padded headers.

## Python 3.13 kernel

The notebook setup exposes the installed project-local Python 3.13 site-packages to the existing Python 3.13 kernel. The global Python environment is not modified. Setup prints both Python and NavalToolbox versions; the local virtual-environment interpreter also remains supported.

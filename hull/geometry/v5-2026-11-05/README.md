# v5 geometry

[hull.step](hull.step) is the supplied November 5 export, originally named `v4 - Hull.step`. The STEP header still names it `v4 - Hull`; it is tracked here as the v5 source. Its bytes were preserved when moving it from the v5 hydrostatics folder.

[Inspection report](step-inspection.json): Open CASCADE reports valid geometry, one solid, one shell and 17 faces. Overall dimensions are **72.000 in along CAD Y × 26.245 in along CAD X × 12.000 in along CAD Z**. The v4 source measures 25.639 in across X, so this export is approximately 0.606 in wider. Both have the same overall length and height.

The STEP declares metres; Open CASCADE imported it in millimetres. CAD bounds are approximately X = −333.309 to +333.309 mm, Y = 0 to 1828.8 mm, Z = 0 to 304.8 mm. The material volume is 0.006975781 m³; this is the thin-shell solid volume, **not** the enclosed flotation volume.

Record before preparing a flotation mesh:

- CAD export date: November 5, 2026, 21:19:37 UTC (STEP header).
- STEP length units: metres; import scale verified against the dimensions above.
- Origin and axis directions: dimensions are consistent with v4's X transverse, Y longitudinal and Z vertical convention; physical origin and positive directions still need confirmation.
- Sealed volumes to include in buoyancy (for example, tubes): awaiting confirmation.
- Openings/rim where water can enter: exterior faces 1–7 and the outer wire of rim face 0 have been reviewed for the [flotation envelope](../../hydrostatics/v5-2026-11-05/geometry/geometry-report.json). The artificial cap at Z=12 inches assumes a dry interior; physical openings and additional buoyancy still need confirmation.

Use the same coordinate system for the [component mass table](../../hydrostatics/v5-2026-11-05/component-masses.csv), or document the transformation explicitly.

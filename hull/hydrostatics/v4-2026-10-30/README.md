# v4 hydrostatics

[NavalToolbox notebook](navaltoolbox.ipynb) · [Quick calculator](displacement-calculator.ipynb) · [Validation status](VALIDATION.md)

The current 72-inch × 12-inch-high STEP hull and the same supplied loading as [Savitsky](../../hydrodynamics-savitsky/v4-2026-10-30/savitsky-inputs.json) are used. Coordinates and mass are full scale; no 10× enlargement.

`geometry/hull-envelope.stl` uses the actual outside surfaces, closed at the rim for dry-interior flotation. It excludes the inner shell surface, tubes and appendages. Rim immersion ends the validity of this assumption. Changing total mass keeps the whole-boat CG fixed; specific component moves need their own loading changes.

The notebook reports draft, minimum freeboard, waterline length, submerged length and wetted area. These are static quantities, not running wetted lengths from planing.

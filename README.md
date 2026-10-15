# Haav

**Highly Amphibious / Autonomous Vessel.** A 4-foot autonomous RIB. We build the hull ourselves: a 3D-printed deep-V shell used as a plug, glassed
outside as the skin and taped inside at the joints, with custom inflatable tubes along the sides and a
plywood baseboard inside. Two Flipsky 65150 pods, each with its VESC built in, push it on 12S and steer
it by differential thrust. Phase 2 adds a sensor tower and an autopilot that drives it over LTE.

This repo holds four things, each documented where it lives, not here:

| Folder | What it is | Status |
|---|---|---|
| [`cad/`](cad/) | The hull: a parametric build123d model, STEP exports, drawings, and an OpenFOAM resistance case | Current design: 48.4 × 17.9 in hull, 59.5 lb all-up against a 62 lb budget |
| [`dashboard/`](dashboard/) | The BOM (a Postgres table on Neon, shown and edited on a Next.js site) and the optimizer results viewer | Live — the public project and sponsor pages, plus the team workshop you open day to day |
| [`optimization/`](optimization/) | The boat-design optimizer: one model picks hull geometry, drive, battery and speed together | Working demo. The numbers are synthetic fixtures, not a design recommendation yet — see its README |
| [`archive/`](archive/) | Earlier phases, kept for the reasoning, not the parts | Historical. The project started as a bought catamaran hull before becoming the RIB above |
| [`docs/`](docs/) | Reference material that isn't part of the design itself | [`docs/PEP-Rules/`](docs/PEP-Rules/) holds the official race rules; [`docs/white-paper/`](docs/white-paper/) is the scaffold for the required 20-point submission, unwritten so far |

## If you're new here

1. Read this file (you're doing it).
2. Read [`docs/PEP-Rules/`](docs/PEP-Rules/) — this is the race the boat is built for, and most of the
   numbers in `optimization/` (30 lb payload, 55.5 V limit, 2-mile course) come straight from it.
3. Run the website — one site, with everything else reachable from its header nav:
   ```bash
   cd dashboard && pnpm install && cd ..   # once
   pnpm dev                                # http://localhost:3000, from the repo root from now on
   ```
   The home page is the public project page; the team workshop behind it holds the BOM (`/bom`), the
   optimizer results viewer (`/optimization`) and the 3D hull viewer. `pnpm build`/`pnpm start`/`pnpm lint` work the same way, from the root — see
   [`dashboard/README.md`](dashboard/README.md) for what each page does.
4. Look at the hull: open [`cad/README.md`](cad/README.md).
5. If you care about the design math, [`optimization/README.md`](optimization/README.md) has the full
   model — objective, constraints, decision variables, and its limits.

## What's real and what isn't

The CAD is a real, dimensioned design you could build today. The BOM tracks real parts and real prices.
The optimizer runs end to end and returns a feasible boat — but every number in its component catalog is
a placeholder, and it says so: every result carries `build_ready: false`. Nothing here has touched water.

## Development

Three languages, three setups:

- **The dashboard** (TypeScript/Next.js) — [`dashboard/README.md`](dashboard/README.md).
- **The CAD** (Python/build123d) — [`cad/README.md`](cad/README.md).
- **The optimizer** (Python/SciPy) — [`optimization/README.md`](optimization/README.md).

This is Next.js 16, which has breaking changes from what you've seen before — read [`AGENTS.md`](AGENTS.md)
before touching `dashboard/`.

`cad/`, `optimization/`, `dashboard/`, and `docs/` each version independently (their own `VERSION` +
`CHANGELOG.md`, or `package.json`'s version for `dashboard/`) — see [`docs/VERSIONING.md`](docs/VERSIONING.md).

## Archive

[`archive/thinking/`](archive/thinking/) is the design reasoning from the project's first phase: a bought
catamaran hull, an Xbox controller, a ~$1,250 budget. The parts list is out of date; most of the reasoning
on stability, vibration, thermal management, and comms still holds — read its own README before assuming
anything in it is current. [`archive/hull/`](archive/hull/) is that catamaran's CAD and an early OpenFOAM
smoke test, superseded by [`cad/`](cad/) but kept for its CFD scripting approach.

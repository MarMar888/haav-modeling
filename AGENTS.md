<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `dashboard/node_modules/next/dist/docs/` before writing any code. Heed deprecation notices. The Next.js app lives under `dashboard/` (its own `package.json`), not the repo root.
<!-- END:nextjs-agent-rules -->

# Haav modeling

The active model is `prop_motor_battery/willmarley.ipynb`; that's where new modeling work goes.
Everything in `archive/` is frozen — don't update it, and don't make new work depend on it
(`archive/AGENTS.md` only applied while `explore.ipynb` was the active model).

Version bumps and `CHANGELOG.md` entries follow [`VERSIONING.md`](VERSIONING.md): same commit as the
change, patch by default, no bump for typo or path fixes.

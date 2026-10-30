# Versioning

This repo versions as one unit (it split out of [`MarMar888/hav`](https://github.com/MarMar888/hav), where
subgroups version independently — these rules are that repo's `docs/VERSIONING.md`, trimmed to one repo):

- **A version number** in a plain `VERSION` file holding just the number.
- **A `CHANGELOG.md`**, newest entry on top, one entry per version: a date and a few sentences on what
  changed and why. Not auto-generated, not bot-assigned — this project is too small for that machinery.

## When to bump

Bump the version, and add a `CHANGELOG.md` entry, in the same commit or PR that changes what the model
*does* — a changed constraint, a new model section, a different solve. A typo fix or a path correction
doesn't need a bump. Patch (`0.1.0` → `0.1.1`) by default; only bump minor or major when it's genuinely a
different capability, and that's a judgment call for whoever's making the change, not an automated rule.

## Who changed what

Don't duplicate that in the changelog — `git log` already gives the real author and date for anything here,
and a name copied into `CHANGELOG.md` would just drift out of sync with reality.

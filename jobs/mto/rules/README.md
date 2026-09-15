# MTO Rules

MTO uses **rules**, not specialist coding-style skills, for equipment business semantics.

## Layers

- `_common/*.md` — source authority, template handling, drawing reconciliation, live-schedule update, conflict/audit rules shared by supported equipment.
- `ac.md` — AC-specific field semantics and allowed derivations.
- `fan.md` — Fan-specific field semantics and allowed derivations.
- `equipment-registry.json` — deterministic mapping from equipment ID/alias to project input folder, template, live schedule, base rule, and audit file.

## Runtime precedence

1. explicit user instruction for the current run;
2. project overrides in `<project>/qto-rules/`;
3. base rules in this directory.

Project rules may refine business behavior but cannot authorize writes outside `01 WIP/SCHEDULE/eqm/**` or into `02 Output/**`.

## Adding another equipment type

Do not add only a registry entry. A new equipment type needs:

- a real project workflow/sample evidence;
- a dedicated equipment rule file;
- template/live-schedule mapping;
- extraction/field semantics precise enough to avoid invention;
- harness/tests updated to prove deterministic resolution.

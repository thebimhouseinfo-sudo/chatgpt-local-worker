# MTO Rules

MTO uses **rules**, not specialist coding-style skills, for equipment business semantics.

## Layers

- `_common/*.md` — source authority, template handling, drawing reconciliation, live-schedule update, conflict/audit, and takeoff-report rules shared by supported equipment.
- `ac.md` — operational AC-specific field semantics and allowed derivations.
- `fan.md` — operational Fan-specific field semantics and allowed derivations.
- `equipment-registry.json` — deterministic mapping for equipment that is actually runnable by the MTO Job Pack.
- `drafts/*.md` — candidate equipment rules reviewed against available templates/source notes but **not yet operational**.

A file existing under `drafts/` does not make that equipment selectable in MTO.

## Runtime precedence

For operational equipment:

1. explicit user instruction for the current run;
2. project overrides in `<project>/qto-rules/`;
3. base operational rules in this directory.

Project rules may refine business behavior but cannot authorize writes outside `01 WIP/SCHEDULE/eqm/**` or into `02 Output/**`.

## Draft rule policy

Draft rules are intentionally allowed to contain:

- `TBC` / unresolved field semantics;
- known template defects or contaminated sample rows;
- provisional defaults that require project evidence;
- validation/promote blockers.

They must say clearly that they are **DRAFT / NOT FINAL — requires real-project implementation and validation**.

Current draft candidates:

- `drafts/chw-pump.md`
- `drafts/chiller.md`
- `drafts/erv-hrv.md`
- `drafts/evaporative-cooler.md`
- `drafts/fume-cupboard.md`
- `drafts/vav.md`
- `drafts/attenuator.md`

Do not add any of these to `equipment-registry.json` until a real project run has validated the relevant selection/catalog/drawing semantics and live schedule/audit/report behavior.

## Result artifacts

For each processed operational equipment/revision, MTO maintains three distinct artifacts:

- live Excel schedule — current working EQM truth;
- `_audit/<equipment>.json` — machine-readable append history;
- `_reports/<input_rev>/<equipment>.md` — human-readable takeoff result with schedule snapshot, change summary, traceability, drawing reconciliation and RFI.

Do not collapse these roles into one artifact.

## Promoting another equipment type

Do not add only a registry entry. Promotion from draft to operational requires:

- a real project workflow/sample evidence;
- a dedicated refined equipment rule under `rules/<equipment>.md`;
- all unresolved/template-defect semantics needed for execution resolved or explicitly handled;
- template/live-schedule mapping;
- extraction/field semantics precise enough to avoid invention;
- real implementation evidence for update/audit/report behavior;
- harness/tests updated to prove deterministic resolution;
- `equipment-registry.json` updated only after those checks are satisfied.

# MTO Rules

MTO uses **rules**, not specialist coding-style skills, for equipment business semantics.

## Layers

- `_common/*.md` — shared operational source authority, template handling, drawing reconciliation, live-schedule update, conflict/audit, reporting, and source-model rules.
- `_common/drawing-export-driven.md` — **operational drawing-export source model** used in real project work. Individual schedule rules using it may still remain draft while their field semantics are refined.
- `ac.md` — operational AC-specific field semantics and allowed derivations.
- `fan.md` — operational Fan-specific field semantics and allowed derivations.
- `equipment-registry.json` — deterministic mapping for equipment that is actually selectable/runnable by the MTO Job Pack.
- `drafts/*.md` — candidate schedule/equipment business rules that are not yet registered as runnable rules.

A file existing under `drafts/` does not make that equipment/schedule selectable in MTO. This is separate from whether its underlying source model is already operational.

## Runtime precedence

For operational equipment/schedules:

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

They must say clearly that they are **DRAFT / NOT FINAL — requires real-project implementation and validation** when their schedule-specific semantics are not yet final.

Current draft candidates:

- `drafts/chw-pump.md`
- `drafts/chiller.md`
- `drafts/erv-hrv.md`
- `drafts/evaporative-cooler.md`
- `drafts/fume-cupboard.md`
- `drafts/vav.md`
- `drafts/attenuator.md`
- `drafts/grille.md`
- `drafts/door-grille.md`
- `drafts/flexible-connection.md`

The last three use the already-operational drawing-export source model; they remain draft only at the schedule/business-rule layer.

Do not add a draft rule to `equipment-registry.json` until its schedule-specific mapping and merge behavior are precise enough for deterministic execution.

## Result artifacts

MTO keeps distinct artifacts:

- live Excel schedule — current working truth;
- `_audit/<equipment-or-schedule>.json` — machine-readable append history;
- human-readable takeoff/change report — review surface with change summary, traceability, reconciliation and RFI/review items.

For selection-driven equipment, the report can be keyed by the selected `input_rev`. For drawing-export-driven schedules, do not invent a synthetic input revision; record the actual export path/hash and optional supplemental input revision separately.

Do not collapse these roles into one artifact.

## Promoting another equipment/schedule rule

Do not add only a registry entry. Promotion from draft to runnable requires:

- real project workflow/sample evidence;
- a dedicated refined rule under `rules/<equipment-or-schedule>.md`;
- unresolved semantics needed for execution resolved or explicitly handled;
- template/live-schedule mapping;
- extraction/field semantics precise enough to avoid invention;
- update/audit/report behavior defined;
- harness/tests updated for deterministic resolution;
- `equipment-registry.json` updated only after those checks are satisfied.

An already-operational source model, such as drawing export, does not by itself mean every schedule rule using that source model is final.
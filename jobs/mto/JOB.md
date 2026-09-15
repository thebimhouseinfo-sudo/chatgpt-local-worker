# MTO / Quantity Takeoff

## Goal

Operate on a local HVAC project folder and execute a user-requested equipment takeoff/update without forcing the user to remember internal paths, revision folders, schedule filenames, or audit locations.

The user defines the work intent and equipment scope. The MTO Job Pack resolves project structure, input revision, matching schedules, equipment rules, and allowed write locations from the known project convention.

## V1 scope

Operational equipment rules currently exist for:

- `ac` — AC equipment schedule
- `fan` — fan equipment schedule

Other equipment types are out of scope until explicit rules are added and validated. Do not infer rules for HRV, grille, pumps, AHU, or other equipment from AC/Fan behavior.

## Expected project structure

```text
<Project Root>/
├─ 00 Input/
│  └─ YYYY MM DD/
│     └─ <equipment>/
├─ 01 WIP/
│  ├─ DESIGN DRAWING/
│  ├─ REVIT/
│  └─ SCHEDULE/
│     ├─ *.xlsx
│     └─ eqm/
│        └─ _audit/
├─ 02 Output/
└─ qto-rules/                  # optional project overrides
```

The worker receives the project root, not separate input/output URLs.

## Authority model

For each requested equipment type:

1. **Schedule template** defines workbook schema/layout and is read-only.
2. **EQM selection** is the project selection authority for selected equipment, tag/ref, selected model, selected make when supplied, quantity/order/grouping, and project-specific values.
3. **Technical data/catalog** is supplementary only and fills missing fields for the exact selected model.
4. **Design drawing** is reconciliation evidence for counts, tag/name mapping, mounting/location/system context; it is not the main specification source.
5. **Rules** define permitted normalization/derivation and field semantics.
6. Unsupported or unresolved data remains explicit; never invent values.

A catalog value must not silently overwrite an explicit selection value. When the same field materially conflicts, preserve the selection value in the live schedule where applicable and record the conflict for review.

## Revision semantics

MTO is user-triggered, not a background watcher.

The user may specify:

- an explicit revision: `YYYY MM DD`; or
- `latest`.

For `latest`, resolve the latest valid revision **per requested equipment** by finding the newest valid date folder containing that equipment folder. Do not use filesystem modified time or naive alphabetical order.

A malformed date-like folder (for example `2026 13 01`) is an error, not something to guess around.

## Write boundary

The only intended write area is:

`01 WIP/SCHEDULE/eqm/**`

Read-only:

- `00 Input/**`
- `01 WIP/DESIGN DRAWING/**`
- schedule templates in `01 WIP/SCHEDULE/*.xlsx`
- project `qto-rules/**`

Out of MTO scope:

- `01 WIP/REVIT/**`

Forbidden:

- `02 Output/**`

The Job Pack's `write-guard.mjs` is a deterministic policy check. Deployment should also enforce the same boundary at the MCP/filesystem permission layer; the Job Pack must not treat a policy check as a substitute for hard ACLs.

## Live EQM semantics

For each requested equipment:

- if the live EQM schedule exists, update it in place;
- if it does not exist, bootstrap it from the matching read-only template and then populate it;
- do not create revision-numbered duplicate schedule files;
- `Last Updated` should reflect the processed input revision, not AI run time, when the template/rules provide that field;
- do not write to `02 Output`; release/freeze is a human action.

If a previously present equipment row disappears from the newly processed selection, do not auto-delete it. Preserve the live row and record it as review-required/disappeared in audit unless a project-specific rule explicitly defines a different policy.

## Project overrides

Base Job Pack rules live under `jobs/mto/rules/`.

A project may provide overrides under:

```text
<Project Root>/qto-rules/
├─ _common/
├─ ac.md
└─ fan.md
```

Precedence:

1. explicit current user instruction;
2. project-specific `qto-rules`;
3. MTO base equipment/common rules.

Project overrides may narrow or refine behavior but must not weaken the hard write boundary or authorize writes to `02 Output`.

## Audit

Each run appends a logical run record to:

`01 WIP/SCHEDULE/eqm/_audit/<equipment>.json`

The file representation is a JSON array of run objects so history remains valid JSON. Each run should record:

- `input_rev`
- `run_timestamp`
- per-tag changes with old/new/source evidence where available
- `tbc`
- `conflicts`
- `unmatched_drawing_vs_selection`
- disappeared/review-required rows where relevant

Audit exists for human review; do not bury unresolved issues inside workbook cells only.

## Completion criteria

An MTO task is complete only when:

1. requested equipment scope is explicit and supported;
2. requested/latest revision resolution is deterministic and valid;
3. applicable base + project rules were read before data mutation;
4. selection was read before supplementary catalog data;
5. only exact selected models were used for catalog supplementation;
6. drawing reconciliation was attempted when drawings are available/usable;
7. all writes stayed inside `01 WIP/SCHEDULE/eqm/**`;
8. live schedules were updated/bootstrapped without modifying templates;
9. audit records were updated and validate as JSON;
10. conflicts/TBC/unmatched/disappeared items are surfaced explicitly;
11. `02 Output/**` was not modified.

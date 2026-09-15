# MTO / Quantity Takeoff

## Goal

Operate on a local HVAC project folder and execute a user-requested takeoff/update without forcing the user to remember internal paths, dated input folders, schedule filenames, report locations, audit locations, or Lisp-export conventions.

The user defines the work intent and equipment/schedule scope. The MTO Job Pack resolves project structure, source model, applicable rule, source paths, matching schedule, report path, and allowed write locations from the known project convention.

## Runnable rule scope

MTO intentionally distinguishes **rule maturity** from **permission to run**.

- `stable` rules are runnable normally.
- `draft` rules are also runnable on real projects so their assumptions can be tested and improved.
- whenever a draft rule is used, GPT must explicitly warn that it is **DRAFT / NOT FINAL**, the result needs careful review, and findings from the run should be fed back into rule development.
- placeholder/disabled/missing rules are not runnable.

Stable rules currently include:

- `ac`
- `fan`

Runnable draft rules currently include:

- `chw-pump`
- `chiller`
- `erv-hrv`
- `evaporative-cooler`
- `fume-cupboard`
- `vav`
- `attenuator`
- `grille`
- `door-grille`
- `flexible-connection`

Do not silently invent missing policy in a draft rule merely to make the output look complete. Preserve/flag unresolved behavior and use real project evidence to refine the rule.

## Expected project structure

```text
<Project Root>/
├─ 00 Input/
│  └─ YYYY MM DD/
│     └─ <equipment>/
├─ 01 WIP/
│  ├─ DESIGN DRAWING/
│  ├─ REVIT/
│  ├─ grille.csv                 # target canonical Lisp names after naming fix
│  ├─ door grille.csv
│  ├─ flex conn.csv
│  └─ SCHEDULE/
│     ├─ *.xlsx                  # read-only templates
│     └─ eqm/
│        ├─ _audit/
│        └─ _reports/
├─ 02 Output/
└─ qto-rules/                    # optional project overrides
```

The current Lisp may still emit a project-name filename instead of the canonical drawing-export names. That does not make drawing export unusable; the user may explicitly identify/provide the current WIP export until the Lisp naming fix is deployed.

## Source models

### Selection-driven

Used by AC, Fan, and selection-driven draft equipment.

Authority order:

1. **Schedule template** = schema/layout authority and read-only.
2. **EQM selection** = project selection authority for selected equipment, tag/ref, selected model/make when supplied, quantity/order/grouping, and project-specific values.
3. **Exact-model technical data/catalog** = supplement only for missing fields.
4. **Design drawing** = reconciliation evidence for counts, tags, naming, mounting/location/system context.
5. **Rules** = permitted normalization/derivation and field semantics.
6. unsupported/unresolved values remain explicit; never invent.

Catalog data must not silently overwrite an explicit selection value. Material conflicts are reported.

### Drawing-export-driven

Used by Grille, Door Grille, and Flexible Connection.

Authority order:

1. **Schedule template** = schema/layout authority and read-only.
2. **Current WIP Lisp export** = primary drawing snapshot for fields actually exported.
3. **Live schedule** = working truth/manual-enrichment surface; valid manual fields must not be blindly destroyed.
4. **Optional 00 Input technical/project data** = supplement when exact useful evidence exists.
5. **Design drawing** = upstream/fallback reconciliation evidence.
6. **Rules/user instruction** = approved normalization/defaults/derivations.

Normal update flow:

`current export -> compare to live schedule -> change report -> controlled merge -> validation`

The drawing-export workflow is already operational. The three schedule rules remain draft only because some field-level semantics/defaults/update behavior need more project evidence.

## Revision/source semantics

MTO is user-triggered, not a background watcher.

For selection-driven work:

- user may specify explicit `YYYY MM DD` or `latest`;
- if omitted, resolver may use `latest`;
- `latest` is resolved independently per requested equipment from valid date folders containing an accepted equipment input folder;
- do not use filesystem mtime or naive lexical guessing;
- malformed date-like folders are errors.

For drawing-export work:

- primary export does not require an input revision;
- after the naming fix, resolve canonical schedule-specific export by stem;
- before that fix, a current legacy WIP export may be explicitly identified/provided;
- never guess a drawing export from "latest modified file";
- optional dated input may be used only as supplemental technical/project data.

## Write boundary

The only intended write area is:

`01 WIP/SCHEDULE/eqm/**`

Read-only:

- `00 Input/**`
- Lisp exports under `01 WIP/**`
- `01 WIP/DESIGN DRAWING/**`
- schedule templates in `01 WIP/SCHEDULE/*.xlsx`
- project `qto-rules/**`

Out of MTO scope:

- `01 WIP/REVIT/**`

Forbidden:

- `02 Output/**`

The Job Pack's write guard is a deterministic policy check. Deployment should additionally enforce the same boundary with hard filesystem/MCP ACLs.

## Live schedule semantics

For every requested equipment/schedule:

- if live schedule exists, reconcile/update it in place;
- if it does not exist, bootstrap from the matching read-only template and remove sample rows only;
- do not create revision-numbered duplicate live schedules;
- do not blindly clear an existing schedule;
- preserve manual/enriched fields when the active source model does not own them;
- `02 Output` release/freeze remains a human action.

For selection-driven schedules, `Last Updated` should reflect processed input revision when that field exists.

For drawing-export schedules, do not invent an input revision. Audit/report should identify actual export source path/hash instead.

If an item disappears from the current source, follow the specific rule. When the draft rule has not yet finalized disappeared-row behavior, preserve/flag rather than invent automatic deletion.

## Project overrides

Base Job Pack rules live under `jobs/mto/rules/` and may be stable or draft.

A project may provide overrides under:

```text
<Project Root>/qto-rules/
├─ _common/
├─ ac.md
├─ fan.md
├─ grille.md
└─ ...
```

Precedence:

1. explicit current user instruction;
2. project-specific `qto-rules`;
3. resolved MTO base/common rule.

Project overrides may refine business behavior but must not weaken the write boundary or authorize `02 Output` writes.

## Audit

Each run appends a logical run record under:

`01 WIP/SCHEDULE/eqm/_audit/<equipment-or-schedule>.json`

Use a JSON array of run objects so history remains valid JSON.

Selection-driven run identity includes `input_rev`.

Drawing-export run identity includes `drawing_export_source` and may include optional `supplement_input_rev`.

Audit should record where relevant:

- `rule_status`
- `source_model`
- `run_timestamp`
- source identity/revision
- per-row/tag/system changes with old/new/source evidence
- `tbc`
- `conflicts`
- unmatched/reconciliation items
- disappeared/review-required rows
- preserved manual/enriched values when material.

## Human-readable report

Every completed scope also produces a Markdown takeoff/change report inside the EQM write tree.

Selection-driven reports are normally revision-scoped:

`01 WIP/SCHEDULE/eqm/_reports/<input_rev>/<equipment>.md`

Drawing-export reports are source-model-scoped:

`01 WIP/SCHEDULE/eqm/_reports/drawing-export/<schedule>.md`

Do not invent a synthetic dated revision for a Lisp export.

Required content:

- run/source summary;
- rule status and source model;
- visible draft warning when status is `draft`;
- readable schedule snapshot where practical;
- change summary against prior live schedule;
- traceability/source evidence;
- drawing reconciliation;
- conflicts/TBC/unmatched/review-required items;
- Query List / RFI only for issues requiring human/PM/design confirmation.

## Completion criteria

An MTO task is complete only when:

1. requested scope is explicit and has a stable or draft runnable rule;
2. draft warning was shown when applicable;
3. source model and source paths were deterministically resolved or explicitly identified by the user;
4. applicable base + project rules were read before mutation;
5. source authority was respected;
6. no missing draft policy was silently invented;
7. only exact selected models were used for catalog supplementation where applicable;
8. manual/live fields outside source ownership were preserved where required;
9. all writes stayed inside `01 WIP/SCHEDULE/eqm/**`;
10. templates/source exports/input/drawings remained unchanged;
11. audit validates;
12. human-readable report validates and exposes unresolved review items;
13. `02 Output/**` was untouched.

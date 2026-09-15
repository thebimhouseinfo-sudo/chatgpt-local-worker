# MTO — Operating SOP

This Job Pack executes user-scoped HVAC takeoff/update work on a local project folder. It is not a background watcher and must not autonomously decide which equipment/schedule categories to process.

## 1. Resolve the execution request

Read `workspace`, `task`, `equipment`, optional `input_revision`, optional `source_file`, and optional `delivery` from `job_status`.

The user defines scope. Do not add equipment/schedules merely because folders or templates exist.

Resolve requested aliases through `rules/equipment-registry.json`.

Registry rule status semantics:

- `stable` — runnable normally;
- `draft` — **runnable for real-project development**, but before processing GPT must explicitly tell the user that the rule is `DRAFT / NOT FINAL`, the result needs careful review, and implementation feedback should be used to refine the rule;
- a missing/disabled/placeholder rule is not runnable.

Do **not** treat `draft` as unsupported. Real project use is how draft rules are validated and improved.

## 2. Resolve source model and project paths

Run:

`node harness/resolve-project.mjs --project <workspace> --equipment <equipment> [--revision <input_revision>] [--source-file <current-wip-export>]`

Use returned paths instead of asking the user to remember internal folder names.

The resolver returns `rule_status`, `required_warning`, `source_model`, source paths, template/live schedule paths, audit/report paths, and applicable rules.

If any resolved rule is `draft`, show its `required_warning` to the user before continuing. This warning is mandatory, not optional prose.

### Selection-driven source model

Used by AC, Fan, and selection-driven draft equipment.

- `input_revision` may be explicit `YYYY MM DD` or `latest`;
- if omitted, treat it as `latest`;
- `latest` is resolved independently per requested equipment from valid dated folders that contain an accepted equipment input folder;
- do not use folder mtime and do not guess malformed dates.

### Drawing-export-driven source model

Used by drawing-derived schedules such as Grille, Door Grille, and Flexible Connection.

- primary source is the current Lisp export in `01 WIP`;
- no synthetic `input_revision` is required;
- after the Lisp naming fix, canonical stems are `grille`, `door grille`, and `flex conn`;
- while legacy project-name export filenames are still used, one drawing-export schedule may be run with an explicitly identified WIP file via `source_file` / `--source-file`;
- never select a drawing export by "latest modified file" guessing;
- optional `input_revision` may be supplied only to consider supplemental `00 Input` technical/project data.

## 3. Load rules before reading project data

For every requested item, read rules in this order:

1. base common rules under `rules/_common/`;
2. resolved base rule from the registry — this may be a stable rule or a file under `rules/drafts/`;
3. optional project common overrides under `<workspace>/qto-rules/_common/`;
4. optional project-specific override returned by the resolver;
5. explicit current user instruction has final authority unless it violates hard write boundaries.

Rules describe engineering/business semantics. Harnesses only validate deterministic mechanics.

For a draft rule, preserve unresolved/TBC behavior exactly as written. Do not silently "finish" the rule by inventing missing engineering policy.

## 4. Read the schedule schema first

Open the matching schedule template in `01 WIP/SCHEDULE/` as read-only.

The template defines:

- target columns/order;
- units;
- sheet/layout structure;
- formatting, merges and borders.

Do not add columns/sheets or alter the source template during normal MTO execution.

If no live schedule exists, bootstrap from the read-only template into `01 WIP/SCHEDULE/eqm/`, removing sample data rows only. Never overwrite the original template.

## 5. Process selection-driven schedules

Inside the resolved `00 Input/<revision>/<equipment>/` folder, distinguish documents by role:

- **EQM selection** — project-specific selected equipment/model/value backbone;
- **technical data/catalog** — supplementary manufacturer information.

Read selection first. Build the project-selected row set and preserve project values.

For fields missing from selection:

1. search exact selected-model technical data;
2. use only values applicable to that exact model;
3. prefer rated/nominal duty values unless the rule says otherwise;
4. never copy neighboring model values;
5. never silently replace an explicit selection value with generic catalog data.

Selection/catalog conflict → preserve the project-selected value where applicable and record the conflict in audit/report.

Unsupported data uses `-`, `TBC`, or another marker only when the rule/template defines it. Never invent numbers.

## 6. Process drawing-export-driven schedules

Use `rules/_common/drawing-export-driven.md`.

The current Lisp export is a drawing snapshot, not a replacement for the live schedule.

Normal sequence:

`current export -> compare to live schedule -> change report -> controlled merge -> validation`

The live schedule may contain valid manual edits and enriched fields. Preserve fields not owned by the export.

Small changes that the user edits directly in the live Excel without generating a new Lisp export are normal and require no MTO run.

Optional technical data under `00 Input` may supplement missing fields when exact matching is supported. Many projects legitimately have no useful grille/door-grille/flexible-connection vendor data at design stage; that absence is not a failure.

## 7. Reconcile against DESIGN DRAWING when needed

Use `01 WIP/DESIGN DRAWING/**` for reconciliation/fallback evidence, not as a reason to re-extract the whole drawing when a valid Lisp export exists.

For selection-driven equipment, check where practical:

- drawing count vs selected rows;
- drawing tag/naming vs selection;
- mounting/location/system context required by the rule.

For drawing-export-driven schedules, direct drawing inspection is only needed for unresolved export/reconciliation cases or explicit user request.

Do not infer tag mappings purely from similar numbering.

## 8. Compute the live-schedule delta

Never blindly clear an existing live schedule.

Possible actions include:

- existing row + authoritative changed value → update;
- new source row/item → add;
- same supported values → unchanged;
- source item disappears → follow that rule's disappeared-row policy; if unresolved, preserve/flag rather than invent deletion behavior;
- live/manual value outside source ownership → preserve;
- conflict/uncertain overwrite authority → preserve and flag for review unless the rule explicitly permits replacement.

For selection-driven schedules, use input revision as `Last Updated` when the template supports it.

For drawing-export schedules, do not invent an input revision. Record the actual source export path/hash in audit/report.

## 9. Guard every write

Before writing any project file, run:

`node harness/write-guard.mjs --project <workspace> --path <target-path>`

Only paths under `01 WIP/SCHEDULE/eqm/**` may pass.

Never write to:

- `00 Input/**`
- `01 WIP/DESIGN DRAWING/**`
- source schedule templates
- `01 WIP/REVIT/**`
- `02 Output/**`

The deployment should additionally enforce the same boundary with filesystem ACLs.

## 10. Update audit history

For every processed scope, update the resolver-provided audit file under:

`01 WIP/SCHEDULE/eqm/_audit/`

Use a JSON array of run objects and preserve previous entries.

Record enough evidence for review:

- rule status (`stable` or `draft`);
- source model;
- input revision for selection-driven runs, when applicable;
- drawing export path/hash for drawing-export runs;
- rows/items added, updated, unchanged and review-required;
- field-level old/new values for material changes;
- source file/page/sheet/cell where actually observed;
- conflicts/TBC/unmatched items;
- preserved manual values when relevant.

Run `audit-lint.mjs` before completion.

## 11. Write the human-readable takeoff/change report

Use the resolver-provided report path, `templates/TAKEOFF_REPORT.md`, and `rules/_common/reporting.md`.

The report must include:

1. run summary;
2. resulting schedule snapshot/table where practical;
3. change summary;
4. traceability/data sources;
5. drawing reconciliation where relevant;
6. conflicts, TBC, unmatched and review-required items;
7. Query List / RFI where actual human confirmation is needed.

For a **draft rule**, the report must visibly state near the top:

`DRAFT / NOT FINAL — result requires careful project review; findings from this run should be fed back into the rule.`

Do not invent source locations. If no RFI remains, write `None` explicitly.

Selection-driven report path is normally revision-scoped. Drawing-export report path is source-model-scoped and must not fake a dated input revision.

Run `report-lint.mjs` before completion.

## 12. Validate and report

Before completion verify:

- exact requested scope processed and nothing else;
- any draft-rule warning was shown;
- template remained unchanged;
- only live schedule/audit/report files under the allowed EQM tree were written;
- source authority and exact-model rules were respected;
- manual fields outside source ownership were preserved where required;
- workbook schema remains consistent with template;
- audit/report validation passes;
- `02 Output/**` is untouched.

Return a compact summary per scope including:

- rule status (`stable` / `draft`);
- source model;
- resolved revision or drawing export source;
- live schedule path and bootstrap/update state;
- report path;
- added/updated/unchanged/review-required counts;
- conflicts/TBC/unmatched items.

If the rule is draft, repeat the review warning in the completion summary.
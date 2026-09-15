# Drawing-Export-Driven Schedule Source Model

> **DRAFT / NOT FINAL — requires real-project implementation and validation.**
>
> This source model is not operational by itself and must not be added to `equipment-registry.json` merely because a draft rule references it.

## Purpose

Some MTO schedules are completed primarily from finished design drawings rather than from PM/vendor equipment selections. For these schedules, a project Lisp exports block attributes from the drawing into a CSV/Excel file under `01 WIP`. That export is the primary drawing snapshot used by MTO.

Current candidate users:

- Grille Schedule
- Door Grille Schedule
- Flexible Connection Schedule

## Target export naming convention

The current Lisp has a legacy bug: it exports using the project name (for example `BLOCK N.csv` or `YAC.csv`) rather than the schedule type. This legacy naming is **not** the intended MTO contract.

The user will revise the Lisp so the current export is named by schedule type. Target canonical export names in the `01 WIP` root are:

- `grille.csv`
- `door grille.csv`
- `flex conn.csv`

If the final Lisp uses another extension, resolver configuration may change the extension while preserving these canonical schedule-type stems.

MTO must not infer schedule type from a project-name export such as `BLOCK N` or `YAC`. Legacy project-name exports are implementation evidence only, not the future resolver convention.

## Single-current-export contract

The Lisp export is **not a revision history store**.

The user controls this source manually:

1. when a sufficiently large drawing change needs MTO reconciliation, the old export is deleted;
2. the user runs the Lisp again;
3. one new/current schedule-specific export is placed in `01 WIP`;
4. MTO is invoked to reconcile/update the corresponding schedule.

Small changes may be edited directly by the user in the live schedule without producing a new Lisp export or MTO run. That is normal workflow.

Therefore MTO must not implement a `latest export` resolver based on modified time, lexical ordering, or filename date parsing.

For a drawing-export-driven run:

- resolve the canonical schedule-specific export path;
- if the expected current export is absent -> stop and report `MISSING_DRAWING_EXPORT`;
- do not fall back to unrelated project-name CSV files by guessing;
- do not choose a different file merely because it is newer;
- the current export filename does not need a revision/date suffix.

## Source authority

1. **Schedule Template = Schema Authority**
   - controls workbook structure, headers, subheaders, units, formatting, merges, and output location;
   - sample rows are examples only and are not project truth;
   - never overwrite the read-only template.
2. **Current WIP Lisp Export = Primary Project/Drawing Snapshot**
   - contains drawing-derived block attributes such as tag, system, airflow, sizes, type, comments, and other attributes exposed by the Lisp;
   - acts like `eqm selection` for fields the export actually owns;
   - represents the current drawing snapshot chosen by the user through delete-and-re-export workflow.
3. **Live Schedule = Working Truth / Manual-Enrichment Surface**
   - may contain valid manual edits between MTO runs;
   - may contain technical-data enrichment or prior project decisions absent from the Lisp export;
   - must not be blindly replaced by the new export.
4. **00 Input Technical Data = Optional Supplement Authority**
   - may fill missing manufacturer/product/project fields when exact matching is sufficiently supported;
   - absence of useful technical data is normal for these schedule types and is not a run failure.
5. **Design Drawing = Upstream/Reconciliation Evidence**
   - direct drawing inspection is fallback/reconciliation evidence, not the normal extraction path when a valid export exists.
6. **Project Rules / Explicit User Instruction**
   - may define normalization, defaults, naming conventions, and approved derivations;
   - cannot override template schema or authorize unsupported invention.

## Field ownership and manual edits

The export owns only fields it actually contains or fields deterministically derived under an approved rule.

When reconciling a new export against the live schedule:

- export-owned fields: compare current live value vs new export value and report material changes;
- live-only/manual/enriched fields absent from the export: preserve them;
- where live and export disagree, surface the discrepancy in the change report instead of silently destroying a manual edit;
- a new export is a reconciliation source, not permission to rebuild the whole live schedule.

Normal run sequence:

`current export -> compare to live schedule -> change report -> controlled merge -> validation`

Never use clear-and-rebuild for an existing drawing-export-driven live schedule.

## Missing-data behavior

- Missing supplementary technical data is normal.
- For a new row, unsupported values use `-` unless an approved project/company default applies.
- Do not replace an existing valid manual/enriched value with `-` merely because the export lacks that field.

## Change report

For a re-export run, the human-readable report should separate at minimum:

- added rows/connections;
- rows/connections missing from the new export;
- changed export-owned fields with old -> new values;
- repeated-record/count changes where relevant;
- unchanged rows/counts;
- live-only/manual/enriched values preserved;
- conflicts/review items;
- optional technical-data enrichment in the same run.

The report exists so the user can review changes in long schedules without manually comparing every row.

## Run identity and audit

A dated `00 Input/<rev>/...` revision is not required for the primary drawing export.

Record at minimum:

- actual canonical current export path/filename;
- run timestamp;
- schedule type;
- added/updated/unchanged/review-required rows;
- preserved manual/enriched fields when relevant;
- optional supplementary `00 Input` revision(s), if used;
- conflicts/review details.

Recording a content hash of the current export is preferred once deterministic tooling is implemented. Do not invent a synthetic `input_rev` for the primary Lisp export.

## Promotion blockers

Before this source model becomes operational, validate:

1. final Lisp filenames/extensions for `grille`, `door grille`, and `flex conn`;
2. deterministic canonical-path resolver in `01 WIP`;
3. stable row identity/cardinality rules for each schedule;
4. exact exported block-attribute names and mapping to schedule fields;
5. disappeared-row semantics for each schedule;
6. field-ownership/manual-edit merge behavior;
7. audit/report source path/hash behavior;
8. deterministic resolver and harness tests for source discovery and write boundaries.

# Drawing-Export-Driven Schedule Source Model

> **OPERATIONAL SOURCE MODEL.**
>
> This workflow is already used in real project work. Individual schedule rules may still remain draft while their field-level business rules are refined.

## Purpose

Some MTO schedules are driven primarily from finished design drawings rather than PM/vendor equipment selection. A project Lisp exports block attributes from the drawing into a CSV/Excel file under `01 WIP`; that export is the primary drawing snapshot used by MTO.

Current users of this source model:

- Grille Schedule
- Door Grille Schedule
- Flexible Connection Schedule

## Current and target export naming

The current Lisp is usable but has a naming bug: it may export using the project name (for example `BLOCK N.csv` or `YAC.csv`) instead of the schedule type.

This naming defect does **not** make the drawing-export workflow non-operational.

Current supported use:

- when the export still has the legacy project-name filename, the user explicitly identifies/provides the current file for the requested schedule;
- MTO uses that file as the current drawing snapshot and does not guess another file by timestamp.

Target naming after the Lisp fix:

- `grille.csv`
- `door grille.csv`
- `flex conn.csv`

The extension may change, but the schedule-specific stem should remain deterministic. Once the naming fix is deployed, the resolver may auto-resolve the canonical schedule-specific file.

## Single-current-export contract

The Lisp export is **not a revision history store**.

The user controls this source manually:

1. when a sufficiently large drawing change needs MTO reconciliation, the old export is deleted;
2. the user runs the Lisp again;
3. one new/current export is placed in WIP;
4. MTO is invoked to reconcile/update the corresponding schedule.

Small changes may be edited directly in the live schedule without producing a new Lisp export or MTO run. That is normal workflow.

MTO must not implement a `latest export` resolver based on modified time, lexical ordering, or filename date parsing.

## Source authority

1. **Schedule Template = Schema Authority**
   - controls workbook structure, headers, subheaders, units, formatting, merges, and output location;
   - sample rows are examples only and are not project truth;
   - never overwrite the read-only template.
2. **Current WIP Lisp Export = Primary Project/Drawing Snapshot**
   - contains drawing-derived block attributes exposed by the Lisp;
   - acts like `eqm selection` for fields the export actually owns;
   - represents the current drawing snapshot selected by the user through the delete-and-re-export workflow.
3. **Live Schedule = Working Truth / Manual-Enrichment Surface**
   - may contain valid manual edits between MTO runs;
   - may contain technical-data enrichment or prior project decisions absent from the Lisp export;
   - must not be blindly replaced by the new export.
4. **00 Input Technical Data = Optional Supplement Authority**
   - may fill missing manufacturer/product/project fields when exact matching is sufficiently supported;
   - absence of useful technical data is normal for these schedules and is not a run failure.
5. **Design Drawing = Upstream/Reconciliation Evidence**
   - direct drawing inspection is fallback/reconciliation evidence, not the normal extraction path when a valid export exists.
6. **Project Rules / Explicit User Instruction**
   - may define normalization, defaults, naming conventions, and approved derivations;
   - cannot override template schema or authorize unsupported invention.

## Field ownership and manual edits

The export owns only fields it actually contains or fields deterministically derived under an approved rule.

When reconciling a new export against the live schedule:

- export-owned fields: compare current live value against the new export and report material changes;
- live-only/manual/enriched fields absent from the export: preserve them;
- where live and export disagree, surface the discrepancy in the change report instead of silently destroying a manual edit;
- a new export is a reconciliation source, not permission to rebuild the whole live schedule.

Normal run sequence:

`current export -> compare to live schedule -> change report -> controlled merge -> validation`

Never clear-and-rebuild an existing drawing-export-driven live schedule.

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

## Run identity and audit

A dated `00 Input/<rev>/...` revision is not required for the primary drawing export.

Record at minimum:

- actual current export path/filename;
- run timestamp;
- schedule type;
- added/updated/unchanged/review-required rows;
- preserved manual/enriched fields when relevant;
- optional supplementary `00 Input` revision(s), if used;
- conflicts/review details.

Recording a content hash of the current export is preferred when deterministic tooling is available. Do not invent a synthetic `input_rev` for the primary Lisp export.

## Automation improvements still pending

The source model is operational even though some automation conveniences are still pending:

1. deploy the Lisp naming fix for `grille`, `door grille`, and `flex conn`;
2. add deterministic canonical-path auto-resolution after that naming fix;
3. add/extend harness fixtures for the schedule-specific exports;
4. refine individual schedule rules from further project evidence.

These are implementation improvements, not blockers to using the drawing-export workflow itself.
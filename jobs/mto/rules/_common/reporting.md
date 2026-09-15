# Common Rule — Takeoff Report

Every completed equipment takeoff/update produces a human-readable Markdown report in addition to the live Excel schedule and machine-readable audit history.

## Purpose

The report is the reviewer-facing result artifact. It should let a human understand the completed takeoff without reopening every source document.

The report is not a replacement for the live schedule or audit JSON:

- live schedule = current working EQM truth;
- audit JSON = append-only machine-readable run/change history;
- takeoff report = human-readable result, traceability, reconciliation and RFI for one equipment revision.

## Report path

Use:

`01 WIP/SCHEDULE/eqm/_reports/<input_rev>/<equipment>.md`

Examples:

- `01 WIP/SCHEDULE/eqm/_reports/2026 08 11/ac.md`
- `01 WIP/SCHEDULE/eqm/_reports/2026 08 15/fan.md`

The report remains inside the allowed EQM write tree.

One equipment + input revision has one canonical report file. If the same revision is rerun to correct extraction/review findings, update that report in place to reflect the final state. The audit JSON still appends each execution run, so run history is not lost.

## Required report sections

Use `templates/TAKEOFF_REPORT.md` as the structural contract.

### 1. Run Summary

Record:

- project/workspace;
- equipment;
- processed input revision;
- live schedule path;
- run timestamp;
- schedule mode (`bootstrap` or `update`);
- base/project rules applied where relevant.

### 2. Equipment Schedule

Include a readable Markdown snapshot of the resulting equipment schedule for the processed equipment scope.

Preserve the schedule's meaningful field names and units. Do not invent report-only engineering values.

This section exists so a reviewer can inspect the takeoff result directly, similar to the previous NotebookLM result format, while the Excel file remains the authoritative working schedule.

### 3. Change Summary

For update runs, summarize the delta against the previous live EQM:

- rows added;
- rows updated;
- rows unchanged;
- rows preserved but review-required/disappeared;
- important field-level changes.

For bootstrap/first takeoff, state that the schedule was created from the template and summarize rows added.

### 4. Traceability & Data Source

Provide tag-level provenance. For each material row/tag, identify the source evidence used, including when available:

- EQM selection filename + page/sheet/cell;
- technical data/catalog filename + page/sheet;
- design drawing reference used for reconciliation;
- project rule/override used for a derived/normalized value.

Do not claim a page/sheet/cell that was not actually observed.

### 5. Drawing Reconciliation

State:

- drawing count vs selection count where checked;
- explicit tag mappings used;
- unmatched tags;
- count mismatch or naming mismatch requiring review.

If drawings were unavailable/unusable, say so explicitly instead of pretending reconciliation was completed.

### 6. Conflicts / TBC / Review Items

List material unresolved items:

- selection-vs-catalog conflicts;
- detailed-source conflicts;
- TBC/unsupported fields;
- disappeared rows;
- manual-looking values preserved because overwrite authority was unclear;
- other review-required conditions.

Keep the selection value visible when selection is authoritative and catalog conflicts.

### 7. Query List (RFI)

Convert unresolved issues that require a human/PM/design decision into concise numbered questions.

Examples:

- confirm whether a source value is intended for the selected duty point;
- confirm whether a disappeared equipment row should be removed;
- confirm an unmapped drawing tag;
- confirm an electrical/start-current interpretation not supported by the source hierarchy.

If there is no RFI, write `None` explicitly.

## Report rules

- Report facts must be supported by the same evidence used for schedule/audit.
- Do not expose internal chain-of-thought; report evidence and conclusions only.
- Do not hide material conflicts just because the live schedule has a preferred value.
- Do not treat the report as an issued deliverable under `02 Output/**`.
- The report is WIP review material and stays under `01 WIP/SCHEDULE/eqm/_reports/**`.

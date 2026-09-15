# Common Rule — Takeoff / Change Report

Every completed MTO run produces a human-readable Markdown report in addition to the live Excel schedule and machine-readable audit history.

## Purpose

The report is the reviewer-facing artifact. It should let a human understand the result, what changed, what sources were used, and what still needs checking without reopening every source document.

The report is not a replacement for the live schedule or audit JSON:

- live schedule = current working truth;
- audit JSON = append-only machine-readable run/change history;
- takeoff/change report = human-readable result, traceability, reconciliation and RFI/review surface.

## Rule status in the report

The report must state the resolved rule status.

For `stable` rules, normal review applies.

For `draft` rules, the report must visibly state near the top:

> **DRAFT / NOT FINAL — result requires careful project review; findings from this run should be fed back into the rule.**

This warning is mandatory because draft rules are intentionally runnable in order to gather real implementation evidence.

## Report path

### Selection-driven

Use:

`01 WIP/SCHEDULE/eqm/_reports/<input_rev>/<equipment>.md`

Examples:

- `01 WIP/SCHEDULE/eqm/_reports/2026 08 11/ac.md`
- `01 WIP/SCHEDULE/eqm/_reports/2026 08 20/erv-hrv.md`

One equipment + input revision has one canonical report. A rerun of the same revision updates that report to the current reviewed result; audit JSON still preserves run history.

### Drawing-export-driven

Use the resolver-provided source-model-scoped path, currently:

`01 WIP/SCHEDULE/eqm/_reports/drawing-export/<schedule>.md`

Do not invent a dated `input_rev` for the Lisp export.

The report must identify the actual drawing export source path/filename and, when available, content hash. Optional supplemental `00 Input` revision may be recorded separately.

## Required report sections

Use `templates/TAKEOFF_REPORT.md` as the structural contract.

### 1. Run Summary

Record:

- project/workspace;
- equipment/schedule;
- rule status (`stable` / `draft`);
- source model (`selection` / `drawing-export`);
- input revision when selection-driven;
- drawing export source when drawing-export-driven;
- live schedule path;
- run timestamp;
- schedule mode (`bootstrap` / `update`);
- base/project rules applied.

For a field not applicable to the current source model, write `None` or `Not applicable`; do not fabricate a value.

### 2. Equipment Schedule

Include a readable Markdown snapshot of the resulting schedule where practical.

Preserve meaningful field names and units. Do not invent report-only engineering values.

For very long schedules, a compact but reviewable representation is acceptable if the full live Excel remains authoritative and the change summary/traceability is complete.

### 3. Change Summary

For update runs summarize:

- rows/items added;
- rows/items updated;
- unchanged rows/count;
- rows/items missing from the new source or otherwise review-required;
- material field-level changes;
- manual/enriched values intentionally preserved when relevant.

For bootstrap runs state that the live schedule was created from the read-only template and summarize rows added.

### 4. Traceability & Data Source

Provide row/tag/system-level provenance appropriate to the source model.

Selection-driven evidence may include:

- EQM selection filename + page/sheet/cell;
- exact-model technical data filename + page/sheet;
- design drawing reference;
- project rule/override.

Drawing-export evidence may include:

- current Lisp export path/filename;
- export row/key/system/tag;
- optional export content hash;
- supplemental technical/project input used for enrichment;
- project rule/override.

Do not claim page/sheet/cell locations that were not actually observed.

### 5. Drawing Reconciliation

Selection-driven schedules should state drawing count/tag reconciliation where checked.

Drawing-export-driven schedules should state whether the export was accepted as the current drawing snapshot and identify any unresolved drawing/export discrepancy. Do not pretend the full drawing was independently re-counted when it was not.

### 6. Conflicts / TBC / Review Items

List material unresolved items, including:

- selection-vs-catalog conflicts;
- detailed-source conflicts;
- TBC/provisional draft semantics;
- disappeared/missing rows;
- manual values preserved because overwrite authority was unclear;
- drawing-export mapping uncertainty;
- any draft-rule assumption encountered in real implementation.

For a draft rule, this section is also where observations useful for refining the rule should be recorded.

### 7. Query List (RFI)

Convert only issues that truly require human/PM/design confirmation into concise questions.

Do not create an RFI merely because optional vendor information is unavailable when the rule permits `-`.

If there is no RFI, write `None` explicitly.

## Report rules

- Facts must be supported by the same evidence used for schedule/audit.
- Do not expose internal chain-of-thought; report evidence and conclusions only.
- Do not hide material conflicts just because one source has precedence.
- Draft rules must not have unresolved policy silently invented to make a clean-looking report.
- The report is WIP review material and remains under `01 WIP/SCHEDULE/eqm/_reports/**`.
- Never write it into issued `02 Output/**`.
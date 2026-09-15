# MTO Rules

MTO uses **rules**, not specialist coding-style skills, for equipment/schedule business semantics.

## Layers

- `_common/*.md` — shared operational source authority, template handling, drawing reconciliation, live-schedule update, conflict/audit, reporting, and source-model rules.
- `_common/drawing-export-driven.md` — **operational drawing-export source model** already used in real project work.
- `ac.md` — stable AC-specific rule.
- `fan.md` — stable Fan-specific rule.
- `drafts/*.md` — **runnable draft rules** used for real-project development and validation.
- `equipment-registry.json` — deterministic mapping for all runnable stable + draft rules, with explicit `status` and `source_model`.

## Rule status

Registry status is intentionally separate from run permission:

- `stable` — runnable without draft warning;
- `draft` — runnable, but GPT must explicitly warn that the rule is not final and the result needs careful review;
- missing/disabled/placeholder — not runnable.

A draft rule is not a fake or blocked rule. It is a development-stage professional rule intended to be exercised on real projects so its assumptions can be tested and refined.

## Runtime precedence

For every runnable equipment/schedule:

1. explicit user instruction for the current run;
2. project overrides in `<project>/qto-rules/`;
3. resolved base rule from the registry (stable or draft).

Project rules may refine business behavior but cannot authorize writes outside `01 WIP/SCHEDULE/eqm/**` or into `02 Output/**`.

## Draft rule policy

Draft rules may contain:

- `TBC` / unresolved field semantics;
- known template defects or contaminated sample rows;
- provisional defaults requiring project evidence;
- validation/promotion blockers.

When a draft rule is selected, GPT must show a warning equivalent to:

> **DRAFT / NOT FINAL — this rule is usable, but the result must be checked carefully. Findings from this project should be fed back into the rule.**

The report and completion summary must retain that status.

Current draft rules:

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

All are registered with `status: draft` and are selectable/runnable. They remain draft because their field-level semantics/defaults/merge behavior still need more implementation evidence, not because GPT is forbidden to use them.

## Source models

### Selection-driven

Primary source is project EQM selection under dated `00 Input`; exact-model technical data supplements missing fields. Revision may be explicit or `latest`.

### Drawing-export-driven

Primary source is the current Lisp block-attribute export in `01 WIP`. No synthetic input revision is required. Live schedule is working truth and may contain valid manual edits/enrichment. Normal flow is:

`current export -> compare -> change report -> controlled merge`

The drawing-export source model is already operational even while Grille / Door Grille / Flexible Connection business rules remain draft.

## Result artifacts

MTO keeps distinct artifacts:

- live Excel schedule — current working truth;
- `_audit/<equipment-or-schedule>.json` — machine-readable append history;
- human-readable takeoff/change report — reviewer-facing change summary, traceability, reconciliation and RFI/review items.

For selection-driven equipment, reports are normally keyed by resolved input revision. For drawing-export-driven schedules, do not invent a dated input revision; record actual export path/hash and optional supplemental input revision separately.

For draft rules, reports must visibly identify the rule as `DRAFT / NOT FINAL`.

## Promoting draft to stable

Promotion does **not** make the rule runnable for the first time. It removes the mandatory draft warning after sufficient evidence exists.

Promote when:

- field semantics are sufficiently proven;
- important TBC/defaults are resolved or intentionally documented;
- template/live mapping is reliable;
- update/merge behavior has project evidence;
- audit/report behavior is satisfactory;
- deterministic harness/tests adequately cover the source model.

Until then, keep the rule runnable as `draft` and use implementation feedback to improve it.
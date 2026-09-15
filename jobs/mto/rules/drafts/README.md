# MTO Draft Rules

Files in this directory are **runnable development rules**, not disabled placeholders.

They capture equipment/schedule logic that has been reviewed against available templates/source evidence but has **not yet been fully validated/finalized through enough real project implementations**.

The purpose of using a draft rule on real work is to produce usable output **and** gather implementation evidence to improve the rule.

## Mandatory draft warning

Whenever GPT uses any rule from `rules/drafts/`, it must tell the user before execution:

> **DRAFT / NOT FINAL — this rule is usable, but the result must be checked carefully. Findings from this project should be fed back into the rule.**

The same status must be visible in the takeoff/change report and completion summary.

`draft` therefore means **runnable with mandatory warning + careful review**. It does not mean unsupported.

## Draft families

### Selection-driven equipment drafts

These follow the normal MTO pattern where project selection is primary and technical data supplements the exact selected model:

- `chw-pump.md`
- `chiller.md`
- `erv-hrv.md`
- `evaporative-cooler.md`
- `fume-cupboard.md`
- `vav.md`
- `attenuator.md`

They are registered with `status: draft` and may be selected normally. Input/revision resolution works like other selection-driven equipment.

### Drawing-export-driven schedule drafts

These use the already-operational `rules/_common/drawing-export-driven.md` source model:

- `grille.md`
- `door-grille.md`
- `flexible-connection.md`

The user keeps one current Lisp export in `01 WIP`; the export is a drawing snapshot, not a revision history store. Live schedules may contain valid manual edits/enrichment and must not be blindly rebuilt.

Normal update flow:

`current export -> compare -> change report -> controlled merge`

Optional `00 Input` technical data may supplement missing values but is often absent and is not required for a valid drawing-export run.

Target Lisp export stems after the known naming bug is fixed:

- `grille`
- `door grille`
- `flex conn`

Until then, the user may explicitly identify/provide the current legacy WIP export file.

## Draft safety

Rules in `drafts/`:

- are selectable/runnable through `equipment-registry.json` with `status: draft`;
- may contain explicit `TBC`, provisional rules, template defects, and unresolved semantics;
- must never have missing engineering policy silently invented by GPT;
- must preserve/flag uncertainty when the rule says behavior is unresolved;
- must be revised from real implementation evidence;
- require stronger human review than stable rules.

## Promotion to stable

Promotion does **not** mean “first time the rule becomes usable.” It means the rule has accumulated enough evidence to remove the draft warning.

Promote `draft -> stable` when:

- field semantics are sufficiently proven;
- important TBC/defaults are resolved or intentionally documented;
- source mapping and update/merge behavior have real-project evidence;
- audit/report behavior is satisfactory;
- deterministic harness/tests cover the source model adequately.

Until then, keep the rule runnable as `draft` and use project feedback to develop it.
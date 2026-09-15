# MTO Draft Rules

Files in this directory are **not operational equipment rules**.

They capture equipment logic that has been reviewed against available templates/source evidence but has **not yet been fully validated through real project implementation**.

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

### Drawing-export-driven schedule drafts

These use the finished design drawing through a Lisp block-attribute export as the primary project snapshot:

- `_common/drawing-export-driven.md` — shared source/update contract;
- `grille.md`;
- `door-grille.md`;
- `flexible-connection.md`.

The drawing-export-driven family is intentionally different from selection-driven equipment:

- the user keeps one current schedule-specific Lisp export in `01 WIP`;
- the export is a drawing snapshot, not a revision history store;
- live schedules may contain valid manual edits and enrichment and must not be blindly rebuilt;
- normal update flow is `current export -> compare -> change report -> controlled merge`;
- optional `00 Input` technical data may supplement missing values but is often absent and is not required for a valid run.

Target Lisp export stems after the known project-name export bug is fixed:

- `grille`
- `door grille`
- `flex conn`

The final extension may be configured separately.

## Draft safety

Rules in `drafts/`:

- must not be added to `equipment-registry.json` merely because a draft exists;
- must not make an equipment type selectable/runnable in MTO;
- may contain explicit `TBC`, provisional rules, template defects, and unresolved semantics;
- must be revised from implementation evidence, not filled in by guesswork.

Promotion to an operational rule requires moving/refining the rule into `rules/<equipment>.md`, adding the equipment registry mapping, and extending deterministic harness/tests for that source model.

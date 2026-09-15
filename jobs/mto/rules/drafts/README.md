# MTO Draft Rules

Files in this directory are **not operational equipment rules**.

They capture equipment logic that has been reviewed against available templates/source evidence but has **not yet been validated through a real project implementation**.

Rules in `drafts/`:

- must not be added to `equipment-registry.json` merely because a draft exists;
- must not make an equipment type selectable/runnable in MTO;
- may contain explicit `TBC`, provisional rules, template defects, and unresolved semantics;
- must be tested on real selection + technical-data + drawing + schedule inputs before promotion;
- should be revised from implementation evidence, not filled in by guesswork.

Promotion to an operational rule requires moving/refining the rule into `rules/<equipment>.md`, adding the equipment registry mapping, and extending deterministic harness/tests.

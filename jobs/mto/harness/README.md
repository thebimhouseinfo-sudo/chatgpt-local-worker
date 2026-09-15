# MTO Harness

Deterministic helpers for project/source resolution, write-scope validation, audit validation, report validation, and Job Pack validation. They support MTO reasoning; they do **not** decide engineering values.

## Source resolution

`resolve-project.mjs` resolves requested aliases through `rules/equipment-registry.json`, including stable and runnable-draft rules.

Selection-driven example:

```bash
node harness/resolve-project.mjs \
  --project <root> \
  --equipment <ac,fan,chiller,...> \
  [--revision <YYYY MM DD|latest>]
```

If revision is omitted for a selection-driven request, the current SOP may resolve it as `latest`.

Drawing-export-driven example:

```bash
node harness/resolve-project.mjs \
  --project <root> \
  --equipment <grille|door-grille|flexible-connection> \
  [--source-file <current-wip-export>] \
  [--revision <optional-supplemental-input-revision>]
```

`--source-file` is useful while legacy Lisp exports still use project-name filenames. Once canonical export stems are in use, the resolver can discover the schedule-specific current export deterministically.

Resolver output includes rule status, mandatory draft warning when applicable, source model, source paths, template/live schedule, audit/report paths, and applicable base/project rules.

## Helpers

- `resolve-project.mjs` — validate project structure and resolve the requested stable/draft rule plus selection or drawing-export source model.
- `write-guard.mjs --project <root> --path <target>` — allow only intended targets under `01 WIP/SCHEDULE/eqm/**`; explicitly deny templates and `02 Output/**`.
- `audit-lint.mjs --file <audit.json>` — validate append-history audit JSON and required source/rule metadata.
- `report-lint.mjs --file <report.md>` — validate the human-readable takeoff/change report structure, unresolved placeholders, and draft-warning contract where applicable.
- `validate.mjs` — validate MTO pack structure, registry/rules, common contracts, and harness assumptions.

Harness output is path/safety/validation evidence, not technical judgement. Field semantics live under `rules/`, including `rules/drafts/` for runnable draft rules.

The drawing-export source model under `rules/_common/drawing-export-driven.md` is operational even while its schedule-specific business rules remain draft.

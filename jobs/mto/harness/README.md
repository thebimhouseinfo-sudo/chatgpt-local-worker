# MTO Harness

Deterministic helpers for project navigation, revision resolution, write-scope validation, and audit validation. They support MTO reasoning; they do not decide equipment engineering values.

- `resolve-project.mjs --project <root> --equipment <ac,fan> --revision <YYYY MM DD|latest>` — validate the project skeleton, resolve the input revision per equipment, match templates/live schedules/audit paths, and return base/project rule paths.
- `write-guard.mjs --project <root> --path <target>` — pass only targets inside `01 WIP/SCHEDULE/eqm/**`; explicitly deny templates and `02 Output/**`.
- `audit-lint.mjs --file <audit.json>` — validate the append-history JSON-array audit contract.
- `validate.mjs` — validate the MTO Job Pack itself.

Harness output is evidence and path resolution, not technical judgement. AC/Fan field semantics live under `rules/`.

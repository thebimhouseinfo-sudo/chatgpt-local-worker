# MTO — Operating SOP

This Job Pack executes user-scoped HVAC equipment takeoff/update work on a local project folder. It is not a background watcher and must not autonomously decide which equipment categories to process.

## 1. Resolve the execution request

After activation, read `workspace`, `task`, `equipment`, `input_revision`, and optional `delivery` from `job_status`.

The user defines equipment scope. Do not add equipment types merely because folders exist.

Normalize supported V1 equipment aliases to:

- `ac`
- `fan`

If a requested equipment type has no rule set in `rules/equipment-registry.json`, stop that equipment scope and report it as unsupported rather than inventing behavior.

## 2. Resolve project paths and revision deterministically

Run:

`node harness/resolve-project.mjs --project <workspace> --equipment <equipment> --revision <input_revision>`

Use the returned paths instead of asking the user to remember internal folder names.

When revision is `latest`, use the latest valid revision containing each requested equipment folder. Explicit revisions must exist and contain each requested equipment folder.

Do not use folder mtime. Do not guess malformed dates.

## 3. Load rules before reading equipment data

For every equipment item, read rules in this order:

1. base common rules under `rules/_common/`;
2. base equipment rule (`rules/ac.md` or `rules/fan.md`);
3. optional project common overrides under `<workspace>/qto-rules/_common/`;
4. optional project equipment override `<workspace>/qto-rules/<equipment>.md`;
5. explicit current user instruction has final authority unless it violates the hard write boundary.

Rules describe business semantics. Harnesses do not decide engineering values.

## 4. Read the schedule schema first

Open the matching schedule template in `01 WIP/SCHEDULE/` as read-only.

The template defines:

- target columns and order;
- units;
- sheet/layout structure;
- formatting/merge/border expectations.

Do not add columns/sheets or change template structure unless the user explicitly requests a schema change outside normal MTO execution.

If no live EQM exists, copy/bootstrap from the template into the resolved `01 WIP/SCHEDULE/eqm/` target before populating data. Never modify the original template.

## 5. Read project selection before catalogs

Inside each resolved `00 Input/<revision>/<equipment>/` folder, distinguish documents by information role:

- **EQM selection** — project-specific selected equipment/model/value backbone;
- **technical data/catalog** — supplementary manufacturer information.

Read selection first and build the selected-equipment registry:

- Tag / REF. NO.
- selected make/model;
- project order/grouping;
- quantity when explicit;
- all project-specific fields already supplied.

Do not scan catalogs to invent additional project equipment.

## 6. Supplement only missing fields

For each selected row and each template field still unsupported by selection:

1. search technical data for the exact selected model;
2. extract only values clearly applicable to that model;
3. prefer rated/nominal duty values over maxima unless the selection/project rule explicitly requires otherwise;
4. never copy a neighboring model's values;
5. never replace an explicit selection value with generic catalog data.

If selection and catalog materially disagree for a populated selection field:

- preserve the selection value in the schedule where applicable;
- record `CONFLICT` in the audit evidence;
- do not silently choose the catalog value.

Unsupported data remains `-`, `TBC`, or another marker only when the template/project rules explicitly define that marker. Never invent a number.

## 7. Reconcile against DESIGN DRAWING

Use `01 WIP/DESIGN DRAWING/**` for reconciliation, not as the default technical-value source.

Check where practical:

- drawing equipment count vs selected rows;
- drawing tag/naming vs selection tag/naming;
- mounting/location/system context when relevant to the equipment rule.

Apply explicit tag mapping from project rules when available. Do not infer mappings purely from similar numbering.

Unknown mapping → `UNMATCHED` in audit/review output.

Do not auto-add or auto-delete schedule rows solely to force drawing counts to match.

## 8. Compute the live EQM delta

Open the resolved live EQM schedule (or bootstrapped copy) and compare by mapped equipment key/tag.

Possible actions:

- existing row + supported changed source value → update;
- new selected equipment → add;
- same supported values → unchanged;
- previous live row absent from current selection → preserve and flag review-required/disappeared; do not auto-delete;
- ambiguous/manual-looking live value where overwrite authority is unclear → preserve and flag for review unless a project rule explicitly authorizes replacement.

When available, set `Last Updated` to the input revision processed for that equipment, not the AI run timestamp.

## 9. Guard every write

Before writing any project file, run:

`node harness/write-guard.mjs --project <workspace> --path <target-path>`

Only paths under `01 WIP/SCHEDULE/eqm/**` may pass.

Never write to:

- `00 Input/**`
- `01 WIP/DESIGN DRAWING/**`
- schedule templates
- `01 WIP/REVIT/**`
- `02 Output/**`

The runtime/filesystem deployment should additionally enforce the same boundary with hard ACLs.

## 10. Update audit history

For each equipment type, update:

`01 WIP/SCHEDULE/eqm/_audit/<equipment>.json`

Use a JSON array of run objects. Preserve earlier entries and append one new logical run record.

Record enough evidence for a reviewer to identify:

- rows added/updated/unchanged;
- field-level old/new values when changed;
- source file/page/sheet when available;
- TBC/unsupported values;
- conflicts;
- drawing-vs-selection unmatched tags;
- disappeared/review-required rows.

Run:

`node harness/audit-lint.mjs --file <audit-path>`

before declaring completion.

## 11. Validate and report

Before completion verify:

- requested revision(s) and equipment scope;
- no unsupported equipment was silently processed;
- templates remain unchanged;
- only live EQM/audit paths were written;
- selected models remained exact;
- no project selection value was silently overwritten by catalog data;
- workbook structure/schema remains consistent with template;
- audit JSON passes validation;
- `02 Output/**` is untouched.

Report a compact run summary per equipment:

- resolved input revision;
- schedule created vs updated;
- rows added;
- rows updated;
- rows unchanged;
- conflicts;
- TBC/unsupported;
- unmatched drawing/selection tags;
- disappeared/review-required rows.

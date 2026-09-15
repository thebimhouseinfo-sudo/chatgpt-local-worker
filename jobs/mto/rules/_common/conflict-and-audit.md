# Common Rule — Conflict, Missing Data & Audit

## Selection vs catalog conflict

When selection already supplies a field and detailed technical data disagrees:

- keep the selection value in the live schedule where applicable;
- record the conflict with both values and source evidence;
- never silently overwrite selection with catalog.

## Detailed-source conflict

Apply `source-authority.md`. If no defensible source wins, keep the field unresolved according to template/project missing-data convention and record the conflict.

## Missing data

- Never guess.
- Default unsupported marker is `-` unless project/template rules define another marker.
- Use `TBC` only when the project/template uses TBC semantics.
- Unmatched drawing/selection identity is `UNMATCHED` in review/audit context.

## Audit history

Audit path:

`01 WIP/SCHEDULE/eqm/_audit/<equipment>.json`

Representation: valid JSON array. Preserve previous run objects and append one new logical record for each completed equipment run.

Minimum run fields:

- `input_rev` — processed input revision;
- `run_timestamp` — actual execution timestamp;
- `changes` — array of tag-level or field-level changes;
- `tbc` — unresolved/TBC items;
- `conflicts` — source conflicts;
- `unmatched_drawing_vs_selection` — unresolved mapping/count identity items.

Recommended change evidence where applicable:

- tag;
- matched selection name;
- action: `added`, `updated`, `unchanged`, `review_required`;
- field;
- old/new;
- source path plus page/sheet/cell when known.

Also record disappeared/review-required live rows either as `review_required` changes or an explicit additional array.

Audit is for human review. Do not hide material conflicts only inside workbook cells.

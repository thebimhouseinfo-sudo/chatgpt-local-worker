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

## Audit vs takeoff report

The audit JSON is machine-readable run/change history. The Markdown takeoff report defined by `reporting.md` is the human-readable result artifact for one equipment revision.

Do not try to replace one with the other:

- audit preserves every execution run;
- report presents the final readable result, traceability, reconciliation and RFI for the equipment revision.

Material conflicts must appear in both audit evidence and the reviewer-facing report when relevant.

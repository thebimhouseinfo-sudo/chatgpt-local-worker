# Common Rule — Live Schedule Update

## Live truth

`01 WIP/SCHEDULE/eqm/<Equipment Schedule>.xlsx` is the living working schedule.

- If it exists, update it in place.
- If it does not exist, bootstrap from the matching read-only template under `01 WIP/SCHEDULE/`.
- Do not create revision-numbered duplicate workbooks for normal updates.
- `02 Output/**` is frozen/release space and must not be written by MTO.

## Row identity and update actions

Use the mapped project tag / REF. NO. as the primary row key unless the project rule explicitly defines another stable key.

Possible outcomes:

- existing tag + changed authoritative value -> update the field;
- new selected tag -> add a row using template row formatting;
- existing tag + no supported change -> unchanged;
- live row missing from the current scoped selection -> preserve it and record `disappeared/review-required`; do not auto-delete;
- tag identity unresolved -> do not merge rows by guess; record `UNMATCHED`.

Do not collapse multiple explicit tags merely because they share a model.

## Manual/live-value protection

Project-specific rules may identify columns that are manually maintained and must never be overwritten automatically.

When no such rule exists but a nonblank live value appears to conflict with a new source value and its provenance/overwrite authority is unclear, preserve the live value and flag the field for review instead of silently replacing it.

## Last Updated

When the schedule contains or project rules define a `Last Updated` field, write the processed input revision (`YYYY MM DD`) for rows materially added/updated in that run. Do not use AI execution time as the input revision marker.

## Ordering

Preserve selection order for newly created schedules/rows unless the project schedule/template defines another order. Do not alphabetically sort by default.

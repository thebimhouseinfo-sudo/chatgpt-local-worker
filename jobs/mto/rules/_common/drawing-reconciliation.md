# Common Rule — Drawing Reconciliation

`01 WIP/DESIGN DRAWING/**` is reconciliation/context evidence, not the main equipment technical-data source.

## Use drawing for

- compare drawing equipment count with selected equipment rows;
- reconcile tag / consultant naming;
- confirm type, mounting, location, or system association when relevant;
- support project-specific context when selection is incomplete.

## Tag mapping

Use explicit project mapping when available, preferably under `qto-rules/_common/tag-mapping.md`.

Example:

```text
AC-1 = ACU 1
AC-2 = ACU 2
```

Do not infer mapping from matching numeric suffix alone. Ordering in drawings and selection may differ.

Unknown mapping must be recorded as `UNMATCHED` / review-required. Do not force-match it to make counts align.

## Count mismatch

When drawing count and selection count differ:

- record the mismatch;
- do not auto-add rows from drawing;
- do not auto-delete selection/live rows;
- continue only with the equipment identity that remains authoritative/traceable;
- surface unresolved mismatch in audit and run summary.

Absence of a usable drawing does not by itself invalidate a selection-backed takeoff.

# Drawing-Export-Driven Schedule Source Model

> **DRAFT / NOT FINAL — requires real-project implementation and validation.**
>
> This source model is not operational by itself and must not be added to `equipment-registry.json` merely because a draft rule references it.

## Purpose

Some MTO schedules are completed primarily from finished design drawings rather than from PM/vendor equipment selections. For these schedules, a project Lisp exports block attributes from the drawing into an Excel file under WIP. That export is the primary project-data source used by MTO.

Current candidate users of this source model:

- Grille Schedule
- Door Grille Schedule
- Flexible Connection Schedule

## Single-current-export contract

The Lisp export is **not a revision history store**.

The user controls this source manually:

1. when the drawing changes, the old export is deleted;
2. the user runs the Lisp again;
3. one new/current export file is placed in WIP;
4. MTO is then invoked to update the corresponding schedule.

Therefore MTO must **not** implement a `latest export` resolver based on filename, timestamp, or lexical ordering.

For each drawing-export-driven schedule run:

- exactly **one** matching current WIP export is expected;
- `0` matching exports -> stop and report `MISSING_DRAWING_EXPORT`;
- `>1` matching exports -> stop and report `AMBIGUOUS_DRAWING_EXPORT`;
- never silently choose one of multiple exports by modified time;
- the export filename itself does not need to encode a revision/date.

## Source authority

For a drawing-export-driven schedule, use the following authority order unless a project override or explicit user instruction says otherwise:

1. **Schedule Template = Schema Authority**
   - controls workbook structure, headers, subheaders, units, formatting, merges, and output location;
   - template sample rows are examples only and are not project truth;
   - never overwrite the read-only template.
2. **Current WIP Lisp Export = Primary Project/Drawing Authority**
   - contains drawing-derived block attributes such as tag, system, airflow, sizes, type, comments, and other attributes exposed by the project Lisp;
   - acts in the same role that `eqm selection` plays for selection-driven equipment;
   - represents the current drawing snapshot selected by the user through the delete-and-re-export workflow;
   - do not infer fields from tag text when an explicit export attribute exists or when no project rule authorizes the inference.
3. **00 Input Technical Data = Optional Supplement Authority**
   - may provide make/model, product-specific dimensions, finish, performance, or other useful manufacturer information;
   - may fill fields missing from the WIP export only when the exact grille/device/type can be matched with sufficient evidence;
   - many projects may have no useful technical-data source for these schedules; that is acceptable and is not a run failure.
4. **Design Drawing = Upstream/Reconciliation Evidence**
   - the drawing is the upstream source from which the Lisp export was produced;
   - use direct drawing inspection only when needed for reconciliation, an unresolved export issue, or explicit user request;
   - normal MTO processing should not re-count/re-extract the whole drawing when a valid Lisp export is available.
5. **Project Rules / Explicit User Instruction**
   - may define normalization, defaults, naming conventions, and other allowed derivations;
   - cannot override template schema or authorize unsupported invention.

## Missing-data behavior

- Missing supplementary technical data is normal.
- If a field is absent from the WIP export and no exact-match supplemental source or approved project rule provides it, use `-`.
- Do not create RFIs merely because optional vendor information such as MAKE or MODEL is unavailable, unless the project specifically requires those fields to be resolved.

## Update behavior

The current export is a current drawing snapshot, while the live schedule is the working schedule artifact.

- if no live schedule exists, bootstrap from the read-only template and remove sample data rows only;
- if a live schedule exists, reconcile/update it from the current export using the schedule's stable drawing-derived identity/key;
- do not clear the live schedule blindly before reconciliation;
- whether rows that disappear from the new current export should be removed or retained/flagged is **not final** and must be decided from real project behavior for each schedule type;
- produce the normal MTO audit + human-readable report artifacts.

## Run identity and audit

A dated `00 Input/<rev>/...` revision is not required for the primary drawing export.

For a drawing-export-driven run, audit/report should record at minimum:

- actual current WIP export path/filename;
- run timestamp;
- schedule type;
- added/updated/unchanged/review-required rows;
- optional supplementary `00 Input` revision(s), if used;
- source/conflict/review details.

When deterministic tooling is implemented, recording a content hash of the current export is preferred because it identifies the exact source snapshot without relying on filename or filesystem modified time.

Do **not** invent a synthetic `input_rev` for the primary Lisp export.

## Promotion blockers

Before this source model becomes operational, validate on a real project:

1. exact WIP export folder and matching filename/pattern conventions;
2. deterministic enforcement of the exactly-one-current-export rule;
3. stable row identity for each schedule type;
4. exact exported block-attribute names and their mapping to schedule fields;
5. disappeared-row semantics for each schedule type;
6. audit/report schema for current-export source path/hash plus optional technical-data revision;
7. deterministic resolver and harness tests for source discovery and write boundaries.

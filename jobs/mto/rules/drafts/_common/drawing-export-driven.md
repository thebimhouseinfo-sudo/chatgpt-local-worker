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

## Source authority

For a drawing-export-driven schedule, use the following authority order unless a project override or explicit user instruction says otherwise:

1. **Schedule Template = Schema Authority**
   - controls workbook structure, headers, subheaders, units, formatting, merges, and output location;
   - template sample rows are examples only and are not project truth;
   - never overwrite the read-only template.
2. **WIP Lisp Export = Primary Project/Drawing Authority**
   - contains drawing-derived block attributes such as tag, system, airflow, sizes, type, comments, and other attributes exposed by the project Lisp;
   - acts in the same role that `eqm selection` plays for selection-driven equipment;
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

The same live-schedule principles apply as other MTO work:

- if no live schedule exists, bootstrap from the read-only template and remove sample data rows only;
- if a live schedule exists, update it in place using the schedule's stable drawing-derived identity/key;
- do not clear the live schedule on every run;
- do not delete disappeared rows automatically; flag them for review unless a future project rule explicitly changes this behavior;
- produce the normal MTO audit + human-readable report artifacts.

## Revision semantics — NOT FINAL

Unlike selection-driven schedules, the primary change trigger may be a new/current Lisp export rather than a dated `00 Input/<rev>/...` folder.

Until a real project implementation establishes the exact WIP export location and revision naming convention:

- do not invent a synthetic `input_rev`;
- identify the primary source as the actual WIP export file;
- if optional dated technical data is used, record its revision separately as a supplemental source;
- report/audit schema may require extension to distinguish `drawing_export_rev` from optional `input_rev`.

## Promotion blockers

Before this source model becomes operational, validate on a real project:

1. exact WIP export folder and filename conventions;
2. how the latest/current export is selected;
3. stable row identity for each schedule type;
4. exact exported block-attribute names and their mapping to schedule fields;
5. whether report/audit metadata needs a dedicated drawing-export revision field;
6. deterministic resolver and harness tests for source discovery and write boundaries.

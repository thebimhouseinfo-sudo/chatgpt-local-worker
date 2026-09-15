# Door Grille Schedule Rule

> **DRAFT / NOT FINAL — requires further real-project implementation and validation.**
>
> This rule has been reconciled against the current `Door Grille Schedule.xlsx` template and the user-confirmed Lisp-export workflow: the export provides only the Door Grille name/tag and size.
>
> **Do not add this rule to `equipment-registry.json` yet.**

## Source model

Use `drafts/_common/drawing-export-driven.md`.

Primary project source: the single current WIP Lisp export for Door Grille.

Target filename convention after the Lisp naming fix:

- `door grille.csv` (canonical stem `door grille`)

The current project-name-based export filename is a Lisp bug and must not become an MTO convention.

Do not resolve a latest file by timestamp. The user keeps only the current export.

Optional supplement: current project input/technical data when it contains useful Door Grille information. In many projects this information is absent because supplier/manufacturer selection is made later by the PM during construction/procurement. That absence is normal and is not a run failure.

## Template authority

The current workbook is `Door Grille Schedule.xlsx`.

Preserve the workbook structure and field order exactly:

1. `REF. NO.`
2. `TYPE`
3. `NOMINAL SIZE mm` with subheader `W x H`
4. `COLOUR`
5. `INSTALLED BY`

The template sample currently shows values such as `CHEVRON`, `ARCHITECT`, and `BUILDER`. These are **sample/template values only** and are not project defaults.

Do not copy them into a project row unless supported by actual project input, a project rule, an existing valid live-schedule value, or explicit user instruction.

## Export ownership

The user-confirmed Lisp export owns only two semantic fields:

- exported name/tag -> `REF. NO.`
- exported size -> `NOMINAL SIZE`

The export does **not** own:

- `TYPE`
- `COLOUR`
- `INSTALLED BY`

For those non-export-owned fields:

1. preserve an existing valid live-schedule value during reconciliation;
2. otherwise check current project input/technical data and project rules for explicit support;
3. otherwise use `-`.

Do not infer a value merely because the template sample contains one.

## Field semantics

### REF. NO.

- Primary source: exported Door Grille name/tag.
- Preserve the project tag exactly except for explicitly approved normalization.
- Do not invent or renumber tags.
- Candidate stable row identity: `REF. NO.`, pending duplicate-tag validation on a real export.

### TYPE

- Use an explicit value from project input, technical data, project rule, user instruction, or an existing valid live schedule.
- If unsupported, use `-`.
- Do **not** default to `CHEVRON` from the template sample.
- The supplied Ver 1.0 text and sample are contradictory (`TYPE = -` vs sample `CHEVRON`), so neither is accepted as a universal rule without project evidence.

### NOMINAL SIZE

- Primary source: exported size.
- Semantic: nominal Door Grille width x height in mm.
- Current template convention is compact `W x H` without units in-cell, with examples such as `600x150`, `600x250`, and `600x600`.
- Preserve the live/template formatting convention; do not force spaces merely because the old generic rule proposed `600 x 150`.
- Reorder dimensions only if the source explicitly identifies axes and proves the source order differs.
- Unsupported/missing new-row size -> `-`.

### COLOUR

- Use an explicit value from project/architectural input, technical data, project rule, user instruction, or an existing valid live schedule.
- If unsupported, use `-`.
- Do **not** default to `ARCHITECT` merely because the template sample uses it.

### INSTALLED BY

- Use an explicit responsibility value from project input/rules, user instruction, or an existing valid live schedule.
- If unsupported, use `-`.
- Do **not** default to `BUILDER` merely because the template sample uses it.

## Initial vs update behavior

Do not apply the old `CLEAR TEMPLATE BEFORE FILL` rule to an existing live schedule.

- No live Door Grille schedule: copy the read-only template, remove sample data rows only, populate `REF. NO.` and `NOMINAL SIZE` from the current export, check optional current input for the remaining fields, and use `-` where unsupported.
- Existing live schedule: compare current export to live schedule, produce the change report, then perform controlled merge.
- Preserve valid manual/non-export-owned values where the export has no authority.
- Do not clear or rebuild the whole schedule blindly.

## Change-report requirements

For a re-export run, report at minimum:

- added Door Grille tags;
- tags missing from the new export;
- changed nominal sizes;
- unchanged counts/rows;
- preserved manual/project values for `TYPE`, `COLOUR`, and `INSTALLED BY`;
- newly supplemented values from current project input, when any;
- conflicts/review items.

Small changes made manually in the live schedule without a new Lisp export produce no MTO run and no report; that is expected workflow.

## Missing data

- Missing Door Grille technical/vendor data is normal and not a run failure.
- For a new row, unsupported `TYPE`, `COLOUR`, or `INSTALLED BY` -> `-`.
- Do not create a mandatory RFI solely because these optional late-selection fields are unavailable.
- Do not replace a valid existing live value with `-` because the new export does not contain that field.
- Supplier/manufacturer information may only become available later in construction/procurement; if such information appears in a later input, it may be used to enrich the live schedule then.

## Formatting

- Preserve template structure, headers, merges, and formatting exactly.
- Preserve compact nominal-size formatting consistent with the current workbook unless a project rule changes it.
- Uppercase normal text where required by project convention without damaging codes/tags.
- Do not add units inside cells when the template already carries unit context.

## Validation checklist

Before considering a run complete:

- the canonical current Door Grille export was resolved;
- template structure/order preserved;
- every row traces to the current export or another explicitly approved project source;
- `REF. NO.` comes from the exported name/tag;
- `NOMINAL SIZE` comes from the exported size;
- no invented tag or size;
- no template-sample defaults are copied into `TYPE`, `COLOUR`, or `INSTALLED BY` without support;
- unsupported non-export-owned fields are `-` for new rows;
- manual/live values outside export ownership are preserved;
- audit/report records export path/hash and change summary.

## Promotion blockers

Before moving this rule to `rules/door-grille.md` and registering it operationally, validate:

1. exact WIP export location and final canonical filename (`door grille.csv` or equivalent extension);
2. exact raw export column names for tag/name and size;
3. whether `REF. NO.` is always a unique stable identity;
4. how later vendor/project input maps to `TYPE` and `COLOUR` when available;
5. whether `INSTALLED BY` normally comes from a project responsibility rule or remains `-`;
6. nominal-size formatting convention and axis order;
7. disappeared-row behavior;
8. compare/report/controlled-merge behavior with manual live edits;
9. resolver/harness tests using a real export fixture.

# Door Grille Schedule Rule

> **STATUS: DRAFT / NOT FINAL — RUNNABLE WITH CAREFUL REVIEW**
>
> This rule has been reconciled against the current `Door Grille Schedule.xlsx` template and the user-confirmed Lisp-export workflow: the export provides only the Door Grille name/tag and size.
>
> This rule is registered as `draft` and may be used on real projects. GPT must warn that the result needs careful review, and implementation findings should be fed back into the rule.

## Source model

Use `rules/_common/drawing-export-driven.md`.

The drawing-export source model itself is operational. This Door Grille rule remains draft only because some field-level defaults and update semantics still need further project validation.

Primary project source: the single current WIP Lisp export for Door Grille.

Target filename convention after the Lisp naming fix:

- `door grille.csv` (canonical stem `door grille`)

The current project-name-based export filename is a Lisp bug and must not become an MTO convention. Until the naming fix is deployed, the user may explicitly identify/provide the current Door Grille export.

Do not resolve a latest file by timestamp. The user keeps only the current export.

Optional supplement: current project input/technical data when it contains useful Door Grille information. In many projects this information is absent because the PM may only select the final supplier/manufacturer later during construction/procurement. That absence is normal and is not a run failure.

## Template authority

The current workbook is `Door Grille Schedule.xlsx`.

Preserve the workbook structure and field order exactly:

1. `REF. NO.`
2. `TYPE`
3. `NOMINAL SIZE mm` with subheader `W x H`
4. `COLOUR`
5. `INSTALLED BY`

The template sample currently shows values such as `CHEVRON`, `ARCHITECT`, and `BUILDER`.

- `CHEVRON` and `ARCHITECT` are sample/template values only and are **not** defaults.
- `BUILDER` matches the confirmed default installation scope and is therefore an approved default for `INSTALLED BY` unless the project explicitly states otherwise.

Do not copy other sample values into a project row unless supported by actual project input, a project rule, an existing valid live-schedule value, or explicit user instruction.

## Export ownership

The user-confirmed Lisp export owns only two semantic fields:

- exported name/tag -> `REF. NO.`
- exported size -> `NOMINAL SIZE`

The export does **not** own:

- `TYPE`
- `COLOUR`
- `INSTALLED BY`

For non-export-owned fields:

- `TYPE`: preserve an existing valid live value or use explicit project/input evidence; otherwise `-`;
- `COLOUR`: preserve an existing valid live value or use explicit project/input evidence; otherwise `-`;
- `INSTALLED BY`: default to `BUILDER` unless an explicit project responsibility rule/user instruction overrides it.

Do not infer `TYPE` or `COLOUR` merely because the template sample contains one.

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

- Default scope: `BUILDER`.
- This is a confirmed scope convention, not a value inferred from the sample row.
- If an explicit project responsibility matrix, project rule, or user instruction states another installer, use the explicit project value instead.
- When reconciling an existing live schedule, preserve a deliberate project-specific installer value and report conflicts rather than silently forcing `BUILDER`.

## Initial vs update behavior

Do not apply the old `CLEAR TEMPLATE BEFORE FILL` rule to an existing live schedule.

- No live Door Grille schedule: copy the read-only template, remove sample data rows only, populate `REF. NO.` and `NOMINAL SIZE` from the current export, check optional current input for `TYPE` and `COLOUR`, use `-` where unsupported, and set `INSTALLED BY = BUILDER` unless project evidence overrides it.
- Existing live schedule: compare current export to live schedule, produce the change report, then perform controlled merge.
- Preserve valid manual/non-export-owned values where the export has no authority.
- Do not clear or rebuild the whole schedule blindly.

## Change-report requirements

For a re-export run, report at minimum:

- added Door Grille tags;
- tags missing from the new export;
- changed nominal sizes;
- unchanged counts/rows;
- preserved manual/project values for `TYPE`, `COLOUR`, and any project-specific `INSTALLED BY` override;
- newly supplemented values from current project input, when any;
- conflicts/review items.

Small changes made manually in the live schedule without a new Lisp export produce no MTO run and no report; that is expected workflow.

## Missing data

- Missing Door Grille technical/vendor data is normal and not a run failure.
- For a new row, unsupported `TYPE` -> `-`.
- For a new row, unsupported `COLOUR` -> `-`.
- `INSTALLED BY` uses the confirmed default scope `BUILDER` unless explicitly overridden.
- Do not create a mandatory RFI solely because optional late-selection fields are unavailable.
- Do not replace a valid existing live value with `-` because the new export does not contain that field.
- Supplier/manufacturer information may only become available later in construction/procurement; if such information appears in a later input, it may be used to enrich the live schedule then.

## Formatting

- Preserve template structure, headers, merges, and formatting exactly.
- Preserve compact nominal-size formatting consistent with the current workbook unless a project rule changes it.
- Uppercase normal text where required by project convention without damaging codes/tags.
- Do not add units inside cells when the template already carries unit context.

## Validation checklist

Before considering a run complete:

- the current Door Grille export was explicitly/canonically resolved;
- template structure/order preserved;
- every row traces to the current export or another explicitly approved project source;
- `REF. NO.` comes from the exported name/tag;
- `NOMINAL SIZE` comes from the exported size;
- no invented tag or size;
- `TYPE` and `COLOUR` are not copied from template samples without support;
- unsupported `TYPE` / `COLOUR` values are `-` for new rows;
- `INSTALLED BY = BUILDER` unless explicit project responsibility evidence overrides it;
- manual/live values outside export ownership are preserved;
- audit/report records export path/hash and change summary;
- report visibly states `DRAFT / NOT FINAL`.

## Promotion blockers

Keep this rule `draft` while additional implementation evidence is needed for:

1. exact raw export column names for tag/name and size;
2. whether `REF. NO.` is always a unique stable identity;
3. how later vendor/project input maps to `TYPE` and `COLOUR` when available;
4. whether any project family overrides the default `INSTALLED BY = BUILDER` scope;
5. nominal-size formatting convention and axis order;
6. disappeared-row behavior;
7. compare/report/controlled-merge behavior with manual live edits;
8. deterministic resolver/harness behavior after the Lisp naming fix.

Draft status does not block use. Promote to `stable` only after enough real-project evidence exists to remove the mandatory warning.

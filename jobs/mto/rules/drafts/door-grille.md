# Door Grille Schedule Rule

> **DRAFT / NOT FINAL — requires further real-project implementation and validation.**
>
> This rule has been reconciled against the current `Door Grille Schedule.xlsx` template and the user-confirmed Lisp-export workflow: the export provides only the door-grille name/tag and size. Remaining schedule fields come from project/company convention, live schedule values, or explicit supplemental evidence.
>
> **Do not add this rule to `equipment-registry.json` yet.**

## Source model

Use `drafts/_common/drawing-export-driven.md`.

Primary project source: the single current WIP Lisp export for Door Grille.

Target filename convention after the Lisp naming fix:

- `door grille.csv` (canonical stem `door grille`)

The current project-name-based export filename is a Lisp bug and must not become an MTO convention.

Exactly one current Door Grille export is expected for a run:

- 0 matching files -> `MISSING_DRAWING_EXPORT`;
- 1 matching file -> use it;
- >1 matching files -> `AMBIGUOUS_DRAWING_EXPORT`.

Do not resolve a latest file by timestamp.

## Template authority

The current workbook is `Door Grille Schedule.xlsx`.

Preserve the workbook structure and field order exactly:

1. `REF. NO.`
2. `TYPE`
3. `NOMINAL SIZE mm` with subheader `W x H`
4. `COLOUR`
5. `INSTALLED BY`

Current template examples use:

- `TYPE = CHEVRON`
- `COLOUR = ARCHITECT`
- `INSTALLED BY = BUILDER`

The supplied Ver 1.0 text states `TYPE = "-"`, but that conflicts with both the template and its own output sample. The draft therefore treats `CHEVRON` as the current provisional project/company default pending real-project confirmation.

## Export ownership

The user-confirmed Lisp export owns only two semantic fields:

- exported name/tag -> `REF. NO.`
- exported size -> `NOMINAL SIZE`

The export does **not** own `TYPE`, `COLOUR`, or `INSTALLED BY` unless a later Lisp version explicitly exports them.

When reconciling against an existing live schedule, preserve valid manual/project values in non-export-owned fields unless an explicit project rule changes them.

## Field semantics

### REF. NO.

- Primary source: exported door-grille name/tag.
- Preserve the project tag exactly except for explicitly approved normalization.
- Do not invent or renumber door-grille tags.
- Candidate stable row identity: `REF. NO.`, pending duplicate-tag validation on a real export.

### TYPE

Current candidate default:

- `CHEVRON`

Rationale:

- the current template uses `CHEVRON` for all provided sample rows;
- the supplied Ver 1.0 output sample also uses `CHEVRON`;
- the contradictory instruction `TYPE = "-"` is therefore not adopted.

This is still a **provisional company/project rule** until a real implementation confirms Door Grille type is always CHEVRON across the intended project set.

If a project/live schedule explicitly provides another supported type, preserve/use that explicit value instead of forcing CHEVRON.

### NOMINAL SIZE

- Primary source: exported size.
- Semantic: nominal Door Grille width x height in mm.
- Current template convention is compact `W x H` without units in-cell, with examples such as `600x150`, `600x250`, and `600x600`.
- Preserve the live/template formatting convention; do not force spaces merely because the old generic rule proposed `600 x 150`.
- Reorder dimensions only if the source explicitly identifies axes and proves the source order differs.
- Unsupported/missing new-row size -> `-`.

### COLOUR

Current candidate default:

- `ARCHITECT`

This is treated as a project/company instruction meaning the final colour is by architectural selection, not as a literal colour value.

If an existing live schedule or explicit project input provides another value, preserve/use that explicit value.

### INSTALLED BY

Current candidate default:

- `BUILDER`

Treat this as a provisional project/company responsibility rule, not a universal engineering fact.

If an explicit project rule or live schedule states another installer, preserve/use the explicit value.

## Initial vs update behavior

Do not apply the old `CLEAR TEMPLATE BEFORE FILL` rule to an existing live schedule.

- No live Door Grille schedule: copy the read-only template, remove sample data rows only, populate rows from the current export, then apply supported provisional/project defaults.
- Existing live schedule: compare current export to live schedule, produce the change report, then perform controlled merge.
- Preserve manual/non-export-owned values where the export has no authority.
- Do not clear or rebuild the whole schedule blindly.

## Change-report requirements

For a re-export run, report at minimum:

- added Door Grille tags;
- tags missing from the new export;
- changed nominal sizes;
- unchanged counts/rows;
- preserved manual `TYPE`, `COLOUR`, or `INSTALLED BY` values when they differ from defaults;
- conflicts/review items.

Small changes made manually in the live schedule without a new Lisp export produce no MTO run and no report; that is expected workflow.

## Missing and disappeared rows

- Missing supplementary technical data is normal and not a run failure.
- New-row values not owned by the export may use approved defaults above; otherwise `-`.
- Do not replace a valid live manual value with `-` because the export lacks that field.
- Disappeared-row behavior is still **TBC** until one real replacement-export cycle is validated. Do not auto-delete rows yet.

## Formatting

- Preserve template structure, headers, merges, and formatting exactly.
- Preserve compact nominal-size formatting consistent with the current workbook unless a project rule changes it.
- Uppercase normal text where required by project convention without damaging codes/tags.
- Do not add units inside cells when the template already carries unit context.

## Validation checklist

Before considering a run complete:

- exactly one current Door Grille export was resolved;
- template structure/order preserved;
- every row traces to the current export or another explicitly approved project source;
- `REF. NO.` comes from the exported name/tag;
- `NOMINAL SIZE` comes from the exported size;
- no invented tag or size;
- `TYPE = CHEVRON`, `COLOUR = ARCHITECT`, and `INSTALLED BY = BUILDER` are treated as provisional project/company defaults, not universal facts;
- manual live values outside export ownership are preserved;
- audit/report records export path/hash and change summary.

## Promotion blockers

Before moving this rule to `rules/door-grille.md` and registering it operationally, validate:

1. exact WIP export location and final canonical filename (`door grille.csv` or equivalent extension);
2. exact raw export column names for tag/name and size;
3. whether `REF. NO.` is always a unique stable identity;
4. whether `TYPE = CHEVRON` is truly the standard default;
5. whether `COLOUR = ARCHITECT` is standard across projects;
6. whether `INSTALLED BY = BUILDER` is standard across projects;
7. nominal-size formatting convention and axis order;
8. disappeared-row behavior;
9. compare/report/controlled-merge behavior with manual live edits;
10. resolver/harness tests using a real export fixture.

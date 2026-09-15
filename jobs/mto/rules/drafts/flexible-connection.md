# Flexible Connection Schedule Rule

> **DRAFT / NOT FINAL — requires real-project implementation and validation.**
>
> This rule has been reconciled against the current `Flexible Connection Schedule.xlsx` template and one real Lisp export (`EQM,SIZE,EXTINSU,INTINSU`). It is still non-operational until tested through a complete project update cycle.
>
> **Do not add this rule to `equipment-registry.json` yet.**

## Source model

Use `drafts/_common/drawing-export-driven.md`.

Primary project source: the single current WIP CSV/Excel export produced by the project Lisp from flexible-connection block attributes.

Optional supplement: project input/design information when it provides exact missing data such as connection length, insulation requirement, or project notes. The live schedule may also contain valid manual values that are not present in the export and must be preserved during reconciliation.

## Template authority

The current workbook is `Flexible Connection Schedule.xlsx`.

Preserve the workbook structure and field order exactly:

1. `SYSTEM`
2. `SIZE mm` with subheader `W x H`
3. `LENGTH mm`
4. `NOTES`

Template examples include both rectangular and round connection notation; therefore `SIZE` is not restricted to rectangular `W x H` only.

## Real export evidence

The supplied real Lisp export contains these columns:

- `EQM`
- `SIZE`
- `EXTINSU`
- `INTINSU`

Observed examples include:

- `OAF-01 OA` + `255x255`
- duplicated identical `OAF-01 OA` + `255x255`
- `OAF-02 OA` + `155x155`
- `OAF-02 OA` + `155%%C`
- the same rectangular + diameter-coded pattern for `OAF-03 OA` and `OAF-04 OA`

`%%C` is a CAD diameter control code in the export representation. Normalize it into the schedule's human-readable diameter convention only; do not preserve the raw control code in the live schedule.

## Mapping from Lisp export

### SYSTEM

- Primary mapping: `EQM` -> `SYSTEM`.
- Preserve the explicit exported system text, including suffix/context such as `OA`, unless a project rule explicitly normalizes it.
- Do not infer another system name from filename, row order, or equipment class.

### SIZE

Primary mapping: export `SIZE` -> schedule `SIZE`.

Normalize representation only when semantics are explicit:

- rectangular `255x255` -> normalized rectangular form such as `255 x 255` according to live-schedule formatting convention;
- CAD diameter form such as `155%%C` -> human-readable diameter form such as `155Dia` / `155 Dia` according to the project/template convention;
- do not convert between rectangular and round geometry;
- do not reorder width/height unless source axes are known.

The current template contains an example `600Dia ( 2-OFF )`, while the supplied Ver 1.0 rule proposes `600 Dia`. Exact spacing around `Dia` remains a formatting detail to validate in implementation; preserve the established live-template convention when possible.

### LENGTH

- The real export does **not** provide a `LENGTH` field.
- Do not copy the template sample value `150` into project rows merely because sample rows use 150 mm.
- For a new row, use an explicit project/export/input value if available; otherwise `-`.
- When reconciling an existing live schedule, preserve an existing valid manually/project-entered length unless a higher-authority project source explicitly changes it.
- A future company/project rule may establish a standard flexible-connection length, but that must be explicit before automation.

### NOTES

- The real export provides `EXTINSU` and `INTINSU`, but the supplied sample has those fields blank; their exact business semantics and encoding have not yet been validated.
- Do not infer roof-mounted status solely because an equipment/system name contains `RC`, `RF`, `OAF`, or another naming fragment.
- Do not automatically write `EXTERNALLY INSULATE CONNECTION AND PROVIDE SUN SHIELDS` based on equipment-name heuristics.
- Populate `NOTES` only from explicit export attributes, project rules, technical/design evidence, or an existing valid live-schedule value.
- `EXTINSU`/`INTINSU` may eventually drive insulation-related notes once their value vocabulary and intended mapping are proven on a real project.

## Duplicate and quantity behavior

The real export proves that multiple block records may share the same `EQM`.

Do not treat every repeated system as a duplicate error.

### Exact duplicate candidates

If multiple export rows have the same normalized `SYSTEM` and same normalized `SIZE`, they may represent multiple identical flexible connections.

Example observed:

- `OAF-01 OA | 255x255`
- `OAF-01 OA | 255x255`

The template's `600Dia ( 2-OFF )` example shows that quantity notation inside `SIZE` is a supported schedule pattern. Therefore grouping identical `(SYSTEM, SIZE)` records into a quantity representation such as `( 2-OFF )` is a **provisional candidate rule**.

Do not enable this automatically until one real project confirms that repeated identical export rows always mean count/quantity rather than duplicated extraction artifacts.

### Same system, different sizes

If one `SYSTEM` has different connection sizes, do **not** collapse those rows into `2-OFF`.

Observed:

- `OAF-02 OA | 155x155`
- `OAF-02 OA | 155%%C`

This may represent two distinct connection geometries. The final schedule representation is not yet proven. Until implementation evidence resolves it:

- preserve both source records during reconciliation;
- flag the system for review if the template/live schedule expects one row per system;
- do not concatenate sizes or create quantity notation by guesswork.

## Initial vs update behavior

Do not apply the old `CLEAR TEMPLATE BEFORE FILL` rule to an existing live schedule.

- no live schedule: bootstrap from the read-only template, clear sample data rows only, then populate from the current export plus supported supplemental values;
- existing live schedule: compare current export against the live schedule, produce the change report, then perform controlled merge;
- preserve manual/enriched `LENGTH` and `NOTES` values when the export does not own them;
- do not clear or rebuild the whole schedule from the CSV.

## Change-report requirements

A re-export run should report at least:

- new systems/connections;
- systems/connections missing from the new export;
- changed `SYSTEM` or `SIZE` values;
- exact duplicate-count changes;
- same-system/multi-size review cases;
- preserved manual `LENGTH` values;
- preserved manual/enriched `NOTES` values;
- any `EXTINSU` / `INTINSU` change that cannot yet be deterministically mapped;
- conflicts requiring user review.

Small changes edited manually in the live schedule without a new Lisp export produce no MTO run and no report; that is expected workflow.

## Missing-data behavior

- New row with no supported LENGTH -> `-`.
- New row with no supported NOTES -> `-`.
- Do not replace an existing valid live LENGTH/NOTES value with `-` because those fields are absent from the current export.
- Do not invent insulation/sun-shield notes.

## Formatting

- Preserve template structure exactly.
- Normalize rectangular dimensions to the project's schedule convention with spaces around `x` when writing human-readable values.
- Normalize CAD diameter control codes to the project's schedule diameter notation.
- Preserve explicit quantity notation when it is source-supported or produced by an approved aggregation rule.
- Do not leave required new-row cells blank; unsupported new values use `-`.

## Validation checklist

Before a run can be considered complete:

- exactly one current WIP export was resolved;
- template/live schedule structure is preserved;
- export columns are recognized (`EQM`, `SIZE`, `EXTINSU`, `INTINSU`) or explicitly mapped by a project override;
- every output connection is traceable to export/live/project evidence;
- `SYSTEM` comes from `EQM` or another explicit source, not inference;
- raw CAD `%%C` is not left in final schedule text;
- identical repeated records are not blindly deduplicated;
- same-system/different-size records are not falsely turned into quantity notation;
- LENGTH is not invented from template sample rows;
- roof/insulation NOTES are not inferred from naming heuristics;
- manual/enriched live values outside export ownership are preserved;
- audit/report records current export path/hash and change summary.

## Promotion blockers

Before moving this rule to `rules/flexible-connection.md` and registering it operationally, validate:

1. exact WIP export location and candidate-file matching rule;
2. whether `EQM` is the stable schedule identity or only a grouping key;
3. whether identical `(EQM, SIZE)` rows should always aggregate to `( n-OFF )`;
4. how one system with multiple different sizes is represented in the final schedule;
5. exact normalization of `%%C` and `Dia` spacing;
6. whether LENGTH has a company/project standard such as 150 mm or must always be source-driven;
7. exact meaning/value vocabulary of `EXTINSU` and `INTINSU`;
8. deterministic mapping from insulation attributes to NOTES, if any;
9. disappeared-row behavior;
10. compare/report/controlled-merge behavior with manual live edits;
11. resolver/harness tests using a real export fixture.

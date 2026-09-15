# Flexible Connection Schedule Rule

> **STATUS: DRAFT / NOT FINAL — RUNNABLE WITH CAREFUL REVIEW**
>
> This rule has been reconciled against the current `Flexible Connection Schedule.xlsx` template, one real Lisp export (`EQM,SIZE,EXTINSU,INTINSU`), and the corresponding completed project schedule produced from that export.
>
> The drawing-export source workflow itself is operational. This rule is registered as `draft` and may be used on real projects. GPT must warn that results need careful review because some field-level business rules and merge semantics still need further project validation.

## Source model

Use `rules/_common/drawing-export-driven.md`.

Target primary source after the Lisp naming fix: `01 WIP/flex conn.csv` (or same canonical stem with the final export extension).

Legacy project-name export files such as `YAC.csv` remain usable when explicitly identified/provided by the user; they are not the future auto-resolver convention.

## Template authority

The current workbook is `Flexible Connection Schedule.xlsx`.

Preserve the workbook structure and field order exactly:

1. `SYSTEM`
2. `SIZE mm` with subheader `W x H`
3. `LENGTH mm`
4. `NOTES`

Although the SIZE subheader says `W x H`, the actual schedule supports both rectangular and round connection notation.

## Verified real-project evidence

The supplied Lisp export contains:

- `EQM`
- `SIZE`
- `EXTINSU`
- `INTINSU`

Observed export records:

- `OAF-01 OA | 255x255` twice;
- `OAF-02 OA | 155x155`;
- `OAF-02 OA | 155%%C`;
- the same rectangular + diameter-coded pair for `OAF-03 OA` and `OAF-04 OA`.

The corresponding completed schedule proves:

- all 8 export records remain 8 schedule rows;
- the duplicate `OAF-01 OA | 255x255` remains two separate rows;
- `155%%C` becomes `155Dia`;
- each row uses LENGTH `150`;
- NOTES is `-` for the supplied sample where `EXTINSU`/`INTINSU` are blank.

This completed result supersedes earlier provisional ideas about automatic `(2-OFF)` aggregation.

## Mapping from Lisp export

### SYSTEM

- Direct mapping: `EQM` -> `SYSTEM`.
- Preserve explicit exported text such as `OAF-01 OA`.
- Do not infer another system reference from filename, row order, equipment class, or tag parsing.

### SIZE

Direct mapping: export `SIZE` -> schedule `SIZE`, with representation normalization only.

Verified current convention:

- rectangular `255x255` -> `255x255`;
- CAD diameter `155%%C` -> `155Dia`;
- do not add spaces around `x` or before `Dia` in this schedule;
- do not convert between rectangular and round geometry;
- do not reorder width/height unless source axes are explicitly known.

Raw CAD `%%C` must never remain in the final live schedule.

### LENGTH

The export does not contain LENGTH, while the completed schedule uses `150` mm for every exported connection.

Current candidate business rule, supported by one real implementation:

- default flexible-connection LENGTH = `150` mm when the export has no explicit length;
- because the template column already carries `mm`, write numeric `150` only;
- explicit project/user/source value overrides this default;
- when reconciling an existing live schedule, preserve an intentional manual/project value that differs from 150 and report the discrepancy rather than silently overwriting it.

This 150 mm default remains **not final** until validated on additional projects.

### NOTES

The real export includes `EXTINSU` and `INTINSU`, but all supplied values are blank. The completed schedule uses `-` for NOTES on all supplied rows.

Therefore:

- blank `EXTINSU` + blank `INTINSU` -> `NOTES = -` for a new row unless another explicit source supplies a note;
- do not infer roof-mounted status from `OAF`, `RF`, `RC`, or other name fragments;
- do not automatically write `EXTERNALLY INSULATE CONNECTION AND PROVIDE SUN SHIELDS` from naming heuristics;
- preserve an existing valid manual/project NOTES value during reconciliation when the export provides no replacement;
- future nonblank `EXTINSU` / `INTINSU` values require real evidence before deterministic note mapping is defined.

## Row cardinality and comparison identity

The completed result proves that **one export connection record corresponds to one schedule row** in the current workflow.

### Repeated identical records

If the export contains the same `(SYSTEM, SIZE)` more than once, retain the same multiplicity in the schedule.

Verified example:

- export contains `OAF-01 OA | 255x255` twice;
- completed schedule contains two separate `OAF-01 OA | 255x255 | 150 | -` rows.

Therefore:

- do not deduplicate identical records;
- do not aggregate them into `(2-OFF)` by default;
- duplicate count is meaningful quantity evidence.

### Same system, different sizes

If one SYSTEM has multiple different SIZE values, retain one row per export record.

Verified example:

- `OAF-02 OA | 155x155`
- `OAF-02 OA | 155%%C`

becomes:

- `OAF-02 OA | 155x155 | 150 | -`
- `OAF-02 OA | 155Dia | 150 | -`

Do not concatenate these sizes and do not turn them into quantity notation.

### Reconciliation key

`SYSTEM` alone is not unique, and `(SYSTEM, SIZE)` may also repeat.

For deterministic comparison, treat the export as a **multiset of normalized connection records**. At minimum compare:

`(normalized SYSTEM, normalized SIZE)` + occurrence count.

A future Lisp-export unique block ID may provide a stronger stable key if it is added, but do not invent one.

## Initial vs update behavior

Do not apply the old `CLEAR TEMPLATE BEFORE FILL` rule to an existing live schedule.

- no live schedule: bootstrap from the read-only template, clear sample data rows only, then create one schedule row per export record;
- existing live schedule: compare current export multiset against the live schedule, generate the change report, then controlled-merge export-owned changes;
- preserve valid manual/enriched values when the export does not own those fields;
- do not clear or rebuild the whole schedule merely because a new export exists.

## Change-report requirements

A re-export run should report at least:

- added connection rows;
- connection rows missing from the new export;
- changed SYSTEM/SIZE records when deterministically matchable;
- count changes for repeated identical `(SYSTEM, SIZE)` records;
- rectangular/round connection changes;
- non-standard/manual LENGTH values preserved or conflicting with the 150 mm default;
- preserved manual/enriched NOTES values;
- any nonblank `EXTINSU` / `INTINSU` values whose mapping is not yet defined;
- conflicts requiring review.

Small changes edited manually in the live schedule without a new Lisp export produce no MTO run and no report; that is expected workflow.

## Formatting

Verified completed-project convention:

- rectangular size: `255x255`;
- diameter: `155Dia`;
- LENGTH: numeric only, e.g. `150`;
- missing NOTES: `-`;
- preserve template structure, headers, merges, formatting, and column order.

This schedule does **not** use the general prose preference of spaces around `x`; the actual completed-project convention takes precedence.

## Audit / report identity

This is a drawing-export run, so do not invent a dated `input_rev`.

Record at minimum:

- `rule_status = draft`;
- `source_model = drawing-export`;
- actual export path/filename;
- optional source hash;
- optional supplemental input revision, if used;
- run timestamp;
- connection changes/count changes/conflicts.

The human-readable report must visibly state `DRAFT / NOT FINAL`.

## Validation checklist

Before a run can be considered complete:

- the current flex-connection export was explicitly/canonically resolved;
- template/live schedule structure is preserved;
- export columns are recognized (`EQM`, `SIZE`, `EXTINSU`, `INTINSU`) or explicitly mapped by project override;
- one schedule row exists for each current export record unless explicit project evidence says otherwise;
- repeated identical export records retain multiplicity;
- same-system/different-size records remain separate;
- SYSTEM comes from `EQM` or another explicit source, not inference;
- `%%C` is normalized to `Dia` notation;
- rectangular size formatting matches verified no-space convention;
- new rows use current candidate LENGTH standard `150` unless explicitly overridden;
- roof/insulation NOTES are not inferred from naming heuristics;
- manual/enriched live values outside export ownership are preserved/reported;
- audit/report records current export path/hash and change summary;
- draft warning is visible.

## Promotion blockers

Keep this rule `draft` while additional implementation evidence is needed for:

1. whether a unique block/connection ID should be added to the export for stronger reconciliation;
2. whether the 150 mm LENGTH default is company-wide or project-specific;
3. exact meaning/value vocabulary of nonblank `EXTINSU` and `INTINSU`;
4. deterministic mapping from insulation attributes to NOTES, if any;
5. disappeared-row behavior;
6. compare/report/controlled-merge behavior across additional real update cycles with manual live edits;
7. deterministic resolver/harness behavior after the Lisp naming fix.

Draft status does not block use. Promote to `stable` only after enough real-project evidence exists to remove the mandatory warning.

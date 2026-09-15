# VAV SCHEDULE — DRAFT RULE

> **STATUS: DRAFT / NOT FINAL — REQUIRES REAL-PROJECT IMPLEMENTATION AND VALIDATION**
>
> Reconciled against the current `VAV Schedule.xlsx` template and supplied Ver 1.0 rule. Do not register VAV as operational until validated on real project inputs.

## Scope and authority

Process only explicitly selected/tagged VAV terminal units represented by the project selection. Exclude accessories, controllers sold separately, and unrelated air-terminal equipment.

Source priority: EQM Selection → exact selected-model technical data → DESIGN DRAWING reconciliation → approved project/common rules → `-`.

## Template contract

Visible fields, in order:

1. `REF. NO.`
2. `TYPE`
3. `MAKE - MODEL`
4. `AIR FLOW L/s`
5. `INLET SIZE`
6. `OUTLET SIZE`
7. `CAPACITY`
8. `OVERALL DIMENSIONS`
9. `WEIGHT`
10. `SYSTEM`

Template subheaders:

- airflow → `MIN / MAX`
- inlet size → `W x H mm`
- outlet size → `W x H mm`
- overall dimensions → `W x H x L mm`
- weight → `Kg`

## Field rules

### REF. NO.
Use selected project tag/equipment number. Do not infer system or identity purely from numbering pattern.

### TYPE
Use source-supported VAV type, e.g. modulating, pressure-independent, fan-powered, etc. Do not normalize beyond evidence.

### MAKE - MODEL
Use selected manufacturer + exact selected model. Preserve meaningful suffixes/options.

### AIR FLOW L/s
Schedule as `MIN / MAX` when both project-selected values are available.

Rules:

- first value = selected minimum airflow;
- second value = selected maximum airflow;
- do not substitute catalog minimum/maximum unless selection does not provide project duty and exact-model technical data clearly applies;
- if only one bound is supported, follow project rule or use `-` for the unresolved bound rather than inventing it.

### INLET SIZE
Selected unit inlet size in `W x H` mm. Reorder only from clearly labeled dimensions.

### OUTLET SIZE
Selected unit outlet size in `W x H` mm. Do not assume it equals inlet size.

### CAPACITY
Use the project/source-supported scheduled capacity. Current template has no unit subheader and sample values include `kW`, so preserve unit in-cell (e.g. `2.5kW`) unless project implementation establishes another convention.

Do not assume whether the value is cooling or heating capacity unless the source/project rule explicitly defines the scheduled semantic.

### OVERALL DIMENSIONS
Overall VAV dimensions in `W x H x L` mm. Reorder only from clearly labeled source dimensions.

### WEIGHT
Exact selected-model net weight in kg.

### SYSTEM
Use explicit project system reference from selection/drawing/project mapping. Do not derive `AC-1`, `AC-5`, etc. solely from the VAV tag numbering pattern.

## Formatting and update behavior

Preserve exact template schema/layout/merge structure/formatting. Missing → `-`. Human-readable dimensions use spaced `x`; workbook formatting follows project/template convention.

Do not apply the old blanket `CLEAR TEMPLATE BEFORE FILL` behavior to an existing live schedule:

- first run: bootstrap live copy and remove sample rows from the copy;
- later revisions: update by tag, add new rows, preserve/flag disappeared rows;
- original template remains read-only.

## Validation / promotion blockers

- MIN/MAX airflow mapping validated from real project selection;
- capacity semantic and in-cell unit convention confirmed;
- system mapping validated against drawing/selection rather than tag pattern;
- inlet/outlet/overall dimension order confirmed;
- at least one real project validates live update, audit, and report behavior.

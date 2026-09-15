# EVAPORATIVE COOLER SCHEDULE — DRAFT RULE

> **STATUS: DRAFT / NOT FINAL — REQUIRES REAL-PROJECT IMPLEMENTATION AND VALIDATION**
>
> Reconciled against the current `Evaporative Cooler Schedule.xlsx` template and supplied Ver 1.0 rule. Do not register as operational until validated on real project data.

## Scope and authority

Process only explicitly selected/tagged evaporative coolers. Exclude accessories and unselected catalog variants.

Source priority: EQM Selection → exact selected-model technical data → DESIGN DRAWING reconciliation → approved project/common rules → `-`.

## Template contract

Visible fields, in order:

1. `REF. NO.`
2. `MAKE`
3. `MODEL`
4. `TYPE`
5. `S/A`
6. `Pa`
7. `SATURATION`
8. `POWER`
9. `DIMENSIONS`
10. `WEIGHT`
11. `ISOLATION`

Template subheaders/sample indicate:

- `S/A` → `L/s`;
- `SATURATION` → `EFFECIENCY` (template spelling) with sample values `0.8`;
- dimensions → `HxWxD`;
- weight → `Kg`.

### Known saturation representation ambiguity

The supplied Ver 1.0 rule describes saturation efficiency as `%` and sample output as `80%`, but the workbook sample stores `0.8`. Treat this as unresolved representation semantics until real project implementation confirms whether the live schedule expects a fraction (0–1) or percent (0–100 / `%`). Do not silently convert without evidence.

## Field rules

### REF. NO.
Use selected project tag/equipment number.

### MAKE / MODEL
Use selected manufacturer and exact selected model.

### TYPE
Use source-supported equipment type; do not infer beyond evidence.

### S/A
Selected/rated supply-air flow in L/s. Prefer project-selected duty; do not substitute maximum airflow.

### Pa
Selected/rated static pressure in Pa applicable to the scheduled duty.

### SATURATION
Saturation efficiency applicable to the selected/rated duty. Preserve the representation required by the live template/project rule. If source gives `80%` while the workbook expects `0.8`, convert only when project implementation confirms that convention. Otherwise flag review.

### POWER
Electrical supply such as `3PH / 415V / 50Hz` when explicitly supported. Do not substitute input kW for supply format unless project schema explicitly requires it.

### DIMENSIONS
Overall equipment dimensions in `H x W x D` order according to current template. Reorder only from clearly labeled source dimensions.

### WEIGHT
Exact selected-model net weight in kg.

### ISOLATION
**Provisional.** Prefer explicit project/selection/drawing requirement. `WAFFLE PAD` is an example/current provisional default, not a universal rule until validated on real installation cases.

## Formatting and update behavior

Preserve exact template schema/layout/merge structure/formatting. Missing → `-`. First run bootstraps a live copy and removes sample rows from the copy; later revisions update by tag rather than wiping the workbook. Original template stays read-only.

## Validation / promotion blockers

- saturation fraction-vs-percent convention confirmed;
- pressure and airflow semantics validated at real duty point;
- dimensions orientation verified;
- isolation logic validated;
- at least one real project confirms live-update and report/audit behavior.

# ERV-HRV SCHEDULE — DRAFT RULE

> **STATUS: DRAFT / NOT FINAL — RUNNABLE WITH CAREFUL REVIEW**
>
> Reconciled against the current `ERV-HRV Schedule.xlsx` template and supplied Ver 1.0 rule. This rule is registered as `draft` and may be used on real projects. GPT must warn that the result needs careful review, and findings from each implementation should be fed back into this rule.

## Scope and authority

Process only explicitly selected/tagged ERV/HRV/heat-reclaim ventilator equipment. Exclude loose accessories and unselected catalog variants.

Source priority: EQM Selection → exact selected-model technical data → DESIGN DRAWING reconciliation → approved project/common rules → `-`.

## Template contract

Visible fields, in order:

1. `REF. NO.`
2. `MAKE`
3. `MODEL`
4. `TYPE`
5. `S/A`
6. `Pa`
7. `POWER`
8. `DIMENSIONS`
9. `WEIGHT`
10. `ANTI-VIBRATION`

Template subheaders show:

- `S/A` → `L/s`
- dimensions → `HxWxD`
- weight → `Kg`

The `Pa` header is treated as static/external pressure only when project/selection/technical evidence supports that semantic.

## Field rules

### REF. NO.
Use selected project tag/equipment number.

### MAKE / MODEL
Use selected manufacturer and exact selected model.

### TYPE
Use source-supported equipment type such as heat reclaim ventilator / ERV / HRV. Do not normalize beyond evidence.

### S/A
Selected/rated supply-air flow in L/s. Prefer project-selected duty. Do not substitute maximum airflow unless explicitly selected.

### Pa
Selected/rated static/external pressure in Pa applicable to the scheduled duty. Do not use fan maximum pressure or unrelated pressure data.

### POWER
Electrical supply, e.g. `1PH / 240V / 50Hz`, when explicitly supported. Do not substitute motor/input kW for supply format unless project schema changes.

### DIMENSIONS
Overall equipment dimensions in `H x W x D` order, as defined by current template. Reorder only from clearly labeled source dimensions. Human-readable report uses spaced form.

### WEIGHT
Exact selected-model net weight in kg.

### ANTI-VIBRATION
**Provisional.** Prefer explicit project/selection/drawing requirement. `SPRING / RUBBER` is an example/sample, not a universal default. If no supported isolation requirement exists, use `-` or raise review according to project rules.

## Formatting and update behavior

Preserve exact template schema/layout/merge structure/formatting. Missing → `-`. First run bootstraps a live copy and removes sample rows from the copy; later revisions update live rows by tag and do not wipe the workbook. Original template stays read-only.

## Validation / promotion blockers

- pressure semantic confirmed on real ERV/HRV selection;
- dimensions order confirmed against manufacturer source;
- anti-vibration logic validated by real installation evidence;
- exact-model flow/power/weight and live-update behavior tested on real projects.

This rule stays `draft` until enough implementation evidence exists to remove the warning. Draft status does not block use; it requires explicit warning and careful review.

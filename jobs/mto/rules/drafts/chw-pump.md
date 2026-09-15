# CHILLED WATER PUMP SCHEDULE — DRAFT RULE

> **STATUS: DRAFT / NOT FINAL — RUNNABLE WITH CAREFUL REVIEW**
>
> Reconciled against the current `CHW Pump Schedule.xlsx` template and the supplied Ver 1.0 rule. This rule is registered as `draft` and may be used on real projects. GPT must warn that the result needs careful review, and findings from each implementation should be fed back into this rule.

## Scope and authority

Process only explicitly selected/tagged CHW pumps. Exclude loose accessories, valves, pipework, unrelated hydronic equipment, and unselected catalog models.

Source priority: EQM Selection → exact selected-model technical data → DESIGN DRAWING reconciliation → approved project/common rules → `-`.

Selection values must not be silently overwritten by catalog values. Material conflicts must be surfaced.

## Current template contract

Visible columns, in order:

1. `REF. NO.`
2. `MAKE / MODEL`
3. `TYPE`
4. `FLOW`
5. `HEAD`
6. `RPM`
7. `MOTOR`
8. `PUMP`
9. `MAX`
10. `POWER`
11. `WEIGHT`
12. `ISOLATION`

Known defects/contamination in the current template:

- sample rows were copied from an Air Compressor schedule and are not pump evidence;
- `FLOW` subheader `L/s` is accepted;
- `HEAD` subheader `M` is accepted as metres of head;
- `RPM` currently shows `bar / psi`, which conflicts with RPM semantics;
- `MOTOR` shows `Kw`, interpreted as motor kW;
- `PUMP` shows `EFF (%)`, interpreted as pump efficiency;
- `MAX` shows `IMP`, whose meaning is unresolved;
- `WEIGHT` shows `Kg`.

Preserve workbook structure. Do not copy contaminated sample semantics into real output.

## Field rules

### REF. NO.
Use project tag/equipment number from selection. Drawing identity requires explicit mapping or unambiguous evidence. Unknown mapping → `UNMATCHED`.

### MAKE / MODEL
Use selected manufacturer + exact selected model. Preserve meaningful suffixes/options. Never substitute a neighboring model.

### TYPE
Use source-supported pump type. Do not normalize to a pump taxonomy unless evidence supports it.

### FLOW
Selected/rated duty flow in `L/s`. Prefer project-selected duty. Do not use catalog maximum flow as a substitute.

### HEAD
Selected/rated duty head in metres. Do not use shut-off/max head as selected duty head.

### RPM
Rotational speed in `rpm`. The current `bar / psi` unit row is a template defect. Use selected/rated speed; never put pressure into this field merely to match the bad unit row.

### MOTOR
Selected/rated motor power in `kW`. Do not confuse motor kW with electrical supply or absorbed/input power unless project semantics explicitly say so.

### PUMP
Pump efficiency at the selected/rated duty point, `%`. Do not substitute BEP efficiency unless BEP is the selected duty or project rule requires it. No derived efficiency unless an approved rule later permits it.

### MAX
Current subheader `IMP` is **UNRESOLVED / TBC**. Do not map maximum pressure, dimensions, or impeller diameter by guesswork. Use `-` unless real project evidence/project rule establishes the intended meaning; raise it in report/RFI.

### POWER
Electrical supply, separate from motor kW. Normalize only supported values, e.g. `3PH / 415V / 50Hz`.

### WEIGHT
Exact selected-model net equipment weight in kg. Do not silently use shipping/gross weight.

### ISOLATION
**Provisional.** Use explicit project/selection/drawing isolation when available. `WAFFLE PAD` may be treated only as the current provisional default when no stronger evidence exists; if mounting/type makes it doubtful, raise review instead of forcing it.

## Formatting

Preserve template columns/layout/merge structure/formatting. Missing → `-`. Use numeric-only values where the template already carries the unit. Do not add a dimensions rule: the current CHW Pump template has no dedicated dimensions column.

## Live schedule behavior

Do not apply the old `CLEAR TEMPLATE BEFORE FILL` rule to every run.

- first run: bootstrap a live copy, remove contaminated sample rows from the copy, then populate;
- later revisions: update live rows by tag, add new rows, preserve/flag disappeared rows, and do not wipe the workbook;
- original template remains read-only.

## Validation / promotion blockers

- exact column order preserved;
- contaminated Air Compressor samples not treated as pump data;
- FLOW/HEAD/RPM/MOTOR/PUMP semantics follow this rule;
- `MAX / IMP` remains unresolved unless real evidence defines it;
- isolation default validated against real mounting cases;
- conflicts/TBC/template defects appear in audit/report.

This rule stays `draft` until enough real CHW Pump implementations validate the unresolved semantics and update behavior. Draft status does not block use; it requires explicit warning and careful review.

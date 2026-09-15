# CHILLER EQUIPMENT SCHEDULE — DRAFT RULE

> **STATUS: DRAFT / NOT FINAL — RUNNABLE WITH CAREFUL REVIEW**
>
> Reconciled against the current `Chiller Equipment Schedule.xlsx` template and the supplied Ver 1.0 rule. This rule is registered as `draft` and may be used on real projects. GPT must warn that the result needs careful review, and findings from each implementation should be fed back into this rule.

## Scope and authority

Process only explicitly selected/tagged chillers or reversible air-to-water heat-pump chillers represented by the project selection. Exclude accessories and unselected catalog variants.

Source priority: EQM Selection → exact selected-model technical data → DESIGN DRAWING reconciliation → approved project/common rules → `-`.

Selection values must not be silently overwritten by catalog data.

## Template contract

Visible fields, in order:

1. `REF. NO.`
2. `MAKE`
3. `MODEL`
4. `TYPE`
5. `NOMINAL COOLING`
6. `NOMINAL HEATING`
7. `EVAPORATOR FLOW RATE`
8. `EVAPORATOR INLET DIA`
9. `EVAPORATOR OUTLET DIA`
10. `CONDENSER FLOW RATE`
11. `CONDENSER INLET DIA`
12. `CONDENSER OUTLET DIA`
13. `SOUND LEVEL`
14. `EQUIPMENT`
15. `WEIGHT`
16. `ANTI-VIBRATION`

Template units/subheaders:

- nominal cooling/heating → kW;
- evaporator/condenser flow → L/s;
- pipe diameters → mm;
- sound level → dB(A);
- equipment dimensions → `WxHxD mm`;
- weight → kg.

## Field rules

### REF. NO.
Use selected tag/equipment number.

### MAKE / MODEL
Use selected manufacturer and exact selected model. Preserve meaningful suffixes/options.

### TYPE
Use source-supported chiller type, e.g. reversible air-to-water heat pump, air-cooled chiller, water-cooled chiller, etc. Do not normalize beyond evidence.

### NOMINAL COOLING / NOMINAL HEATING
Use project-selected nominal/rated capacities in kW. If the selected equipment has no heating function, use `-` unless the project/template explicitly requires another representation.

Do not use maximum or peak capacity unless the project selection explicitly identifies it as the schedule value.

### EVAPORATOR / CONDENSER FLOW RATE
Use project-selected/rated design flow for the corresponding circuit in L/s.

Do not swap evaporator and condenser values. For air-cooled equipment with no water condenser circuit, condenser-water fields remain `-` unless the project uses those columns for another explicitly defined circuit.

### EVAPORATOR / CONDENSER INLET/OUTLET DIA
Use source-supported connection/pipe connection diameter in mm for the correct circuit and inlet/outlet.

Do not infer from nominal pipe size naming unless conversion to the template convention is deterministic and explicitly allowed.

### SOUND LEVEL
Use the sound metric explicitly required by the selection/template/project rule. The template label alone does not distinguish sound power from sound pressure; do not silently substitute one for the other. If source metric is ambiguous or incompatible, flag review and use `-`.

### EQUIPMENT
Overall dimensions in `W x H x D` order, mm. Reorder only when source labels dimensions sufficiently. Human-readable reports should display spaced form such as `2220 x 1070 x 1320`.

### WEIGHT
Exact selected-model net equipment weight in kg. Do not silently substitute operating/shipping weight.

### ANTI-VIBRATION
**Provisional.** Prefer explicit project/selection/drawing requirement. `WAFFLE PAD` may be used only as a provisional default where no stronger evidence exists and mounting/type does not make that assumption doubtful. Raise review when uncertain.

## Formatting

Preserve exact template schema/layout/merge structure/formatting. Missing → `-`. Do not apply the old blanket `CLEAR TEMPLATE BEFORE FILL` behavior to existing live schedules.

## Live schedule behavior

- first run: bootstrap live copy, remove sample rows from the copy, populate selected equipment;
- later revisions: update by tag, add new rows, preserve/flag disappeared rows;
- original template remains read-only.

## Validation / promotion blockers

- cooling/heating semantics verified against real selection;
- evaporator vs condenser fields confirmed for real chiller types;
- sound metric semantics validated;
- anti-vibration default validated against real installation requirements;
- exact-model dimensions/weight and live-update behavior tested on real projects.

This rule stays `draft` until enough implementation evidence exists to remove the warning. Draft status does not block use; it requires explicit warning and careful review.

# Equipment Rule — AC

## Scope

Use for the project `ac` input folder and `AC Equipment Schedule.xlsx` only.

Typical in-scope selected equipment:

- AC indoor units / FCU;
- AHU when the project AC schedule contains it;
- outdoor / condensing units;
- branch box / branch controller.

Do not add unrelated HRV/ERV/VAM, fans, roof cowls, remote controllers, pipe kits, loose accessories, or other equipment unless the project schedule/rule explicitly includes them.

## Type normalization

Apply only when the source supports the type and normalization is needed:

- ducted FCU / ducted indoor -> `DUCTED UNIT`
- cassette -> `CASSETTE`
- wall mounted -> `WALL MOUNTED UNIT`
- floor standing -> `FLOOR STANDING`
- AHU -> project/template-approved AHU type
- branch box/controller -> `BRANCH BOX`
- outdoor/CU -> `CONDENSING UNIT`

Do not infer type solely from model naming when authoritative source/context is absent.

## Field rules

Apply only to fields present in the actual schedule template.

### REF. NO.

- Primary: project selection tag/ref.
- Drawing may supplement only when selection does not establish the tag and mapping is explicit.

### MAKE

1. project selection make when supplied;
2. exact selected-model manufacturer technical source;
3. unresolved marker.

### MODEL

- Use the exact selected model from EQM selection.
- Never substitute another catalog model or a neighboring family variant.

### TOTAL COOLING

1. project-specific selected value;
2. exact-model rated/nominal technical value when selection lacks it;
3. unresolved marker.

Do not use maximum capacity unless explicitly requested/selected.

### SENSIBLE COOLING

Use the same authority logic as Total Cooling.

### ENTERING AIR

- Prefer project-specific return/entering-air condition.
- Generic catalog test conditions must not be presented as selected project conditions unless the source/project rule clearly establishes that equivalence.

### SUPPLY AIR

If the schedule unit is `L/s`, treat this field as airflow.

1. project selected airflow;
2. exact-model rated/nominal airflow when selection is silent and project rule allows catalog supplementation;
3. unresolved marker.

### OUTSIDE AIR

Use only explicitly supplied fresh/outside-air quantity. Do not calculate or infer it from total airflow without an explicit project rule.

### POWER

Interpret the template semantics before filling.

If the column expects electrical supply (`PH / V / Hz`), write supply data, not motor/input kW.

Default representation where applicable:

`XPH / YYYV / 50Hz`

Do not infer phase/frequency unless project rules explicitly permit it.

### MCA

Use Minimum Circuit Ampacity only. Do not substitute FLA/FLC or another current value. If unavailable, unresolved marker.

### PIPE SIZES

Follow template/project definition. When the schedule requires refrigerant liquid/gas sizes, preferred format is:

`LIQUID / GAS`

Example: `9.52 / 15.88`

Do not substitute service-valve or high/low-pressure dimensions unless the source explicitly identifies them as the required connection sizes.

### EQUIPMENT / DIMENSIONS

When the template uses `EQUIPMENT` as a dimensions field, write:

`W x H x D`

Do not write equipment class labels such as `FCU`, `AHU`, or `CU` into a dimension column.

Dimension order must be supported by source labels; do not guess unlabeled order.

### WEIGHT

Use exact selected-model net weight unless the template/project explicitly requests another weight basis.

### SAFETY TRAY

Apply only when project/common rules permit derivation.

Default base rule:

- `DUCTED UNIT` -> applicable
- `BRANCH BOX` -> applicable
- other AC types -> `-`

When applicable and equipment dimensions are authoritative:

- W = equipment width + 150 mm
- H = 50 mm
- D = equipment depth + 150 mm

Output: `W x H x D`.

A project `qto-rules/ac.md` may override/disable this derivation.

### ANTI-VIBRATION

Default base rule:

- `DUCTED UNIT` -> `SPRING / RUBBER`
- `CASSETTE` -> `SPRING / RUBBER`
- `FLOOR STANDING` -> `SPRING / RUBBER`
- `BRANCH BOX` -> `SPRING / RUBBER`
- `CONDENSING UNIT` -> `WAFFLE PAD`
- `WALL MOUNTED UNIT` -> `-`

Project rules may override this mapping.

## AC validation

Before completion verify:

- every schedule row is traceable to selected project equipment or an explicitly approved reconciliation source;
- selected model is exact;
- no unselected catalog model was added;
- project-specific cooling/airflow/electrical values were not overwritten by generic catalog values;
- rated/nominal values were preferred over maxima when catalog supplementation was necessary;
- POWER, MCA, pipe-size, dimension, weight semantics match the actual template;
- safety-tray and anti-vibration logic was applied only under allowed rules;
- missing/conflict/unmatched evidence is visible in audit.

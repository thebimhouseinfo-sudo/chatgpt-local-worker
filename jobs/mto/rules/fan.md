# Equipment Rule — Fan

## Scope

Use for the project `fan` input folder and `Fan Equipment Schedule.xlsx` only.

Typical in-scope selected equipment:

- inline fan;
- mixed-flow fan;
- centrifugal fan;
- axial fan;
- exhaust fan;
- supply fan;
- roof-mounted fan;
- other fan equipment explicitly present in Fan selection.

A roof cowl/relief device may be included only when it is explicitly selected/tagged in the project source/drawing and the Fan schedule is intended to contain it. Do not add loose accessories.

## Field rules

Apply only to fields present in the actual schedule template.

### REF. NO.

Use project selection tag/ref. Drawing may only supplement through explicit reconciliation/mapping.

### MAKE

1. project selection make when supplied;
2. exact selected-model technical source;
3. unresolved marker.

### MODEL

Use the exact selected model. Never substitute another catalog model.

### TYPE

Use project/source-supported fan type. Examples may include:

- `MIXED FLOW INLINE`
- `CENTRIFUGAL`
- `AXIAL`
- `IN LINE EXHAUST AIR FAN`
- `ROOF MOUNTED CENTRIFUGAL`

Normalize only when the project/template expects normalized wording and the underlying type is supported by evidence.

### AIRFLOW

1. project selected airflow;
2. exact-model rated/nominal airflow when selection is silent and catalog supplementation is appropriate;
3. unresolved marker.

Convert units only when conversion is deterministic. Do not use a catalog maximum when a selected duty value exists.

### STATIC PRESSURE

1. project selected static pressure;
2. exact-model rated/nominal static pressure when appropriate;
3. unresolved marker.

Do not infer a design pressure from a performance range without explicit selected duty evidence.

### RPM

Use selected/rated fan speed. Do not use maximum speed unless explicitly selected.

For non-rotating roof cowl/relief devices, use `-` where RPM is not applicable.

### POWER

Interpret template semantics first.

If POWER means electrical supply, use:

`XPH / YYYV / 50Hz`

Do not put motor kW into a PH/V/Hz column.

If a distinct motor/input power column exists, use the exact selected/rated value appropriate to that column.

### FLC / START

Use only supplied full-load current and starting current values for their matching columns. Do not derive one from another unless an explicit project rule permits it.

If unavailable, unresolved marker.

For non-powered roof cowl/relief devices, use `-` where not applicable.

### DIMENSIONS

Only fill when the schedule has a dimension field.

Format: `W x H x D` when the source identifies those dimensions. Do not guess unlabeled order.

### WEIGHT

Use exact selected-model net weight unless project/template specifies another basis.

### ANTI-VIBRATION

Default base logic:

- suspended fan -> `SPRING / RUBBER`
- ceiling/wall/roof mounted -> `-`

Mounting condition must be supported by selection, drawing, or explicit project rule. Do not infer mounting solely from fan category/model name.

A project `qto-rules/fan.md` may override the default mapping.

## Fan validation

Before completion verify:

- every output row is traceable to project selection or an explicitly approved drawing source;
- selected model is exact;
- no unselected catalog model/accessory was added;
- selection airflow/static-pressure values were not overwritten by generic catalog maxima;
- RPM uses selected/rated speed, not maximum by default;
- electrical supply semantics are not confused with motor kW;
- FLC/START values are not guessed;
- dimensions/weight are exact-model data;
- anti-vibration is supported by mounting evidence/rules;
- missing/conflict/unmatched evidence is visible in audit.

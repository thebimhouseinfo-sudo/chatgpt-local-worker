# ATTENUATOR SCHEDULE — DRAFT RULE

> **STATUS: DRAFT / NOT FINAL — RUNNABLE WITH CAREFUL REVIEW**
>
> Reconciled against the current `Attenuator Schedule.xlsx` template and the supplied Ver 1.0 rule. This rule is registered as `draft` and may be used on real projects. GPT must warn that the result needs careful review, and findings from each implementation should be fed back into this rule.

## Scope and authority

Process only explicitly selected/tagged duct attenuators/silencers. Exclude unrelated duct accessories and unselected catalog variants.

Source priority: EQM Selection → exact selected-model technical data → DESIGN DRAWING reconciliation → approved project/common rules → `-`.

## Template contract

Visible fields, in order:

1. `REF. NO.`
2. `MAKE`
3. `MODEL`
4. `SIZE`
5. `AIR QTY`
6. `PRESSURE LOSS`
7. `63HZ`
8. `125HZ`
9. `250HZ`
10. `500HZ`
11. `1K HZ`
12. `2K HZ`
13. `4K HZ`
14. `8K HZ`
15. `WEIGHT`
16. `JOINTS`

The template groups the eight frequency columns under `INSERTION LOSS (dB)`.

Units/subheaders:

- `SIZE` → `WxHxL`
- `AIR QTY` → `L/s`
- `PRESSURE LOSS` → `Pa`
- insertion loss bands → dB
- `WEIGHT` → `Kg`

## Field rules

### REF. NO.
Use selected equipment/tag reference. Do not infer from neighboring tags.

### MAKE / MODEL
Use selected manufacturer and exact selected model. Preserve meaningful model suffixes.

### SIZE
Overall attenuator size in `W x H x L` order, mm. Reorder only when source explicitly labels dimensions well enough to do so. If orientation/order is ambiguous, preserve evidence or raise review rather than guessing.

### AIR QTY
Selected/rated airflow in L/s. Prefer project duty airflow. Deterministic unit conversion may be used only when an approved common/project rule permits it and the source unit/value is unambiguous.

### PRESSURE LOSS
Pressure loss in Pa at the selected/rated duty airflow. Do not copy airflow values into this field merely because a sample row has the same number. Use only source-supported pressure-drop data applicable to the selected attenuator/duty.

### INSERTION LOSS — 63/125/250/500 Hz, 1/2/4/8 kHz
Fill each band from exact selected-model insertion-loss data applicable to the selected attenuator size/configuration. Missing band → `-`.

Do not:

- shift values between bands;
- substitute sound-power/sound-level data for insertion loss;
- use a nearby size/model curve without explicit equivalence evidence.

### WEIGHT
Exact selected-model net weight in kg. Do not substitute gross/shipping weight silently.

### JOINTS
Use explicit connection/joint type and size when supported, e.g. `40mm ANGLE IRON`. Do not impose `40mm ANGLE IRON` as a universal default solely because it appears in the template sample.

## Formatting

Preserve template order/layout/merge structure/formatting. Missing → `-`. Descriptive text uppercase except unit notation. Dimensions use spaced `W x H x L` presentation in human-readable output; workbook formatting should follow the project/template convention without changing schema.

## Live schedule behavior

Follow common MTO update semantics, not the old blanket `CLEAR TEMPLATE BEFORE FILL` rule:

- first run: bootstrap live copy, remove sample data rows from the copy, populate selected rows;
- later revisions: update by tag, add new rows, preserve/flag disappeared rows;
- original template remains read-only.

## Validation / promotion blockers

- all eight insertion-loss bands map to the correct frequencies;
- pressure loss is validated at the relevant airflow/duty;
- size orientation is evidence-based;
- joint type/size is source-supported rather than sample-derived;
- real takeoffs confirm exact-model acoustic data and live-update behavior.

This rule stays `draft` until enough implementation evidence exists to remove the warning. Draft status does not block use; it requires explicit warning and careful review.

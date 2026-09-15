# FUME CUPBOARD SCHEDULE — DRAFT RULE

> **STATUS: DRAFT / NOT FINAL — REQUIRES REAL-PROJECT IMPLEMENTATION AND VALIDATION**
>
> Reconciled against the current `FUME CUPBOARD Schedule.xlsx` template and supplied Ver 1.0 rule. Do not register as operational until validated on real project data.

## Scope and authority

Process only explicitly selected/tagged fume cupboards represented by the project selection. Exclude loose accessories and unrelated laboratory equipment.

Source priority: EQM Selection → exact selected-model technical data → DESIGN DRAWING reconciliation → approved project/common rules → `-`.

## Template contract

The Ver 1.0 rule described one `AIR FLOW (L/s)` value, but the actual workbook uses a **grouped airflow section with three sub-columns**.

Logical template structure:

1. `REF. NO.`
2. `MAKE / MODEL`
3. `AIR FLOW (L/s)` — grouped parent
   - `50mm`
   - `250mm`
   - `620mm`
4. `CONNECTION`
5. `POWER`
6. `OVERALL DIMENSIONS`

The workbook also contains the note `(FC WITH SYCROFLOW VAV SYSTEM)` above the three airflow sub-columns.

The three `50mm / 250mm / 620mm` labels appear to represent operating/opening conditions for the airflow values, but this exact engineering interpretation must be confirmed during real implementation. Do not collapse them to one airflow value.

## Field rules

### REF. NO.
Use selected project tag/equipment number.

### MAKE / MODEL
Use selected manufacturer and exact selected model/designation.

### AIR FLOW — 50mm / 250mm / 620mm
Extract the three airflow values independently for the corresponding template conditions. Unit: L/s.

Do not:

- put one airflow value into all three sub-columns;
- shift values between opening/condition columns;
- invent missing values from ratios or neighboring models;
- collapse the grouped section into a single field.

If the source does not identify which airflow belongs to which condition, use `-` for unresolved values and raise review/RFI.

### CONNECTION
Use explicit connection detail/diameter/type for the selected fume cupboard. Preserve source-supported notation, normalized only by project convention. Sample `315Dia` is not a universal default.

### POWER
Use the schedule-required electrical/power descriptor exactly as supported by selection/source. The sample `1.5kW / 3PH` shows that this template may combine power rating and phase rather than the normal MTO supply-only format; confirm this semantic during implementation and do not force another equipment's power convention onto this schedule.

### OVERALL DIMENSIONS
Overall dimensions in `W x H x D` order, mm, according to supplied rule/template intent. Reorder only from clearly labeled source dimensions. Human-readable output uses spaced form such as `1500 x 2400 x 1000`.

## Formatting and update behavior

Preserve grouped headers, sub-columns, template layout/merge structure/formatting. Missing → `-`. Do not apply old blanket `CLEAR TEMPLATE BEFORE FILL` behavior to an existing live schedule.

- first run: bootstrap live copy and remove sample row(s) from the copy;
- later revisions: update by tag, add new rows, preserve/flag disappeared rows;
- original template remains read-only.

## Validation / promotion blockers

- real project confirms the meaning of the `50mm / 250mm / 620mm` airflow conditions;
- all three airflow fields are independently sourced/mapped;
- POWER semantics are confirmed for the actual project schedule;
- connection and dimension formats are validated;
- live update + report/audit behavior tested on at least one real project.

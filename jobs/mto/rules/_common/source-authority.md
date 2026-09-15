# Common Rule — Source Authority

## Authority order

1. Schedule template = schema authority.
2. EQM selection = project selection/value authority.
3. Detailed technical data/catalog = supplement authority for exact selected model only.
4. Design drawing = reconciliation/context evidence.
5. Project/base rules = permitted normalization/derivation.

## Mandatory behavior

- Build project equipment rows from selection, not catalog.
- Preserve explicit selection values.
- Use catalog only to fill fields not supplied by selection.
- Never use a neighboring model as a substitute.
- Never use a family-wide value unless the source explicitly applies it to the selected model.
- Prefer project-specific/rated/nominal duty over generic maximum values unless the project explicitly selects maximum.
- Do not let drawing silently replace an explicit selected model.
- Do not invent model, quantity, capacity, electrical data, dimensions, pipe sizes, current, pressure, weight, or other engineering values.

## Detailed-source conflict order

When detailed technical sources conflict and selection does not already control the field, prefer:

1. exact-model project-specific datasheet;
2. exact-model manufacturer technical data;
3. current exact-model dimensional/electrical sheet;
4. generic family catalog only when clearly applicable to the selected model.

If no defensible authoritative choice remains, leave the field unresolved according to template/project missing-data convention and record the conflict in audit.

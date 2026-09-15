# Common Rule — Template & Formatting

## Template is immutable schema

The matching workbook in `01 WIP/SCHEDULE/*.xlsx` controls:

- sheet structure and names;
- column names/order/count;
- unit rows;
- formatting, borders, fonts, row heights, column widths;
- existing merge structure;
- data-row layout.

Normal MTO execution must not add/remove/rename/reorder columns, add notes/comments/sheets, or create new merges.

If more rows are needed, extend by copying existing data-row formatting only.

## Formatting defaults

Apply only when the template/project rule does not already dictate another representation.

- Descriptive text: uppercase.
- Preserve unit case such as `mm`, `Hz`, `kW`, `L/s`, `Pa`, `dB`.
- Dimensions: `W x H x D` only when source identifies dimension order. Example `1,200 x 300 x 500`.
- If source explicitly gives another labeled order such as `H x W x D`, reorder deterministically to template order.
- Power supply when the column expects supply semantics: `XPH / YYYV / 50Hz`.
- If the template already defines a unit in the header/unit row, enter the value without duplicating the unit unless project rule says otherwise.

## Missing values

Default unsupported marker is `-` when the schedule expects a value and no authoritative value exists. Use `TBC` only when the template/project rule explicitly uses `TBC` semantics.

Do not leave required data cells blank merely to hide missing evidence.

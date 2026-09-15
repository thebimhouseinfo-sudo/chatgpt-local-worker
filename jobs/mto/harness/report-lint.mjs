import fs from "node:fs/promises";
import path from "node:path";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const fileArg = arg("--file");
const errors = [];
const warnings = [];

if (!fileArg) {
  errors.push("missing --file <takeoff-report.md>");
}

let text = "";
let file = null;
if (fileArg) {
  file = path.resolve(fileArg);
  try {
    text = await fs.readFile(file, "utf8");
  } catch (error) {
    errors.push(`cannot read report: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const requiredHeadings = [
  "## RUN SUMMARY",
  "## EQUIPMENT SCHEDULE",
  "## CHANGE SUMMARY",
  "## TRACEABILITY & DATA SOURCE",
  "## DRAWING RECONCILIATION",
  "## CONFLICTS / TBC / REVIEW ITEMS",
  "## QUERY LIST (RFI)"
];

for (const heading of requiredHeadings) {
  if (text && !text.includes(heading)) errors.push(`missing required heading '${heading}'`);
}

if (text && !/^#\s+MTO TAKEOFF REPORT\b/im.test(text)) {
  errors.push("report must start with an MTO TAKEOFF REPORT title");
}

const unresolvedPlaceholders = [...text.matchAll(/\{\{[A-Z0-9_ -]+\}\}/g)].map((m) => m[0]);
if (unresolvedPlaceholders.length) {
  errors.push(`unresolved template placeholders: ${[...new Set(unresolvedPlaceholders)].join(", ")}`);
}

if (text && !/^\s*-\s+Input Revision:\s*\S/m.test(text)) {
  errors.push("RUN SUMMARY must include Input Revision");
}

if (text && !/^\s*-\s+Run Timestamp:\s*\S/m.test(text)) {
  errors.push("RUN SUMMARY must include Run Timestamp");
}

if (text && !/\|[^\n]+\|/.test(text.split("## CHANGE SUMMARY")[0] || "")) {
  warnings.push("EQUIPMENT SCHEDULE does not appear to contain a Markdown table");
}

const result = {
  ok: errors.length === 0,
  file,
  required_headings: requiredHeadings,
  warnings,
  errors
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;

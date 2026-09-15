import fs from "node:fs/promises";
import path from "node:path";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function validRevision(value) {
  if (typeof value !== "string") return false;
  const m = /^(\d{4}) (\d{2}) (\d{2})$/.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

const fileArg = arg("--file");
const errors = [];
let auditFile = null;
let data = null;

if (!fileArg) {
  errors.push("missing --file <audit-json>");
} else {
  auditFile = path.resolve(fileArg);
  try {
    data = JSON.parse(await fs.readFile(auditFile, "utf8"));
  } catch (error) {
    errors.push(`cannot read/parse audit JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (data !== null) {
  if (!Array.isArray(data)) {
    errors.push("audit root must be a JSON array of run records");
  } else {
    for (let i = 0; i < data.length; i += 1) {
      const run = data[i];
      const p = `run[${i}]`;
      if (!run || typeof run !== "object" || Array.isArray(run)) {
        errors.push(`${p} must be an object`);
        continue;
      }

      const sourceModel = run.source_model || (run.input_rev ? "selection" : null);
      if (sourceModel && !["selection", "drawing-export"].includes(sourceModel)) {
        errors.push(`${p}.source_model must be 'selection' or 'drawing-export'`);
      }

      if (run.rule_status !== undefined && !["stable", "draft"].includes(run.rule_status)) {
        errors.push(`${p}.rule_status must be 'stable' or 'draft' when present`);
      }

      if (sourceModel === "drawing-export") {
        if (typeof run.drawing_export_source !== "string" || !run.drawing_export_source.trim()) {
          errors.push(`${p}.drawing_export_source is required for drawing-export runs`);
        }
        if (run.supplement_input_rev !== undefined && run.supplement_input_rev !== null && !validRevision(run.supplement_input_rev)) {
          errors.push(`${p}.supplement_input_rev must be valid YYYY MM DD when present`);
        }
      } else {
        if (!validRevision(run.input_rev)) errors.push(`${p}.input_rev must be valid YYYY MM DD for selection-driven runs`);
      }

      if (typeof run.run_timestamp !== "string" || Number.isNaN(Date.parse(run.run_timestamp))) {
        errors.push(`${p}.run_timestamp must be an ISO-like parseable timestamp`);
      }

      for (const key of ["changes", "tbc", "conflicts", "unmatched_drawing_vs_selection"]) {
        if (!Array.isArray(run[key])) errors.push(`${p}.${key} must be an array`);
      }

      if (Array.isArray(run.changes)) {
        for (let j = 0; j < run.changes.length; j += 1) {
          const change = run.changes[j];
          if (!change || typeof change !== "object" || Array.isArray(change)) {
            errors.push(`${p}.changes[${j}] must be an object`);
            continue;
          }
          const identity = [change.tag, change.key, change.system].find((v) => typeof v === "string" && v.trim());
          if (!identity) errors.push(`${p}.changes[${j}] requires one of tag/key/system`);
          if (typeof change.action !== "string" || !change.action.trim()) errors.push(`${p}.changes[${j}].action is required`);
        }
      }
    }
  }
}

const result = {
  ok: errors.length === 0,
  file: auditFile,
  run_count: Array.isArray(data) ? data.length : 0,
  errors,
  note: "MTO audit history is a JSON array. Selection runs use input_rev; drawing-export runs use drawing_export_source and may optionally record supplement_input_rev."
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;

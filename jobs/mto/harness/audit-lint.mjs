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
      if (!validRevision(run.input_rev)) errors.push(`${p}.input_rev must be valid YYYY MM DD`);
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
          if (typeof change.tag !== "string" || !change.tag.trim()) errors.push(`${p}.changes[${j}].tag is required`);
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
  note: "MTO audit history is a JSON array. New runs append logically while preserving prior run objects."
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "node:url";
import { validateJobPack } from "../../../shared-harness/job-pack-validator.mjs";

const packDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await validateJobPack(packDir);

const requiredFiles = [
  "rules/equipment-registry.json",
  "rules/_common/source-authority.md",
  "rules/_common/template-and-formatting.md",
  "rules/_common/drawing-reconciliation.md",
  "rules/_common/live-schedule-update.md",
  "rules/_common/conflict-and-audit.md",
  "rules/_common/reporting.md",
  "rules/ac.md",
  "rules/fan.md",
  "templates/TAKEOFF_REPORT.md",
  "harness/resolve-project.mjs",
  "harness/write-guard.mjs",
  "harness/audit-lint.mjs",
  "harness/report-lint.mjs",
  "harness/validate.mjs"
];

for (const rel of requiredFiles) {
  try {
    await fs.access(path.join(packDir, rel));
  } catch {
    result.ok = false;
    result.errors.push(`missing MTO component '${rel}'`);
  }
}

let registry = null;
try {
  registry = JSON.parse(await fs.readFile(path.join(packDir, "rules", "equipment-registry.json"), "utf8"));
} catch (error) {
  result.ok = false;
  result.errors.push(`invalid equipment registry JSON: ${error instanceof Error ? error.message : String(error)}`);
}

for (const id of ["ac", "fan"]) {
  const meta = registry?.equipment?.[id];
  if (!meta) {
    result.ok = false;
    result.errors.push(`equipment registry missing '${id}'`);
    continue;
  }
  for (const key of ["input_folder", "template", "live_schedule", "base_rule", "audit_file"]) {
    if (typeof meta[key] !== "string" || !meta[key].trim()) {
      result.ok = false;
      result.errors.push(`equipment '${id}' missing registry field '${key}'`);
    }
  }
}

result.mto = {
  operational: true,
  equipment: Object.keys(registry?.equipment || {}),
  write_root: "01 WIP/SCHEDULE/eqm",
  output_writes: false,
  revision_resolution: "explicit-or-latest-per-equipment",
  report_model: "canonical-markdown-per-equipment+revision",
  rules_model: "base-common + base-equipment + project-overrides + explicit-user-instruction",
  skills: 0,
  harness_entrypoints: 5
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;

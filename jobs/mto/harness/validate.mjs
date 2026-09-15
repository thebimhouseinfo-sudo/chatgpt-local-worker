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
  "rules/_common/drawing-export-driven.md",
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

const stable = [];
const draft = [];
const sourceModels = new Set();

for (const [id, meta] of Object.entries(registry?.equipment || {})) {
  const status = meta.status || "stable";
  if (!new Set(["stable", "draft"]).has(status)) {
    result.ok = false;
    result.errors.push(`equipment '${id}' has unsupported status '${status}'`);
  }
  if (status === "stable") stable.push(id);
  if (status === "draft") draft.push(id);

  const sourceModel = meta.source_model || "selection";
  sourceModels.add(sourceModel);
  if (!new Set(["selection", "drawing-export"]).has(sourceModel)) {
    result.ok = false;
    result.errors.push(`equipment '${id}' has unsupported source_model '${sourceModel}'`);
  }

  for (const key of ["template", "live_schedule", "base_rule", "project_rule", "audit_file"]) {
    if (typeof meta[key] !== "string" || !meta[key].trim()) {
      result.ok = false;
      result.errors.push(`equipment '${id}' missing registry field '${key}'`);
    }
  }

  if (sourceModel === "selection") {
    if (!Array.isArray(meta.input_folders) || !meta.input_folders.length) {
      result.ok = false;
      result.errors.push(`selection-driven equipment '${id}' requires non-empty input_folders`);
    }
  }

  if (sourceModel === "drawing-export") {
    if (typeof meta.export_stem !== "string" || !meta.export_stem.trim()) {
      result.ok = false;
      result.errors.push(`drawing-export equipment '${id}' requires export_stem`);
    }
  }

  if (typeof meta.base_rule === "string") {
    try {
      await fs.access(path.join(packDir, meta.base_rule));
    } catch {
      result.ok = false;
      result.errors.push(`equipment '${id}' base_rule does not exist: '${meta.base_rule}'`);
    }
  }
}

for (const id of ["ac", "fan"]) {
  if (registry?.equipment?.[id]?.status !== "stable") {
    result.ok = false;
    result.errors.push(`baseline equipment '${id}' must remain stable`);
  }
}

result.mto = {
  operational: true,
  registry_version: registry?.version ?? null,
  equipment: Object.keys(registry?.equipment || {}),
  stable_equipment: stable.sort(),
  draft_equipment: draft.sort(),
  draft_policy: "runnable-with-mandatory-warning-and-careful-review",
  source_models: [...sourceModels].sort(),
  write_root: "01 WIP/SCHEDULE/eqm",
  output_writes: false,
  revision_resolution: "selection=explicit-or-latest-per-equipment; drawing-export=no-synthetic-revision",
  report_model: "selection=revision-scoped; drawing-export=source-model-scoped",
  rules_model: "base-common + stable-or-draft-base-rule + project-overrides + explicit-user-instruction",
  skills: 0,
  harness_entrypoints: 5
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;

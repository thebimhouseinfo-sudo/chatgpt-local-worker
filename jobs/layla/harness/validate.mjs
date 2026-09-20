import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateJobPack } from "../../../shared-harness/job-pack-validator.mjs";

const packDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await validateJobPack(packDir);

const requiredHarness = [
  "harness/workspace-preflight.mjs",
  "harness/scope-gate.mjs",
  "harness/validate.mjs",
];

for (const rel of requiredHarness) {
  try {
    await fs.access(path.join(packDir, rel));
  } catch {
    result.ok = false;
    result.errors.push(`missing layla harness '${rel}'`);
  }
}

try {
  const meta = JSON.parse(await fs.readFile(path.join(packDir, "job.yaml"), "utf8"));

  if (meta.plan_confirmation?.required !== true) {
    result.ok = false;
    result.errors.push("layla must require plan_confirmation");
  }

  if (meta.execution_policy?.mode !== "adaptive-two-gate") {
    result.ok = false;
    result.errors.push("layla must use adaptive-two-gate execution policy");
  }

  if (meta.execution_policy?.default_write_scope !== "confirmed-workspace-only") {
    result.ok = false;
    result.errors.push("layla writes must default to the confirmed workspace only");
  }
} catch (error) {
  result.ok = false;
  result.errors.push(
    `unable to validate layla policy: ${error instanceof Error ? error.message : String(error)}`
  );
}

result.layla = {
  universal_file_work: true,
  adaptive_workflow: true,
  workspace_preflight_required: true,
  plan_confirmation_before_mutation: true,
  workspace_scope_gate: true,
  specialist_job_precedence: true,
  task_appropriate_validation_required: true,
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;

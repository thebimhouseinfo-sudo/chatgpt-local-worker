import path from "node:path";
import { fileURLToPath } from "node:url";
import { flag, arg, run, resolveCwd, emit } from "./lib/common.mjs";
import { verifyTaskCompletion } from "./lib/task-completion.mjs";

const cwd = resolveCwd();
const harnessDir = path.dirname(fileURLToPath(import.meta.url));
const runQuality = flag("--run-quality");
const categories = arg("--categories", null);
const planningDir = arg("--planning-dir", null);
const taskId = arg("--task-id", null);
const evidenceFile = arg("--evidence", null);

function runJson(script, extra = []) {
  const result = run(cwd, process.execPath, [path.join(harnessDir, script), ...extra], { timeoutMs: Number(arg("--timeout-ms", "600000")), maxChars: 100000 });
  let data = null;
  try { data = JSON.parse(result.stdout); } catch {}
  return { process_ok: result.ok, data, stderr: result.stderr };
}

const validation = runJson("validate.mjs");
const inspection = runJson("inspect-repo.mjs", ["--cwd", cwd]);
const diff = runJson("diff-gate.mjs", ["--cwd", cwd]);
const audit = runJson("change-audit.mjs", ["--cwd", cwd]);
const dependencies = runJson("dependency-gate.mjs", ["--cwd", cwd]);
const qualityArgs = ["--cwd", cwd];
if (runQuality) qualityArgs.push("--run");
if (categories) qualityArgs.push("--categories", categories);
const quality = runJson("quality-gate.mjs", qualityArgs);

let planningBundle = null;
if (planningDir) {
  const args = ["--dir", planningDir];
  if (taskId) args.push("--task-id", taskId);
  planningBundle = runJson("planning-bundle-check.mjs", args);
}

const required = { validation, inspection, diff, audit, dependencies };
if (planningBundle) required.planning_bundle = planningBundle;
const failedRequired = Object.entries(required).filter(([, gate]) => !gate.process_ok || gate.data?.ok === false).map(([name]) => name);
const qualityFailed = runQuality && (!quality.process_ok || quality.data?.ok === false);
const goal = evidenceFile && taskId
  ? await verifyTaskCompletion(cwd, taskId, evidenceFile)
  : null;
const ok = failedRequired.length === 0 && !qualityFailed && (goal ? goal.ok : true);

emit({
  ok,
  cwd,
  mode: runQuality ? "structural+quality" : "structural+quality-discovery",
  failed_required_gates: failedRequired,
  quality_executed: runQuality,
  completion_level: goal ? "TASK_GOAL_VERIFIED" : "STRUCTURAL_ONLY_NOT_GOAL_PASS",
  goal_verification: goal,
  task_done: Boolean(goal?.ok && failedRequired.length === 0 && !qualityFailed),
  planning_bundle_checked: Boolean(planningBundle),
  gates: {
    validation: validation.data,
    inspection: inspection.data,
    diff: diff.data,
    change_audit: audit.data,
    dependency_gate: dependencies.data,
    planning_bundle: planningBundle?.data || null,
    quality: quality.data,
  },
  note: goal ? (goal.ok ? "Fresh goal evidence and structural checks passed." : "Goal incomplete: review goal_verification.problems.") : planningBundle
    ? "Structural gates ran and the planning bundle/task ledger was validated. Quality commands follow the selected execution mode."
    : "Structural gates ran. Quality commands were handled by the selected execution mode; pass --planning-dir for bundle-backed task validation."
});
if (!ok) process.exitCode = 1;

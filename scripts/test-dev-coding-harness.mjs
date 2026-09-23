import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packRoot = path.join(repoRoot, "jobs", "dev-coding");
const harnessRoot = path.join(packRoot, "harness");
function run(script, args = []) {
  const result = spawnSync(process.execPath, [path.join(harnessRoot, script), ...args], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(result.status, 0, `${script} failed:\n${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

const validation = run("validate.mjs");
assert.equal(validation.ok, true);
assert.equal(validation.id, "dev-coding");
assert.equal(validation.status, "ready");
assert.equal(validation.dev_coding.skills, 13);
assert.equal(validation.dev_coding.harness_entrypoints, 12);
assert.equal(validation.dev_coding.execution_planning, true);
assert.equal(validation.dev_coding.context_first, true);
assert.equal(validation.dev_coding.planning_bundle_reader, true);
assert.equal(validation.dev_coding.task_ledger_updates, true);
assert.equal(validation.dev_coding.task_local_subplans, true);
assert.equal(validation.dev_coding.targeted_repository_discovery, true);
assert.equal(validation.dev_coding.recommends_dev_planing_for_deep_planning, true);
assert.equal(validation.dev_coding.formal_project_plan_artifact_by_default, false);

const bundleDir = path.join(repoRoot, "jobs", "dev-planing", "templates");
const bundle = run("planning-bundle-check.mjs", ["--dir", bundleDir, "--task-id", "TASK-001"]);
assert.equal(bundle.ok, true);
assert.equal(bundle.active_task.found, true);
assert.equal(bundle.task_ledger.task_count >= 1, true);
assert.deepEqual(bundle.required_files, ["ARCHITECTURE.md", "IMPLEMENTATION_PLAN.md", "TODO.md", "TASKS.md"]);
assert.deepEqual(bundle.read_order.slice(0, 4), ["ARCHITECTURE.md", "IMPLEMENTATION_PLAN.md", "TODO.md", "TASKS.md"]);

const taskPlan = run("task-plan-lint.mjs", ["--plan", path.join(packRoot, "templates", "TASK_PLAN.md")]);
assert.equal(taskPlan.ok, true);

const preflight = run("execution-preflight.mjs", [
  "--cwd", repoRoot,
  "--plan", "README.md",
  "--architecture", "WORKER.md",
]);
assert.equal(preflight.ok, true);
assert.equal(preflight.purpose, "dev-coding-execution-preflight");
assert.equal(preflight.repository.git !== null, true);
assert.equal(Array.isArray(preflight.validation_candidates), true);

const inspection = run("inspect-repo.mjs", ["--cwd", repoRoot]);
assert.equal(inspection.ok, true);
assert.equal(inspection.git !== null, true);
assert.equal(inspection.manifests.includes("package.json"), true);
assert.equal(typeof inspection.package_scripts.test, "string");
assert.equal(Array.isArray(inspection.ci_workflows), true);

const quality = run("quality-gate.mjs", ["--cwd", repoRoot]);
assert.equal(quality.ok, true);
assert.equal(quality.mode, "discover");
assert.equal(quality.results.length, 0);
assert.equal(quality.discovered.some((item) => item.command.includes("test")), true);
assert.equal(quality.discovered.some((item) => item.command.includes("build")), true);

const diff = run("diff-gate.mjs", ["--cwd", repoRoot]);
assert.equal(diff.ok, true);
assert.equal(diff.git, true);
assert.equal(diff.whitespace_check.unstaged.ok, true);
assert.equal(diff.whitespace_check.staged.ok, true);
assert.deepEqual(diff.unresolved_conflicts, []);

const audit = run("change-audit.mjs", ["--cwd", repoRoot]);
assert.equal(audit.ok, true);
const dependencies = run("dependency-gate.mjs", ["--cwd", repoRoot]);
assert.equal(dependencies.ok, true);

const completion = run("completion-gate.mjs", [
  "--cwd", repoRoot,
  "--planning-dir", bundleDir,
  "--task-id", "TASK-001",
]);
assert.equal(completion.ok, true);
assert.equal(completion.quality_executed, false);
assert.equal(completion.planning_bundle_checked, true);
assert.equal(completion.gates.validation.ok, true);
assert.equal(completion.gates.diff.ok, true);
assert.equal(completion.gates.planning_bundle.active_task.found, true);

console.log("test-dev-coding-harness: ok");

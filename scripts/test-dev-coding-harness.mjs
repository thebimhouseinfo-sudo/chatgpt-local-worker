import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const harnessRoot = path.join(repoRoot, "jobs", "dev-coding", "harness");
function run(script, args = []) {
  const result = spawnSync(process.execPath, [path.join(harnessRoot, script), ...args], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(result.status, 0, `${script} failed:\n${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

const validation = run("validate.mjs");
assert.equal(validation.ok, true);
assert.equal(validation.id, "dev-coding");
assert.equal(validation.status, "ready");
assert.equal(validation.dev_coding.skills, 12);
assert.equal(validation.dev_coding.harness_entrypoints >= 8, true);
assert.equal(validation.dev_coding.execution_planning, true);
assert.equal(validation.dev_coding.formal_plan_artifact_by_default, false);

const preflight = run("execution-preflight.mjs", ["--cwd", repoRoot]);
assert.equal(preflight.ok, true);
assert.equal(preflight.purpose, "dev-coding-execution-preflight");
assert.equal(preflight.repository.git !== null, true);
assert.equal(Array.isArray(preflight.validation_candidates), true);
assert.equal(Array.isArray(preflight.planning_hints), true);

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

const completion = run("completion-gate.mjs", ["--cwd", repoRoot]);
assert.equal(completion.ok, true);
assert.equal(completion.quality_executed, false);
assert.equal(completion.gates.validation.ok, true);
assert.equal(completion.gates.diff.ok, true);

console.log("test-dev-coding-harness: ok");

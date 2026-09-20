import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const laylaHarness = path.join(repoRoot, "jobs", "layla", "harness");

function run(script, args) {
  return spawnSync(process.execPath, [path.join(laylaHarness, script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

const preflightOk = run("workspace-preflight.mjs", ["--workspace", repoRoot]);
assert.equal(preflightOk.status, 0, preflightOk.stderr || preflightOk.stdout);
const preflightData = JSON.parse(preflightOk.stdout);
assert.equal(preflightData.ok, true);
assert.equal(path.isAbsolute(preflightData.resolved_workspace), true);

const preflightBad = run("workspace-preflight.mjs", ["--workspace", "."]);
assert.notEqual(preflightBad.status, 0);

const insideTarget = path.join(repoRoot, "package.json");
const scopeOk = run("scope-gate.mjs", [
  "--workspace",
  repoRoot,
  "--path",
  insideTarget,
]);
assert.equal(scopeOk.status, 0, scopeOk.stderr || scopeOk.stdout);
const scopeOkData = JSON.parse(scopeOk.stdout);
assert.equal(scopeOkData.ok, true);
assert.equal(scopeOkData.targets[0].ok, true);

const outsideTarget = path.dirname(repoRoot);
const scopeBad = run("scope-gate.mjs", [
  "--workspace",
  repoRoot,
  "--path",
  outsideTarget,
]);
assert.notEqual(scopeBad.status, 0);
const scopeBadData = JSON.parse(scopeBad.stdout);
assert.equal(scopeBadData.ok, false);
assert.equal(scopeBadData.targets[0].ok, false);

const validate = run("validate.mjs", []);
assert.equal(validate.status, 0, validate.stderr || validate.stdout);
const validateData = JSON.parse(validate.stdout);
assert.equal(validateData.ok, true);
assert.equal(validateData.layla.plan_confirmation_before_mutation, true);
assert.equal(validateData.layla.workspace_scope_gate, true);

console.log("test-layla-harness: ok");

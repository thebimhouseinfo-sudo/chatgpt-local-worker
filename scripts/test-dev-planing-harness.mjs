import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packRoot = path.join(repoRoot, "jobs", "dev-planing");
const harnessRoot = path.join(packRoot, "harness");

function run(script, args = [], expectedStatus = 0) {
  const result = spawnSync(process.execPath, [path.join(harnessRoot, script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, expectedStatus, `${script} unexpected status:\n${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

const validation = run("validate.mjs");
assert.equal(validation.ok, true);
assert.equal(validation.id, "dev-planing");
assert.equal(validation.status, "ready");
assert.equal(validation.dev_planing.skills, 6);
assert.equal(validation.dev_planing.source_editing, false);
assert.equal(validation.dev_planing.executable_task_ledger, true);
assert.deepEqual(validation.dev_planing.planning_bundle, [
  "templates/ARCHITECTURE.md",
  "templates/IMPLEMENTATION_PLAN.md",
  "templates/TODO.md",
  "templates/TASKS.md",
]);

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "local-worker-dev-planing-"));
try {
  const names = ["ARCHITECTURE.md", "IMPLEMENTATION_PLAN.md", "TODO.md", "TASKS.md"];
  for (const name of names) {
    const content = await fs.readFile(path.join(packRoot, "templates", name), "utf8");
    await fs.writeFile(path.join(tmp, name), content, "utf8");
  }

  const lint = run("bundle-lint.mjs", ["--dir", tmp]);
  assert.equal(lint.ok, true);
  assert.equal(lint.files.architecture, "ARCHITECTURE.md");
  assert.equal(lint.files.plan, "IMPLEMENTATION_PLAN.md");
  assert.equal(lint.files.todo, "TODO.md");
  assert.equal(lint.files.tasks, "TASKS.md");

  await fs.rm(path.join(tmp, "TASKS.md"));
  const bad = run("bundle-lint.mjs", ["--dir", tmp], 1);
  assert.equal(bad.ok, false);
  assert.equal(bad.errors.some((error) => error.includes("TASKS.md")), true);
} finally {
  await fs.rm(tmp, { recursive: true, force: true });
}

console.log("test-dev-planing-harness: ok");

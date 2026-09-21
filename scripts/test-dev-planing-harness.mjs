import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateDevPlaningPack } from "../jobs/dev-planing/harness/validate.mjs";
import { validatePlanningBundle } from "../jobs/dev-planing/harness/bundle-lint.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packRoot = path.join(repoRoot, "jobs", "dev-planing");

const validation = await validateDevPlaningPack();
assert.equal(validation.ok, true, validation.errors.join("\n"));
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
    const content = await fs.readFile(
      path.join(packRoot, "templates", name),
      "utf8"
    );
    await fs.writeFile(path.join(tmp, name), content, "utf8");
  }

  const lint = await validatePlanningBundle(tmp);
  assert.equal(lint.ok, true, lint.errors.join("\n"));
  assert.equal(lint.files.architecture, "ARCHITECTURE.md");
  assert.equal(lint.files.plan, "IMPLEMENTATION_PLAN.md");
  assert.equal(lint.files.todo, "TODO.md");
  assert.equal(lint.files.tasks, "TASKS.md");

  await fs.rm(path.join(tmp, "TASKS.md"));
  const bad = await validatePlanningBundle(tmp);
  assert.equal(bad.ok, false);
  assert.equal(bad.errors.some((error) => error.includes("TASKS.md")), true);
} finally {
  await fs.rm(tmp, { recursive: true, force: true });
}

console.log("test-dev-planing-harness: ok");

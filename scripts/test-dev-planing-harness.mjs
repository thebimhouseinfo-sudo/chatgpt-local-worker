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
assert.equal(validation.dev_planing.skills, 5);
assert.equal(validation.dev_planing.source_editing, false);

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "local-worker-dev-plan-"));
try {
  const planPath = path.join(tmp, "DEV_PLAN.md");
  const template = await fs.readFile(path.join(packRoot, "templates", "DEV_PLAN.md"), "utf8");
  const concrete = template
    .replace("Describe the observable engineering objective and success condition.", "Add deterministic handoff between dev-planing and dev-coding execution.")
    .replace("List concrete repository findings that constrain the plan. Prefer file paths, symbols, schemas, tests, commands, and current behavior.", "jobs/dev-planing/job.yaml defines the planning pack. jobs/dev-coding/job.yaml accepts an optional plan input. scripts/test-job-runtime.mjs validates runtime activation boundaries.")
    .replace("List explicit technical, compatibility, platform, dependency, delivery, and user constraints.", "Dev Planing must not edit source code. Dev Coding must not create a formal plan. Job Runtime confirmation and pack isolation remain unchanged.")
    .replace("List adjacent work intentionally excluded from this plan.", "No MTO implementation and no server-level permission-engine redesign.")
    .replace("Describe affected boundaries, dependencies, compatibility, migrations, rollout/rollback, and external integrations only where relevant.", "The change affects Job Pack metadata/SOP/tests only and preserves the MCP execution core and existing runtime lifecycle.")
    .replace("1. Describe an ordered, implementation-ready change step with affected files/components/symbols and expected behavior.\n2. Continue in dependency order.", "1. Update dev-planing pack metadata/SOP/skills and validate its plan-only boundary.\n2. Keep formal planning outside dev-coding while retaining optional plan consumption.\n3. Update runtime and harness tests for both ready jobs.\n4. Run Job Pack validation and the inherited full test suite.")
    .replace("List targeted tests/checks first, then broader build/runtime/migration verification appropriate to the risk.", "Run dev-planing plan lint, dev-coding harness tests, Job Runtime lifecycle tests, TypeScript build, and the inherited npm test suite.")
    .replace("List material implementation or operational risks and mitigations where known.", "Risk: job responsibilities can drift later. Mitigation: dedicated validators and lifecycle tests assert the separation.")
    .replace("List unresolved product/architecture decisions that must not be guessed by the coding job. Write `None` when there are no material open questions.", "None")
    .replace("Record any execution ordering, migration, rollout, environment, or delivery notes the coding job must preserve.", "The dev-coding job may consume this plan as an optional input but must follow newer explicit user instructions and repository rules if they conflict.");
  await fs.writeFile(planPath, concrete, "utf8");

  const lint = run("plan-lint.mjs", ["--plan", planPath]);
  assert.equal(lint.ok, true);

  const badPath = path.join(tmp, "bad.md");
  await fs.writeFile(badPath, "# Development Plan\n\n## Objective\nToo small.\n", "utf8");
  const bad = run("plan-lint.mjs", ["--plan", badPath], 1);
  assert.equal(bad.ok, false);
  assert.equal(bad.errors.length > 0, true);
} finally {
  await fs.rm(tmp, { recursive: true, force: true });
}

console.log("test-dev-planing-harness: ok");

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createCheckpoint, snapshotBeforeEdit, registerAgentWrite, readCheckpoint,
} from "../jobs/dev-coding/harness/lib/checkpoint.mjs";
import { verifyTaskCompletion } from "../jobs/dev-coding/harness/lib/task-completion.mjs";
import { inspectTaskDiff } from "../jobs/dev-coding/harness/lib/snapshot-review.mjs";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-completion-"));
const target = path.join(root, "src.js");
const evidencePath = path.join(root, "task-evidence.json");
const taskId = "TASK-VERIFY";
const rules = [
  "approved-scope", "preserve-user-edits", "no-weakened-tests",
  "no-disabled-lint-security", "no-commented-out-fix", "no-secrets-debug-artifacts",
  "callers-and-interfaces",
];
try {
  await fs.writeFile(target, "export const answer = 1;\n");
  await createCheckpoint(root, taskId, {
    goal: "answer changes from one to two",
    acceptance: ["answer-is-two"],
    scopePaths: [target],
    executionId: "exec-new", generation: 1,
  });
  await snapshotBeforeEdit(root, taskId, target);
  await fs.writeFile(target, "export const answer = 2;\n");
  await registerAgentWrite(root, taskId, target);
  const review = await inspectTaskDiff(root, taskId);
  assert.equal(review.ok, true);
  assert.equal(review.complete, false, "automated static diff never independently establishes Goal PASS");
  assert.equal(review.changed.length, 1);

  const state = await readCheckpoint(root, taskId);
  const evidence = {
    task_id: taskId, input_fingerprint: state.latest_manifest.fingerprint,
    browser_required: false, runtime_required: false, build_required: false,
    acceptance: [{ id: "answer-is-two", status: "PASS",
      observation: "The observed runtime value of answer is exactly two.",
      evidence_ref: "test-output#answer-is-two" }],
    checks: Object.fromEntries(["CODE_QA", "TESTS", "BUILD", "RUNTIME", "BROWSER_QA", "GOAL", "DIFF_REVIEW"]
      .map(x => [x, ["BUILD", "RUNTIME", "BROWSER_QA"].includes(x) ?
        { status: "N/A", reason: "Not required for this isolated fixture" } :
        { status: "PASS", observation: "Validated the specific acceptance signal using independent evidence" }])),
    diff_review: rules.map(rule => ({ rule, status: "PASS", evidence: "Reviewed the actual changed file and its callers; no unexpected effects." })),
  };
  await fs.writeFile(evidencePath, JSON.stringify(evidence));
  let result = await verifyTaskCompletion(root, taskId, evidencePath);
  assert.equal(result.ok, true, JSON.stringify(result.problems));
  assert.equal(result.goal_status, "PASS");

  // Merely green checks cannot cover a missing original acceptance signal.
  evidence.acceptance = [];
  await fs.writeFile(evidencePath, JSON.stringify(evidence));
  result = await verifyTaskCompletion(root, taskId, evidencePath);
  assert.equal(result.ok, false);
  assert.ok(result.problems.some(x => x.startsWith("unverified-acceptance:")));

  evidence.acceptance = [{ id: "answer-is-two", status: "PASS",
    observation: "The observed runtime value of answer is exactly two.", evidence_ref: "test-output#answer-is-two" }];
  await fs.writeFile(evidencePath, JSON.stringify(evidence));
  await fs.writeFile(target, "export const answer = 999;\n");
  result = await verifyTaskCompletion(root, taskId, evidencePath);
  assert.equal(result.ok, false, "PASS evidence must become stale after source changes");
  assert.ok(result.problems.includes("stale-source-fingerprint"));

  // A missing original snapshot cannot pass even when all checklist entries claim PASS.
  const other = path.join(root, "new.js");
  await createCheckpoint(root, "TASK-UNSNAPSHOT", {
    goal: "add a new file", acceptance: ["file-exists"], scopePaths: [other],
  });
  await fs.writeFile(other, "const a = 1;\n");
  assert.equal((await inspectTaskDiff(root, "TASK-UNSNAPSHOT")).ok, false);

  console.log("test-dev-coding-completion: ok");
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

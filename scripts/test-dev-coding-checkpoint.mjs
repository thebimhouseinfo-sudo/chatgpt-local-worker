import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createCheckpoint, readCheckpoint, discoverCheckpoints, resumeCheckpoint,
  snapshotBeforeEdit, registerAgentWrite, restoreAgentEdit, hashManifest,
  checkIterationBudget,
} from "../jobs/dev-coding/harness/lib/checkpoint.mjs";

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-checkpoint-"));
const file = path.join(workspace, "example.txt");
const newFile = path.join(workspace, "new.txt");
try {
  await fs.writeFile(file, "original\n");
  const task = await createCheckpoint(workspace, "TASK-001", {
    goal: "Modify behavior safely", acceptance: ["A1"], scopePaths: [file, newFile],
    executionId: "exec-old", generation: 1,
  });
  assert.equal(task.iteration, 0);
  assert.equal(task.baseline_manifest.files.length, 2);
  let found = await discoverCheckpoints(workspace);
  assert.equal(found.length, 1);
  assert.equal(found[0].fingerprint_fresh, true);
  assert.equal((await discoverCheckpoints(workspace, "TASK-002")).length, 0);

  // New conversation has a new handle, not the previous authority token.
  let resumed = await resumeCheckpoint(workspace, "TASK-001", { executionId: "exec-new", generation: 2 });
  assert.equal(resumed.stale, false);
  assert.equal(resumed.state.execution_id, "exec-new");
  assert.equal(resumed.state.generation, 2);

  // Snapshot backup is taken only from an explicitly approved path.
  await snapshotBeforeEdit(workspace, "TASK-001", file);
  await snapshotBeforeEdit(workspace, "TASK-001", newFile);
  await fs.writeFile(file, "agent-edited\n");
  await fs.writeFile(newFile, "agent-created\n");
  await registerAgentWrite(workspace, "TASK-001", file);
  await registerAgentWrite(workspace, "TASK-001", newFile);
  await assert.rejects(restoreAgentEdit(workspace, "TASK-001", file), /approval/);

  // Any intervening user edit must prevent overwrite.
  await fs.writeFile(file, "user-edited\n");
  await assert.rejects(
    restoreAgentEdit(workspace, "TASK-001", file, { approved: true }),
    /RESTORE_CONFLICT/
  );
  assert.equal(await fs.readFile(file, "utf8"), "user-edited\n");
  await fs.writeFile(file, "agent-edited\n");
  assert.equal((await restoreAgentEdit(workspace, "TASK-001", file, { approved: true })).restored, file);
  assert.equal(await fs.readFile(file, "utf8"), "original\n");

  await restoreAgentEdit(workspace, "TASK-001", newFile, { approved: true });
  await assert.rejects(fs.access(newFile), /ENOENT/);
  const manifest = await hashManifest(workspace, [file, newFile]);
  assert.equal(typeof manifest.fingerprint, "string");
  assert.equal(manifest.fingerprint.length, 64);

  // A resumed stale checkpoint invalidates all prior PASS evidence.
  await fs.writeFile(file, "manual change\n");
  found = await discoverCheckpoints(workspace);
  assert.equal(found[0].fingerprint_fresh, false);
  resumed = await resumeCheckpoint(workspace, "TASK-001", { executionId: "exec-next", generation: 3 });
  assert.equal(resumed.stale, true);
  assert.equal(resumed.state.next_action, "REVALIDATE_AFTER_SOURCE_DRIFT");

  const state = await readCheckpoint(workspace, "TASK-001");
  state.iteration = 8;
  assert.deepEqual(await checkIterationBudget(state, "SAME"), { stop: true, reason: "BUDGET_EXHAUSTED" });
  state.iteration = 2;
  state.history = [{ failure_signature: "SAME" }, { failure_signature: "SAME" }];
  assert.deepEqual(await checkIterationBudget(state, "SAME"), { stop: true, reason: "REPEATED_UNINFORMATIVE_FAILURE" });

  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-outside-"));
  try {
    await assert.rejects(snapshotBeforeEdit(workspace, "TASK-001", path.join(outside, "outside.txt")), /BOUNDARY/);
    if (process.platform !== "win32") {
      const link = path.join(workspace, "escape");
      await fs.symlink(outside, link);
      await assert.rejects(hashManifest(workspace, [path.join(link, "secret")]), /BOUNDARY/);
    }
  } finally { await fs.rm(outside, { recursive: true, force: true }); }
  console.log("test-dev-coding-checkpoint: ok");
} finally {
  await fs.rm(workspace, { recursive: true, force: true });
}

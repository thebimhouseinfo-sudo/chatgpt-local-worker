import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-state-"));
process.env.LOCAL_WORKER_HOME = tempRoot;

const {
  clearWorkerState,
  getWorkerStatePath,
  readWorkerState,
  writeWorkerState,
} = await import("../dist/lib/worker-state.js");

try {
  assert.equal(getWorkerStatePath(), path.join(tempRoot, "worker-state.json"));

  const initial = await readWorkerState();
  assert.deepEqual(initial, {
    current_job: null,
    active_workspace: null,
    status: "idle",
    updated_at: null,
  });

  const workspace = path.join(tempRoot, "project-a");
  await fs.mkdir(workspace, { recursive: true });

  const confirmed = await writeWorkerState("dev-coding", workspace);
  assert.equal(confirmed.current_job, "dev-coding");
  assert.equal(confirmed.active_workspace, path.resolve(workspace));
  assert.equal(confirmed.status, "confirmed");
  assert.equal(typeof confirmed.updated_at, "string");

  const persisted = await readWorkerState();
  assert.equal(persisted.current_job, "dev-coding");
  assert.equal(persisted.active_workspace, path.resolve(workspace));
  assert.equal(persisted.status, "confirmed");

  const cleared = await clearWorkerState();
  assert.equal(cleared.current_job, null);
  assert.equal(cleared.active_workspace, null);
  assert.equal(cleared.status, "idle");

  const afterClear = await readWorkerState();
  assert.equal(afterClear.current_job, null);
  assert.equal(afterClear.active_workspace, null);
  assert.equal(afterClear.status, "idle");

  console.log("test-worker-state: ok");
} finally {
  delete process.env.LOCAL_WORKER_HOME;
  await fs.rm(tempRoot, { recursive: true, force: true });
}

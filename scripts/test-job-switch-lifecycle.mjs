import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-switch-lifecycle-"));
process.env.LOCAL_WORKER_HOME = tempRoot;

const { registerJobTools } = await import("../dist/tools/jobs.js");
const {
  releaseWorkRegistration,
  validateWorkHandle,
} = await import("../dist/lib/work-registration.js");
const { flushRuntimeLog } = await import("../dist/lib/runtime-log.js");

const registered = new Map();
const server = {
  registerTool(name, config, callback) {
    registered.set(name, { config, callback });
    return {
      remove() {},
      update() {},
      enable() {},
      disable() {},
      enabled: true,
    };
  },
};

const fakeRuntime = {
  async status() {
    return { state: { phase: "idle", bindings: {} }, active_job: null };
  },
  async switch() {
    return {
      previous_state: { phase: "idle", bindings: {} },
      current: {
        state: {
          phase: "active",
          job_id: "no-confirm",
          bindings: { workspace: tempRoot },
        },
        job: {
          id: "no-confirm",
          name: "No Confirm",
          status: "ready",
          preload_families: [],
        },
        skills: [],
        harness: [],
        validators: [],
      },
    };
  },
  stop() {
    return { state: { phase: "idle", bindings: {} } };
  },
};

registerJobTools(server, fakeRuntime);

const jobSwitch = registered.get("job_switch")?.callback;
assert.ok(jobSwitch, "job_switch was not registered");

const switched = await jobSwitch({
  job: "no-confirm",
  bindings: { workspace: tempRoot, task: "Switch lifecycle test" },
});
assert.equal(switched.structuredContent.ok, true);

const current = switched.structuredContent.data?.current;
assert.equal(current?.state?.phase, "active");
assert.equal(
  typeof current?.work_handle?.execution_id,
  "string",
  "active job_switch result must carry a new work_handle"
);
assert.equal(typeof current?.work_handle?.authority_token, "string");

const invalidWorkspace = path.join(tempRoot, "missing-workspace");
const invalidSwitch = await jobSwitch({
  job: "no-confirm",
  bindings: { workspace: invalidWorkspace },
  execution_id: current.work_handle.execution_id,
  authority_token: current.work_handle.authority_token,
});
assert.equal(invalidSwitch.structuredContent.ok, false);
assert.match(
  String(invalidSwitch.structuredContent.data?.error || ""),
  /does not exist or is not a directory/
);
assert.doesNotThrow(
  () =>
    validateWorkHandle(
      current.work_handle.execution_id,
      current.work_handle.authority_token
    ),
  "invalid replacement Workspace must not destroy the current active work handle"
);

// Once active, work_handle itself authorizes a switch. The old registration
// must be released and the replacement active Job must receive a fresh handle.
const switchedAgain = await jobSwitch({
  job: "no-confirm",
  bindings: { workspace: tempRoot, task: "Switch lifecycle test again" },
  execution_id: current.work_handle.execution_id,
  authority_token: current.work_handle.authority_token,
});
assert.equal(switchedAgain.structuredContent.ok, true);

const replacement = switchedAgain.structuredContent.data?.current;
assert.equal(replacement?.state?.phase, "active");
assert.equal(typeof replacement?.work_handle?.execution_id, "string");
assert.equal(typeof replacement?.work_handle?.authority_token, "string");
assert.notEqual(
  replacement.work_handle.execution_id,
  current.work_handle.execution_id,
  "active job_switch must create a fresh work registration"
);

releaseWorkRegistration(
  replacement.work_handle.execution_id,
  replacement.work_handle.authority_token
);
await flushRuntimeLog();
await fs.rm(tempRoot, { recursive: true, force: true });

console.log("test-job-switch-lifecycle: ok");

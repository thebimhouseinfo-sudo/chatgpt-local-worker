import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-switch-lifecycle-"));
process.env.LOCAL_WORKER_HOME = tempRoot;

const { AdmissionRuntime } = await import("../dist/lib/activation-policy.js");
const { registerJobTools } = await import("../dist/tools/jobs.js");
const { releaseWorkRegistration } = await import("../dist/lib/work-registration.js");

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

const admission = new AdmissionRuntime();
registerJobTools(server, fakeRuntime, undefined, admission);

const admitted = admission.check({
  userTurn: "@gptworker switch to no-confirm job",
  hasConcreteTask: true,
});
assert.equal(admitted.mode, "ACTIVE");

const jobSwitch = registered.get("job_switch")?.callback;
assert.ok(jobSwitch, "job_switch was not registered");

const switched = await jobSwitch({
  job: "no-confirm",
  admission_token: admitted.admission_token,
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

assert.throws(
  () => admission.validate(admitted.admission_token),
  /ADMISSION_REQUIRED/,
  "pre-active admission token must be consumed when job_switch creates active work"
);

// Once active, work_handle itself authorizes a switch. The old registration
// must be released and the replacement active Job must receive a fresh handle.
const switchedAgain = await jobSwitch({
  job: "no-confirm",
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
await fs.rm(tempRoot, { recursive: true, force: true });

console.log("test-job-switch-lifecycle: ok");

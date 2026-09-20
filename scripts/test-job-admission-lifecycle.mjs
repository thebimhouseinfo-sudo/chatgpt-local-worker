import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AdmissionRuntime } from "../dist/lib/activation-policy.js";
import { registerJobTools } from "../dist/tools/jobs.js";
import { releaseWorkRegistration } from "../dist/lib/work-registration.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

const fakeNoConfirmRuntime = {
  async status() {
    return { state: { phase: "idle", bindings: {} }, active_job: null };
  },
  async select() {
    return {
      state: {
        phase: "active",
        job_id: "no-confirm",
        bindings: { workspace: repoRoot },
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
    };
  },
  stop() {
    return { state: { phase: "idle", bindings: {} } };
  },
};

const admission = new AdmissionRuntime();
registerJobTools(server, fakeNoConfirmRuntime, undefined, admission);

const admissionDecision = admission.check({
  userTurn: "@gptworker run no-confirm test",
  hasConcreteTask: true,
});
assert.equal(admissionDecision.mode, "ACTIVE");

const jobSelect = registered.get("job_select")?.callback;
assert.ok(jobSelect, "job_select was not registered");

const activated = await jobSelect({
  job: "no-confirm",
  bindings: {},
  confirmed: false,
  admission_token: admissionDecision.admission_token,
});
assert.equal(activated.structuredContent.ok, true);

const activeData = activated.structuredContent.data;
assert.equal(activeData?.state?.phase, "active");
assert.equal(typeof activeData?.work_handle?.execution_id, "string");
assert.equal(typeof activeData?.work_handle?.authority_token, "string");

assert.throws(
  () => admission.validate(admissionDecision.admission_token),
  /ADMISSION_REQUIRED/,
  "admission token must be consumed whenever a work_handle is issued, even for no-confirm Jobs"
);

releaseWorkRegistration(
  activeData.work_handle.execution_id,
  activeData.work_handle.authority_token
);

console.log("test-job-admission-lifecycle: ok");

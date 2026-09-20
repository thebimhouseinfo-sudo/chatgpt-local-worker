import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JobRuntime } from "../dist/jobs/job-runtime.js";
import { AdmissionRuntime } from "../dist/lib/activation-policy.js";
import { registerJobTools } from "../dist/tools/jobs.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jobsRoot = path.join(repoRoot, "jobs");

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

const admission = new AdmissionRuntime();
const runtime = new JobRuntime(repoRoot, jobsRoot);
registerJobTools(server, runtime, undefined, admission);

const admitted = admission.check({
  userTurn: `@gptworker đọc ${repoRoot} và lên kế hoạch`,
  hasConcreteTask: true,
  workspace: repoRoot,
});
assert.equal(admitted.mode, "ACTIVE");

const jobSelect = registered.get("job_select")?.callback;
const jobStop = registered.get("job_stop")?.callback;
assert.ok(jobSelect, "job_select was not registered");
assert.ok(jobStop, "job_stop was not registered");

const nominated = await jobSelect({
  job: "dev-planing",
  bindings: {
    workspace: repoRoot,
    objective: "Plan pending work then cancel it",
  },
  confirmed: false,
  admission_token: admitted.admission_token,
});
assert.equal(nominated.structuredContent.ok, true);
assert.equal(
  nominated.structuredContent.data?.state?.phase,
  "awaiting_confirmation"
);
const confirmationToken = nominated.structuredContent.data?.confirmation_token;
assert.equal(typeof confirmationToken, "string");

// Pending work has no work_handle yet. job_stop must still cancel this session's
// nomination and return it to idle without requiring execution authority.
const stopped = await jobStop({});
assert.equal(
  stopped.structuredContent.ok,
  true,
  "job_stop must cancel pending confirmation without a work_handle"
);
assert.equal(stopped.structuredContent.data?.state?.phase, "idle");

assert.throws(
  () => admission.validate(admitted.admission_token),
  /ADMISSION_REQUIRED/,
  "stopping pending work must clear its admission token"
);

// The cancelled confirmation token must no longer be usable.
const confirmAfterStop = await jobSelect({
  job: "dev-planing",
  bindings: {
    workspace: repoRoot,
    objective: "Plan pending work then cancel it",
  },
  confirmed: true,
  admission_token: admitted.admission_token,
  confirmation_token: confirmationToken,
});
assert.equal(confirmAfterStop.structuredContent.ok, false);

console.log("test-job-stop-pending: ok");

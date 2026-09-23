import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-confirm-retry-"));
process.env.LOCAL_WORKER_HOME = tempHome;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jobsRoot = path.join(repoRoot, "jobs");
process.env.DEFAULT_JOB_PACKS_PATH = jobsRoot;

const { JobRuntime } = await import("../dist/jobs/job-runtime.js");
const { AdmissionRuntime } = await import("../dist/lib/activation-policy.js");
const { registerJobTools } = await import("../dist/tools/jobs.js");
const {
  createWorkRegistration,
  releaseWorkRegistration,
} = await import("../dist/lib/work-registration.js");

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
const runtime = new JobRuntime(jobsRoot);
registerJobTools(server, runtime, undefined, admission);
const jobSelect = registered.get("job_select")?.callback;
assert.ok(jobSelect, "job_select was not registered");

const admitted = admission.check({
  userTurn: `@gptworker đọc ${repoRoot} và lên kế hoạch`,
  hasConcreteTask: true,
  workspace: repoRoot,
});
assert.equal(admitted.mode, "ACTIVE");

const bindings = {
  workspace: repoRoot,
  objective: "Verify confirmation survives transient registration failure",
};

const nominated = await jobSelect({
  job: "dev-planing",
  bindings,
  confirmed: false,
  admission_token: admitted.admission_token,
});
assert.equal(nominated.structuredContent.ok, true);
const confirmationToken = nominated.structuredContent.data?.confirmation_token;
assert.equal(typeof confirmationToken, "string");

const blocker = await createWorkRegistration("blocker", repoRoot);

const blocked = await jobSelect({
  job: "dev-planing",
  bindings,
  confirmed: true,
  admission_token: admitted.admission_token,
  confirmation_token: confirmationToken,
});
assert.equal(blocked.structuredContent.ok, false);
assert.match(
  String(blocked.structuredContent.data?.error || ""),
  /already registered|WORKSPACE_BUSY/i
);

releaseWorkRegistration(blocker.executionId, blocker.authorityToken);

// A transient work-registration failure must not destroy the user's already
// granted confirmation. Retrying the same confirmed activation should work.
const retried = await jobSelect({
  job: "dev-planing",
  bindings,
  confirmed: true,
  admission_token: admitted.admission_token,
  confirmation_token: confirmationToken,
});
assert.equal(
  retried.structuredContent.ok,
  true,
  "confirmation proof must survive a transient work-registration failure"
);
const handle = retried.structuredContent.data?.work_handle;
assert.equal(typeof handle?.execution_id, "string");
assert.equal(typeof handle?.authority_token, "string");

releaseWorkRegistration(handle.execution_id, handle.authority_token);
await fs.rm(tempHome, { recursive: true, force: true });

console.log("test-job-confirmation-retry-after-busy: ok");

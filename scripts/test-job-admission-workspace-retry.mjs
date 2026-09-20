import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JobRuntime } from "../dist/jobs/job-runtime.js";
import { AdmissionRuntime } from "../dist/lib/activation-policy.js";
import { registerJobTools } from "../dist/tools/jobs.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jobsRoot = path.join(repoRoot, "jobs");
const missingWorkspace = path.join(
  os.tmpdir(),
  "gptworker-missing-workspace-" + Date.now()
);
await fs.rm(missingWorkspace, { recursive: true, force: true });

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
  userTurn: "@gptworker đọc repo và lên kế hoạch",
  hasConcreteTask: true,
});
assert.equal(admitted.mode, "ACTIVE");
assert.equal(admitted.workspace, undefined);

const jobSelect = registered.get("job_select")?.callback;
assert.ok(jobSelect, "job_select was not registered");

// First attempt uses an absolute path that does not exist.
const invalidAttempt = await jobSelect({
  job: "dev-planing",
  bindings: {
    workspace: missingWorkspace,
    objective: "Plan the repository",
  },
  confirmed: false,
  admission_token: admitted.admission_token,
});
assert.equal(invalidAttempt.structuredContent.ok, false);
assert.match(
  String(invalidAttempt.structuredContent.data?.error || ""),
  /does not exist or is not a directory/
);

// Correcting a typo/path mistake must reuse the same admission token.
// A failed workspace validation must not permanently bind the token.
const correctedAttempt = await jobSelect({
  job: "dev-planing",
  bindings: {
    workspace: repoRoot,
    objective: "Plan the repository",
  },
  confirmed: false,
  admission_token: admitted.admission_token,
});
assert.equal(
  correctedAttempt.structuredContent.ok,
  true,
  "corrected valid Workspace must remain usable with the same @ admission token"
);
assert.equal(
  correctedAttempt.structuredContent.data?.state?.phase,
  "awaiting_confirmation"
);

console.log("test-job-admission-workspace-retry: ok");

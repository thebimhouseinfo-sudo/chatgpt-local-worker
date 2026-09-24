import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JobRuntime } from "../dist/jobs/job-runtime.js";
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

const runtime = new JobRuntime(jobsRoot);
registerJobTools(server, runtime);

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
});
assert.equal(invalidAttempt.structuredContent.ok, false);
assert.match(
  String(invalidAttempt.structuredContent.data?.error || ""),
  /does not exist or is not a directory/
);

// Correcting a typo/path mistake simply retries nomination; no admission token is involved.
const correctedAttempt = await jobSelect({
  job: "dev-planing",
  bindings: {
    workspace: repoRoot,
    objective: "Plan the repository",
  },
  confirmed: false,
});
assert.equal(
  correctedAttempt.structuredContent.ok,
  true,
  "corrected valid Workspace must remain usable after the invalid path attempt"
);
assert.equal(
  correctedAttempt.structuredContent.data?.state?.phase,
  "awaiting_confirmation"
);

console.log("test-job-admission-workspace-retry: ok");

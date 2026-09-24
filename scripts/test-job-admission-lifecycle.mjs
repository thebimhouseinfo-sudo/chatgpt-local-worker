import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JobRuntime } from "../dist/jobs/job-runtime.js";
import { registerJobTools } from "../dist/tools/jobs.js";
import { releaseWorkRegistration } from "../dist/lib/work-registration.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registered = new Map();
const server = {
  registerTool(name, config, callback) {
    registered.set(name, { config, callback });
    return { remove() {}, update() {}, enable() {}, disable() {}, enabled: true };
  },
};

const runtime = new JobRuntime(path.join(repoRoot, "jobs"));
registerJobTools(server, runtime);
const jobSelect = registered.get("job_select")?.callback;
assert.ok(jobSelect, "job_select was not registered");

// Conversation may nominate a Job, but server registration waits for Workspace.
const incomplete = await jobSelect({
  job: "dev-coding",
  bindings: { task: "Fix login bug" },
  confirmed: false,
});
assert.equal(incomplete.structuredContent.ok, false);
assert.match(String(incomplete.structuredContent.data?.error || ""), /PREPARE_INCOMPLETE/);

// Once JOB + FOLDER + TASK are known, nomination becomes awaiting_confirmation.
const nominated = await jobSelect({
  job: "dev-coding",
  bindings: { workspace: repoRoot, task: "Fix login bug" },
  confirmed: false,
});
assert.equal(nominated.structuredContent.ok, true);
assert.equal(nominated.structuredContent.data?.state?.phase, "awaiting_confirmation");
assert.equal(typeof nominated.structuredContent.data?.confirmation_token, "string");
assert.equal(nominated.structuredContent.data?.work_handle, undefined);

// Execution authority exists only after explicit confirmation.
const confirmationToken = nominated.structuredContent.data.confirmation_token;
const activated = await jobSelect({
  job: "dev-coding",
  bindings: { workspace: repoRoot, task: "Fix login bug" },
  confirmed: true,
  confirmation_token: confirmationToken,
});
assert.equal(activated.structuredContent.ok, true);
const handle = activated.structuredContent.data?.work_handle;
assert.equal(typeof handle?.execution_id, "string");
assert.equal(typeof handle?.authority_token, "string");

releaseWorkRegistration(handle.execution_id, handle.authority_token);
console.log("test-job-admission-lifecycle: ok");

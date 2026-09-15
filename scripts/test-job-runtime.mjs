import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JobRuntime } from "../dist/jobs/job-runtime.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtime = new JobRuntime(repoRoot, path.join(repoRoot, "jobs"));

const listing = await runtime.list("repo lisp");
assert.equal(listing.jobs.length, 2);
assert.deepEqual(listing.jobs.map((job) => job.id).sort(), ["coding", "mto"]);
assert.equal(listing.suggested_job_ids.includes("coding"), true);
assert.equal(listing.jobs.find((job) => job.id === "coding")?.status, "ready");
assert.equal(listing.jobs.find((job) => job.id === "coding")?.skill_count, 5);
assert.equal(listing.jobs.find((job) => job.id === "mto")?.status, "placeholder");

await assert.rejects(
  () => runtime.select({ job: "mto" }),
  /placeholder.*cannot be selected or activated/i
);

const partial = await runtime.select({
  job: "coding",
  bindings: { workspace: "." },
});
assert.equal(partial.state.phase, "selected");
assert.deepEqual(partial.missing_bindings, ["task"]);
assert.deepEqual(partial.skills, []);
assert.deepEqual(partial.harness, []);

const selected = await runtime.select({
  job: "coding",
  bindings: {
    workspace: ".",
    task: "Validate the coding Job Runtime lifecycle",
  },
});
assert.equal(selected.state.phase, "awaiting_confirmation");
assert.equal(typeof selected.confirmation_token, "string");
assert.deepEqual(selected.skills, []);
assert.deepEqual(selected.harness, []);

const active = await runtime.select({
  job: "coding",
  bindings: {
    workspace: ".",
    task: "Validate the coding Job Runtime lifecycle",
  },
  confirmed: true,
  confirmationToken: selected.confirmation_token,
});
assert.equal(active.state.phase, "active");
assert.equal(active.job.status, "ready");
assert.equal(active.skills.length, 5);
assert.equal(active.harness.length, 4);
assert.equal(active.validators.length, 2);

const stopped = runtime.stop();
assert.equal(stopped.state.phase, "idle");

console.log("test-job-runtime: ok");

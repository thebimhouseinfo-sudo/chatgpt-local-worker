import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JobRuntime } from "../dist/jobs/job-runtime.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtime = new JobRuntime(repoRoot, path.join(repoRoot, "jobs"));

const listing = await runtime.list("repo lisp");
assert.equal(listing.jobs.length >= 4, true);
assert.equal(listing.suggested_job_ids.includes("software-development"), true);

const selected = await runtime.select({
  job: "software-development",
  bindings: {
    workspace: ".",
    result: "./.worker-output",
  },
});
assert.equal(selected.state.phase, "awaiting_confirmation");
assert.equal(typeof selected.confirmation_token, "string");
assert.deepEqual(selected.harness, []);

const active = await runtime.select({
  job: "software-development",
  bindings: {
    workspace: ".",
    result: "./.worker-output",
  },
  confirmed: true,
  confirmationToken: selected.confirmation_token,
});
assert.equal(active.state.phase, "active");
assert.equal(active.harness.length > 0, true);

const switched = await runtime.switch("technical-review", {
  source: ".",
  report: "./review.md",
});
assert.equal(switched.previous_state.phase, "active");
assert.equal(switched.current.state.phase, "awaiting_confirmation");

const stopped = runtime.stop();
assert.equal(stopped.state.phase, "idle");

console.log("test-job-runtime: ok");

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JobRuntime } from "../dist/jobs/job-runtime.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtime = new JobRuntime(repoRoot, path.join(repoRoot, "jobs"));

const listing = await runtime.list("repo lisp");
assert.equal(listing.jobs.length, 3);
assert.deepEqual(listing.jobs.map((job) => job.id).sort(), ["dev-coding", "dev-planing", "mto"]);
assert.equal(listing.suggested_job_ids.includes("dev-coding"), true);
assert.equal(listing.jobs.find((job) => job.id === "dev-coding")?.status, "ready");
assert.equal(listing.jobs.find((job) => job.id === "dev-coding")?.skill_count, 11);
assert.equal(listing.jobs.find((job) => job.id === "dev-planing")?.status, "ready");
assert.equal(listing.jobs.find((job) => job.id === "dev-planing")?.skill_count, 5);
assert.equal(listing.jobs.find((job) => job.id === "mto")?.status, "placeholder");

await assert.rejects(
  () => runtime.select({ job: "mto" }),
  /placeholder.*cannot be selected or activated/i
);

const partial = await runtime.select({
  job: "dev-coding",
  bindings: { workspace: "." },
});
assert.equal(partial.state.phase, "selected");
assert.deepEqual(partial.missing_bindings, ["task"]);
assert.deepEqual(partial.skills, []);
assert.deepEqual(partial.harness, []);

const selected = await runtime.select({
  job: "dev-coding",
  bindings: {
    workspace: ".",
    task: "Validate the dev-coding Job Runtime lifecycle",
  },
});
assert.equal(selected.state.phase, "awaiting_confirmation");
assert.equal(typeof selected.confirmation_token, "string");
assert.deepEqual(selected.skills, []);
assert.deepEqual(selected.harness, []);

const active = await runtime.select({
  job: "dev-coding",
  bindings: {
    workspace: ".",
    task: "Validate the dev-coding Job Runtime lifecycle",
  },
  confirmed: true,
  confirmationToken: selected.confirmation_token,
});
assert.equal(active.state.phase, "active");
assert.equal(active.job.id, "dev-coding");
assert.equal(active.job.status, "ready");
assert.equal(active.skills.length, 11);
assert.equal(active.harness.length, 7);
assert.equal(active.validators.length, 2);

runtime.stop();

const planSelected = await runtime.select({
  job: "dev-planing",
  bindings: {
    workspace: ".",
    objective: "Plan a safe runtime change",
    plan: "./DEV_PLAN.test.md",
  },
});
assert.equal(planSelected.state.phase, "awaiting_confirmation");
assert.equal(typeof planSelected.confirmation_token, "string");
assert.deepEqual(planSelected.skills, []);

const planActive = await runtime.select({
  job: "dev-planing",
  bindings: {
    workspace: ".",
    objective: "Plan a safe runtime change",
    plan: "./DEV_PLAN.test.md",
  },
  confirmed: true,
  confirmationToken: planSelected.confirmation_token,
});
assert.equal(planActive.state.phase, "active");
assert.equal(planActive.job.id, "dev-planing");
assert.equal(planActive.job.status, "ready");
assert.equal(planActive.skills.length, 5);
assert.equal(planActive.harness.length, 2);
assert.equal(planActive.validators.length, 2);

const stopped = runtime.stop();
assert.equal(stopped.state.phase, "idle");

console.log("test-job-runtime: ok");

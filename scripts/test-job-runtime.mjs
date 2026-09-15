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
assert.equal(listing.jobs.find((job) => job.id === "dev-coding")?.skill_count, 13);
assert.equal(listing.jobs.find((job) => job.id === "dev-planing")?.status, "ready");
assert.equal(listing.jobs.find((job) => job.id === "dev-planing")?.skill_count, 6);
assert.equal(listing.jobs.find((job) => job.id === "mto")?.status, "ready");
assert.equal(listing.jobs.find((job) => job.id === "mto")?.skill_count, 0);

const mtoListing = await runtime.list("fan takeoff");
assert.equal(mtoListing.suggested_job_ids.includes("mto"), true);

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
    planning_dir: "./.worker/dev",
    task_id: "TASK-001",
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
    planning_dir: "./.worker/dev",
    task_id: "TASK-001",
  },
  confirmed: true,
  confirmationToken: selected.confirmation_token,
});
assert.equal(active.state.phase, "active");
assert.equal(active.job.id, "dev-coding");
assert.equal(active.job.status, "ready");
assert.equal(active.skills.length, 13);
assert.equal(active.harness.length, 10);
assert.equal(active.validators.length, 2);

runtime.stop();

const planSelected = await runtime.select({
  job: "dev-planing",
  bindings: {
    workspace: ".",
    objective: "Plan a safe runtime change",
    planning_dir: "./DEV_PLAN.test",
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
    planning_dir: "./DEV_PLAN.test",
  },
  confirmed: true,
  confirmationToken: planSelected.confirmation_token,
});
assert.equal(planActive.state.phase, "active");
assert.equal(planActive.job.id, "dev-planing");
assert.equal(planActive.job.status, "ready");
assert.equal(planActive.skills.length, 6);
assert.equal(planActive.harness.length, 2);
assert.equal(planActive.validators.length, 2);

runtime.stop();

const mtoPartial = await runtime.select({
  job: "mto",
  bindings: {
    workspace: ".",
    task: "Update AC and Fan EQM from the latest input",
  },
});
assert.equal(mtoPartial.state.phase, "selected");
assert.deepEqual(mtoPartial.missing_bindings, ["equipment", "input_revision"]);
assert.deepEqual(mtoPartial.harness, []);

const mtoSelected = await runtime.select({
  job: "mto",
  bindings: {
    workspace: ".",
    task: "Update AC and Fan EQM from the latest input",
    equipment: "ac,fan",
    input_revision: "latest",
  },
});
assert.equal(mtoSelected.state.phase, "awaiting_confirmation");
assert.equal(typeof mtoSelected.confirmation_token, "string");
assert.deepEqual(mtoSelected.harness, []);

const mtoActive = await runtime.select({
  job: "mto",
  bindings: {
    workspace: ".",
    task: "Update AC and Fan EQM from the latest input",
    equipment: "ac,fan",
    input_revision: "latest",
  },
  confirmed: true,
  confirmationToken: mtoSelected.confirmation_token,
});
assert.equal(mtoActive.state.phase, "active");
assert.equal(mtoActive.job.id, "mto");
assert.equal(mtoActive.job.status, "ready");
assert.equal(mtoActive.skills.length, 0);
assert.equal(mtoActive.harness.length, 5);
assert.equal(mtoActive.validators.length, 1);

const stopped = runtime.stop();
assert.equal(stopped.state.phase, "idle");

console.log("test-job-runtime: ok");
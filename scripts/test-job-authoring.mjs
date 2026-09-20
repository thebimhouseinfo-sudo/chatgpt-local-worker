
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-job-authoring-"));
const jobsRoot = path.join(tempRoot, "jobs");
await fs.mkdir(jobsRoot, { recursive: true });
process.env.LOCAL_WORKER_HOME = tempRoot;
process.env.JOB_PACKS_PATH = jobsRoot;

const {
  createJobPack,
  updateJobPack,
  removeJobPack,
  validateJobPack,
} = await import("../dist/jobs/job-authoring.js");
const { JobRuntime } = await import("../dist/jobs/job-runtime.js");

const created = await createJobPack({
  id: "test-job",
  name: "Test Job",
  description: "Temporary Job Pack used by automated authoring tests.",
  keywords: ["test", "authoring"],
  inputs: [
    {
      key: "workspace",
      type: "directory",
      required: true,
      description: "Target workspace",
    },
    {
      key: "task",
      type: "string",
      required: true,
      description: "Task to perform",
    },
  ],
  skills: ["skills/example.md"],
  harness_entrypoints: ["harness/validate.mjs"],
  validators: ["harness/validate.mjs"],
  files: {
    "skills/example.md": "# Example skill\n",
    "harness/validate.mjs": "console.log('validate test-job');\n",
  },
});

assert.equal(created.job_id, "test-job");
assert.equal(created.validation.ok, true);
assert.equal(await fs.stat(path.join(jobsRoot, "test-job", "JOB.md")).then(() => true), true);

const runtime = new JobRuntime(tempRoot, jobsRoot);
const listing = await runtime.list("test authoring");
assert.equal(listing.jobs.some((job) => job.id === "test-job"), true);

const updated = await updateJobPack("test-job", {
  version: "0.2.0",
  description: "Updated temporary Job Pack.",
  job_md: "# Test Job\n\nUpdated contract.\n",
  files: {
    "skills/second.md": "# Second skill\n",
  },
  skills: ["skills/example.md", "skills/second.md"],
});
assert.equal(updated.validation.ok, true);

const manifest = JSON.parse(
  await fs.readFile(path.join(jobsRoot, "test-job", "job.yaml"), "utf8")
);
assert.equal(manifest.version, "0.2.0");
assert.deepEqual(manifest.skills, ["skills/example.md", "skills/second.md"]);
assert.match(
  await fs.readFile(path.join(jobsRoot, "test-job", "JOB.md"), "utf8"),
  /Updated contract/
);

const validation = await validateJobPack(path.join(jobsRoot, "test-job"));
assert.equal(validation.ok, true);

await assert.rejects(
  () =>
    createJobPack({
      id: "broken-job",
      name: "Broken Job",
      description: "Should never publish because a referenced skill is missing.",
      skills: ["skills/missing.md"],
    }),
  /Job validation failed/
);
await assert.rejects(
  fs.stat(path.join(jobsRoot, "broken-job")),
  (error) => error && error.code === "ENOENT"
);

await assert.rejects(
  () =>
    createJobPack({
      id: "bad/job",
      name: "Bad Job",
      description: "Unsafe id",
    }),
  /Job id/
);

const removed = await removeJobPack("test-job");
assert.equal(removed.removed, true);
await assert.rejects(
  fs.stat(path.join(jobsRoot, "test-job")),
  (error) => error && error.code === "ENOENT"
);

await fs.rm(tempRoot, { recursive: true, force: true });
console.log("test-job-authoring: ok");

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-job-authoring-"));
const dataRoot = path.join(tempRoot, "appdata", "GPTWorker");
const customJobsRoot = path.join(dataRoot, "jobs");
const defaultJobsRoot = path.join(tempRoot, "repo-default-jobs");

await fs.mkdir(customJobsRoot, { recursive: true });
await fs.mkdir(defaultJobsRoot, { recursive: true });
await fs.cp(
  path.join(repoRoot, "jobs", "dev-coding"),
  path.join(defaultJobsRoot, "dev-coding"),
  { recursive: true }
);

process.env.LOCAL_WORKER_HOME = tempRoot;
process.env.GPTWORKER_DATA_ROOT = dataRoot;
process.env.JOB_PACKS_PATH = customJobsRoot;
process.env.DEFAULT_JOB_PACKS_PATH = defaultJobsRoot;

const {
  createJobPack,
  updateJobPack,
  removeJobPack,
  inspectJobPackForRemoval,
  exportJobPack,
  importJobPack,
  validateJobPack,
} = await import("../dist/jobs/job-authoring.js");
const { JobRuntime } = await import("../dist/jobs/job-runtime.js");
const {
  acquireToolLease,
  createWorkRegistration,
  releaseToolLease,
  releaseWorkRegistration,
} = await import("../dist/lib/work-registration.js");

const created = await createJobPack({
  id: "test-job",
  name: "Test Job",
  description: "Temporary custom Job Pack used by automated authoring tests.",
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
  preload_families: ["filesystem", "context", "mcp"],
  files: {
    "skills/example.md": "# Example skill\n",
    "harness/validate.mjs": "console.log('validate test-job');\n",
  },
});

assert.equal(created.job_id, "test-job");
assert.equal(created.validation.ok, true);
assert.equal(
  await fs.stat(path.join(customJobsRoot, "test-job", "JOB.md")).then(() => true),
  true
);

const runtime = new JobRuntime(tempRoot);
const listing = await runtime.list("test authoring");
const defaultJob = listing.jobs.find((job) => job.id === "dev-coding");
const customJob = listing.jobs.find((job) => job.id === "test-job");
assert.equal(defaultJob?.source, "default");
assert.equal(customJob?.source, "custom");
assert.deepEqual(customJob?.preload_families, ["filesystem", "context", "mcp"]);
assert.equal(listing.jobs.length, 2);

await assert.rejects(
  () =>
    createJobPack({
      id: "dev-coding",
      name: "Duplicate Default",
      description: "Must be rejected because bundled default ids are reserved.",
    }),
  /bundled default Job/
);

await assert.rejects(
  () => updateJobPack("dev-coding", { description: "Do not mutate defaults." }),
  /bundled default Job/
);

await assert.rejects(
  () => removeJobPack("dev-coding"),
  /bundled default Job/
);

// Default Jobs are immutable, but may be cloned into a new custom Job id.
const defaultManifestBefore = await fs.readFile(
  path.join(defaultJobsRoot, "dev-coding", "job.yaml"),
  "utf8"
);
const cloned = await createJobPack({
  id: "my-dev-coding",
  clone_from: "dev-coding",
  name: "My Dev Coding",
});
assert.equal(cloned.job_id, "my-dev-coding");
assert.equal(cloned.cloned_from, "dev-coding");
const clonedManifest = JSON.parse(
  await fs.readFile(path.join(customJobsRoot, "my-dev-coding", "job.yaml"), "utf8")
);
assert.equal(clonedManifest.id, "my-dev-coding");
assert.equal(clonedManifest.name, "My Dev Coding");
assert.deepEqual(clonedManifest.aliases, []);
assert.equal(clonedManifest.cloned_from.job_id, "dev-coding");
assert.equal(clonedManifest.cloned_from.source, "default");
assert.equal(
  await fs.readFile(path.join(defaultJobsRoot, "dev-coding", "job.yaml"), "utf8"),
  defaultManifestBefore
);

const cloneListing = await runtime.list();
assert.equal(
  cloneListing.jobs.find((job) => job.id === "my-dev-coding")?.source,
  "custom"
);

await updateJobPack("my-dev-coding", {
  description: "Customized clone without touching the bundled default.",
});
await removeJobPack("my-dev-coding");

const updated = await updateJobPack("test-job", {
  version: "0.2.0",
  description: "Updated temporary custom Job Pack.",
  job_md: "# Test Job\n\nUpdated contract.\n",
  files: {
    "skills/second.md": "# Second skill\n",
  },
  skills: ["skills/example.md", "skills/second.md"],
  preload_families: ["filesystem", "context"],
});
assert.equal(updated.validation.ok, true);

const manifest = JSON.parse(
  await fs.readFile(path.join(customJobsRoot, "test-job", "job.yaml"), "utf8")
);
assert.equal(manifest.version, "0.2.0");
assert.deepEqual(manifest.skills, ["skills/example.md", "skills/second.md"]);
assert.deepEqual(manifest.runtime?.preload_families, ["filesystem", "context"]);
assert.match(
  await fs.readFile(path.join(customJobsRoot, "test-job", "JOB.md"), "utf8"),
  /Updated contract/
);

const validation = await validateJobPack(path.join(customJobsRoot, "test-job"));
assert.equal(validation.ok, true);

const exportDir = path.join(tempRoot, "exports");
await fs.mkdir(exportDir, { recursive: true });

await assert.rejects(
  () => exportJobPack("dev-coding", exportDir),
  /Only custom Jobs can be exported/
);

const exported = await exportJobPack("test-job", exportDir);
assert.equal(exported.exported, true);
assert.equal(exported.archive, path.join(exportDir, "test-job.zip"));
assert.equal(
  await fs.stat(exported.archive).then((stat) => stat.isFile()),
  true
);

await assert.rejects(
  () => exportJobPack("test-job", "relative-export-dir"),
  /absolute local path/
);

const activeWorkspace = path.join(tempRoot, "active-workspace");
await fs.mkdir(activeWorkspace, { recursive: true });
const activeRegistration = await createWorkRegistration("test-job", activeWorkspace);
const activeLease = acquireToolLease(
  "read_text_file",
  "filesystem",
  activeRegistration.executionId,
  activeRegistration.authorityToken
);
const removalPreflight = await inspectJobPackForRemoval("test-job");
assert.equal(removalPreflight.source, "custom");
assert.equal(removalPreflight.active_work_count, 1);
assert.equal(removalPreflight.active_tool_count, 1);
assert.equal(removalPreflight.active_tools[0]?.tool, "read_text_file");

await assert.rejects(
  () => updateJobPack("test-job", { description: "Must stop active work first." }),
  /is active/
);
await assert.rejects(
  () => removeJobPack("test-job"),
  /is active/
);

releaseToolLease(activeLease, "ok");
releaseWorkRegistration(
  activeRegistration.executionId,
  activeRegistration.authorityToken
);


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
  fs.stat(path.join(customJobsRoot, "broken-job")),
  (error) => error && error.code === "ENOENT"
);

await assert.rejects(
  () =>
    createJobPack({
      id: "bad-preload",
      name: "Bad Preload",
      description: "Invalid preload family should be rejected.",
      preload_families: ["filesystem", "not-a-family"],
    }),
  /Unknown Job preload family/
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
  fs.stat(path.join(customJobsRoot, "test-job")),
  (error) => error && error.code === "ENOENT"
);

const afterRemove = await runtime.list();
assert.equal(afterRemove.jobs.some((job) => job.id === "dev-coding"), true);
assert.equal(afterRemove.jobs.some((job) => job.id === "test-job"), false);

const imported = await importJobPack(exportDir);
assert.equal(imported.imported, true);
assert.equal(imported.job_id, "test-job");
assert.equal(
  await fs.stat(path.join(customJobsRoot, "test-job", "JOB.md")).then(() => true),
  true
);

const importedListing = await runtime.list();
assert.equal(
  importedListing.jobs.find((job) => job.id === "test-job")?.source,
  "custom"
);

await assert.rejects(
  () => importJobPack(exportDir),
  /already exists/
);
await assert.rejects(
  () => importJobPack("relative-import-dir"),
  /absolute local path/
);

await removeJobPack("test-job");

await fs.rm(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
console.log("test-job-authoring: ok");

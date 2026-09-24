import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JobRuntime } from "../dist/jobs/job-runtime.js";
import { registerJobTools } from "../dist/tools/jobs.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registered = new Map();
const fakeServer = {
  registerTool(name, config, callback) {
    registered.set(name, { config, callback });
    return { remove() {}, update() {}, enable() {}, disable() {}, enabled: true };
  },
};

const runtime = new JobRuntime(path.join(repoRoot, "jobs"));
registerJobTools(fakeServer, runtime);

const jobList = registered.get("job_list");
assert.ok(jobList, "job_list was not registered");

const metadata = JSON.stringify(jobList.config).toLowerCase();
assert.ok(!metadata.includes("mto"), "public tool metadata must not reveal private Job identity");

const welcome = await jobList.callback({ surface: "welcome" });
assert.equal(welcome.structuredContent.ok, true);
const welcomeData = welcome.structuredContent.data;
assert.equal(welcomeData.prepare_mode, true);
assert.deepEqual(welcomeData.required_before_nomination, ["job", "workspace", "task"]);
assert.ok(welcomeData.welcome_text.includes("Dev Coding"));
assert.ok(welcomeData.welcome_text.includes("Dev Planing"));
assert.ok(welcomeData.welcome_text.includes("Layla"));
assert.ok(!welcomeData.welcome_text.toLowerCase().includes("mto"));
assert.ok(!JSON.stringify(welcomeData).includes("continuation_token"));
assert.ok(!JSON.stringify(welcomeData).includes("admission_token"));

const catalog = await jobList.callback({ surface: "catalog" });
assert.equal(catalog.structuredContent.ok, true);
const catalogText = JSON.stringify(catalog.structuredContent.data).toLowerCase();
assert.ok(!catalogText.includes('"mto"'));

const customRegistered = new Map();
const customServer = {
  registerTool(name, config, callback) {
    customRegistered.set(name, { config, callback });
    return { remove() {}, update() {}, enable() {}, disable() {}, enabled: true };
  },
};
const customRuntime = {
  async list() {
    return {
      jobs: [
        { id: "rename", name: "Rename", description: "đổi tên file hàng loạt.", status: "ready", source: "custom" },
        { id: "mto", name: "MTO", description: "private custom workflow", status: "ready", source: "custom" },
        { id: "draft-job", name: "Draft Job", description: "not ready yet", status: "placeholder", source: "custom" },
      ],
      suggested_job_ids: ["mto", "rename"],
      note: "test",
    };
  },
};
registerJobTools(customServer, customRuntime);
const customJobList = customRegistered.get("job_list");
const customWelcome = await customJobList.callback({ surface: "welcome" });
const customText = JSON.stringify(customWelcome);
assert.ok(customText.includes("**4. Rename** — đổi tên file hàng loạt."));
assert.ok(!customText.includes("private custom workflow"));
assert.ok(!customText.includes("Draft Job"));

console.log("test-job-list-arming: ok");

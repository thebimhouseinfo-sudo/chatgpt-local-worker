import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JobRuntime } from "../dist/jobs/job-runtime.js";
import { AdmissionRuntime } from "../dist/lib/activation-policy.js";
import { registerJobTools } from "../dist/tools/jobs.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registered = new Map();
const fakeServer = {
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

const admissionRuntime = new AdmissionRuntime();
const jobRuntime = new JobRuntime(path.join(repoRoot, "jobs"));
registerJobTools(fakeServer, jobRuntime, undefined, admissionRuntime);

const jobList = registered.get("job_list");
assert.ok(jobList, "job_list was not registered");
const publicToolMetadata = JSON.stringify(jobList.config).toLowerCase();
assert.ok(!publicToolMetadata.includes("mto"), "job_list public tool metadata must not reveal private Job identity");

assert.equal(admissionRuntime.isExplicitAtFlowArmed(), false);

const bareAtResult = await jobList.callback({
  activation_request: "@gptworker",
});
const payload = JSON.stringify(bareAtResult);
assert.ok(payload.includes('"at_flow_armed":true'));
assert.equal(admissionRuntime.isExplicitAtFlowArmed(), true);
assert.ok(payload.includes('"welcome_text"'));
assert.ok(!payload.includes('"jobs":'), "bare @ must not expose the catalog payload to ChatGPT");
assert.ok(!payload.includes('"suggested_job_ids":'), "bare @ must return only the completed Welcome surface");
assert.ok(payload.includes("Dev Coding"));
assert.ok(payload.includes("Dev Planing"));
assert.ok(payload.includes("Layla"));
assert.ok(!payload.toLowerCase().includes('"id":"mto"'));
assert.ok(!payload.includes("HVAC quantity takeoff"));

// The following work request can now continue without repeating @.
const workspace = repoRoot;
const continuation = admissionRuntime.check({
  userTurn: `2 ${workspace} đọc repo và lên kế hoạch`,
  hasConcreteTask: true,
  workspace,
});
assert.equal(continuation.mode, "ACTIVE");

// A separate MCP session remains unarmed.
const otherAdmission = new AdmissionRuntime();
assert.equal(otherAdmission.isExplicitAtFlowArmed(), false);
const direct = otherAdmission.check({
  userTurn: `Đọc repo ${workspace} và lên kế hoạch`,
  hasConcreteTask: true,
  workspace,
});
assert.equal(direct.mode, "INACTIVE");


// Custom Jobs are scanned dynamically for Welcome. Only ready custom Jobs
// appear after the three fixed defaults; mto and non-custom packs stay hidden.
const customRegistered = new Map();
const customServer = {
  registerTool(name, config, callback) {
    customRegistered.set(name, { config, callback });
    return {
      remove() {},
      update() {},
      enable() {},
      disable() {},
      enabled: true,
    };
  },
};
const customRuntime = {
  async list() {
    return {
      jobs: [
        {
          id: "rename",
          name: "Rename",
          description: "đổi tên file hàng loạt.",
          status: "ready",
          source: "custom",
        },
        {
          id: "mto",
          name: "MTO",
          description: "private custom workflow",
          status: "ready",
          source: "custom",
        },
        {
          id: "draft-job",
          name: "Draft Job",
          description: "not ready yet",
          status: "placeholder",
          source: "custom",
        },
        {
          id: "another-default",
          name: "Another Default",
          description: "must not enter Welcome",
          status: "ready",
          source: "default",
        },
      ],
      suggested_job_ids: ["mto", "rename"],
      job_roots: {},
      note: "test",
    };
  },
};
const customAdmission = new AdmissionRuntime();
registerJobTools(customServer, customRuntime, undefined, customAdmission);
const customJobList = customRegistered.get("job_list");
const customWelcome = await customJobList.callback({
  activation_request: "@gptworker",
});
const customPayload = JSON.stringify(customWelcome);
assert.ok(customPayload.includes("**4. Rename** — đổi tên file hàng loạt."));
assert.ok(!customPayload.includes("private custom workflow"));
assert.ok(!customPayload.includes("Draft Job"));
assert.ok(!customPayload.includes("Another Default"));

// Explicit gr/job list is also a public enumeration surface. Private MTO must
// stay hidden there, including suggestion ids, while other custom Jobs remain.
const explicitList = await customJobList.callback({ query: "mto rename" });
const explicitPayload = explicitList.structuredContent?.data ?? explicitList.structuredContent ?? explicitList;
const explicitText = JSON.stringify(explicitPayload);
assert.ok(explicitText.includes("Rename"));
assert.ok(!explicitText.includes("private custom workflow"));
assert.ok(!explicitText.toLowerCase().includes('"id":"mto"'));
assert.ok(!explicitText.toLowerCase().includes('"mto"'));

// Hiding from enumeration must not remove the Job from runtime resolution.
// Direct invocation remains a separate job_select path, not job_list.
const directMtoRuntime = new JobRuntime(path.join(repoRoot, "jobs"));
const directMto = await directMtoRuntime.select({
  job: "mto",
  bindings: { workspace: repoRoot, task: "private mto task" },
});
assert.equal(directMto.job.id, "mto");

console.log("test-job-list-arming: ok");

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
const jobRuntime = new JobRuntime(repoRoot, path.join(repoRoot, "jobs"));
registerJobTools(fakeServer, jobRuntime, undefined, admissionRuntime);

const jobList = registered.get("job_list");
assert.ok(jobList, "job_list was not registered");
assert.equal(admissionRuntime.isExplicitAtFlowArmed(), false);

const bareAtResult = await jobList.callback({
  activation_request: "@gptworker",
});
const payload = JSON.stringify(bareAtResult);
assert.ok(payload.includes('"at_flow_armed":true'));
assert.equal(admissionRuntime.isExplicitAtFlowArmed(), true);

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

console.log("test-job-list-arming: ok");

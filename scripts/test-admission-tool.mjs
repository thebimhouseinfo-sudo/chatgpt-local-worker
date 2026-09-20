import path from "node:path";
import { registerAdmissionTool } from "../dist/tools/admission.js";
import { AdmissionRuntime } from "../dist/lib/activation-policy.js";

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

const runtime = new AdmissionRuntime();
registerAdmissionTool(fakeServer, runtime);
const admission = registered.get("gptworker_admission");
if (!admission) throw new Error("gptworker_admission was not registered");

const inactive = await admission.callback({
  user_turn: "Hãy giải thích đoạn code này",
  has_concrete_task: true,
});
const inactiveJson = JSON.stringify(inactive);
if (!inactiveJson.includes('"mode":"INACTIVE"')) {
  throw new Error("ordinary ChatGPT request must be INACTIVE");
}
if (!inactiveJson.includes('"render_to_user":false')) {
  throw new Error("admission result must be marked non-user-facing");
}

const workspace = path.resolve("admission-tool-test-workspace");

// Direct task + path in a fresh session is blocked.
const direct = await admission.callback({
  user_turn: `Sửa app ở ${workspace} để thêm nút regenerate`,
  has_concrete_task: true,
  workspace,
});
const directJson = JSON.stringify(direct);
if (!directJson.includes('"mode":"INACTIVE"')) {
  throw new Error("fresh task + absolute local path without @gptworker must be INACTIVE");
}

// Literal @gptworker is ACTIVE.
const explicit = await admission.callback({
  user_turn: `@gptworker sửa app ở ${workspace}`,
  has_concrete_task: true,
  workspace,
});
const explicitJson = JSON.stringify(explicit);
if (!explicitJson.includes('"mode":"ACTIVE"') || !explicitJson.includes("admission_token")) {
  throw new Error("@gptworker must produce ACTIVE admission token");
}

// A separately armed @ flow may continue without repeating @.
const continuationRuntime = new AdmissionRuntime();
continuationRuntime.armExplicitAt("@gptworker");
const continuationRegistered = new Map();
const continuationServer = {
  registerTool(name, config, callback) {
    continuationRegistered.set(name, { config, callback });
    return { remove() {}, update() {}, enable() {}, disable() {}, enabled: true };
  },
};
registerAdmissionTool(continuationServer, continuationRuntime);
const continuationTool = continuationRegistered.get("gptworker_admission");
const continuation = await continuationTool.callback({
  user_turn: `2 ${workspace} đọc repo và lên kế hoạch`,
  has_concrete_task: true,
  workspace,
});
if (!JSON.stringify(continuation).includes('"mode":"ACTIVE"')) {
  throw new Error("armed @gptworker flow must allow the following Job+Workspace continuation");
}

const control = await admission.callback({
  user_turn: "gptworker/job list",
});
if (!JSON.stringify(control).includes('"mode":"CONTROL"')) {
  throw new Error("explicit GPTWorker public command must be CONTROL");
}

console.log("test-admission-tool: ok");

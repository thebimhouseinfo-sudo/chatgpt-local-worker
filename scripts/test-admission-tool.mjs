import path from "node:path";
import { registerAdmissionTool } from "../dist/tools/admission.js";

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

registerAdmissionTool(fakeServer);
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
if (!inactiveJson.includes("Continue the response as ordinary ChatGPT")) {
  throw new Error("INACTIVE must instruct ChatGPT to continue normally");
}

const explicit = await admission.callback({
  user_turn: "@gptworker sửa app này",
  has_concrete_task: true,
});
const explicitJson = JSON.stringify(explicit);
if (!explicitJson.includes('"mode":"ACTIVE"') || !explicitJson.includes("admission_token")) {
  throw new Error("@gptworker must produce ACTIVE admission token");
}

const workspace = path.resolve("admission-tool-test-workspace");
const natural = await admission.callback({
  user_turn: `Sửa app ở ${workspace} để thêm nút regenerate`,
  has_concrete_task: true,
  workspace,
});
const naturalJson = JSON.stringify(natural);
if (!naturalJson.includes('"mode":"ACTIVE"') || !naturalJson.includes("task_with_workspace")) {
  throw new Error("task + absolute local path must be ACTIVE");
}

const control = await admission.callback({
  user_turn: "gptworker/job list",
});
if (!JSON.stringify(control).includes('"mode":"CONTROL"')) {
  throw new Error("explicit GPTWorker public command must be CONTROL");
}

console.log("test-admission-tool: ok");

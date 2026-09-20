import assert from "node:assert/strict";
import path from "node:path";
import {
  AdmissionRuntime,
  validateActivationGate,
} from "../dist/lib/activation-policy.js";

const workspace = path.resolve("activation-test-workspace");
const runtime = new AdmissionRuntime();

const inactive = runtime.check({
  userTurn: "Sửa UI này đẹp hơn",
  hasConcreteTask: true,
});
assert.equal(inactive.mode, "INACTIVE");
assert.equal(inactive.claimed, false);
assert.equal(
  inactive.next,
  "stop_gptworker_continue_normal_chat_or_requested_plugin"
);

const directTaskWithPath = runtime.check({
  userTurn: `Sửa app ở ${workspace} để thêm nút regenerate`,
  hasConcreteTask: true,
  workspace,
});
assert.equal(
  directTaskWithPath.mode,
  "INACTIVE",
  "task + absolute local path must NOT activate GPTWorker without @gptworker"
);
assert.equal(directTaskWithPath.claimed, false);
assert.equal(directTaskWithPath.admission_token, undefined);

const control = runtime.check({ userTurn: "gptworker/job list" });
assert.equal(control.mode, "CONTROL");
assert.equal(control.claimed, false);

const explicitAdmission = runtime.check({
  userTurn: `@gptworker sửa app ở ${workspace} để thêm nút regenerate`,
  hasConcreteTask: true,
  workspace,
});
assert.equal(explicitAdmission.mode, "ACTIVE");
assert.equal(explicitAdmission.trigger, "explicit_gptworker");
assert.equal(typeof explicitAdmission.admission_token, "string");

assert.equal(
  runtime.validate(explicitAdmission.admission_token, workspace).trigger,
  "explicit_gptworker"
);

const fromAdmission = runtime.activation(
  explicitAdmission.admission_token,
  { workspace }
);
assert.equal(fromAdmission.trigger, "explicit_gptworker");

assert.throws(
  () => runtime.activation(undefined, { workspace }),
  /ADMISSION_REQUIRED/
);

const otherSession = new AdmissionRuntime();
assert.throws(
  () => otherSession.validate(explicitAdmission.admission_token, workspace),
  /another MCP session/
);

assert.throws(
  () => validateActivationGate({ bindings: { workspace } }),
  /ACTIVATION_REQUIRED/
);

assert.throws(
  () =>
    validateActivationGate({
      trigger: "explicit_gptworker",
      activationRequest: `Sửa app ở ${workspace} để thêm nút regenerate`,
      bindings: { workspace },
    }),
  /literal @gptworker/
);

const explicit = validateActivationGate({
  trigger: "explicit_gptworker",
  activationRequest: `@gptworker sửa app ở ${workspace} để thêm nút regenerate`,
  bindings: { workspace },
});
assert.equal(explicit.trigger, "explicit_gptworker");

console.log("test-activation-policy: ok");

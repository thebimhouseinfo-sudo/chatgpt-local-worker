import assert from "node:assert/strict";
import path from "node:path";
import {
  activationFromAdmission,
  checkAdmission,
  validateActivationGate,
  validateAdmissionToken,
} from "../dist/lib/activation-policy.js";

const workspace = path.resolve("activation-test-workspace");

const inactive = checkAdmission({
  userTurn: "Sửa UI này đẹp hơn",
  hasConcreteTask: true,
});
assert.equal(inactive.mode, "INACTIVE");
assert.equal(inactive.claimed, false);
assert.equal(
  inactive.next,
  "stop_gptworker_continue_normal_chat_or_requested_plugin"
);

const control = checkAdmission({ userTurn: "gptworker/job list" });
assert.equal(control.mode, "CONTROL");
assert.equal(control.claimed, false);

const explicitAdmission = checkAdmission({
  userTurn: "@gptworker sửa app giúp tôi",
});
assert.equal(explicitAdmission.mode, "ACTIVE");
assert.equal(explicitAdmission.trigger, "explicit_gptworker");
assert.equal(typeof explicitAdmission.admission_token, "string");

const naturalAdmission = checkAdmission({
  userTurn: `Sửa app ở ${workspace} để thêm nút regenerate`,
  hasConcreteTask: true,
  workspace,
});
assert.equal(naturalAdmission.mode, "ACTIVE");
assert.equal(naturalAdmission.trigger, "task_with_workspace");
assert.equal(naturalAdmission.workspace, workspace);
assert.equal(typeof naturalAdmission.admission_token, "string");

assert.equal(
  validateAdmissionToken(naturalAdmission.admission_token, workspace).trigger,
  "task_with_workspace"
);
assert.throws(
  () =>
    validateAdmissionToken(
      naturalAdmission.admission_token,
      path.resolve("different-workspace")
    ),
  /Workspace does not match/
);

const fromAdmission = activationFromAdmission(
  naturalAdmission.admission_token,
  { workspace }
);
assert.equal(fromAdmission.trigger, "task_with_workspace");
assert.equal(fromAdmission.workspace, workspace);

assert.throws(
  () => activationFromAdmission(undefined, { workspace }),
  /ADMISSION_REQUIRED/
);

// Preserve the lower-level evidence validator as a defense-in-depth primitive.
assert.throws(
  () => validateActivationGate({ bindings: { workspace } }),
  /ACTIVATION_REQUIRED/
);

assert.throws(
  () =>
    validateActivationGate({
      trigger: "explicit_gptworker",
      activationRequest: "Sửa app này giúp tôi",
      bindings: { workspace },
    }),
  /literal @gptworker/
);

const explicit = validateActivationGate({
  trigger: "explicit_gptworker",
  activationRequest: "@gptworker sửa app giúp tôi",
  bindings: { workspace },
});
assert.equal(explicit.trigger, "explicit_gptworker");

assert.throws(
  () =>
    validateActivationGate({
      trigger: "task_with_workspace",
      activationRequest: "Sửa app này giúp tôi",
      activationWorkspace: workspace,
      bindings: { workspace },
    }),
  /path to appear/
);

const natural = validateActivationGate({
  trigger: "task_with_workspace",
  activationRequest: `Sửa app ở ${workspace} để thêm nút regenerate`,
  activationWorkspace: workspace,
  bindings: { workspace },
});
assert.equal(natural.trigger, "task_with_workspace");
assert.equal(natural.workspace, workspace);

console.log("test-activation-policy: ok");

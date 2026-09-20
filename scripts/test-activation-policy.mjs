import assert from "node:assert/strict";
import path from "node:path";
import { validateActivationGate } from "../dist/lib/activation-policy.js";

const workspace = path.resolve("activation-test-workspace");

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

assert.throws(
  () =>
    validateActivationGate({
      trigger: "task_with_workspace",
      activationRequest: `Sửa app ở ${workspace} để thêm nút regenerate`,
      activationWorkspace: workspace,
      bindings: { workspace: path.resolve("different-workspace") },
    }),
  /must match bindings\.workspace/
);

console.log("test-activation-policy: ok");

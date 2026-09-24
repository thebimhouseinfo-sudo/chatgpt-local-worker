import assert from "node:assert/strict";
import path from "node:path";
import {
  AdmissionRuntime,
  validateActivationGate,
} from "../dist/lib/activation-policy.js";

const workspace = path.resolve("activation-test-workspace");

// Fresh/unarmed session: task + absolute local path must never activate GPTWorker.
const fresh = new AdmissionRuntime();
const directTaskWithPath = fresh.check({
  userTurn: `Sửa app ở ${workspace} để thêm nút regenerate`,
  hasConcreteTask: true,
  workspace,
});
assert.equal(directTaskWithPath.mode, "INACTIVE");
assert.equal(directTaskWithPath.claimed, false);
assert.equal(directTaskWithPath.admission_token, undefined);

const mentionOnly = fresh.check({
  userTurn: `Đừng gọi @gptworker, chỉ giải thích ${workspace}`,
  hasConcreteTask: true,
  workspace,
});
assert.equal(
  mentionOnly.mode,
  "INACTIVE",
  "@gptworker mentioned mid-sentence must not count as explicit invocation"
);

const connectorArmRuntime = new AdmissionRuntime();
const connectorContinuationToken = connectorArmRuntime.armExplicitAt("connector mention: @gptworker");
assert.equal(
  typeof connectorContinuationToken,
  "string",
  "bare connector/job-list arming must mint an opaque continuation token"
);
assert.equal(connectorArmRuntime.isExplicitAtFlowArmed(), true);

const pluginRuntime = new AdmissionRuntime();
const pluginToken = pluginRuntime.armPluginInvocation("app://asdk_app_example");
assert.equal(typeof pluginToken, "string");
const pluginContinuation = new AdmissionRuntime().check({
  userTurn: `Dev Coding ${workspace}`,
  hasConcreteTask: true,
  workspace,
});
assert.equal(pluginContinuation.mode, "ACTIVE");
assert.equal(pluginContinuation.continuation_token, pluginToken);
const pluginProof = new AdmissionRuntime();
const pluginAdmission = pluginProof.check({
  userTurn: `Dev Coding ${workspace}`,
  hasConcreteTask: true,
  workspace,
  continuationToken: pluginToken,
});
assert.equal(pluginAdmission.mode, "ACTIVE");
assert.doesNotThrow(() =>
  pluginProof.activation(pluginAdmission.admission_token, { workspace })
);


const control = fresh.check({ userTurn: "gptworker/job list" });
assert.equal(control.mode, "CONTROL");
assert.equal(control.claimed, false);

const controlGr = fresh.check({ userTurn: "gr/job list" });
assert.equal(controlGr.mode, "CONTROL");
assert.equal(controlGr.claimed, false);

const controlGrHelp = fresh.check({ userTurn: "gr/help" });
assert.equal(controlGrHelp.mode, "CONTROL");
assert.equal(controlGrHelp.claimed, false);

const controlGrMenu = fresh.check({ userTurn: "gr/" });
assert.equal(controlGrMenu.mode, "CONTROL");
assert.equal(controlGrMenu.claimed, false);

// Current-turn explicit @gptworker works.
const explicitAdmission = fresh.check({
  userTurn: `@gptworker sửa app ở ${workspace} để thêm nút regenerate`,
  hasConcreteTask: true,
  workspace,
});
assert.equal(explicitAdmission.mode, "ACTIVE");
assert.equal(explicitAdmission.trigger, "explicit_gptworker");
assert.equal(typeof explicitAdmission.admission_token, "string");

const leadingWhitespaceRuntime = new AdmissionRuntime();
const leadingWhitespaceAdmission = leadingWhitespaceRuntime.check({
  userTurn: `   @gptworker sửa app ở ${workspace}`,
  hasConcreteTask: true,
  workspace,
});
assert.equal(
  leadingWhitespaceAdmission.mode,
  "ACTIVE",
  "leading whitespace before @gptworker should preserve the normal invocation flow"
);

// A current-turn @gptworker arms the chat flow until stop/timeout.
const directAfterExplicit = fresh.check({
  userTurn: `Tiếp tục sửa ${workspace}`,
  hasConcreteTask: true,
  workspace,
});
assert.equal(
  directAfterExplicit.mode,
  "ACTIVE",
  "explicit @gptworker must keep later turns in the same chat flow active"
);
assert.equal(
  fresh.isExplicitAtFlowArmed(),
  true,
  "explicit admission must keep the @ flow armed"
);

// Bare @gptworker can arm the current transport/runtime for the next Job+Workspace reply.
const continuationRuntime = new AdmissionRuntime();
assert.equal(continuationRuntime.isExplicitAtFlowArmed(), false);
const continuationToken = continuationRuntime.armExplicitAt("@gptworker");
assert.equal(typeof continuationToken, "string");
assert.equal(continuationRuntime.isExplicitAtFlowArmed(continuationToken), true);

const continuationAdmission = continuationRuntime.check({
  userTurn: `2 ${workspace}`,
  hasConcreteTask: false,
  workspace,
});
assert.equal(continuationAdmission.mode, "ACTIVE");
assert.equal(continuationAdmission.trigger, "explicit_gptworker");
assert.equal(continuationAdmission.workspace, workspace);
assert.equal(typeof continuationAdmission.admission_token, "string");

// The @ arm persists across later messages in the same chat/runtime.
const secondDirectAfterContinuation = continuationRuntime.check({
  userTurn: `Sửa tiếp repo ở ${workspace}`,
  hasConcreteTask: true,
  workspace,
});
assert.equal(
  secondDirectAfterContinuation.mode,
  "ACTIVE",
  "armed @gptworker authority must persist until stop/timeout"
);
assert.equal(
  continuationRuntime.isExplicitAtFlowArmed(),
  true,
  "continuation admission must not consume the @ arm"
);

assert.equal(
  continuationRuntime.validate(
    continuationAdmission.admission_token,
    workspace
  ).trigger,
  "explicit_gptworker"
);

assert.throws(
  () =>
    continuationRuntime.validate(
      continuationAdmission.admission_token,
      path.resolve("different-workspace")
    ),
  /Workspace does not match/
);

const fromAdmission = continuationRuntime.activation(
  continuationAdmission.admission_token,
  { workspace }
);
assert.equal(fromAdmission.trigger, "explicit_gptworker");
assert.equal(fromAdmission.workspace, workspace);

// Admission tokens are temporary pre-confirmation authority. Once consumed
// after active work registration, they must become invalid.
continuationRuntime.consume(continuationAdmission.admission_token);
assert.throws(
  () =>
    continuationRuntime.validate(
      continuationAdmission.admission_token,
      workspace
    ),
  /ADMISSION_REQUIRED/,
  "consumed admission token must not authorize later job_select/job_switch calls"
);

assert.throws(
  () => continuationRuntime.activation(undefined, { workspace }),
  /ADMISSION_REQUIRED/
);

// A fresh MCP runtime may recover the one unambiguous live bare-@ flow.
const otherTransport = new AdmissionRuntime();
assert.equal(otherTransport.isExplicitAtFlowArmed(), false);
const crossTransportDirect = otherTransport.check({
  userTurn: `Đọc repo ${workspace} và lên kế hoạch`,
  hasConcreteTask: true,
  workspace,
});
assert.equal(
  crossTransportDirect.mode,
  "ACTIVE",
  "unique live bare-@ flow must survive transport rotation even without replayed tool state"
);

// The opaque token remains valid and binds to the same recovered flow when available.
const crossTransportWithFlow = otherTransport.check({
  userTurn: `Đọc repo ${workspace} và lên kế hoạch`,
  hasConcreteTask: true,
  workspace,
  continuationToken,
});
assert.equal(crossTransportWithFlow.mode, "ACTIVE");
assert.equal(crossTransportWithFlow.continuation_token, continuationToken);

// But once an opaque admission token has been minted, that token is the
// authority carrier and must survive legitimate MCP transport rotation.
const rotatingSource = new AdmissionRuntime();
const rotatingAdmission = rotatingSource.check({
  userTurn: `@gptworker đọc repo ${workspace} và lên kế hoạch`,
  hasConcreteTask: true,
  workspace,
});
assert.equal(rotatingAdmission.mode, "ACTIVE");
assert.equal(typeof rotatingAdmission.admission_token, "string");

const rotatedTransport = new AdmissionRuntime();
assert.equal(
  rotatedTransport.validate(rotatingAdmission.admission_token, workspace).trigger,
  "explicit_gptworker",
  "opaque admission token must survive MCP transport rotation"
);

// Once consumed, the token is invalid from every runtime/transport.
rotatedTransport.consume(rotatingAdmission.admission_token);
assert.throws(
  () =>
    rotatingSource.validate(
      rotatingAdmission.admission_token,
      workspace
    ),
  /ADMISSION_REQUIRED/,
  "consumed admission token must be invalid across all transports"
);

// The earlier consumed continuation token must likewise stay invalid.
assert.throws(
  () =>
    otherTransport.validate(
      continuationAdmission.admission_token,
      workspace
    ),
  /ADMISSION_REQUIRED/
);

// A new explicit bare @ invocation supersedes the previous unconfirmed arm,
// preserving one unambiguous process-scoped flow for this local Worker.
const superseding = new AdmissionRuntime();
const replacementToken = superseding.armExplicitAt("@gptworker");
assert.equal(typeof replacementToken, "string");
assert.notEqual(replacementToken, continuationToken);
const recoveredAfterReplace = new AdmissionRuntime().check({
  userTurn: `Dev Coding ${workspace}`,
  hasConcreteTask: true,
  workspace,
});
assert.equal(recoveredAfterReplace.mode, "ACTIVE");
assert.equal(recoveredAfterReplace.continuation_token, replacementToken);

// Lower-level activation proof remains literal-@ based.
assert.throws(
  () => validateActivationGate({ bindings: { workspace } }),
  /ACTIVATION_REQUIRED/
);

assert.throws(
  () =>
    validateActivationGate({
      trigger: "explicit_gptworker",
      activationRequest: `Sửa app ở ${workspace}`,
      bindings: { workspace },
    }),
  /start with @gptworker/
);

assert.throws(
  () =>
    validateActivationGate({
      trigger: "explicit_gptworker",
      activationRequest: "Đừng gọi @gptworker trong câu này",
      bindings: { workspace },
    }),
  /start with @gptworker/,
  "mid-sentence mention must not satisfy the low-level activation proof"
);

const explicit = validateActivationGate({
  trigger: "explicit_gptworker",
  activationRequest: "@gptworker",
  bindings: { workspace },
});
assert.equal(explicit.trigger, "explicit_gptworker");
assert.equal(explicit.workspace, workspace);

assert.throws(
  () =>
    validateActivationGate({
      trigger: "explicit_gptworker",
      activationRequest: "@gptworker",
      bindings: { workspace: "relative-workspace" },
    }),
  /absolute local Workspace/,
  "low-level activation gate must reject a relative Workspace"
);

// If @gptworker is admitted before a Workspace is known, the token may be
// unbound initially, but the first Workspace validation must bind it permanently.
const lateWorkspaceRuntime = new AdmissionRuntime();
const lateWorkspaceAdmission = lateWorkspaceRuntime.check({
  userTurn: "@gptworker",
  hasConcreteTask: false,
});
assert.equal(lateWorkspaceAdmission.mode, "ACTIVE");
assert.equal(lateWorkspaceAdmission.workspace, undefined);
const firstWorkspace = path.resolve("first-workspace");
const secondWorkspace = path.resolve("second-workspace");
assert.throws(
  () =>
    lateWorkspaceRuntime.validate(
      lateWorkspaceAdmission.admission_token,
      "relative-workspace"
    ),
  /absolute local Workspace/,
  "relative Workspace must be rejected before an unbound token is mutated"
);
const preBindProof = lateWorkspaceRuntime.validate(
  lateWorkspaceAdmission.admission_token,
  firstWorkspace
);
assert.equal(
  preBindProof.workspace,
  undefined,
  "validation alone must not mutate an unbound admission token"
);
lateWorkspaceRuntime.bindWorkspace(
  lateWorkspaceAdmission.admission_token,
  firstWorkspace
);
assert.equal(
  lateWorkspaceRuntime.validate(lateWorkspaceAdmission.admission_token).workspace,
  firstWorkspace
);
assert.throws(
  () =>
    lateWorkspaceRuntime.validate(
      lateWorkspaceAdmission.admission_token,
      secondWorkspace
    ),
  /Workspace does not match/,
  "an admission token must bind to the first validated Workspace it authorizes"
);

console.log("test-activation-policy: ok");

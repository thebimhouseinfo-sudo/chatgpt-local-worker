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

const control = fresh.check({ userTurn: "gptworker/job list" });
assert.equal(control.mode, "CONTROL");
assert.equal(control.claimed, false);

// Current-turn explicit @gptworker works.
const explicitAdmission = fresh.check({
  userTurn: `@gptworker sửa app ở ${workspace} để thêm nút regenerate`,
  hasConcreteTask: true,
  workspace,
});
assert.equal(explicitAdmission.mode, "ACTIVE");
assert.equal(explicitAdmission.trigger, "explicit_gptworker");
assert.equal(typeof explicitAdmission.admission_token, "string");

// A current-turn @gptworker request must not leave a stale arm behind either.
const directAfterExplicit = fresh.check({
  userTurn: `Tiếp tục sửa ${workspace}`,
  hasConcreteTask: true,
  workspace,
});
assert.equal(
  directAfterExplicit.mode,
  "INACTIVE",
  "explicit @gptworker admission must not arm future direct requests"
);
assert.equal(
  fresh.isExplicitAtFlowArmed(),
  false,
  "explicit admission must consume the temporary @ arm"
);

// Bare @gptworker can arm the same MCP session for the next Job+Workspace reply.
const continuationRuntime = new AdmissionRuntime();
assert.equal(continuationRuntime.isExplicitAtFlowArmed(), false);
assert.equal(
  continuationRuntime.armExplicitAt("@gptworker"),
  true,
  "literal @gptworker must arm the current MCP session"
);
assert.equal(continuationRuntime.isExplicitAtFlowArmed(), true);

const continuationAdmission = continuationRuntime.check({
  userTurn: `2 ${workspace}`,
  hasConcreteTask: false,
  workspace,
});
assert.equal(continuationAdmission.mode, "ACTIVE");
assert.equal(continuationAdmission.trigger, "explicit_gptworker");
assert.equal(continuationAdmission.workspace, workspace);
assert.equal(typeof continuationAdmission.admission_token, "string");

// The @ arm is one-shot. After the first admitted continuation, a later
// direct task+path in the same MCP session must NOT inherit GPTWorker authority.
const secondDirectAfterContinuation = continuationRuntime.check({
  userTurn: `Sửa tiếp repo ở ${workspace}`,
  hasConcreteTask: true,
  workspace,
});
assert.equal(
  secondDirectAfterContinuation.mode,
  "INACTIVE",
  "armed @gptworker authority must be consumed after the first continuation"
);
assert.equal(
  continuationRuntime.isExplicitAtFlowArmed(),
  false,
  "continuation admission must consume the temporary @ arm"
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

// @ authorization never crosses MCP sessions.
const otherSession = new AdmissionRuntime();
assert.equal(otherSession.isExplicitAtFlowArmed(), false);
const crossSessionDirect = otherSession.check({
  userTurn: `Đọc repo ${workspace} và lên kế hoạch`,
  hasConcreteTask: true,
  workspace,
});
assert.equal(crossSessionDirect.mode, "INACTIVE");
assert.throws(
  () => otherSession.validate(continuationAdmission.admission_token, workspace),
  /another MCP session/
);

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
  /literal @gptworker/
);

const explicit = validateActivationGate({
  trigger: "explicit_gptworker",
  activationRequest: "@gptworker",
  bindings: { workspace },
});
assert.equal(explicit.trigger, "explicit_gptworker");
assert.equal(explicit.workspace, workspace);

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
lateWorkspaceRuntime.validate(
  lateWorkspaceAdmission.admission_token,
  firstWorkspace
);
assert.throws(
  () =>
    lateWorkspaceRuntime.validate(
      lateWorkspaceAdmission.admission_token,
      secondWorkspace
    ),
  /Workspace does not match/,
  "an admission token must bind to the first Workspace it authorizes"
);

console.log("test-activation-policy: ok");

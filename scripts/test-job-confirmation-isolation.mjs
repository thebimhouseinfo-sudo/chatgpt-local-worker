import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JobRuntime } from "../dist/jobs/job-runtime.js";
import { AdmissionRuntime } from "../dist/lib/activation-policy.js";
import { registerJobTools } from "../dist/tools/jobs.js";
import { releaseWorkRegistration } from "../dist/lib/work-registration.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jobsRoot = path.join(repoRoot, "jobs");

function makeSession() {
  const registered = new Map();
  const server = {
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

  const admission = new AdmissionRuntime();
  const runtime = new JobRuntime(jobsRoot);
  registerJobTools(server, runtime, undefined, admission);

  return {
    admission,
    jobSelect: registered.get("job_select")?.callback,
  };
}

function data(result) {
  return result?.structuredContent?.data;
}

const bindings = {
  workspace: repoRoot,
  objective: "Verify confirmation tokens are isolated per MCP session",
};

const sessionA = makeSession();
const admissionA = sessionA.admission.check({
  userTurn: `@gptworker đọc ${repoRoot} và lên kế hoạch`,
  hasConcreteTask: true,
  workspace: repoRoot,
});
assert.equal(admissionA.mode, "ACTIVE");

const nominatedA = await sessionA.jobSelect({
  job: "dev-planing",
  bindings,
  confirmed: false,
  admission_token: admissionA.admission_token,
});
assert.equal(nominatedA.structuredContent.ok, true);
const confirmationA = data(nominatedA)?.confirmation_token;
assert.equal(typeof confirmationA, "string");

const sessionB = makeSession();
const admissionB = sessionB.admission.check({
  userTurn: `@gptworker đọc ${repoRoot} và lên kế hoạch`,
  hasConcreteTask: true,
  workspace: repoRoot,
});
assert.equal(admissionB.mode, "ACTIVE");

// Session B has its own valid @ admission, but it has never shown/received its
// own confirmation prompt. A token minted by session A must not confirm B.
const crossSessionConfirm = await sessionB.jobSelect({
  job: "dev-planing",
  bindings,
  confirmed: true,
  admission_token: admissionB.admission_token,
  confirmation_token: confirmationA,
});

assert.equal(
  crossSessionConfirm.structuredContent.ok,
  false,
  "confirmation token minted in another MCP session must be rejected"
);
assert.match(
  String(data(crossSessionConfirm)?.error || ""),
  /Confirmation token missing\/stale/,
  "cross-session confirmation must fail as missing/stale in this session"
);



const sessionC = makeSession();
const admissionC = sessionC.admission.check({
  userTurn: `@gptworker đọc ${repoRoot} và lên kế hoạch`,
  hasConcreteTask: true,
  workspace: repoRoot,
});
assert.equal(admissionC.mode, "ACTIVE");

const firstBindings = {
  workspace: repoRoot,
  objective: "Plan version A",
};
const firstNomination = await sessionC.jobSelect({
  job: "dev-planing",
  bindings: firstBindings,
  confirmed: false,
  admission_token: admissionC.admission_token,
});
assert.equal(firstNomination.structuredContent.ok, true);
const firstConfirmation = data(firstNomination)?.confirmation_token;
assert.equal(typeof firstConfirmation, "string");

// A confirmation token authorizes exactly the Job + bindings that were shown.
// Changing a non-workspace binding at confirmed=true must not be accepted.
const mutatedAtConfirm = await sessionC.jobSelect({
  job: "dev-planing",
  bindings: {
    workspace: repoRoot,
    objective: "Silently changed after user confirmation",
  },
  confirmed: true,
  admission_token: admissionC.admission_token,
  confirmation_token: firstConfirmation,
});
assert.equal(
  mutatedAtConfirm.structuredContent.ok,
  false,
  "confirmed=true must not alter the bindings covered by the confirmation token"
);
assert.match(
  String(data(mutatedAtConfirm)?.error || ""),
  /bound to different Job\/Workspace bindings/,
  "mutated confirmation bindings must be rejected"
);


const revisedBindings = {
  workspace: repoRoot,
  objective: "Plan version B",
};
const revisedNomination = await sessionC.jobSelect({
  job: "dev-planing",
  bindings: revisedBindings,
  confirmed: false,
  admission_token: admissionC.admission_token,
});
assert.equal(revisedNomination.structuredContent.ok, true);
const revisedConfirmation = data(revisedNomination)?.confirmation_token;
assert.equal(typeof revisedConfirmation, "string");
assert.notEqual(revisedConfirmation, firstConfirmation);

const staleSameSessionConfirm = await sessionC.jobSelect({
  job: "dev-planing",
  bindings: firstBindings,
  confirmed: true,
  admission_token: admissionC.admission_token,
  confirmation_token: firstConfirmation,
});
assert.equal(
  staleSameSessionConfirm.structuredContent.ok,
  false,
  "a superseded confirmation token must not reactivate old bindings"
);
assert.match(
  String(data(staleSameSessionConfirm)?.error || ""),
  /Confirmation token missing\/stale/,
  "superseded confirmation must fail as stale"
);


// Transport rotation must not destroy a valid same-chat authority chain.
// Admission can be minted by one MCP server instance, nomination handled by a
// second, and confirmation/activation handled by a third, provided the exact
// opaque admission + confirmation tokens are carried forward.
const admissionTransportA = new AdmissionRuntime();
const admittedAcrossTransport = admissionTransportA.check({
  userTurn: `@gptworker JOB dev-planing FOLDER ${repoRoot}`,
  hasConcreteTask: true,
  workspace: repoRoot,
});
assert.equal(admittedAcrossTransport.mode, "ACTIVE");
assert.equal(typeof admittedAcrossTransport.admission_token, "string");

const nominationTransportB = makeSession();
const nominatedAcrossTransport = await nominationTransportB.jobSelect({
  job: "dev-planing",
  bindings,
  confirmed: false,
  admission_token: admittedAcrossTransport.admission_token,
});
assert.equal(
  nominatedAcrossTransport.structuredContent.ok,
  true,
  "valid admission token must survive MCP transport rotation before nomination"
);
const crossTransportConfirmation =
  data(nominatedAcrossTransport)?.confirmation_token;
assert.equal(typeof crossTransportConfirmation, "string");

const activationTransportC = makeSession();
const activatedAcrossTransport = await activationTransportC.jobSelect({
  job: "dev-planing",
  bindings,
  confirmed: true,
  admission_token: admittedAcrossTransport.admission_token,
  confirmation_token: crossTransportConfirmation,
});
assert.equal(
  activatedAcrossTransport.structuredContent.ok,
  true,
  "admission + confirmation authority must survive MCP transport rotation"
);
const crossTransportHandle = data(activatedAcrossTransport)?.work_handle;
assert.equal(typeof crossTransportHandle?.execution_id, "string");
assert.equal(typeof crossTransportHandle?.authority_token, "string");

releaseWorkRegistration(
  crossTransportHandle.execution_id,
  crossTransportHandle.authority_token
);

console.log("test-job-confirmation-isolation: ok");

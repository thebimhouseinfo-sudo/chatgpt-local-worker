import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JobRuntime } from "../dist/jobs/job-runtime.js";
import { AdmissionRuntime } from "../dist/lib/activation-policy.js";
import { registerJobTools } from "../dist/tools/jobs.js";

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
  const runtime = new JobRuntime(repoRoot, jobsRoot);
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

console.log("test-job-confirmation-isolation: ok");

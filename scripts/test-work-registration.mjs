import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-work-reg-"));
process.env.LOCAL_WORKER_HOME = tempRoot;

const work = await import("../dist/lib/work-registration.js");
const pathSecurity = await import("../dist/lib/path-security.js");

function comparablePath(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

const wsA = path.join(tempRoot, "Project A");
const wsB = path.join(tempRoot, "Project B");
await fs.mkdir(wsA, { recursive: true });
await fs.mkdir(wsB, { recursive: true });

work.resetWorkRegistrationStateForTests();
assert.equal(work.getWorkIdleTimeoutMs(), 10 * 60 * 1000);

const regA = await work.createWorkRegistration("dev-coding", wsA);
assert.match(regA.executionId, /^exec:dev-coding@project-a#[a-f0-9]{6}:e\d+:g1$/);
assert.equal(typeof regA.authorityToken, "string");
assert.ok(regA.authorityToken.length >= 24);
assert.equal(work.getWorkRegistrationCount(), 1);

assert.throws(
  () => work.validateWorkHandle(regA.executionId, "wrong-token"),
  /NO_ACTIVE_WORK/
);

const validated = work.validateWorkHandle(regA.executionId, regA.authorityToken);
assert.equal(comparablePath(validated.workspace), comparablePath(wsA));

const lease = work.acquireToolLease(
  "read_text_file",
  "filesystem",
  regA.executionId,
  regA.authorityToken
);
assert.match(lease.leaseId, /tool:filesystem@dev-coding@project-a#[a-f0-9]{6}:e\d+:g1:c1/);
assert.equal(work.getActiveToolLeaseCount(), 1);
work.releaseToolLease(lease);
assert.equal(work.getActiveToolLeaseCount(), 0);

await assert.rejects(
  () => work.createWorkRegistration("dev-coding", wsA),
  /Workspace is already registered/
);

const observed = [];
await Promise.all([
  pathSecurity.runWithWorkspaceScope(wsA, [], async () => {
    await new Promise((resolve) => setTimeout(resolve, 25));
    observed.push(pathSecurity.getDefaultCwd());
  }),
  pathSecurity.runWithWorkspaceScope(wsB, [], async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    observed.push(pathSecurity.getDefaultCwd());
  }),
]);
assert.deepEqual(
  new Set(observed.map(comparablePath)),
  new Set([wsA, wsB].map(comparablePath))
);

work.releaseWorkRegistration(regA.executionId, regA.authorityToken);
assert.equal(work.getWorkRegistrationCount(), 0);

const regA2 = await work.createWorkRegistration("dev-coding", wsA);
assert.equal(regA2.generation, 2);
assert.notEqual(regA2.executionId, regA.executionId);
work.releaseWorkRegistration(regA2.executionId, regA2.authorityToken);

// Idle work auto-stops after 10 minutes and invokes the owning runtime cleanup hook.
let idleRuntimeStopped = 0;
const idle = await work.createWorkRegistration("dev-coding", wsB, () => {
  idleRuntimeStopped += 1;
});
idle.lastActivityAt = new Date(Date.now() - work.getWorkIdleTimeoutMs() - 1000).toISOString();
assert.equal(work.sweepExpiredWorkRegistrations(Date.now()), 1);
assert.equal(work.getWorkRegistrationCount(), 0);
assert.equal(idleRuntimeStopped, 1);
assert.throws(
  () => work.validateWorkHandle(idle.executionId, idle.authorityToken),
  /NO_ACTIVE_WORK/
);

// A foreground call protects the work from timeout; the idle clock restarts
// when the call releases its lease.
const busy = await work.createWorkRegistration("dev-coding", wsB);
const busyLease = work.acquireToolLease(
  "read_text_file",
  "filesystem",
  busy.executionId,
  busy.authorityToken
);
busy.lastActivityAt = new Date(Date.now() - work.getWorkIdleTimeoutMs() - 1000).toISOString();
assert.equal(work.sweepExpiredWorkRegistrations(Date.now()), 0);
assert.equal(work.getWorkRegistrationCount(), 1);
work.releaseToolLease(busyLease);
assert.ok(Date.parse(busy.lastActivityAt) > Date.now() - 5000);
work.releaseWorkRegistration(busy.executionId, busy.authorityToken);

await fs.rm(tempRoot, {
  recursive: true,
  force: true,
  maxRetries: 8,
  retryDelay: 75,
});
console.log("test-work-registration: ok");

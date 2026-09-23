import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const sha = b => createHash("sha256").update(b).digest("hex");
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TEST_MS = 90_000;
const MAX_OUTPUT = 5000;

async function canonicalFile(workspace, target) {
  if (!path.isAbsolute(workspace) || !path.isAbsolute(target))
    throw new Error("WORKSPACE_BOUNDARY: absolute paths required");
  const root = await fs.realpath(workspace);
  const resolved = await fs.realpath(target);
  const rel = path.relative(root, resolved);
  if (!rel || rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel))
    throw new Error("WORKSPACE_BOUNDARY: file outside confirmed workspace");
  const stat = await fs.lstat(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES)
    throw new Error("CONTROL_DENIED: only bounded regular files supported");
  return resolved;
}
function testRun(root, testFile, timeoutMs) {
  const result = spawnSync(process.execPath, ["--test", testFile], {
    cwd: root, encoding: "utf8", shell: false,
    timeout: timeoutMs, maxBuffer: MAX_BYTES,
  });
  return { status: result.status, signal: result.signal,
    output: String(result.stdout || "") + "\n" + String(result.stderr || ""),
    error: result.error?.message ?? null };
}
async function replaceSameFile(target, bytes, expectedHash) {
  const now = await fs.readFile(target);
  if (sha(now) !== expectedHash)
    throw new Error("RESTORE_CONFLICT: target changed since last controlled write");
  const temp = target + ".gptworker-negative-" + randomUUID();
  try {
    await fs.writeFile(temp, bytes, { flag: "wx", mode: 0o600 });
    await fs.rename(temp, target);
  } finally {
    await fs.rm(temp, { force: true }).catch(() => {});
  }
}

/**
 * Mutation control requires a prepared, behaviorally relevant wrong
 * implementation. It never edits the test itself, lowers its assertions,
 * or accepts test-runner failure as a useful negative control.
 */
export async function runNegativeControl({
  workspace, implementationFile, mutantFile, testFile,
  acceptanceId, failureMarker, timeoutMs = MAX_TEST_MS,
}) {
  if (typeof acceptanceId !== "string" || !/^[\w-]{2,80}$/.test(acceptanceId))
    throw new Error("CONTROL_DENIED: named acceptance ID required");
  if (typeof failureMarker !== "string" || failureMarker.length < 5 || failureMarker.length > 200)
    throw new Error("CONTROL_DENIED: relevant failing assertion marker required");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > MAX_TEST_MS)
    throw new Error("CONTROL_DENIED: invalid timeout");
  const root = await fs.realpath(workspace);
  const [target, mutant, test] = await Promise.all([
    canonicalFile(root, implementationFile), canonicalFile(root, mutantFile), canonicalFile(root, testFile),
  ]);
  if (target === mutant || target === test || mutant === test)
    throw new Error("CONTROL_DENIED: target, mutant and unchanged test must differ");
  if (!/\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(test))
    throw new Error("CONTROL_DENIED: require a project test file");
  const [original, faulty, testBytes] = await Promise.all([
    fs.readFile(target), fs.readFile(mutant), fs.readFile(test),
  ]);
  if (sha(original) === sha(faulty))
    throw new Error("CONTROL_DENIED: mutant implementation is identical");
  const sourceHash = sha(original), mutantHash = sha(faulty), testHash = sha(testBytes);
  const passBefore = testRun(root, test, timeoutMs);
  if (passBefore.status !== 0 || passBefore.error)
    return { ok: false, reason: "BASELINE_TEST_NOT_PASSING", acceptance_id: acceptanceId,
      baseline_exit: passBefore.status, test_sha256: testHash };
  if (passBefore.output.includes(failureMarker))
    return { ok: false, reason: "FAILURE_MARKER_ALREADY_PRESENT", acceptance_id: acceptanceId };
  let applied = false, cleanupError = null, mutated = null, restored = null;
  try {
    // The test must stay untouched; only mutate the implementation.
    if (sha(await fs.readFile(test)) !== testHash)
      throw new Error("CONTROL_DENIED: test changed before mutation");
    await replaceSameFile(target, faulty, sourceHash);
    applied = true;
    mutated = testRun(root, test, timeoutMs);
  } finally {
    if (applied) {
      try {
        await replaceSameFile(target, original, mutantHash);
        restored = testRun(root, test, timeoutMs);
      } catch (error) {
        cleanupError = error instanceof Error ? error.message : String(error);
      }
    }
  }
  if (cleanupError) throw new Error("RESTORE_CONFLICT: " + cleanupError);
  if (sha(await fs.readFile(test)) !== testHash)
    throw new Error("CONTROL_DENIED: test changed during negative control");
  const assertionObserved = Boolean(mutated && mutated.status !== 0 &&
    !mutated.error && mutated.signal === null && mutated.output.includes(failureMarker));
  const ok = assertionObserved && restored?.status === 0 && !restored.error &&
    sha(await fs.readFile(target)) === sourceHash;
  return { ok, reason: ok ? "BEHAVIORAL_NEGATIVE_CONTROL_VERIFIED" :
      assertionObserved ? "RESTORED_TEST_NOT_PASSING" : "MUTANT_DID_NOT_TRIGGER_NAMED_ASSERTION",
    acceptance_id: acceptanceId, source_sha256: sourceHash, mutant_sha256: mutantHash,
    unchanged_test_sha256: testHash, baseline_exit: passBefore.status,
    mutant_exit: mutated?.status, restored_exit: restored?.status,
    failing_assertion_observed: assertionObserved,
    failure_excerpt: assertionObserved ? mutated.output.slice(-MAX_OUTPUT) : null,
    known_limitation: "One mutation cannot establish exhaustive acceptance coverage.",
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opts = {};
  const argv = process.argv.slice(2);
  try {
    for (let i = 0; i < argv.length; i += 2) {
      if (!argv[i]?.startsWith("--") || !argv[i + 1] || argv[i + 1].startsWith("--"))
        throw new Error("Expected --key value");
      opts[argv[i]] = argv[i + 1];
    }
    const r = await runNegativeControl({
      workspace: opts["--cwd"], implementationFile: opts["--target"],
      mutantFile: opts["--mutant"], testFile: opts["--test"],
      acceptanceId: opts["--acceptance"], failureMarker: opts["--failure-marker"],
    });
    console.log(JSON.stringify(r, null, 2));
    if (!r.ok) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  }
}

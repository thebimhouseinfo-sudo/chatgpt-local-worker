import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

export const CHECKPOINT_SCHEMA = 1;
const MAX_CHECKPOINTS = 40;
const MAX_CHECKPOINT_BYTES = 256 * 1024;
const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;
const TASK_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;

function digest(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
const currentIso = () => new Date().toISOString();

async function canonicalWorkspace(workspace) {
  if (!path.isAbsolute(workspace)) throw new Error("WORKSPACE_BOUNDARY: absolute Workspace required");
  const real = await fs.realpath(workspace);
  if (!(await fs.stat(real)).isDirectory()) throw new Error("WORKSPACE_BOUNDARY: Workspace is not a directory");
  return real;
}
async function contained(workspace, target) {
  if (!path.isAbsolute(target)) throw new Error("WORKSPACE_BOUNDARY: absolute file path required");
  const root = await canonicalWorkspace(workspace);
  const resolved = path.resolve(target);

  // Compare canonical paths only. On Windows, temp/workspace paths can be
  // presented through junctions, aliases, or short/long path spellings; mixing
  // a canonical Workspace with a lexical target causes false boundary rejects.
  // Resolve the nearest existing ancestor first, then append missing segments.
  let cursor = resolved;
  const missing = [];
  while (true) {
    try {
      const real = await fs.realpath(cursor);
      const candidate = path.resolve(real, ...missing);
      const rel = path.relative(root, candidate);
      if (rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel) || !rel) {
        throw new Error("WORKSPACE_BOUNDARY: outside Workspace or symlink/junction escape");
      }
      return {
        root,
        absolute: candidate,
        relative: rel.split(path.sep).join("/"),
      };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw new Error("WORKSPACE_BOUNDARY: no existing ancestor");
      missing.unshift(path.basename(cursor));
      cursor = parent;
    }
  }
}

async function taskDir(workspace, taskId) {
  if (!TASK_ID.test(taskId)) throw new Error("Invalid task id");
  const root = await canonicalWorkspace(workspace);
  const target = path.join(root, ".gptworker", "dev-coding", taskId);
  await contained(root, target);
  return target;
}

async function atomicJson(file, data) {
  const temp = file + "." + process.pid + "." + randomUUID() + ".tmp";
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    await fs.writeFile(temp, JSON.stringify(data, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    await fs.rename(temp, file);
  } finally {
    await fs.rm(temp, { force: true }).catch(() => {});
  }
}
async function readJson(file) {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.size > MAX_CHECKPOINT_BYTES) throw new Error("Invalid checkpoint file");
  return JSON.parse(await fs.readFile(file, "utf8"));
}
export async function hashManifest(workspace, absolutePaths) {
  const unique = [...new Set(absolutePaths)].sort();
  if (unique.length > 4000) throw new Error("Manifest too large");
  const files = [];
  for (const p of unique) {
    const { absolute, relative } = await contained(workspace, p);
    const stat = await fs.lstat(absolute).catch((error) => error.code === "ENOENT" ? null : Promise.reject(error));
    if (!stat) { files.push({ path: relative, exists: false }); continue; }
    if (!stat.isFile()) throw new Error("Manifest path must be a regular file");
    const bytes = await fs.readFile(absolute);
    files.push({ path: relative, exists: true, sha256: digest(bytes), size: bytes.length });
  }
  return { files, fingerprint: digest(JSON.stringify(files)) };
}
export async function createCheckpoint(workspace, taskId, { goal, acceptance = [], scopePaths = [], executionId = null, generation = null }) {
  if (typeof goal !== "string" || !goal.trim()) throw new Error("Goal required");
  const root = await canonicalWorkspace(workspace);
  const dir = await taskDir(root, taskId);
  const scope = await Promise.all(scopePaths.map(p => contained(root, p)));
  const manifest = await hashManifest(root, scope.map(x => x.absolute));
  // Never truncate a checkpoint from a prior conversation or lose its snapshots.
  // Users must explicitly resume an unfinished task or choose a fresh task ID.
  const existing = path.join(dir, "state.json");
  await fs.lstat(existing).then(() => { throw new Error("CHECKPOINT_EXISTS: resume or use a fresh task ID"); },
    error => { if (error.code !== "ENOENT") throw error; });
  const state = {
    schema_version: CHECKPOINT_SCHEMA, task_id: taskId, workspace: root,
    goal, acceptance, scope_paths: scope.map(x => x.absolute),
    execution_id: executionId, generation,
    status: "IN_PROGRESS", iteration: 0, max_iterations: 8,
    active_elapsed_ms: 0, max_active_ms: 45 * 60_000,
    history: [], snapshots: {}, baseline_manifest: manifest, latest_manifest: manifest,
    evidence: [], remaining_goal_gap: [...acceptance], next_action: null, updated_at: currentIso(),
  };
  await atomicJson(path.join(dir, "state.json"), state);
  return state;
}
export async function readCheckpoint(workspace, taskId) {
  const root = await canonicalWorkspace(workspace);
  const dir = await taskDir(root, taskId);
  await contained(root, path.join(dir, "state.json"));
  const state = await readJson(path.join(dir, "state.json"));
  if (state.schema_version !== CHECKPOINT_SCHEMA || state.task_id !== taskId || state.workspace !== root ||
      !Array.isArray(state.scope_paths) || !Array.isArray(state.history)) throw new Error("Checkpoint schema/Workspace mismatch");
  for (const p of state.scope_paths) await contained(root, p);
  return state;
}
export async function saveCheckpoint(workspace, taskId, state) {
  const existing = await readCheckpoint(workspace, taskId);
  if (existing.task_id !== state.task_id || existing.workspace !== state.workspace) throw new Error("Checkpoint identity changed");
  if (!Array.isArray(state.history) || !Array.isArray(state.scope_paths) ||
      JSON.stringify(existing.scope_paths) !== JSON.stringify(state.scope_paths))
    throw new Error("CHECKPOINT_SCOPE_CHANGED: use separately approved scope expansion");
  const clean = { ...state, schema_version: CHECKPOINT_SCHEMA, history: state.history.slice(-8), updated_at: currentIso() };
  const file = path.join(await taskDir(workspace, taskId), "state.json");
  await contained(workspace, file);
  await atomicJson(file, clean);
  return clean;
}
export async function discoverCheckpoints(workspace, requestedId) {
  const root = await canonicalWorkspace(workspace);
  const container = path.join(root, ".gptworker", "dev-coding");
  await contained(root, container);
  const entries = await fs.readdir(container, { withFileTypes: true }).catch(error => error.code === "ENOENT" ? [] : Promise.reject(error));
  const candidates = [];
  for (const entry of entries.slice(0, MAX_CHECKPOINTS)) {
    if (!entry.isDirectory() || !TASK_ID.test(entry.name) || (requestedId && requestedId !== entry.name)) continue;
    try {
      const state = await readCheckpoint(root, entry.name);
      if (!["IN_PROGRESS", "BLOCKED", "FAILED_VALIDATION"].includes(state.status)) continue;
      const current = await hashManifest(root, state.scope_paths);
      candidates.push({
        task_id: state.task_id, goal: state.goal.slice(0, 200),
        status: state.status, iteration: state.iteration,
        last_result: state.history.at(-1)?.result ?? null,
        remaining_goal_gap: state.remaining_goal_gap,
        updated_at: state.updated_at,
        fingerprint_fresh: current.fingerprint === state.latest_manifest.fingerprint,
      });
    } catch { /* Ignore corrupt or escaping checkpoints; never follow them. */ }
  }
  return candidates.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
export async function resumeCheckpoint(workspace, taskId, { executionId, generation }) {
  if (!executionId || !Number.isInteger(generation)) throw new Error("Fresh confirmed execution required");
  const state = await readCheckpoint(workspace, taskId);
  const current = await hashManifest(workspace, state.scope_paths);
  const stale = current.fingerprint !== state.latest_manifest.fingerprint;
  const resumed = await saveCheckpoint(workspace, taskId, {
    ...state, execution_id: executionId, generation,
    latest_manifest: current, evidence: stale ? [] : state.evidence,
    status: "IN_PROGRESS", next_action: stale ? "REVALIDATE_AFTER_SOURCE_DRIFT" : state.next_action,
  });
  return { state: resumed, stale, needs_revalidation: stale };
}
export async function snapshotBeforeEdit(workspace, taskId, absoluteFile) {
  const state = await readCheckpoint(workspace, taskId);
  const { relative, absolute } = await contained(workspace, absoluteFile);
  if (!state.scope_paths.includes(absolute)) throw new Error("SCOPE_DENIED: not an approved path");
  if (state.snapshots[relative]) return state.snapshots[relative];
  const bytes = await fs.readFile(absolute).catch(error => error.code === "ENOENT" ? null : Promise.reject(error));
  if (bytes && bytes.length > MAX_SNAPSHOT_BYTES) throw new Error("Snapshot exceeds safe size limit");
  const record = { existed: bytes !== null, before_hash: bytes ? digest(bytes) : null, last_written_hash: null };
  if (bytes) {
    const dest = path.join(await taskDir(workspace, taskId), "snapshots", digest(relative));
    await contained(workspace, dest);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await contained(workspace, dest);
    await fs.writeFile(dest, bytes, { flag: "wx", mode: 0o600 });
    record.snapshot = dest;
  }
  state.snapshots[relative] = record;
  await saveCheckpoint(workspace, taskId, state);
  return record;
}
export async function registerAgentWrite(workspace, taskId, absoluteFile) {
  const state = await readCheckpoint(workspace, taskId);
  const { relative } = await contained(workspace, absoluteFile);
  const snapshot = state.snapshots[relative];
  if (!snapshot) throw new Error("Missing original-file snapshot");
  const bytes = await fs.readFile(absoluteFile).catch(error => error.code === "ENOENT" ? null : Promise.reject(error));
  snapshot.last_written_hash = bytes === null ? null : digest(bytes);
  snapshot.last_written_absent = bytes === null;
  state.latest_manifest = await hashManifest(workspace, state.scope_paths);
  await saveCheckpoint(workspace, taskId, state);
}
export async function restoreAgentEdit(workspace, taskId, absoluteFile, { approved = false } = {}) {
  if (!approved) throw new Error("Explicit user approval required for restore");
  const state = await readCheckpoint(workspace, taskId);
  const { relative, absolute } = await contained(workspace, absoluteFile);
  const record = state.snapshots[relative];
  if (!record || !Object.hasOwn(record, "last_written_absent")) throw new Error("Missing agent-owned change record");
  const current = await fs.readFile(absolute).catch(error => error.code === "ENOENT" ? null : Promise.reject(error));
  const nowHash = current === null ? null : digest(current);
  if (nowHash !== record.last_written_hash) throw new Error("RESTORE_CONFLICT: user file changed after agent write");
  if (record.existed) {
    await contained(workspace, record.snapshot);
    const previous = await fs.readFile(record.snapshot);
    if (digest(previous) !== record.before_hash) throw new Error("Snapshot integrity failure");
    const temp = absolute + ".gptworker-restore-" + randomUUID();
    await fs.writeFile(temp, previous, { flag: "wx" });
    await fs.rename(temp, absolute);
  } else {
    await fs.rm(absolute, { force: true });
  }
  state.latest_manifest = await hashManifest(workspace, state.scope_paths);
  state.evidence = [];
  await saveCheckpoint(workspace, taskId, state);
  return { restored: absolute };
}
export async function checkIterationBudget(state, nextFailureSignature, newEvidence = false) {
  if (state.iteration >= state.max_iterations || state.active_elapsed_ms >= state.max_active_ms)
    return { stop: true, reason: "BUDGET_EXHAUSTED" };
  const recent = state.history.slice(-2);
  if (!newEvidence && recent.length === 2 && recent.every(x => x.failure_signature === nextFailureSignature))
    return { stop: true, reason: "REPEATED_UNINFORMATIVE_FAILURE" };
  return { stop: false };
}

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createCheckpoint, discoverCheckpoints, readCheckpoint, resumeCheckpoint,
  snapshotBeforeEdit, registerAgentWrite, checkIterationBudget, saveCheckpoint,
} from "./lib/checkpoint.mjs";
import { inspectTaskDiff } from "./lib/snapshot-review.mjs";
import { verifyTaskCompletion } from "./lib/task-completion.mjs";

function args() {
  const [command, ...argv] = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith("--") || !argv[i + 1] || argv[i + 1].startsWith("--"))
      throw new Error("Expected --key value pair: " + key);
    if (options[key]) throw new Error("Duplicate option: " + key);
    options[key] = argv[++i];
  }
  return { command, options };
}
const required = (o, k) => { if (!o[k]) throw new Error("Missing " + k); return o[k]; };
const jsonArray = (o, k) => {
  const value = JSON.parse(required(o, k));
  if (!Array.isArray(value) || !value.length) throw new Error(k + " must be nonempty JSON array");
  return value;
};
const emit = value => console.log(JSON.stringify(value, null, 2));

export async function runCommand(command, options) {
  const root = path.resolve(required(options, "--cwd"));
  if (!path.isAbsolute(options["--cwd"])) throw new Error("WORKSPACE_BOUNDARY: supply absolute --cwd");
  if (command === "discover") {
    return { ok: true, tasks: await discoverCheckpoints(root, options["--task-id"]),
      note: "Read-only discovery. Select resume/new explicitly; no saved next_action executed." };
  }
  const taskId = required(options, "--task-id");
  if (command === "begin") {
    const paths = jsonArray(options, "--scope");
    const acceptance = jsonArray(options, "--acceptance");
    const state = await createCheckpoint(root, taskId, {
      goal: required(options, "--goal"), acceptance, scopePaths: paths,
      executionId: options["--execution-id"] || null,
      generation: options["--generation"] ? Number(options["--generation"]) : null,
    });
    return { ok: true, task_id: state.task_id, fingerprint: state.latest_manifest.fingerprint,
      note: "Call capture before each first edit and wrote immediately after each agent edit." };
  }
  if (command === "resume") {
    const result = await resumeCheckpoint(root, taskId, {
      executionId: required(options, "--execution-id"),
      generation: Number(required(options, "--generation")),
    });
    return { ok: true, task_id: taskId, stale: result.stale,
      next_action: result.state.next_action,
      note: "Caller must validate the new confirmed work handle. CLI never grants work authority." };
  }
  if (command === "capture") {
    const file = required(options, "--file");
    if (!path.isAbsolute(file)) throw new Error("WORKSPACE_BOUNDARY: absolute --file required");
    return { ok: true, snapshot: await snapshotBeforeEdit(root, taskId, file) };
  }
  if (command === "wrote") {
    const file = required(options, "--file");
    if (!path.isAbsolute(file)) throw new Error("WORKSPACE_BOUNDARY: absolute --file required");
    await registerAgentWrite(root, taskId, file);
    return { ok: true, task_id: taskId, file };
  }
  if (command === "iteration") {
    const state = await readCheckpoint(root, taskId);
    const signature = required(options, "--signature");
    const newEvidence = options["--new-evidence"] === "true";
    const budget = await checkIterationBudget(state, signature, newEvidence);
    if (budget.stop) {
      state.status = "FAILED_VALIDATION";
      state.next_action = budget.reason;
    } else {
      state.iteration += 1;
      const durationMs = Number(required(options, "--active-ms"));
      if (!Number.isSafeInteger(durationMs) || durationMs < 0) throw new Error("Invalid active duration");
      state.active_elapsed_ms += durationMs;
      state.history.push({ failure_signature: signature, new_evidence: newEvidence,
        duration_ms: durationMs, result: options["--result"] || "UNVERIFIED",
        input_fingerprint: state.latest_manifest.fingerprint });
      const after = await checkIterationBudget(state, signature, newEvidence);
      if (after.stop) { state.status = "FAILED_VALIDATION"; state.next_action = after.reason; }
    }
    await saveCheckpoint(root, taskId, state);
    return { ok: state.status !== "FAILED_VALIDATION", task_id: taskId, iteration: state.iteration,
      active_elapsed_ms: state.active_elapsed_ms, status: state.status, reason: state.next_action };
  }
  if (command === "diff") return await inspectTaskDiff(root, taskId);
  if (command === "verify") {
    return await verifyTaskCompletion(root, taskId, required(options, "--evidence"));
  }
  throw new Error("Unknown command. Expected discover|begin|resume|capture|wrote|iteration|diff|verify");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { command, options } = args();
    const output = await runCommand(command, options);
    emit(output);
    if (!output.ok) process.exitCode = 1;
  } catch (error) {
    emit({ ok: false, error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  }
}

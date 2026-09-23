import fs from "node:fs/promises";
import path from "node:path";
import { readCheckpoint, hashManifest } from "./checkpoint.mjs";
import { inspectTaskDiff } from "./snapshot-review.mjs";

const REQUIRED_DIFF_ITEMS = [
  "approved-scope", "preserve-user-edits", "no-weakened-tests",
  "no-disabled-lint-security", "no-commented-out-fix", "no-secrets-debug-artifacts",
  "callers-and-interfaces",
];
const ACCEPTABLE = new Set(["PASS", "N/A", "FAIL", "UNAVAILABLE", "NOT_RUN"]);
const gates = ["CODE_QA", "TESTS", "BUILD", "RUNTIME", "BROWSER_QA", "GOAL", "DIFF_REVIEW"];

async function safeEvidenceFile(workspace, absolute) {
  if (!path.isAbsolute(absolute)) throw new Error("EVIDENCE_DENIED: absolute path required");
  const realRoot = await fs.realpath(workspace);
  const realFile = await fs.realpath(absolute);
  const relative = path.relative(realRoot, realFile);
  if (!relative || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative))
    throw new Error("EVIDENCE_DENIED: evidence must be inside confirmed Workspace");
  const stat = await fs.lstat(realFile);
  if (!stat.isFile() || stat.size > 256 * 1024) throw new Error("EVIDENCE_DENIED: invalid evidence file");
  return JSON.parse(await fs.readFile(realFile, "utf8"));
}

/**
 * Distinct from legacy structural completion-gate: a successful result here
 * requires fresh task-specific evidence and every acceptance signal.
 * The Coder cannot infer Goal PASS from a green build or self-generated tests.
 */
export async function verifyTaskCompletion(workspace, taskId, evidenceFile) {
  const root = await fs.realpath(workspace);
  const state = await readCheckpoint(root, taskId);
  const current = await hashManifest(root, state.scope_paths);
  const snapshot = await inspectTaskDiff(root, taskId);
  const evidence = await safeEvidenceFile(root, evidenceFile);
  const problems = [];
  const missing = rule => problems.push(rule);
  if (evidence.task_id !== taskId) missing("task-id-mismatch");
  if (evidence.input_fingerprint !== current.fingerprint) missing("stale-source-fingerprint");
  if (state.latest_manifest.fingerprint !== current.fingerprint) missing("checkpoint-stale");
  if (!snapshot.ok) missing("unsafe-snapshot-diff");
  if (!Array.isArray(state.acceptance) || state.acceptance.length === 0) missing("missing-acceptance-contract");
  if (!evidence.checks || typeof evidence.checks !== "object") missing("missing-checks");
  const statuses = {};
  for (const gate of gates) {
    const record = evidence.checks?.[gate];
    const status = record?.status;
    statuses[gate] = ACCEPTABLE.has(status) ? status : "NOT_RUN";
    if (!["PASS", "N/A"].includes(statuses[gate])) missing(gate + ":" + statuses[gate]);
    if (["CODE_QA", "TESTS", "GOAL", "DIFF_REVIEW"].includes(gate) && status !== "PASS")
      missing(gate + ":requires-PASS");
    if (status === "PASS" && (typeof record.observation !== "string" || record.observation.trim().length < 10))
      missing(gate + ":missing-observation");
    if (status === "N/A" && (typeof record.reason !== "string" || !record.reason.trim()))
      missing(gate + ":missing-na-reason");
  }
  if (evidence.browser_required === true && statuses.BROWSER_QA !== "PASS") missing("required-browser-not-verified");
  if (evidence.runtime_required === true && statuses.RUNTIME !== "PASS") missing("required-runtime-not-verified");
  if (evidence.build_required === true && statuses.BUILD !== "PASS") missing("required-build-not-verified");
  const signals = Array.isArray(evidence.acceptance) ? evidence.acceptance : [];
  for (const signal of state.acceptance || []) {
    const found = signals.find(s => s.id === signal && s.status === "PASS" &&
      typeof s.observation === "string" && s.observation.trim().length >= 10 &&
      typeof s.evidence_ref === "string" && s.evidence_ref.trim());
    if (!found) missing("unverified-acceptance:" + signal);
  }
  const reviews = Array.isArray(evidence.diff_review) ? evidence.diff_review : [];
  for (const key of REQUIRED_DIFF_ITEMS) {
    const item = reviews.find(x => x.rule === key && x.status === "PASS" &&
      typeof x.evidence === "string" && x.evidence.trim().length >= 10);
    if (!item) missing("missing-diff-review:" + key);
  }
  if (snapshot.findings.some(f => f.severity === "warning") &&
      !reviews.some(x => x.rule === "warnings-reviewed" && x.status === "PASS" && x.evidence?.length >= 10)) {
    missing("diff-warnings-unreviewed");
  }
  const ok = problems.length === 0;
  return { ok, goal_status: ok ? "PASS" : "BLOCKED", task_id: taskId,
    current_fingerprint: current.fingerprint, gates: statuses,
    problems: [...new Set(problems)], diff: snapshot,
    note: ok ? "All task-specific evidence gates have been supplied and are fresh." :
      "Structural success alone cannot claim DONE. Resolve each listed evidence gap." };
}

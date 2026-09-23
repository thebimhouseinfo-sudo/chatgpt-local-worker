import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { arg, exists, resolveCwd, emit } from "./lib/common.mjs";
import { discoverCheckpoints } from "./lib/checkpoint.mjs";

const cwd = resolveCwd();
const harnessDir = path.dirname(fileURLToPath(import.meta.url));
const planArg = arg("--plan", "");
const architectureArg = arg("--architecture", "");
// Discovery is read-only and requires a confirmed active Job execution.
const activeExecutionId = arg("--active-execution-id", null);
const resumeTaskId = arg("--task-id", null);
const checkpoints = activeExecutionId
  ? await discoverCheckpoints(cwd, resumeTaskId)
  : [];

function runJson(script, args = []) {
  const child = spawnSync(process.execPath, [path.join(harnessDir, script), "--cwd", cwd, ...args], {
    cwd,
    encoding: "utf8",
  });

  let payload = null;
  try {
    payload = child.stdout ? JSON.parse(child.stdout) : null;
  } catch {
    payload = null;
  }

  return {
    ok: child.status === 0 && Boolean(payload?.ok),
    status: child.status,
    payload,
    stderr: child.stderr?.trim() || "",
  };
}

async function contextFile(kind, value) {
  if (!value) return { kind, supplied: false, path: null, resolved: null, exists: null, inside_workspace: null };
  const resolved = path.resolve(cwd, value);
  const relative = path.relative(cwd, resolved);
  const insideWorkspace = relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  return {
    kind,
    supplied: true,
    path: value,
    resolved,
    exists: await exists(resolved),
    inside_workspace: insideWorkspace,
  };
}

const [plan, architecture] = await Promise.all([
  contextFile("plan", planArg),
  contextFile("architecture", architectureArg),
]);

const inspectionRun = runJson("inspect-repo.mjs");
const qualityRun = runJson("quality-gate.mjs");
const inspection = inspectionRun.payload;
const quality = qualityRun.payload;
const dirty = inspection?.git?.status || [];
const validationCandidates = (quality?.discovered || []).map((item) => ({
  category: item.category,
  command: item.command,
}));

const planningHints = [];
if (plan.supplied && plan.exists) planningHints.push("read-implementation-plan-before-source-inspection");
if (architecture.supplied && architecture.exists) planningHints.push("read-architecture-before-source-inspection");
if (plan.supplied && !plan.exists) planningHints.push("supplied-plan-path-does-not-exist");
if (architecture.supplied && !architecture.exists) planningHints.push("supplied-architecture-path-does-not-exist");
if (dirty.length) planningHints.push("protect-existing-dirty-worktree-changes");
if ((inspection?.instruction_files || []).length) planningHints.push("read-repository-instructions-before-editing");
if (validationCandidates.length) planningHints.push("choose-targeted-repository-native-validation-before-editing");
if (inspection?.monorepo_signals && Object.values(inspection.monorepo_signals).some(Boolean)) planningHints.push("bound-package-workspace-scope-before-editing");
planningHints.push("prefer-targeted-implementation-discovery-over-full-repository-review");

const contextOk = (!plan.supplied || plan.exists) && (!architecture.supplied || architecture.exists);
const ok = contextOk && inspectionRun.ok && qualityRun.ok;
emit({
  ok,
  purpose: "dev-coding-execution-preflight",
  cwd,
  context_files: { plan, architecture },
  repository: {
    git: inspection?.git || null,
    manifests: inspection?.manifests || [],
    lockfiles: inspection?.lockfiles || [],
    instruction_files: inspection?.instruction_files || [],
    source_dirs: inspection?.source_dirs || [],
    test_dirs: inspection?.test_dirs || [],
    ci_workflows: inspection?.ci_workflows || [],
    package_manager: inspection?.package_manager || null,
    monorepo_signals: inspection?.monorepo_signals || {},
    languages: inspection?.languages || {},
  },
  worktree: {
    dirty: dirty.length > 0,
    changed_entries: dirty,
  },
  validation_candidates: validationCandidates,
  planning_hints: planningHints,
  checkpoint_discovery: {
    scanned: Boolean(activeExecutionId),
    unfinished: checkpoints,
    action: checkpoints.length === 0 ? "START_NEW" : checkpoints.length === 1 ? "OFFER_RESUME_OR_NEW" : "REQUIRE_TASK_SELECTION",
    note: "Never resume automatically; a fresh confirmed handle and explicit task selection are required.",
  },
  note: "Deterministic root/context preflight only. Read plan/architecture first when supplied, then inspect only implementation-relevant code. This harness does not perform repository archaeology or generate a formal plan.",
  failures: [
    ...(!contextOk ? [{ harness: "context-files", status: 1, stderr: "One or more supplied context paths do not exist." }] : []),
    ...(inspectionRun.ok ? [] : [{ harness: "inspect-repo.mjs", status: inspectionRun.status, stderr: inspectionRun.stderr }]),
    ...(qualityRun.ok ? [] : [{ harness: "quality-gate.mjs", status: qualityRun.status, stderr: qualityRun.stderr }]),
  ],
});
if (!ok) process.exitCode = 1;

import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { resolveCwd, emit } from "./lib/common.mjs";

const cwd = resolveCwd();
const harnessDir = path.dirname(fileURLToPath(import.meta.url));

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
if (dirty.length) planningHints.push("protect-existing-dirty-worktree-changes");
if ((inspection?.instruction_files || []).length) planningHints.push("read-repository-instructions-before-editing");
if (validationCandidates.length) planningHints.push("choose-targeted-repository-native-validation-before-editing");
if (inspection?.monorepo_signals && Object.values(inspection.monorepo_signals).some(Boolean)) planningHints.push("bound-package-workspace-scope-before-editing");

const ok = inspectionRun.ok && qualityRun.ok;
emit({
  ok,
  purpose: "dev-coding-execution-preflight",
  cwd,
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
  note: "Deterministic preflight evidence only; this harness does not generate architecture or a formal implementation plan.",
  failures: [
    ...(inspectionRun.ok ? [] : [{ harness: "inspect-repo.mjs", status: inspectionRun.status, stderr: inspectionRun.stderr }]),
    ...(qualityRun.ok ? [] : [{ harness: "quality-gate.mjs", status: qualityRun.status, stderr: qualityRun.stderr }]),
  ],
});
if (!ok) process.exitCode = 1;

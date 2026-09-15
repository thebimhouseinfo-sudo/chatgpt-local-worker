import path from "node:path";
import { fileURLToPath } from "node:url";
import { flag, arg, run, resolveCwd, emit } from "./lib/common.mjs";

const cwd = resolveCwd();
const harnessDir = path.dirname(fileURLToPath(import.meta.url));
const runQuality = flag("--run-quality");
const categories = arg("--categories", null);

function runJson(script, extra = []) {
  const result = run(cwd, process.execPath, [path.join(harnessDir, script), "--cwd", cwd, ...extra], { timeoutMs: Number(arg("--timeout-ms", "600000")), maxChars: 100000 });
  let data = null;
  try { data = JSON.parse(result.stdout); } catch {}
  return { process_ok: result.ok, data, stderr: result.stderr };
}

const validation = runJson("validate.mjs");
const inspection = runJson("inspect-repo.mjs");
const diff = runJson("diff-gate.mjs");
const audit = runJson("change-audit.mjs");
const dependencies = runJson("dependency-gate.mjs");
const qualityArgs = [];
if (runQuality) qualityArgs.push("--run");
if (categories) qualityArgs.push("--categories", categories);
const quality = runJson("quality-gate.mjs", qualityArgs);

const required = { validation, inspection, diff, audit, dependencies };
const failedRequired = Object.entries(required).filter(([, gate]) => !gate.process_ok || gate.data?.ok === false).map(([name]) => name);
const qualityFailed = runQuality && (!quality.process_ok || quality.data?.ok === false);
const ok = failedRequired.length === 0 && !qualityFailed;

emit({
  ok,
  cwd,
  mode: runQuality ? "structural+quality" : "structural+quality-discovery",
  failed_required_gates: failedRequired,
  quality_executed: runQuality,
  gates: { validation: validation.data, inspection: inspection.data, diff: diff.data, change_audit: audit.data, dependency_gate: dependencies.data, quality: quality.data },
  note: runQuality ? "Structural gates and discovered quality commands were executed." : "Structural gates ran; quality commands were discovered only. Run task-appropriate tests/checks separately or pass --run-quality after reviewing discovery."
});
if (!ok) process.exitCode = 1;

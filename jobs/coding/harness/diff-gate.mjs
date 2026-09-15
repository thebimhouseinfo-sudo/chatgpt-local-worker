import path from "node:path";
import { spawnSync } from "node:child_process";

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
function run(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", shell: false });
  return { status: result.status, ok: result.status === 0, stdout: (result.stdout || "").trim(), stderr: (result.stderr || "").trim() };
}

const cwd = path.resolve(arg("--cwd", process.cwd()));
const inside = run(cwd, ["rev-parse", "--is-inside-work-tree"]);
if (!inside.ok || inside.stdout !== "true") {
  console.log(JSON.stringify({ ok: true, cwd, git: false, note: "Not a Git worktree; diff gate skipped." }, null, 2));
  process.exit(0);
}

const check = run(cwd, ["diff", "--check"]);
const status = run(cwd, ["status", "--short"]);
const stat = run(cwd, ["diff", "--stat"]);
const names = run(cwd, ["diff", "--name-only"]);
const stagedStat = run(cwd, ["diff", "--cached", "--stat"]);
const stagedNames = run(cwd, ["diff", "--cached", "--name-only"]);
const ok = check.ok;

console.log(JSON.stringify({
  ok,
  cwd,
  git: true,
  whitespace_check: check,
  status: status.stdout.split(/\r?\n/).filter(Boolean),
  unstaged: { stat: stat.stdout, files: names.stdout.split(/\r?\n/).filter(Boolean) },
  staged: { stat: stagedStat.stdout, files: stagedNames.stdout.split(/\r?\n/).filter(Boolean) }
}, null, 2));
if (!ok) process.exitCode = 1;

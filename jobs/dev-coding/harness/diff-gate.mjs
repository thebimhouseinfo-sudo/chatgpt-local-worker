import { arg, run, lines, resolveCwd, emit } from "./lib/common.mjs";

const cwd = resolveCwd();
const base = arg("--base", null);
const inside = run(cwd, "git", ["rev-parse", "--is-inside-work-tree"]);
if (!inside.ok || inside.stdout !== "true") {
  emit({ ok: true, cwd, git: false, note: "Not a Git worktree; diff gate skipped." });
  process.exit(0);
}

const unstagedCheck = run(cwd, "git", ["diff", "--check"]);
const stagedCheck = run(cwd, "git", ["diff", "--cached", "--check"]);
const conflicts = run(cwd, "git", ["diff", "--name-only", "--diff-filter=U"]);
const status = run(cwd, "git", ["status", "--short", "--untracked-files=all"]);
const unstagedNames = run(cwd, "git", ["diff", "--name-only"]);
const stagedNames = run(cwd, "git", ["diff", "--cached", "--name-only"]);
const branch = run(cwd, "git", ["branch", "--show-current"]).stdout;
const head = run(cwd, "git", ["rev-parse", "HEAD"]).stdout;
let baseDiff = null;
if (base) {
  const mergeBase = run(cwd, "git", ["merge-base", base, "HEAD"]);
  baseDiff = mergeBase.ok ? {
    base,
    merge_base: mergeBase.stdout,
    files: lines(run(cwd, "git", ["diff", "--name-only", `${mergeBase.stdout}...HEAD`]).stdout),
    stat: run(cwd, "git", ["diff", "--stat", `${mergeBase.stdout}...HEAD`]).stdout,
  } : { base, error: mergeBase.stderr || "Unable to resolve merge-base" };
}
const conflictFiles = lines(conflicts.stdout);
const ok = unstagedCheck.ok && stagedCheck.ok && conflictFiles.length === 0;

emit({
  ok,
  cwd,
  git: true,
  branch,
  head,
  whitespace_check: { unstaged: unstagedCheck, staged: stagedCheck },
  unresolved_conflicts: conflictFiles,
  status: lines(status.stdout),
  unstaged: { files: lines(unstagedNames.stdout), stat: run(cwd, "git", ["diff", "--stat"]).stdout },
  staged: { files: lines(stagedNames.stdout), stat: run(cwd, "git", ["diff", "--cached", "--stat"]).stdout },
  base_diff: baseDiff,
});
if (!ok) process.exitCode = 1;

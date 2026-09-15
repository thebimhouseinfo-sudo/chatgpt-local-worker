import fs from "node:fs/promises";
import path from "node:path";
import { run, lines, unique, resolveCwd, emit, exists } from "./lib/common.mjs";

const cwd = resolveCwd();
const inside = run(cwd, "git", ["rev-parse", "--is-inside-work-tree"]);
if (!inside.ok) {
  emit({ ok: true, cwd, git: false, findings: [], note: "Not a Git worktree; dependency gate skipped." });
  process.exit(0);
}
const changed = unique([...lines(run(cwd, "git", ["diff", "--name-only"]).stdout), ...lines(run(cwd, "git", ["diff", "--cached", "--name-only"]).stdout), ...lines(run(cwd, "git", ["ls-files", "--others", "--exclude-standard"]).stdout)]);
const changedSet = new Set(changed.map((v) => v.replaceAll("\\", "/")));
const findings = [];
const depKeys = ["dependencies","devDependencies","peerDependencies","optionalDependencies","overrides","resolutions","packageManager"];

for (const rel of changed.filter((name) => name.endsWith("package.json"))) {
  let current;
  try { current = JSON.parse(await fs.readFile(path.join(cwd, rel), "utf8")); } catch { continue; }
  const previousRaw = run(cwd, "git", ["show", `HEAD:${rel.replaceAll("\\", "/")}`]);
  if (!previousRaw.ok) continue;
  let previous;
  try { previous = JSON.parse(previousRaw.stdout); } catch { continue; }
  const depChanged = depKeys.some((key) => JSON.stringify(previous?.[key] ?? null) !== JSON.stringify(current?.[key] ?? null));
  if (!depChanged) continue;
  const rootLocks = ["pnpm-lock.yaml","package-lock.json","yarn.lock","bun.lock","bun.lockb"];
  const existingLocks = [];
  for (const lock of rootLocks) if (await exists(path.join(cwd, lock))) existingLocks.push(lock);
  if (existingLocks.length && !existingLocks.some((lock) => changedSet.has(lock))) {
    findings.push({ severity: "error", file: rel, rule: "lockfile-not-updated", detail: `Dependency fields changed but existing lockfile(s) are unchanged: ${existingLocks.join(", ")}` });
  }
}

for (const pair of [["Cargo.toml","Cargo.lock"],["pyproject.toml","poetry.lock"]]) {
  const [manifest, lock] = pair;
  if (changedSet.has(manifest) && await exists(path.join(cwd, lock)) && !changedSet.has(lock)) {
    findings.push({ severity: "warning", file: manifest, rule: "lockfile-review", detail: `${manifest} changed while ${lock} did not; verify whether dependency resolution changed.` });
  }
}

const errors = findings.filter((finding) => finding.severity === "error");
emit({ ok: errors.length === 0, cwd, git: true, changed_files: changed, findings, summary: { errors: errors.length, warnings: findings.length - errors.length } });
if (errors.length) process.exitCode = 1;

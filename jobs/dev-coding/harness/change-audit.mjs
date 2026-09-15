import fs from "node:fs/promises";
import path from "node:path";
import { run, lines, unique, resolveCwd, emit } from "./lib/common.mjs";

const cwd = resolveCwd();
const inside = run(cwd, "git", ["rev-parse", "--is-inside-work-tree"]);
if (!inside.ok) {
  emit({ ok: true, cwd, git: false, findings: [], note: "Not a Git worktree; changed-file audit skipped." });
  process.exit(0);
}

const changed = unique([
  ...lines(run(cwd, "git", ["diff", "--name-only"]).stdout),
  ...lines(run(cwd, "git", ["diff", "--cached", "--name-only"]).stdout),
  ...lines(run(cwd, "git", ["ls-files", "--others", "--exclude-standard"]).stdout),
]);
const findings = [];
const add = (severity, file, rule, detail) => findings.push({ severity, file, rule, detail });

for (const rel of changed) {
  const full = path.join(cwd, rel);
  let stat;
  try { stat = await fs.stat(full); } catch { continue; }
  if (!stat.isFile()) continue;
  const base = path.basename(rel).toLowerCase();
  if (stat.size > 5 * 1024 * 1024) add("warning", rel, "large-file", `Changed file is ${(stat.size / 1024 / 1024).toFixed(1)} MiB`);
  if ((base === ".env" || base.endsWith(".pem") || base.endsWith(".key")) && base !== ".env.example") {
    add("error", rel, "sensitive-file", "Sensitive-looking file is changed/untracked; verify it is safe to commit.");
  }
  if (stat.size > 1024 * 1024) continue;
  const buf = await fs.readFile(full).catch(() => null);
  if (!buf || buf.includes(0)) continue;
  const text = buf.toString("utf8");
  if (/^(<<<<<<<|=======|>>>>>>>) /m.test(text) || /^(<<<<<<<|>>>>>>>)$/m.test(text)) add("error", rel, "conflict-marker", "Possible unresolved merge conflict marker.");
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) add("error", rel, "private-key", "Private-key material detected in changed file.");
  if (/(?:[A-Za-z]:\\Users\\[^\s"']+|\/Users\/[^\s/]+\/|\/home\/[^\s/]+\/)/.test(text)) add("warning", rel, "machine-path", "Machine-specific absolute user path detected.");
  if (/\bdebugger\s*;/.test(text)) add("warning", rel, "debugger", "Debugger statement detected in changed file.");
}

const errors = findings.filter((finding) => finding.severity === "error");
emit({ ok: errors.length === 0, cwd, git: true, changed_files: changed, findings, summary: { files: changed.length, errors: errors.length, warnings: findings.length - errors.length } });
if (errors.length) process.exitCode = 1;

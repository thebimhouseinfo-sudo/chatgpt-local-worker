import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const browser = process.argv.includes("--browser");
const sha = text => createHash("sha256").update(text).digest("hex");
const windows = process.platform === "win32";
const npmCmd = (script) => {
  if (windows) return [process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm", "run", script]];
  return ["npm", ["run", script]];
};
const taskRun = (label, command, args, timeoutMs = 240000) => {
  console.log("RUN " + label);
  const started = Date.now();
  const child = spawnSync(command, args, {
    cwd: root, env: process.env, shell: false, encoding: "utf8",
    timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024,
  });
  const result = {
    label, exit_code: child.status, signal: child.signal,
    duration_ms: Date.now() - started,
    status: child.status === 0 && !child.error ? "PASS" : "FAIL",
    output_sha256: sha(String(child.stdout || "") + String(child.stderr || "")),
    // Bounded and redacted excerpt: the full test output stays on stdout, not
    // copied wholesale into artifacts that may contain developer local paths.
    excerpt: child.status === 0 ? String(child.stdout || "").trim().split("\n").slice(-2).join("\n").slice(-300) : null,
    error: child.error?.message || null,
  };
  if (child.stdout) process.stdout.write(child.stdout);
  if (child.stderr) process.stderr.write(child.stderr);
  return result;
};

const checks = [];
checks.push(taskRun("build", ...npmCmd("build")));
if (checks.at(-1).status === "PASS") {
  checks.push(taskRun("job-pack-validation", ...npmCmd("validate:jobs")));
  const focused = [
    "test-dev-coding-checkpoint.mjs",
    "test-dev-coding-task-session.mjs",
    "test-dev-coding-negative-control.mjs",
    "test-dev-coding-completion.mjs",
    "test-setup-agent-browser.mjs",
    "test-browser-capability.mjs",
    "test-browser-mcp-contract.mjs",
    "test-browser-work-gateway.mjs",
  ];
  for (const script of focused) {
    checks.push(taskRun(script, process.execPath, [path.join(root, "scripts", script)], 90000));
    if (checks.at(-1).status !== "PASS") break;
  }
  if (checks.every(x => x.status === "PASS")) {
    checks.push(taskRun("default-test-suite", ...npmCmd("test"), 600000));
  }
  if (checks.every(x => x.status === "PASS")) {
    checks.push(taskRun("runtime-integration", ...npmCmd("test:all"), 600000));
  }
  if (browser && checks.every(x => x.status === "PASS")) {
    checks.push(taskRun("real-windows-upstream-browser", process.execPath,
      [path.join(root, "scripts", "test-browser-windows-smoke.mjs")], 180000));
    if (checks.at(-1).status === "PASS") {
      checks.push(taskRun("real-windows-gateway-browser", process.execPath,
        [path.join(root, "scripts", "test-browser-gateway-windows-e2e.mjs")], 180000));
    }
  }
}
const passed = checks.every(c => c.status === "PASS");
const report = {
  schema_version: 1, source: "gptworker-dev-coding-validation",
  timestamp: new Date().toISOString(), platform: process.platform,
  node: process.version, browser_requested: browser,
  source_checks: checks.map(({ excerpt, ...rest }) => rest),
  result: passed ? (browser ? "AUTOMATED_BROWSER_PASS_MANUAL_ACCEPTANCE_PENDING" :
    "SOURCE_PASS_BROWSER_AND_MANUAL_ACCEPTANCE_PENDING") : "FAILED_VALIDATION",
  required_manual_evidence: [
    "Fresh MCP tools/list after YES and NO with stale tool calls denied",
    "Authorized Dev Coding end-to-end UI task and Goal evidence",
    "Custom Job denied and Job stop revokes browser subprocess",
    "All applicable A01-A36 rows with observed results and safe logs",
  ],
  warning: "Automated green is not full A01-A36 task acceptance.",
};
const evidenceDir = path.join(root, ".gptworker", "dev-coding", "acceptance");
await fs.mkdir(evidenceDir, { recursive: true });
const reportFile = path.join(evidenceDir, "source-validation.json");
const temp = reportFile + "." + process.pid + ".tmp";
try {
  await fs.writeFile(temp, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  await fs.rename(temp, reportFile);
} finally { await fs.rm(temp, { force: true }).catch(() => {}); }
console.log("\nSUMMARY " + report.result + "\nREPORT " + reportFile);
if (!passed) process.exitCode = 1;

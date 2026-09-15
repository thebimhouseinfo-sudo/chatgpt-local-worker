/**
 * Test instruction context builder (project context + Worker policy).
 * Run: node scripts/test-project-memory.mjs
 */
import {
  buildInstructionContext,
  summarizeInstructionContext,
} from "../dist/lib/instruction-context.js";

const workspaceRoot = process.env.WORKSPACE_PATH || process.cwd();
let passed = 0;
let failed = 0;

function ok(name) {
  console.log(`OK  ${name}`);
  passed++;
}
function fail(name, err) {
  console.error(`FAIL ${name}: ${err}`);
  failed++;
}

try {
  const ctx = await buildInstructionContext({
    workspaceRoot,
    workspaceRoots: [workspaceRoot],
    pid: process.pid,
    adminPort: 3001,
  });

  if (!ctx.instructionsText.includes("Core execution workflow")) {
    throw new Error("missing Local Worker core execution prompt");
  }
  ok("Local Worker core prompt in instructions");

  if (!ctx.workerPolicy.loaded) {
    throw new Error(`WORKER.md was not loaded from ${ctx.workerPolicy.path}`);
  }
  if (
    !ctx.instructionsText.includes("Mandatory preflight") ||
    !ctx.instructionsText.includes("JOB") ||
    !ctx.instructionsText.includes("FOLDER") ||
    !ctx.instructionsText.includes("Xác nhận bắt đầu?")
  ) {
    throw new Error("missing GPTWorker JOB/FOLDER confirmation policy");
  }
  ok("WORKER.md GPTWorker preflight policy loaded separately from project memory");

  if (!ctx.instructionsText.includes("## Environment")) {
    throw new Error("missing environment block");
  }
  ok("environment block");

  if (!ctx.instructionsText.includes("## Git")) {
    throw new Error("missing git block");
  }
  ok("git block");

  if (!ctx.instructionsText.includes("job_list")) {
    throw new Error("missing Job Runtime quick pointers");
  }
  ok("job runtime pointers");

  if (!ctx.instructionsText.includes("agent_status")) {
    throw new Error("missing core-tool footer pointer");
  }
  ok("core-tool pointer retained");

  if (ctx.instructionBytes < 500) {
    throw new Error(`instructions too small: ${ctx.instructionBytes}`);
  }
  ok(`instruction size ${Math.round(ctx.instructionBytes / 1024)}KB`);

  const summary = summarizeInstructionContext(ctx);
  if (!summary.root) throw new Error("summary missing root");
  if (!summary.worker_policy?.loaded) {
    throw new Error("summary missing loaded worker policy state");
  }
  ok("summarizeInstructionContext");

  console.log("\nGit:", ctx.git.is_repo ? ctx.git.branch : "not a repo");
  console.log("Worker policy:", ctx.workerPolicy.path);
  console.log(
    "Memory files:",
    ctx.projectMemory.sections.map((s) => s.path).join(", ") || "(none)"
  );
} catch (err) {
  fail("buildInstructionContext", err.message || err);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

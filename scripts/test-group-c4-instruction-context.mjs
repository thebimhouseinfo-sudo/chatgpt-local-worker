import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildInstructionContext,
  summarizeInstructionContext,
} from "../dist/lib/instruction-context.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.CHATGPT_TOOL_PROFILE = "slim";

const ctx = await buildInstructionContext({
  workspaceRoot: repoRoot,
  workspaceRoots: [repoRoot],
  pid: process.pid,
});

assert.equal(ctx.toolProfile, "slim");
assert.equal(ctx.workspaceRoot, repoRoot);
assert.deepEqual(ctx.workspaceRoots, [repoRoot]);

assert.equal(ctx.contextText.includes("## GPTWorker control plane"), true);
assert.equal(ctx.contextText.includes("Startup root:"), true);
assert.equal(ctx.contextText.includes("Project files, project-local context, skills, and Git state are loaded only after"), true);

for (const forbidden of [
  "Core execution workflow",
  "## Git",
  "## Project memory",
  "## Project context",
  "# GPTWorker — Worker Policy",
  "CLAUDE.md",
  "Auto memory",
]) {
  assert.equal(
    ctx.contextText.includes(forbidden),
    false,
    `initialize context contains rich/legacy block: ${forbidden}`
  );
}

assert.equal(ctx.instructionsText.includes("gptworker_admission"), true);
assert.equal(ctx.instructionsText.includes("job_select"), true);
assert.equal(ctx.instructionsText.includes("work_tool"), true);
assert.equal(ctx.instructionsText.includes("## GPTWorker control plane"), true);
assert.equal(ctx.instructionBytes > 500, true);

const summary = summarizeInstructionContext(ctx);
assert.equal(summary.mode, "control-plane");
assert.equal(summary.root, repoRoot);
assert.equal(summary.tool_profile, "slim");
assert.equal("memory_files" in summary, false);
assert.equal("git" in summary, false);
assert.equal("worker_policy" in summary, false);

const source = await (await import("node:fs/promises")).readFile(
  "src/lib/instruction-context.ts",
  "utf8"
);
for (const forbidden of [
  "codex-agent-prompt",
  "loadAutoMemory",
  "loadProjectSkills",
  "collectGitSnapshot",
  "loadWorkerPolicy",
]) {
  assert.equal(source.includes(forbidden), false, `instruction context still imports ${forbidden}`);
}

console.log("test-group-c4-instruction-context: ok — initialize is control-plane only");

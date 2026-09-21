import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  appendAutoMemory,
  loadAutoMemory,
} from "../dist/lib/auto-memory.js";
import { loadProjectMemory } from "../dist/lib/project-memory.js";

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

for (const file of [
  "legacy/group-c/lib/project-memory.ts",
  "legacy/group-c/lib/auto-memory.ts",
  "legacy/group-c/tools/context.ts",
]) {
  assert.equal(await exists(file), true, `missing quarantined C3 file: ${file}`);
}

const activeProjectMemory = await fs.readFile("src/lib/project-memory.ts", "utf8");
for (const forbidden of [
  "USER_MEMORY_CANDIDATES",
  'path.join(os.homedir(), ".codex"',
  'path.join(os.homedir(), ".claude"',
  "run /init in Claude Code",
  "auto-loaded like Claude Code",
]) {
  assert.equal(
    activeProjectMemory.includes(forbidden),
    false,
    `project-memory contains retired global dependency: ${forbidden}`
  );
}

const activeAutoMemory = await fs.readFile("src/lib/auto-memory.ts", "utf8");
for (const forbidden of ["CODEX_HOME", '".codex"', "os.homedir"]) {
  assert.equal(
    activeAutoMemory.includes(forbidden),
    false,
    `auto-memory contains retired storage dependency: ${forbidden}`
  );
}
assert.equal(
  activeAutoMemory.includes("getWorkerDataRoot"),
  true,
  "auto-memory must use GPTWorker data root"
);

const contextSource = await fs.readFile("src/tools/context.ts", "utf8");
for (const forbidden of [
  "getUpstreamManager",
  "upstream_mcp",
  "mcp-upstream",
  "rewind:",
  "plugin-config",
]) {
  assert.equal(
    contextSource.includes(forbidden),
    false,
    `context contains retired dependency: ${forbidden}`
  );
}
assert.equal(
  contextSource.includes("worker_data_root"),
  true,
  "agent_status must expose GPTWorker data root"
);
assert.equal(
  contextSource.includes("checkpoint:"),
  true,
  "agent_status must expose checkpoint safety as checkpoint"
);

const skillsSource = await fs.readFile("src/lib/skills-loader.ts", "utf8");
for (const forbidden of ["plugin-config", "resolveComputerUseSkillPath", "@oai/sky"]) {
  assert.equal(
    skillsSource.includes(forbidden),
    false,
    `skills loader contains retired dependency: ${forbidden}`
  );
}

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-c3-"));
const workspace = path.join(tmp, "workspace");
const dataRoot = path.join(tmp, "worker-data");
await fs.mkdir(workspace, { recursive: true });

process.env.GPTWORKER_DATA_ROOT = dataRoot;

const memoryFile = await appendAutoMemory(workspace, "local-memory-test");
assert.equal(
  path.resolve(memoryFile).startsWith(path.resolve(dataRoot) + path.sep),
  true,
  "auto memory must live under GPTWORKER_DATA_ROOT"
);
assert.equal(memoryFile.includes(".codex"), false);
assert.match(memoryFile, /memory[\\/]projects[\\/][a-f0-9]{12}[\\/]MEMORY\.md$/);

const loadedMemory = await loadAutoMemory(workspace);
assert.equal(loadedMemory?.includes("local-memory-test"), true);

await fs.writeFile(
  path.join(workspace, "AGENTS.md"),
  [
    "# Project instructions",
    "@./local-note.md",
    "@~/outside-note.md",
  ].join("\n"),
  "utf8"
);
await fs.writeFile(path.join(workspace, "local-note.md"), "LOCAL_PROJECT_NOTE", "utf8");

const bundle = await loadProjectMemory(workspace);
const combined = bundle.sections.map((section) => section.content).join("\n");
assert.equal(combined.includes("LOCAL_PROJECT_NOTE"), true);
assert.equal(combined.includes("skipped non-project import"), true);
assert.equal(
  bundle.sections.some((section) => section.path.includes(".codex")),
  false,
  "project memory must not load global Codex home"
);

await fs.rm(tmp, { recursive: true, force: true });

console.log("test-group-c3-context: ok — context is workspace-local and GPTWorker-owned");

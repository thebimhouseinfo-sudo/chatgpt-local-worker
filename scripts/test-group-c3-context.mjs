import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadProjectContext } from "../dist/lib/project-context-loader.js";

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

// Pre-correction Group C3 implementations were retired after cleanup.
for (const file of [
  "legacy/group-c/post-review/lib/auto-memory.ts",
  "legacy/group-c/post-review/lib/project-memory.ts",
  "legacy/group-c/tools/context.ts",
]) {
  assert.equal(
    await exists(file),
    false,
    `retired C3 legacy path unexpectedly exists: ${file}`
  );
}

// Active runtime must have no GPTWorker knowledge-memory subsystem.
assert.equal(await exists("src/lib/auto-memory.ts"), false, "auto-memory must not remain active");
assert.equal(await exists("src/lib/project-memory.ts"), false, "project-memory naming must not remain active");
assert.equal(
  await exists("src/lib/project-context-loader.ts"),
  true,
  "project context loader is missing"
);

const loaderSource = await fs.readFile("src/lib/project-context-loader.ts", "utf8");
for (const forbidden of [
  "ProjectMemory",
  "PROJECT_MEMORY",
  "loadProjectMemory",
  "auto-memory",
  "MEMORY.md",
  "memory/projects",
  "CODEX_HOME",
  'path.join(os.homedir(), ".codex"',
  'path.join(os.homedir(), ".claude"',
]) {
  assert.equal(
    loaderSource.includes(forbidden),
    false,
    `project context loader contains retired memory identifier: ${forbidden}`
  );
}
for (const required of [
  "ProjectContextSection",
  "ProjectContextBundle",
  "PROJECT_CONTEXT_MAX_BYTES",
  "PROJECT_CONTEXT_MAX_LINES",
  "loadProjectContext",
]) {
  assert.equal(
    loaderSource.includes(required),
    true,
    `project context loader missing renamed identifier: ${required}`
  );
}

const contextSource = await fs.readFile("src/tools/context.ts", "utf8");
for (const forbidden of [
  "appendAutoMemory",
  "auto-memory",
  '"remember"',
  "loadProjectMemory",
  "project-memory",
]) {
  assert.equal(
    contextSource.includes(forbidden),
    false,
    `context tool contains retired memory surface: ${forbidden}`
  );
}
assert.equal(
  contextSource.includes("loadProjectContext"),
  true,
  "project_context must use the context loader"
);
assert.equal(
  contextSource.includes("worker_data_root"),
  true,
  "agent_status should keep Worker operational data root"
);

const gatewaySource = await fs.readFile("src/tools/work-gateway.ts", "utf8");
assert.equal(gatewaySource.includes('"remember"'), false, "WorkGateway still exposes remember");

const profileSource = await fs.readFile("src/lib/tool-profile.ts", "utf8");
assert.equal(profileSource.includes('"remember"'), false, "tool profile still exposes remember");

const policySource = await fs.readFile("src/lib/tool-work-policy.ts", "utf8");
assert.equal(policySource.includes('"remember"'), false, "tool policy still classifies remember");

const instructionSource = await fs.readFile("src/lib/instruction-context.ts", "utf8");
assert.equal(
  instructionSource.includes("project memory"),
  false,
  "initialize text still describes a project-memory subsystem"
);

// Project-local context remains on-demand and bounded to the workspace.
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-c3-context-"));
const workspace = path.join(tmp, "workspace");
await fs.mkdir(workspace, { recursive: true });

await fs.writeFile(
  path.join(workspace, "AGENTS.md"),
  [
    "# Project instructions",
    "@./local-note.md",
    "@~/outside-note.md",
  ].join("\n"),
  "utf8"
);
await fs.writeFile(
  path.join(workspace, "local-note.md"),
  "LOCAL_PROJECT_CONTEXT",
  "utf8"
);

const bundle = await loadProjectContext(workspace);
const combined = bundle.sections.map((section) => section.content).join("\n");

assert.equal(combined.includes("LOCAL_PROJECT_CONTEXT"), true);
assert.equal(combined.includes("skipped non-project import"), true);
assert.equal(bundle.root, path.resolve(workspace));
assert.equal(bundle.workspace_roots.includes(path.resolve(workspace)), true);

await fs.rm(tmp, { recursive: true, force: true });

console.log(
  "test-group-c3-context: ok — no GPTWorker memory; project context remains on-demand"
);

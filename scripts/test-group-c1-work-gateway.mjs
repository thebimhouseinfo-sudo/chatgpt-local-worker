import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createWorkToolResolver,
  FAMILY_TOOLS,
  TOOL_FAMILIES,
  WORK_TOOL_OPERATIONS,
} from "../dist/tools/work-gateway.js";
import { setDefaultCwd } from "../dist/lib/path-security.js";

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

assert.equal(
  await exists("legacy/group-c/tools/work-gateway.ts"),
  false,
  "retired work gateway unexpectedly exists"
);

const activeSource = await fs.readFile("src/tools/work-gateway.ts", "utf8");
for (const forbidden of [
  "mcp-upstream",
  "mcp-bridge",
  "ponytail.js",
  "rewind.js",
  "McpUpstreamManager",
]) {
  assert.equal(
    activeSource.includes(forbidden),
    false,
    `active work gateway contains retired dependency: ${forbidden}`
  );
}

assert.deepEqual(
  TOOL_FAMILIES,
  ["filesystem", "shell", "context", "browser"],
  "runtime family set drifted"
);
assert.equal("rewind" in FAMILY_TOOLS, false);
assert.equal(WORK_TOOL_OPERATIONS.includes("rewind"), false);
assert.equal(WORK_TOOL_OPERATIONS.includes("remember"), false);
assert.equal(WORK_TOOL_OPERATIONS.some((name) => name.startsWith("git_")), false);
assert.equal(FAMILY_TOOLS.context.includes("remember"), false);
assert.equal(FAMILY_TOOLS.browser.includes("browser_open"), true);
assert.equal(FAMILY_TOOLS.browser.includes("agent_browser_eval"), false);

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-c1-"));
try {
  setDefaultCwd(tmpDir);
  const resolver = createWorkToolResolver(tmpDir, 30);

  const prepared = await resolver.prepareJob("runtime-job", [
    "filesystem",
    "filesystem",
  ]);

  assert.deepEqual(prepared.requested_families, ["filesystem"]);
  assert.deepEqual(prepared.prepared_families, ["filesystem"]);
  assert.equal(prepared.stale, false);

  const status = resolver.status();
  assert.deepEqual(status.prepared_families, ["filesystem"]);
  assert.equal(status.loaded_families.includes("filesystem"), true);

  await assert.rejects(() => resolver.resolve("rewind"), /Unknown work tool/);
  await assert.rejects(() => resolver.resolve("mcp_call"), /Unknown work tool/);
} finally {
  await fs.rm(tmpDir, { recursive: true, force: true });
}

console.log("test-group-c1-work-gateway: ok — clean active runtime families");

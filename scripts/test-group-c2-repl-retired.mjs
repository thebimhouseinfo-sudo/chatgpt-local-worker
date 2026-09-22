import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  FAMILY_TOOLS,
  WORK_TOOL_OPERATIONS,
  createWorkToolResolver,
} from "../dist/tools/work-gateway.js";
import { RUNTIME_FAMILIES } from "../dist/lib/runtime-families.js";
import { LOCAL_TOOL_CATALOG } from "../dist/lib/tool-profile.js";
import { setDefaultCwd } from "../dist/lib/path-security.js";
import os from "node:os";
import path from "node:path";

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

assert.equal(
  await exists("src/tools/node-repl.ts"),
  false,
  "retired node_repl implementation must not remain in active src/"
);
assert.equal("repl" in FAMILY_TOOLS, false);
assert.equal(RUNTIME_FAMILIES.includes("repl"), false);
assert.equal(WORK_TOOL_OPERATIONS.includes("node_repl"), false);
assert.equal(LOCAL_TOOL_CATALOG.includes("node_repl"), false);

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-repl-retired-"));
try {
  setDefaultCwd(tmpDir);
  const resolver = createWorkToolResolver(tmpDir, 30);
  await assert.rejects(
    () => resolver.resolve("node_repl"),
    /Unknown work tool: node_repl/
  );
} finally {
  await fs.rm(tmpDir, { recursive: true, force: true });
}

console.log("test-group-c2-repl-retired: ok — Node REPL family retired; Node remains available through shell");

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createWorkToolResolver,
  FAMILY_TOOLS,
  WORK_TOOL_OPERATIONS,
} from "../dist/tools/work-gateway.js";
import {
  LOCAL_TOOL_CATALOG,
  SLIM_CHATGPT_TOOLS,
} from "../dist/lib/tool-profile.js";
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
  await exists("src/tools/rewind.ts"),
  false,
  "standalone rewind adapter must not remain in active src/"
);
assert.equal(
  await exists("legacy/group-b/tools/rewind.ts"),
  true,
  "quarantined rewind adapter is missing"
);
assert.equal(
  await exists("src/lib/checkpoint.ts"),
  true,
  "checkpoint safety engine must remain active"
);

const filesystemSource = await fs.readFile("src/tools/filesystem.ts", "utf8");
assert.equal(
  filesystemSource.includes('from "../lib/checkpoint.js"'),
  true,
  "filesystem must keep the checkpoint safety engine"
);
assert.equal(
  filesystemSource.includes("checkpointBefore("),
  true,
  "filesystem mutations must still create automatic checkpoints"
);

const gatewaySource = await fs.readFile("src/tools/work-gateway.ts", "utf8");
assert.equal(gatewaySource.includes('./rewind.js'), false, "work gateway still imports rewind");
assert.equal("rewind" in FAMILY_TOOLS, false, "rewind must not be a runtime family");
assert.equal(WORK_TOOL_OPERATIONS.includes("rewind"), false, "work_tool still exposes rewind");

assert.equal(LOCAL_TOOL_CATALOG.includes("rewind"), false, "tool catalog still contains rewind");
assert.equal(SLIM_CHATGPT_TOOLS.has("rewind"), false, "slim profile still exposes rewind");

const quickstart = await fs.readFile("src/lib/quickstart.ts", "utf8");
assert.equal(
  /work_tool[^\n]*rewind|operation rewind|Dispatch rewind/i.test(quickstart),
  false,
  "quickstart still instructs ChatGPT to use standalone rewind"
);

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-group-b-"));
try {
  setDefaultCwd(tmpDir);
  const resolver = createWorkToolResolver(tmpDir, 30);

  const prepared = await resolver.prepareJob("legacy-job", [
    "filesystem",
    "rewind",
    "mcp",
    "ponytail",
  ]);

  assert.deepEqual(
    prepared.requested_families,
    ["filesystem"],
    "legacy preload tokens must be ignored instead of becoming runtime families"
  );
  assert.deepEqual(
    prepared.prepared_families,
    ["filesystem"],
    "supported preload family must still prepare successfully"
  );

  await assert.rejects(
    () => resolver.resolve("rewind"),
    /Unknown work tool: rewind/,
    "rewind must not resolve through work_tool"
  );
} finally {
  await fs.rm(tmpDir, { recursive: true, force: true });
}

console.log("test-group-b-retired: ok — rewind retired, checkpoint safety retained");

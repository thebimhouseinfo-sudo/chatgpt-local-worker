import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createWorkToolResolver,
  TOOL_FAMILIES,
  WORK_TOOL_OPERATIONS,
} from "../dist/tools/work-gateway.js";
import {
  requiresWorkHandle,
  toolFamily,
} from "../dist/lib/tool-work-policy.js";
import { JOB_PRELOAD_FAMILIES } from "../dist/lib/runtime-families.js";
import { setDefaultCwd } from "../dist/lib/path-security.js";

assert.deepEqual(
  TOOL_FAMILIES,
  ["filesystem", "shell", "context", "browser"],
  "runtime family registry drifted"
);

assert.equal(
  new Set(WORK_TOOL_OPERATIONS).size,
  WORK_TOOL_OPERATIONS.length,
  "work_tool operation registry contains duplicates"
);

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-r2-map-"));
try {
  setDefaultCwd(tmpDir);
  const resolver = createWorkToolResolver(30);

  for (const operation of WORK_TOOL_OPERATIONS) {
    const resolved = await resolver.resolve(operation);
    assert.equal(
      resolved.name,
      operation,
      `registry → lazy-loader → registerTool mapping failed for ${operation}`
    );
  }
} finally {
  await fs.rm(tmpDir, { recursive: true, force: true });
}

assert.equal(requiresWorkHandle("agent_status"), true);
assert.equal(toolFamily("agent_status"), "context");

const activeFamilies = new Set(TOOL_FAMILIES);
const acceptedPreloadFamilies = new Set(JOB_PRELOAD_FAMILIES);

for (const jobId of ["dev-coding", "dev-planing", "layla", "mto"]) {
  const jobDir = path.join("jobs", jobId);
  const meta = JSON.parse(
    await fs.readFile(path.join(jobDir, "job.yaml"), "utf8")
  );

  for (const family of meta.runtime?.preload_families ?? []) {
    assert.equal(
      acceptedPreloadFamilies.has(family),
      true,
      `${jobId} declares unknown preload family ${family}`
    );
    assert.equal(
      activeFamilies.has(family),
      true,
      `${jobId} preload family ${family} is not an active runtime family`
    );
  }

  const refs = [
    ...(meta.skills ?? []),
    ...(meta.harness?.entrypoints ?? []),
    ...(meta.validators ?? []),
  ];
  for (const rel of refs) {
    const target = path.join(jobDir, rel);
    const stat = await fs.stat(target).catch(() => null);
    assert.equal(
      Boolean(stat?.isFile()),
      true,
      `${jobId} references missing pack file ${rel}`
    );
  }
}

for (const sourcePath of [
  "src/index.ts",
  "src/lib/mcp-session-manager.ts",
  "src/server-factory.ts",
]) {
  const source = await fs.readFile(sourcePath, "utf8");
  assert.equal(
    source.includes("projectMemoryInstructions"),
    false,
    `${sourcePath} still uses stale memory-era instruction plumbing name`
  );
}

console.log(
  `test-post-review-round2-mapping: ok — ${WORK_TOOL_OPERATIONS.length} work operations resolve and Job mappings are complete`
);

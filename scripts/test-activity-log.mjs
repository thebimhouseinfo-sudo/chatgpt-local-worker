import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-activity-"));
process.env.ACTIVITY_LOG_PATH = path.join(tmpDir, "activity.jsonl");
delete process.env.ACTIVITY_LOG_DISABLED;

const {
  appendActivity,
  logMcpRequest,
  summarizeToolArgs,
} = await import("../dist/lib/activity-log.js");
const {
  flushRuntimeLog,
  loadRuntimeLog,
} = await import("../dist/lib/runtime-log.js");

try {
  assert.equal(summarizeToolArgs("run_command", { command: "npm test" }), "npm test");
  assert.equal(summarizeToolArgs("read_text_file", { path: "C:\\foo.ts" }), "C:\\foo.ts");

  appendActivity({ kind: "tool", tool: "grep", status: "ok", summary: "pattern: foo" });
  await flushRuntimeLog();
  let entries = await loadRuntimeLog(50);
  const latestTool = entries.find((e) => e.kind === "tool" && e.tool === "grep");
  assert.ok(latestTool, "expected persisted grep activity entry");

  logMcpRequest(
    {
      method: "tools/call",
      params: {
        name: "read_text_file",
        arguments: {
          execution_id: "exec:dev-coding@test#123456:e1:g1",
          authority_token: "super-secret-authority-token-value",
          path: "/tmp/x",
        },
      },
    },
    "sess-abc-123",
    42,
    200
  );
  await flushRuntimeLog();
  entries = await loadRuntimeLog(100);
  const mcp = entries.find((e) => e.kind === "mcp" && e.tool === "read_text_file" && e.session_id === "sess-abc-123");
  assert.ok(mcp, "expected persisted mcp tools/call entry");
  assert.equal(mcp.client, "chatgpt");
  assert.equal(mcp.duration_ms, 42);
  assert.equal(mcp.summary, "/tmp/x");
  assert.equal(mcp.status, "ok");

  logMcpRequest(
    { method: "tools/call", params: { name: "read_text_file", arguments: { path: "/tmp/y" } } },
    "sess-missing-work",
    7,
    200
  );
  await flushRuntimeLog();
  entries = await loadRuntimeLog(100);
  const rejected = entries.find(
    (e) => e.action === "tool_lease_rejected" && e.tool === "read_text_file"
  );
  assert.ok(rejected, "expected missing work handle to persist tool_lease_rejected");
  assert.equal(rejected.status, "blocked");
  assert.equal(rejected.tool_family, "filesystem");

  const blockedMcp = entries.find(
    (e) => e.kind === "mcp" && e.tool === "read_text_file" && e.session_id === "sess-missing-work"
  );
  assert.ok(blockedMcp, "expected blocked MCP entry for missing work handle");
  assert.equal(blockedMcp.status, "blocked");
  assert.match(blockedMcp.summary || "", /NO_ACTIVE_WORK/);

  logMcpRequest(
    {
      method: "tools/call",
      params: {
        name: "write_file",
        arguments: {
          execution_id: "exec:dev-coding@test#123456:e1:g1",
          authority_token: "test-authority-token",
          path: "/x",
        },
      },
    },
    "sess-err",
    2,
    400,
    "Bad Request: Server not initialized"
  );
  await flushRuntimeLog();
  entries = await loadRuntimeLog(100);
  const errEntry = entries.find(
    (e) => e.status === "error" && e.tool === "write_file" && e.session_id === "sess-err"
  );
  assert.ok(errEntry, "expected persisted error activity entry");
  assert.equal(errEntry.summary, "Bad Request: Server not initialized");

  const summarized = summarizeToolArgs("custom_tool", {
    execution_id: "exec:dev-coding@test#123456:e1:g1",
    authority_token: "super-secret-authority-token-value",
  });
  assert.equal(summarized.includes("super-secret-authority-token-value"), false);

  const serialized = JSON.stringify(entries);
  assert.equal(
    serialized.includes("super-secret-authority-token-value"),
    false,
    "persisted activity must redact authority tokens"
  );

  console.log("activity-log: ok — persisted runtime log verified");
} finally {
  await fs.rm(tmpDir, { recursive: true, force: true });
}

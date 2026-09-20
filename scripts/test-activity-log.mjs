import assert from "node:assert/strict";
import { appendActivity, getRecentActivity, logMcpRequest, summarizeToolArgs } from "../dist/lib/activity-log.js";

// summarizeToolArgs
assert.equal(summarizeToolArgs("run_command", { command: "npm test" }), "npm test");
assert.equal(summarizeToolArgs("read_text_file", { path: "C:\\foo.ts" }), "C:\\foo.ts");

// append + retrieve
const before = getRecentActivity(500).length;
appendActivity({ kind: "tool", tool: "grep", status: "ok", summary: "pattern: foo" });
assert.equal(getRecentActivity(500).length, before + 1);
const latest = getRecentActivity(1)[0];
assert.equal(latest.tool, "grep");
assert.equal(latest.kind, "tool");

// logMcpRequest tools/call
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
const mcp = getRecentActivity(5).find((e) => e.kind === "mcp" && e.tool === "read_text_file");
assert.ok(mcp, "expected mcp tools/call entry");
assert.equal(mcp.client, "chatgpt");
assert.equal(mcp.duration_ms, 42);
assert.equal(mcp.summary, "/tmp/x");
assert.equal(mcp.status, "ok");

// missing work handle is an application-level rejection even though MCP uses HTTP 200
logMcpRequest(
  { method: "tools/call", params: { name: "read_text_file", arguments: { path: "/tmp/y" } } },
  "sess-missing-work",
  7,
  200
);
const rejected = getRecentActivity(10).find(
  (e) => e.action === "tool_lease_rejected" && e.tool === "read_text_file"
);
assert.ok(rejected, "expected missing work handle to create tool_lease_rejected");
assert.equal(rejected.status, "blocked");
assert.equal(rejected.tool_family, "filesystem");
const blockedMcp = getRecentActivity(10).find(
  (e) => e.kind === "mcp" && e.tool === "read_text_file" && e.session_id === "sess-missing-work"
);
assert.ok(blockedMcp, "expected blocked MCP entry for missing work handle");
assert.equal(blockedMcp.status, "blocked");
assert.match(blockedMcp.summary || "", /NO_ACTIVE_WORK/);

// filter since
const all = getRecentActivity(500);
const since = all[1]?.id;
if (since) {
  const newer = getRecentActivity(500, since);
  assert.ok(newer.length < all.length);
}

// error logging with message
logMcpRequest(
  { method: "tools/call", params: { name: "write_file", arguments: { path: "/x" } } },
  "sess-err",
  2,
  400,
  "Bad Request: Server not initialized"
);
const errEntry = getRecentActivity(3).find((e) => e.status === "error" && e.tool === "write_file");
assert.ok(errEntry, "expected error activity entry");
assert.equal(errEntry.summary, "Bad Request: Server not initialized");

console.log("activity-log: ok");
// work-handle summaries must never leak opaque authority tokens
const summarized = summarizeToolArgs("custom_tool", {
  execution_id: "exec:dev-coding@test#123456:e1:g1",
  authority_token: "super-secret-authority-token-value",
});
assert.equal(summarized.includes("super-secret-authority-token-value"), false);


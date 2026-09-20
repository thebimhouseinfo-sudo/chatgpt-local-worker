import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "local-worker-runtime-log-"));
const logPath = path.join(root, "activity.jsonl");
process.env.ACTIVITY_LOG_PATH = logPath;
process.env.ACTIVITY_LOG_ROTATE_BYTES = "600";

const { appendActivity, loadActivityHistory, sanitizeActivityValue } = await import(
  `../dist/lib/activity-log.js?runtime-log-test=${Date.now()}`
);
const { flushRuntimeLog } = await import("../dist/lib/runtime-log.js");

process.env.MCP_TOKEN = "mcp-runtime-secret-123456";

assert.equal(sanitizeActivityValue({ api_key: "sk-test-secret-value" }).api_key, "[REDACTED]");
assert.match(String(sanitizeActivityValue("Bearer abc.def.ghi")), /REDACTED/);
assert.match(String(sanitizeActivityValue("OPENAI_TUNNEL_API_KEY=sk-test-secret-value")), /OPENAI_TUNNEL_API_KEY=\[REDACTED\]/);
assert.match(String(sanitizeActivityValue("VERCEL_TOKEN=vercel-secret-value")), /VERCEL_TOKEN=\[REDACTED\]/);
assert.match(String(sanitizeActivityValue("DATABASE_URL=postgres://user:password@host/db")), /DATABASE_URL=\[REDACTED\]/);
assert.equal(String(sanitizeActivityValue("GET /mcp/mcp-runtime-secret-123456")), "GET /mcp/[REDACTED]");
assert.equal(String(sanitizeActivityValue("postgres://user:password@host/db")), "[REDACTED_URL]");
assert.equal(String(sanitizeActivityValue("ghp_1234567890abcdefghijklmnop")), "[REDACTED]");

appendActivity({
  kind: "system",
  action: "runtime_log_test /mcp/mcp-runtime-secret-123456",
  status: "ok",
  details: {
    api_key: "sk-test-secret-value",
    authorization: "Bearer abc.def.ghi",
    command: "deploy --token VERCEL_TOKEN=vercel-secret-value",
    note: "safe-value",
  },
});
await flushRuntimeLog();

const first = await fs.readFile(logPath, "utf8");
assert.match(first, /runtime_log_test/);
assert.doesNotMatch(first, /sk-test-secret-value|abc\.def\.ghi|mcp-runtime-secret-123456|vercel-secret-value/);
assert.match(first, /schema_version/);

appendActivity({ kind: "system", action: "rotation_test", details: { payload: "x".repeat(1200) } });
appendActivity({ kind: "system", action: "rotation_test_2", details: { payload: "y".repeat(1200) } });
await flushRuntimeLog();
assert.equal((await fs.stat(`${logPath}.1`)).isFile(), true);
assert.ok((await loadActivityHistory(20)).some((entry) => entry.action === "rotation_test_2"));

process.env.ACTIVITY_LOG_PATH = root;
assert.doesNotThrow(() => appendActivity({ kind: "system", action: "fail_open_test" }));
await flushRuntimeLog();

await fs.rm(root, { recursive: true, force: true });
console.log("runtime-log: ok");

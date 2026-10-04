import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "local-worker-runtime-log-"));
const logPath = path.join(root, "activity.jsonl");
process.env.ACTIVITY_LOG_PATH = logPath;
process.env.ACTIVITY_LOG_ROTATE_BYTES = "600";

const { appendActivity, sanitizeActivityValue } = await import(
  `../dist/lib/activity-log.js?runtime-log-test=${Date.now()}`
);
const { enqueueRuntimeLog, flushRuntimeLog, loadRuntimeLog, getRuntimeLogStats } = await import("../dist/lib/runtime-log.js");

try {
  delete process.env.ACTIVITY_LOG_DISABLED;
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
  assert.ok((await loadRuntimeLog(20)).some((entry) => entry.action === "rotation_test_2"));

  process.env.ACTIVITY_LOG_PATH = root;
  assert.doesNotThrow(() => appendActivity({ kind: "system", action: "fail_open_test" }));
  await flushRuntimeLog();

  // A failed destination must not poison later writes.
  process.env.ACTIVITY_LOG_PATH = logPath;
  process.env.ACTIVITY_LOG_ROTATE_BYTES = "1000000";
  process.env.ACTIVITY_LOG_MAX_RECORD_BYTES = "512";
  appendActivity({
    kind: "mcp", action: "bounded_record", request_id: 42, session_id: "session-test",
    details: { payload: "z".repeat(2000) },
  });
  await flushRuntimeLog();
  const boundedRecord = (await loadRuntimeLog(1))[0];
  assert.equal(boundedRecord.details.truncated, true);
  assert.equal(boundedRecord.request_id, 42);
  assert.equal(boundedRecord.session_id, "session-test");

  // Even oversized metadata and a tiny configured budget leave bounded valid JSON.
  process.env.ACTIVITY_LOG_MAX_RECORD_BYTES = "1";
  enqueueRuntimeLog({ action: "a".repeat(10000), details: { payload: "z".repeat(2000) } });
  await flushRuntimeLog();
  const boundedLine = (await fs.readFile(logPath, "utf8")).trim().split("\n").at(-1);
  assert.ok(Buffer.byteLength(`${boundedLine}\n`) <= 256);
  assert.equal(JSON.parse(boundedLine).details.truncated, true);

  const badDetails = Object.defineProperty({}, "value", {
    enumerable: true, get() { throw new Error("broken getter"); },
  });
  assert.doesNotThrow(() => appendActivity({ kind: "system", action: "bad_details", details: badDetails }));
  const originalConsoleLog = console.log;
  try {
    console.log = () => { throw new Error("closed console"); };
    assert.doesNotThrow(() => appendActivity({ kind: "tool", tool: "test", action: "console_failure" }));
  } finally {
    console.log = originalConsoleLog;
  }
  await flushRuntimeLog();

  const circular = {};
  circular.self = circular;
  const failuresBefore = getRuntimeLogStats().failed_records;
  assert.doesNotThrow(() => enqueueRuntimeLog(circular));
  assert.equal(getRuntimeLogStats().failed_records, failuresBefore + 1);

  // Snapshot queued records: later caller mutations cannot change diagnostics.
  delete process.env.ACTIVITY_LOG_MAX_RECORD_BYTES;
  const snapshot = { action: "snapshot", details: { value: "before" } };
  enqueueRuntimeLog(snapshot);
  snapshot.details.value = "after";
  await flushRuntimeLog();
  assert.equal((await loadRuntimeLog(1))[0].details.value, "before");

  const dropsBefore = getRuntimeLogStats().dropped_records;
  for (let i = 0; i < 1100; i++) enqueueRuntimeLog({ action: "burst", i });
  assert.equal(getRuntimeLogStats().pending_records, 1000);
  assert.equal(getRuntimeLogStats().dropped_records, dropsBefore + 100);
  assert.ok(getRuntimeLogStats().pending_bytes <= 4 * 1024 * 1024);
  await flushRuntimeLog();
  assert.equal(getRuntimeLogStats().pending_records, 0);
  assert.equal(getRuntimeLogStats().pending_bytes, 0);

  for (let i = 0; i < 200; i++) enqueueRuntimeLog({ action: "large_burst", payload: "x".repeat(30000) });
  assert.ok(getRuntimeLogStats().pending_records < 200, "byte budget must bound large records");
  assert.ok(getRuntimeLogStats().pending_bytes <= 4 * 1024 * 1024);
  await flushRuntimeLog();

  process.env.ACTIVITY_LOG_DISABLED = "true";
  const disabledBefore = await fs.readFile(logPath, "utf8");
  enqueueRuntimeLog({ action: "disabled" });
  await flushRuntimeLog();
  assert.equal(await fs.readFile(logPath, "utf8"), disabledBefore);
  console.log("runtime-log: ok");
} finally {
  await flushRuntimeLog();
  await fs.rm(root, { recursive: true, force: true });
}

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

assert.equal(sanitizeActivityValue({ api_key: "sk-test-secret-value" }).api_key, "[REDACTED]");
assert.match(String(sanitizeActivityValue("Bearer abc.def.ghi")), /REDACTED/);
assert.match(String(sanitizeActivityValue("OPENAI_TUNNEL_API_KEY=sk-test-secret-value")), /OPENAI_TUNNEL_API_KEY=\[REDACTED\]/);

appendActivity({
  kind: "system",
  action: "runtime_log_test",
  status: "ok",
  details: {
    api_key: "sk-test-secret-value",
    authorization: "Bearer abc.def.ghi",
    note: "safe-value",
  },
});
await flushRuntimeLog();

const first = await fs.readFile(logPath, "utf8");
assert.match(first, /runtime_log_test/);
assert.doesNotMatch(first, /sk-test-secret-value|abc\.def\.ghi/);
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

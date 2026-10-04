import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_ROTATE_BYTES = 20 * 1024 * 1024;
const DEFAULT_MAX_RECORD_BYTES = 32 * 1024;
const MAX_PENDING_RECORDS = 1000;
const MAX_PENDING_BYTES = 4 * 1024 * 1024;
let writeQueue: Promise<void> = Promise.resolve();
let pendingRecords = 0;
let pendingBytes = 0;
let droppedRecords = 0;
let failedRecords = 0;

export function getRuntimeLogStats() {
  return {
    pending_records: pendingRecords,
    pending_bytes: pendingBytes,
    dropped_records: droppedRecords,
    failed_records: failedRecords,
  };
}

function positiveEnv(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getRuntimeLogPath(): string {
  const configured = (process.env.ACTIVITY_LOG_PATH || "").trim();
  if (configured) return path.resolve(configured);
  const home = (process.env.LOCAL_WORKER_HOME || "").trim();
  return path.resolve(home || process.cwd(), ".mcp-activity.jsonl");
}

function isDisabled(): boolean {
  return ["1", "true", "yes", "on"].includes(
    (process.env.ACTIVITY_LOG_DISABLED || "").trim().toLowerCase()
  );
}

async function rotateIfNeeded(filePath: string, nextBytes: number): Promise<void> {
  const maxBytes = positiveEnv("ACTIVITY_LOG_ROTATE_BYTES", DEFAULT_ROTATE_BYTES);
  try {
    const stat = await fs.stat(filePath);
    if (stat.size + nextBytes <= maxBytes) return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }

  try {
    await fs.rm(`${filePath}.1`, { force: true });
    await fs.rename(filePath, `${filePath}.1`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function serializeRecord(record: Record<string, unknown>): string {
  const line = `${JSON.stringify(record)}\n`;
  // A usable JSON envelope needs a minimum budget, even with tiny env values.
  const maxRecordBytes = Math.max(256, positiveEnv("ACTIVITY_LOG_MAX_RECORD_BYTES", DEFAULT_MAX_RECORD_BYTES));
  const bounded = Buffer.byteLength(line, "utf8") > maxRecordBytes
    ? `${JSON.stringify({
        schema_version: record.schema_version,
        time: record.time,
        id: record.id,
        kind: record.kind,
        action: record.action,
        status: record.status,
        pid: record.pid,
        request_id: record.request_id,
        session_id: record.session_id,
        work_id: record.work_id,
        lease_id: record.lease_id,
        job_id: record.job_id,
        workspace_key: record.workspace_key,
        tool: record.tool,
        summary: "[record truncated]",
        details: { truncated: true },
      })}\n`
    : line;
  if (Buffer.byteLength(bounded, "utf8") <= maxRecordBytes) return bounded;
  return `${JSON.stringify({ schema_version: 1, summary: "[record truncated]", details: { truncated: true } })}\n`;
}

async function appendRecord(filePath: string, line: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await rotateIfNeeded(filePath, Buffer.byteLength(line, "utf8"));
  await fs.appendFile(filePath, line, "utf8");
}

/** Queue logging work so file I/O cannot delay or fail the caller. */
export function enqueueRuntimeLog(record: Record<string, unknown>): void {
  try {
    if (isDisabled()) return;
    if (pendingRecords >= MAX_PENDING_RECORDS) {
      droppedRecords += 1;
      return;
    }
    const filePath = getRuntimeLogPath();
    const line = serializeRecord(record);
    const bytes = Buffer.byteLength(line, "utf8");
    if (pendingBytes + bytes > MAX_PENDING_BYTES) {
      droppedRecords += 1;
      return;
    }
    pendingRecords += 1;
    pendingBytes += bytes;
    writeQueue = writeQueue
      .then(() => appendRecord(filePath, line))
      .catch(() => { failedRecords += 1; })
      .finally(() => {
        pendingRecords -= 1;
        pendingBytes -= bytes;
      });
  } catch {
    failedRecords += 1;
  }
}

export async function flushRuntimeLog(): Promise<void> {
  await writeQueue.catch(() => undefined);
}

export async function loadRuntimeLog(limit = 200): Promise<Record<string, unknown>[]> {
  try {
    const filePath = getRuntimeLogPath();
    const contents = await Promise.all(
      [`${filePath}.1`, filePath].map(async (candidate) => {
        try {
          return await fs.readFile(candidate, "utf8");
        } catch {
          return "";
        }
      })
    );
    return contents.join("\n")
      .split("\n")
      .filter(Boolean)
      .slice(-Math.max(1, Math.min(limit, 2000)))
      .flatMap((line) => {
        try {
          const value = JSON.parse(line);
          return value && typeof value === "object" ? [value as Record<string, unknown>] : [];
        } catch {
          return [];
        }
      })
      .reverse();
  } catch {
    return [];
  }
}

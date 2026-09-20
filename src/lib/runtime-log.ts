import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_ROTATE_BYTES = 20 * 1024 * 1024;
const DEFAULT_MAX_RECORD_BYTES = 32 * 1024;
let writeQueue: Promise<void> = Promise.resolve();

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

async function appendRecord(record: Record<string, unknown>): Promise<void> {
  const filePath = getRuntimeLogPath();
  const line = `${JSON.stringify(record)}\n`;
  const maxRecordBytes = positiveEnv("ACTIVITY_LOG_MAX_RECORD_BYTES", DEFAULT_MAX_RECORD_BYTES);
  const bounded = Buffer.byteLength(line, "utf8") > maxRecordBytes
    ? `${JSON.stringify({
        schema_version: record.schema_version,
        time: record.time,
        id: record.id,
        kind: record.kind,
        action: record.action,
        status: record.status,
        summary: "[record truncated]",
        details: { truncated: true },
      })}\n`
    : line;

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await rotateIfNeeded(filePath, Buffer.byteLength(bounded, "utf8"));
  await fs.appendFile(filePath, bounded, "utf8");
}

/** Queue logging work so file I/O cannot delay or fail the caller. */
export function enqueueRuntimeLog(record: Record<string, unknown>): void {
  if (isDisabled()) return;
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(() => appendRecord(record))
    .catch(() => undefined);
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

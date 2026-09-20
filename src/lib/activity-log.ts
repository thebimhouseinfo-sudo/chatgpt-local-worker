import { randomUUID } from "node:crypto";
import fs from "fs/promises";
import { getAuditPath } from "./audit.js";
import { enqueueRuntimeLog, loadRuntimeLog } from "./runtime-log.js";

export type ActivityKind = "tool" | "mcp" | "session" | "system";

export interface ActivityEntry {
  id: string;
  time: string;
  kind: ActivityKind;
  tool?: string;
  action?: string;
  target?: string;
  status?: string;
  duration_ms?: number;
  session_id?: string;
  client?: string;
  summary?: string;
  details?: Record<string, unknown>;
  pid?: number;
  request_id?: string | number;
  work_id?: string;
  lease_id?: string;
  job_id?: string;
  workspace_key?: string;
  tool_family?: string;
  schema_version?: 1;
}

const MAX_ENTRIES = parseInt(process.env.ACTIVITY_LOG_MAX || "500", 10);
const entries: ActivityEntry[] = [];
const listeners = new Set<(entry: ActivityEntry) => void>();

function trimSummary(text: string, max = 160): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : oneLine.slice(0, max - 1) + "…";
}

const SENSITIVE_KEY = /(token|secret|password|passwd|api[_-]?key|authorization|cookie|credential|private[_-]?key)/i;
const SENSITIVE_STRING = /(sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|npm_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._~+/=-]+)/gi;
const SENSITIVE_ASSIGNMENT = /(\b(?:(?:[A-Z][A-Z0-9_]*)(?:TOKEN|KEY|SECRET|PASSWORD|PASSWD|CREDENTIAL)|DATABASE_URL)\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi;
const CREDENTIAL_URL = /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s]+/gi;
const MAX_VALUE_DEPTH = 5;

function redactConfiguredSecrets(value: string): string {
  let redacted = value;
  for (const [envKey, envValue] of Object.entries(process.env)) {
    if (!envValue || envValue.length < 6) continue;
    if (!SENSITIVE_KEY.test(envKey) && envKey.toUpperCase() !== "DATABASE_URL") continue;
    redacted = redacted.split(envValue).join("[REDACTED]");
  }
  return redacted;
}

function redactString(value: string): string {
  return redactConfiguredSecrets(value)
    .replace(SENSITIVE_STRING, "[REDACTED]")
    .replace(SENSITIVE_ASSIGNMENT, "$1[REDACTED]")
    .replace(CREDENTIAL_URL, "[REDACTED_URL]")
    .slice(0, 4000);
}

export function sanitizeActivityValue(value: unknown, key = "", depth = 0): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (typeof value === "string") return redactString(value);
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= MAX_VALUE_DEPTH) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeActivityValue(item, key, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 200)
        .map(([childKey, childValue]) => [childKey, sanitizeActivityValue(childValue, childKey, depth + 1)])
    );
  }
  return String(value);
}

export function summarizeToolArgs(tool: string, args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const a = args as Record<string, unknown>;

  if (tool === "run_command" && typeof a.command === "string") return trimSummary(a.command, 120);
  if (typeof a.path === "string") return a.path;
  if (typeof a.server_id === "string" && typeof a.tool === "string") {
    return `${a.server_id} → ${a.tool}`;
  }
  if (typeof a.pattern === "string") return `pattern: ${a.pattern}`;
  if (typeof a.checkpoint_id === "string") return `checkpoint: ${a.checkpoint_id}`;
  if (typeof a.action === "string") return `action: ${a.action}`;

  try {
    return trimSummary(JSON.stringify(sanitizeActivityValue(a)));
  } catch {
    return "";
  }
}

export function appendActivity(partial: Omit<ActivityEntry, "id" | "time"> & { time?: string }): ActivityEntry {
  const entry: ActivityEntry = {
    id: randomUUID(),
    time: partial.time ?? new Date().toISOString(),
    schema_version: 1,
    pid: process.pid,
    ...partial,
    action: partial.action ? redactString(partial.action) : partial.action,
    summary: partial.summary ? redactString(partial.summary) : partial.summary,
    target: partial.target ? redactString(partial.target) : partial.target,
    details: partial.details
      ? sanitizeActivityValue(partial.details) as Record<string, unknown>
      : partial.details,
  };

  entries.push(entry);
  while (entries.length > MAX_ENTRIES) entries.shift();

  writeConsole(entry);
  enqueueRuntimeLog(entry as unknown as Record<string, unknown>);
  for (const listener of listeners) {
    try {
      listener(entry);
    } catch {}
  }
  return entry;
}

export function logSystemEvent(
  action: string,
  options: { status?: string; sessionId?: string; summary?: string; details?: Record<string, unknown> } = {}
): ActivityEntry {
  return appendActivity({
    kind: options.sessionId ? "session" : "system",
    action,
    status: options.status ?? "ok",
    session_id: options.sessionId,
    summary: options.summary,
    details: options.details,
  });
}

export function subscribeActivity(listener: (entry: ActivityEntry) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRecentActivity(limit = 100, sinceId?: string): ActivityEntry[] {
  const capped = Math.min(Math.max(limit, 1), MAX_ENTRIES);
  if (!sinceId) return [...entries].slice(-capped).reverse();
  const idx = entries.findIndex((e) => e.id === sinceId);
  if (idx < 0) return [...entries].slice(-capped).reverse();
  return entries.slice(idx + 1).reverse();
}

function writeConsole(entry: ActivityEntry): void {
  const sid = entry.session_id ? ` session=${entry.session_id.slice(0, 8)}` : "";
  const dur = entry.duration_ms != null ? ` ${entry.duration_ms}ms` : "";
  const isError = entry.status === "error" || entry.status === "blocked";

  if (isError) {
    const label =
      entry.tool ? `tools/call ${entry.tool}` : entry.action || entry.kind || "mcp";
    const detail = entry.summary || entry.target || "";
    const http = entry.details?.http_status != null ? ` HTTP ${entry.details.http_status}` : "";
    console.warn(
      `[MCP ERROR]${http} ${label}${detail ? ` — ${detail}` : ""}${dur}${sid}`
    );
    return;
  }

  const status = entry.status ? ` [${entry.status}]` : "";

  if (entry.kind === "tool" && entry.action?.startsWith("tool_lease_")) {
    const lease = entry.lease_id || entry.details?.lease_id || entry.summary || "";
    const work = entry.work_id || entry.details?.work_id || "";
    console.log(
      `[LEASE]${status} ${entry.action} ${entry.tool || "tool"}` +
      `${lease ? ` — ${lease}` : ""}${work ? ` work=${String(work)}` : ""}${dur}`
    );
    return;
  }

  if (entry.kind === "tool" && entry.tool) {
    const extra = entry.summary || entry.target || "";
    console.log(`[TOOL]${status} ${entry.tool}${extra ? ` — ${extra}` : ""}${dur}${sid}`);
    return;
  }

  if (entry.kind === "mcp") {
    const label = entry.tool ? `tools/call ${entry.tool}` : entry.action || "request";
    const extra = entry.summary ? ` — ${entry.summary}` : "";
    const discovery =
      entry.action === "tools/list" && entry.details?.tool_count != null
        ? ` (${entry.details.tool_count} tools)`
        : "";
    console.log(`[MCP]${status} ${label}${discovery}${extra}${dur}${sid}`);
    return;
  }

  if (entry.kind === "session") {
    const extra = entry.summary ? ` — ${entry.summary}` : "";
    console.log(`[MCP] session ${entry.action || "event"}${extra}${sid}`);
    return;
  }
}

export async function loadAuditHistory(limit = 80): Promise<ActivityEntry[]> {
  const auditPath = getAuditPath();
  try {
    const raw = await fs.readFile(auditPath, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    const slice = lines.slice(-limit);
    return slice.map((line) => {
      try {
        const rec = JSON.parse(line) as Record<string, unknown>;
        return {
          id: randomUUID(),
          time: String(rec.time || new Date().toISOString()),
          kind: "tool" as const,
          tool: String(rec.tool || "unknown"),
          action: String(rec.action || ""),
          target: rec.target ? String(rec.target) : undefined,
          status: rec.status ? String(rec.status) : undefined,
          details: rec.details as Record<string, unknown> | undefined,
          summary: rec.target ? String(rec.target) : undefined,
        };
      } catch {
        return {
          id: randomUUID(),
          time: new Date().toISOString(),
          kind: "system" as const,
          summary: line.slice(0, 200),
        };
      }
    }).reverse();
  } catch {
    return [];
  }
}

export async function loadActivityHistory(limit = 200): Promise<ActivityEntry[]> {
  const records = await loadRuntimeLog(limit);
  return records.flatMap((record) => {
    if (typeof record.id !== "string" || typeof record.time !== "string") return [];
    return [record as unknown as ActivityEntry];
  });
}

export function logMcpHttpEvent(opts: {
  method: string;
  path: string;
  httpStatus: number;
  durationMs: number;
  sessionId?: string;
  rpcMethod?: string;
  tool?: string;
  errorMessage?: string;
  summary?: string;
}): void {
  const isError = opts.httpStatus >= 400;
  const label = opts.tool
    ? `tools/call ${opts.tool}`
    : opts.rpcMethod || `${opts.method} ${opts.path}`;
  const summary =
    opts.errorMessage ||
    opts.summary ||
    (isError ? `HTTP ${opts.httpStatus}` : undefined);

  appendActivity({
    kind: opts.rpcMethod === "initialize" ? "session" : "mcp",
    tool: opts.tool,
    action: opts.rpcMethod || `${opts.method} ${opts.path}`,
    session_id: opts.sessionId,
    client: "chatgpt",
    status: isError ? "error" : "ok",
    duration_ms: opts.durationMs,
    summary,
    details: { http_status: opts.httpStatus, method: opts.method, path: opts.path },
  });
}

export function logMcpRequest(
  body: unknown,
  sessionId: string | undefined,
  durationMs: number,
  httpStatus: number,
  errorMessage?: string
): void {
  if (typeof body !== "object" || body === null) {
    if (httpStatus >= 400) {
      logMcpHttpEvent({
        method: "POST",
        path: "/mcp",
        httpStatus,
        durationMs,
        sessionId,
        errorMessage,
      });
    }
    return;
  }
  const rpc = body as {
    id?: string | number;
    method?: string;
    params?: { name?: string; arguments?: unknown; protocolVersion?: string };
  };
  const isError = httpStatus >= 400;
  const argSummary =
    rpc.method === "tools/call" && rpc.params?.name
      ? summarizeToolArgs(rpc.params.name, rpc.params.arguments)
      : undefined;
  const summary = errorMessage || argSummary;

  if (rpc.method === "tools/call" && rpc.params?.name) {
    const tool = rpc.params.name;
    appendActivity({
      kind: "mcp",
      tool,
      action: "tools/call",
      session_id: sessionId,
      request_id: rpc.id,
      client: "chatgpt",
      status: isError ? "error" : "ok",
      duration_ms: durationMs,
      summary,
      details: {
        http_status: httpStatus,
        request_id: rpc.id,
        arguments: rpc.params.arguments,
        ...(errorMessage ? { error: errorMessage } : {}),
      },
    });
    return;
  }

  if (rpc.method === "initialize") {
    appendActivity({
      kind: "session",
      action: "initialize",
      session_id: sessionId,
      request_id: rpc.id,
      client: "chatgpt",
      status: isError ? "error" : "ok",
      duration_ms: durationMs,
      summary: errorMessage,
      details: { http_status: httpStatus, request_id: rpc.id },
    });
    return;
  }

  if (rpc.method === "tools/list") {
    appendActivity({
      kind: "mcp",
      action: "tools/list",
      session_id: sessionId,
      request_id: rpc.id,
      client: "chatgpt",
      status: isError ? "error" : "ok",
      duration_ms: durationMs,
      summary: errorMessage || (isError ? `HTTP ${httpStatus}` : "discovery"),
      details: { http_status: httpStatus, request_id: rpc.id, phase: "connector_discovery" },
    });
    return;
  }

  if (rpc.method && !rpc.method.startsWith("notifications/")) {
    appendActivity({
      kind: "mcp",
      action: rpc.method,
      session_id: sessionId,
      request_id: rpc.id,
      client: "chatgpt",
      status: isError ? "error" : "ok",
      duration_ms: durationMs,
      summary: errorMessage,
      details: { http_status: httpStatus, request_id: rpc.id },
    });
  }
}

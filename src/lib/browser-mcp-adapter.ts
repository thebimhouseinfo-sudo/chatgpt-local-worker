import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { assertBrowserCapability } from "./browser-capability.js";
import { assertPathInsideWorkspaceSync } from "./path-security.js";
import { isLeaseActive, onWorkRegistrationReleased, type ToolLease } from "./work-registration.js";

const operationMap = {
  browser_open: "agent_browser_open",
  browser_snapshot: "agent_browser_snapshot",
  browser_click: "agent_browser_click",
  browser_fill: "agent_browser_fill",
  browser_press: "agent_browser_press",
  browser_wait: "agent_browser_wait_for_selector",
  browser_screenshot: "agent_browser_screenshot",
  browser_get_url: "agent_browser_get_url",
  browser_close: "agent_browser_close",
} as const;
export type BrowserOperation = keyof typeof operationMap;
export const BROWSER_OPERATIONS = Object.keys(operationMap) as BrowserOperation[];

const workLease = new AsyncLocalStorage<ToolLease>();
interface Session {
  client: Client;
  transport: StdioClientTransport;
  session: string;
  workspace: string;
  executionId: string;
  allowedDomains: string[];
  lastOrigin: string;
  closed: boolean;
}
const owned = new Map<string, Session>();
const START_TIMEOUT_MS = 12_000;
const CALL_TIMEOUT_MS = 25_000;
const MAX_CONTENT_BYTES = 5 * 1024 * 1024;
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function runWithBrowserLease<T>(lease: ToolLease, callback: () => T): T {
  return workLease.run(lease, callback);
}
function requireLease(): ToolLease {
  const lease = workLease.getStore();
  if (!lease || lease.jobId !== "dev-coding" || lease.family !== "browser" || !isLeaseActive(lease)) {
    throw new Error("BROWSER_DENIED: browser requires a live Dev Coding work lease");
  }
  assertBrowserCapability();
  return lease;
}
export function assertApprovedBrowserUrl(value: string): string {
  let u: URL;
  try { u = new URL(value); } catch { throw new Error("BROWSER_ORIGIN_DENIED: invalid URL"); }
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password ||
      !LOOPBACK.has(u.hostname.toLowerCase())) {
    throw new Error("BROWSER_ORIGIN_DENIED: v1 permits loopback preview URLs only");
  }
  return u.href;
}
async function withDeadline<T>(promise: Promise<T>, timeout: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("BROWSER_TIMEOUT")), timeout);
      }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}
async function startup(lease: ToolLease): Promise<Session> {
  const current = owned.get(lease.workId);
  if (current && !current.closed) return current;
  // One isolated stdio server + upstream browser session per confirmed execution.
  const id = "gptworker-" + randomUUID();
  const transport = new StdioClientTransport({
    command: "agent-browser", args: ["mcp"],
    env: { ...process.env, AGENT_BROWSER_SESSION: id, AGENT_BROWSER_HEADED: "false" },
    stderr: "pipe",
  });
  const client = new Client({ name: "gptworker-browser", version: "1.0.0" });
  const entry: Session = {
    client, transport, session: id,
    workspace: lease.workspace, executionId: lease.workId,
    allowedDomains: ["localhost", "127.0.0.1", "::1"],
    lastOrigin: "", closed: false,
  };
  try {
    await withDeadline(client.connect(transport), START_TIMEOUT_MS);
    const available = new Map<string, any>();
    let cursor: string | undefined;
    do {
      const response = await withDeadline(client.listTools(cursor ? { cursor } : {}), START_TIMEOUT_MS);
      for (const tool of response.tools) available.set(tool.name, tool);
      cursor = response.nextCursor;
    } while (cursor);
    for (const expected of Object.values(operationMap)) {
      const schema = available.get(expected)?.inputSchema;
      if (!schema || schema.type !== "object" || typeof schema.properties !== "object") {
        throw new Error("BROWSER_SCHEMA_MISMATCH: missing tool " + expected);
      }
    }
    if (!isLeaseActive(lease)) throw new Error("BROWSER_DENIED: work lease revoked during startup");
    owned.set(lease.workId, entry);
    return entry;
  } catch (error) {
    entry.closed = true;
    await transport.close().catch(() => {});
    throw error;
  }
}
export async function closeBrowserExecution(executionId: string): Promise<void> {
  const entry = owned.get(executionId);
  if (!entry) return;
  owned.delete(executionId);
  entry.closed = true;
  await withDeadline(entry.transport.close(), 3_000).catch(() => {});
}
export async function closeAllBrowserExecutions(): Promise<void> {
  await Promise.all([...owned.keys()].map(id => closeBrowserExecution(id)));
}
onWorkRegistrationReleased((registration) => {
  // Revoke synchronously in Map, then close the owned subprocess asynchronously.
  void closeBrowserExecution(registration.executionId);
});
process.once("exit", () => {
  for (const entry of owned.values()) {
    // StdioClientTransport owns the spawned child and will close it on normal
    // shutdown; synchronous exit handler must never kill unrelated processes.
    entry.closed = true;
  }
});

function validateArgs(op: BrowserOperation, args: Record<string, unknown>): Record<string, unknown> {
  const permitted: Record<BrowserOperation, string[]> = {
    browser_open: ["url"],
    browser_snapshot: ["interactive", "compact", "depth", "selector"],
    browser_click: ["selector"],
    browser_fill: ["selector", "text"],
    browser_press: ["key"],
    browser_wait: ["selector"],
    browser_screenshot: ["selector", "fullPage", "format"],
    browser_get_url: [],
    browser_close: [],
  };
  if (Object.keys(args).some(k => !permitted[op].includes(k))) {
    throw new Error("BROWSER_ARGUMENT_DENIED: unknown or forbidden argument");
  }
  const required: Partial<Record<BrowserOperation, string[]>> = {
    browser_open: ["url"], browser_click: ["selector"], browser_fill: ["selector", "text"],
    browser_press: ["key"], browser_wait: ["selector"],
  };
  for (const field of required[op] || []) {
    if (typeof args[field] !== "string" || !(args[field] as string).trim() || (args[field] as string).length > 4000) {
      throw new Error("BROWSER_ARGUMENT_DENIED: invalid " + field);
    }
  }
  if (op === "browser_open") args.url = assertApprovedBrowserUrl(String(args.url));
  if (args.selector !== undefined && (typeof args.selector !== "string" || args.selector.length > 1000)) {
    throw new Error("BROWSER_ARGUMENT_DENIED: invalid selector");
  }
  if (args.text !== undefined && (typeof args.text !== "string" || args.text.length > 4000)) {
    throw new Error("BROWSER_ARGUMENT_DENIED: invalid text");
  }
  if (args.key !== undefined && (typeof args.key !== "string" || args.key.length > 120)) {
    throw new Error("BROWSER_ARGUMENT_DENIED: invalid key");
  }
  for (const key of ["interactive", "compact", "fullPage"]) {
    if (args[key] !== undefined && typeof args[key] !== "boolean") throw new Error("BROWSER_ARGUMENT_DENIED: invalid " + key);
  }
  if (args.depth !== undefined && (!Number.isInteger(args.depth) || (args.depth as number) < 0 || (args.depth as number) > 30)) throw new Error("BROWSER_ARGUMENT_DENIED: invalid depth");
  if (args.format !== undefined && !["png", "jpeg"].includes(String(args.format))) throw new Error("BROWSER_ARGUMENT_DENIED: invalid format");
  return args;
}
async function rawCall(entry: Session, tool: string, args: Record<string, unknown>): Promise<any> {
  if (entry.closed) throw new Error("BROWSER_DENIED: session revoked");
  return withDeadline(entry.client.callTool({ name: tool, arguments: {
    ...args, session: entry.session, allowedDomains: entry.allowedDomains,
  } }), CALL_TIMEOUT_MS);
}
function contentSize(result: any): number {
  return (result.content || []).reduce((sum: number, item: any) =>
    sum + (typeof item.text === "string" ? Buffer.byteLength(item.text) : typeof item.data === "string" ? Buffer.byteLength(item.data, "base64") : 0), 0);
}
async function verifyPageOrigin(entry: Session): Promise<void> {
  const result = await rawCall(entry, operationMap.browser_get_url, {});
  if (result.isError) throw new Error("BROWSER_ORIGIN_DENIED: cannot verify current URL");
  const text = (result.content || []).filter((x: any) => x.type === "text").map((x: any) => x.text).join("\n").trim();
  if (!text) throw new Error("BROWSER_ORIGIN_DENIED: missing URL");
  // Upstream may return CLI text decorated with labels; keep fail closed if it
  // is not an unambiguous approved URL.
  entry.lastOrigin = new URL(assertApprovedBrowserUrl(text)).origin;
}
export async function callBrowserTool(op: BrowserOperation, supplied: Record<string, unknown> = {}): Promise<any> {
  const lease = requireLease();
  if (!(op in operationMap)) throw new Error("BROWSER_ARGUMENT_DENIED: unlisted tool");
  const args = validateArgs(op, { ...supplied });
  // Validate both before and after the lazy-start await to close revoke races.
  const entry = await startup(lease);
  try {
    requireLease();
    if (entry.executionId !== lease.workId || entry.workspace !== lease.workspace || entry.closed) {
      throw new Error("BROWSER_DENIED: wrong execution/session");
    }
    if (op !== "browser_open" && op !== "browser_close") await verifyPageOrigin(entry);
    if (op === "browser_screenshot") {
      const evidence = path.join(lease.workspace, ".gptworker", "dev-coding", "browser-evidence",
        createHash("sha256").update(lease.workId).digest("hex").slice(0, 16),
        randomUUID() + "." + (args.format === "jpeg" ? "jpg" : "png"));
      assertPathInsideWorkspaceSync(evidence, lease.workspace);
      await fs.mkdir(path.dirname(evidence), { recursive: true });
      args.path = evidence;
    }
    const result = await rawCall(entry, operationMap[op], args);
    requireLease();
    if (contentSize(result) > MAX_CONTENT_BYTES) throw new Error("BROWSER_OUTPUT_TOO_LARGE");
    if (op === "browser_open" || ["browser_click", "browser_fill", "browser_press", "browser_wait"].includes(op)) {
      if (!result.isError) await verifyPageOrigin(entry);
    }
    if (op === "browser_close") await closeBrowserExecution(lease.workId);
    return result;
  } catch (error) {
    await closeBrowserExecution(lease.workId);
    throw error;
  }
}

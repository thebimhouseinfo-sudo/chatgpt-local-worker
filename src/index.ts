#!/usr/bin/env node

import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { randomUUID } from "crypto";

import {
  setDefaultCwd,
  getDefaultCwd,
} from "./lib/path-security.js";
import {
  consumeSessionTransportError,
  createSessionManager,
  extractRequestId,
  isInitializeRequest,
} from "./lib/mcp-session-manager.js";
import { logMcpHttpEvent, logMcpRequest, logSystemEvent } from "./lib/activity-log.js";
import {
  buildInstructionContext,
  summarizeInstructionContext,
  type InstructionContext,
} from "./lib/instruction-context.js";
import { buildLegacyDiscoverFallback } from "./lib/mcp-discover-compat.js";
import { flushRuntimeLog } from "./lib/runtime-log.js";
import { getWorkRegistrationCount } from "./lib/work-registration.js";
import { getWorkGatewayTelemetry } from "./tools/work-gateway.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "127.0.0.1";
const MCP_TOKEN = (process.env.MCP_TOKEN || "").trim();
const SHELL_TIMEOUT = parseInt(process.env.SHELL_TIMEOUT || "120", 10);
const SESSION_RECOVERY =
  (process.env.MCP_SESSION_RECOVERY || "true").toLowerCase() !== "false";

function splitWorkspaceEnv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(";")
    .map((p) => p.trim().replace(/^['\"]|['\"]$/g, ""))
    .filter(Boolean);
}

function resolveWorkspaceRoots(): string[] {
  const configuredRoots = [
    ...splitWorkspaceEnv(process.env.WORKSPACE_PATH || process.cwd()),
    ...splitWorkspaceEnv(process.env.EXTRA_WORKSPACE_PATHS),
    ...splitWorkspaceEnv(process.env.WORKSPACE_PATHS),
    ...splitWorkspaceEnv(process.env.ALLOWED_WORKSPACE_PATHS),
  ];

  const roots = configuredRoots.map((p) => path.resolve(p));
  return [...new Set(roots)];
}

const workspaceRoots = resolveWorkspaceRoots();
const workspaceRoot = workspaceRoots[0] || process.cwd();
setDefaultCwd(workspaceRoot);


const instructionContext: InstructionContext = await buildInstructionContext({
  workspaceRoot,
  workspaceRoots,
  pid: process.pid,
});

console.log(
  `[MCP] MCP instructions: ${Math.round(instructionContext.instructionBytes / 1024)}KB (control plane)`
);

const sessionManager = createSessionManager({
  workspaceRoot,
  shellTimeout: SHELL_TIMEOUT,
  workspaceRoots,
  port: PORT,
  controlPlaneInstructions: instructionContext.contextText,
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
// ChatGPT co the goi "/" hoac "/mcp" — ho tro ca hai.
// Neu dat MCP_TOKEN, endpoint doi thanh "/<token>" + "/mcp/<token>"; cac path
// khong co token se tra 404 de client khong hieu nham la OAuth challenge.
const MCP_PATHS = MCP_TOKEN ? [`/${MCP_TOKEN}`, `/mcp/${MCP_TOKEN}`] : ["/", "/mcp"];
const MCP_PATHS_SET = new Set(MCP_PATHS);

app.use((req, res, next) => {
  const started = Date.now();
  const isMcpRoute = MCP_PATHS_SET.has(req.path);
  res.on("finish", () => {
    const duration = Date.now() - started;
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const sessionInfo = sessionId ? ` session=${String(sessionId).slice(0, 8)}...` : "";

    if (req.method === "POST" && isMcpRoute) {
      const transportError =
        consumeSessionTransportError(sessionId) ||
        (typeof res.locals.mcpError === "string" ? res.locals.mcpError : undefined);
      logMcpRequest(req.body, sessionId, duration, res.statusCode, transportError);
      return;
    }

    if (isMcpRoute && res.statusCode >= 400) {
      const reason =
        (typeof res.locals.mcpError === "string" ? res.locals.mcpError : undefined) ||
        (res.statusCode === 404
          ? "Session not found"
          : res.statusCode === 400
            ? "Bad Request (missing Mcp-Session-Id or invalid state)"
            : `HTTP ${res.statusCode}`);
      logMcpHttpEvent({
        method: req.method,
        path: req.path,
        httpStatus: res.statusCode,
        durationMs: duration,
        sessionId,
        errorMessage: reason,
      });
      return;
    }

    if (isMcpRoute) {
      logMcpHttpEvent({
        method: req.method,
        path: req.path,
        httpStatus: res.statusCode,
        durationMs: duration,
        sessionId,
        summary:
          req.method === "GET"
            ? "transport request"
            : req.method === "DELETE"
              ? "session delete"
              : undefined,
      });
      return;
    }

    console.log(`[HTTP] ${req.method} ${req.path} ${res.statusCode} ${duration}ms${sessionInfo}`);
    logSystemEvent("http_request", {
      status: res.statusCode >= 400 ? "error" : "ok",
      sessionId,
      details: {
        method: req.method,
        path: req.path,
        http_status: res.statusCode,
        duration_ms: duration,
      },
    });
  });
  next();
});

if (MCP_TOKEN) {
  // 404 chu KHONG phai 401: theo chuan MCP, 401 la tin hieu "can OAuth" — client
  // (ChatGPT) se di tim OAuth metadata, khong thay, roi treo. 404 = khong co gi o day.
  for (const unguarded of ["/", "/mcp"]) {
    app.all(unguarded, (_req, res) => {
      res.status(404).json({ ok: false, error: "Not found" });
    });
  }
}

app.get("/health", (_req, res) => {
  const memory = process.memoryUsage();
  const mb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;
  const activeWork = getWorkRegistrationCount();
  const gateway = getWorkGatewayTelemetry();
  const runtimeMode =
    activeWork > 0
      ? gateway.loaded_family_count > 0
        ? "execution-ready"
        : "armed"
      : gateway.loaded_family_count > 0
        ? "preloaded-cache"
        : "control-plane";
  res.json({
    status: "ok",
    name: "chatgpt-local-worker",
    workspace: workspaceRoot,
    defaultCwd: getDefaultCwd(),
    jobWorkspaceBoundaryEnforced: true,
    effectiveJobAccess: "confirmed-workspace-only",
    activeSessions: sessionManager.count(),
    activeWork,
    runtimeMode,
    loadedWorkFamilies: gateway.loaded_families,
    memory: {
      rss_mb: mb(memory.rss),
      heap_used_mb: mb(memory.heapUsed),
      heap_total_mb: mb(memory.heapTotal),
      external_mb: mb(memory.external),
    },
    sessionRecovery: SESSION_RECOVERY,
    mcpEndpoints: MCP_PATHS,
    instructions: summarizeInstructionContext(instructionContext),
  });
});

async function handleMcpPost(req: express.Request, res: express.Response): Promise<void> {
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const requestId = extractRequestId(req.body);

    // MCP 2026-07-28 clients probe legacy servers with server/discover first.
    // Do not create/recover a stateful v1 session for this stateless probe:
    // returning JSON-RPC MethodNotFound with HTTP 200 tells modern clients to
    // fall back to the legacy initialize handshake without retaining a session ID.
    const discoverFallback = buildLegacyDiscoverFallback(req.body);
    if (discoverFallback) {
      console.log("[MCP] server/discover -> legacy initialize fallback");
      res.status(200).json(discoverFallback);
      return;
    }

    const existing = sessionId ? sessionManager.get(sessionId) : undefined;
    if (existing) {
      await sessionManager.handleExisting(existing, req, res, req.body);
      return;
    }

    if (isInitializeRequest(req.body)) {
      if (sessionId) {
        console.log(`[MCP] Re-initialize with stale session header: ${sessionId}`);
      }
      await sessionManager.createNew(req, res, req.body);
      return;
    }

    if (sessionId) {
      if (SESSION_RECOVERY) {
        const recovered = await sessionManager.tryRecoverStale(
          sessionId,
          req,
          res,
          req.body
        );
        if (recovered) return;
      }
      sessionManager.sendSessionNotFound(res, requestId);
      return;
    }

    // Other sessionless legacy requests may still need recovery/adoption.
    // server/discover is handled above as a stateless compatibility probe.
    if (SESSION_RECOVERY) {
      const adopted = await sessionManager.tryRecoverStale(
        randomUUID(),
        req,
        res,
        req.body
      );
      if (adopted) return;
    }

    sessionManager.sendBadRequest(
      res,
      "Bad Request: Mcp-Session-Id header is required",
      requestId
    );
  } catch (error) {
    console.log("[MCP] Error:", error);
    logSystemEvent("mcp_handler_error", {
      status: "error",
      sessionId: req.headers["mcp-session-id"] as string | undefined,
      summary: error instanceof Error ? error.message : String(error),
      details: { request_id: extractRequestId(req.body) },
    });
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: extractRequestId(req.body),
      });
    }
  }
}

function handleStaleSession(
  req: express.Request,
  res: express.Response,
  sessionId: string | undefined
): boolean {
  if (!sessionId || sessionManager.get(sessionId)) {
    return false;
  }
  sessionManager.sendSessionNotFound(res);
  return true;
}

async function handleMcpGet(req: express.Request, res: express.Response): Promise<void> {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (handleStaleSession(req, res, sessionId)) return;

  if (!sessionId) {
    sessionManager.sendBadRequest(res, "Bad Request: Mcp-Session-Id header is required");
    return;
  }

  const session = sessionManager.get(sessionId);
  if (!session) {
    sessionManager.sendSessionNotFound(res);
    return;
  }

  await sessionManager.handleExisting(session, req, res, undefined);
}

async function handleMcpDelete(req: express.Request, res: express.Response): Promise<void> {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (handleStaleSession(req, res, sessionId)) return;

  if (!sessionId) {
    sessionManager.sendBadRequest(res, "Bad Request: Mcp-Session-Id header is required");
    return;
  }

  const session = sessionManager.get(sessionId);
  if (!session) {
    sessionManager.sendSessionNotFound(res);
    return;
  }

  await sessionManager.handleExisting(session, req, res, undefined);
}

for (const mcpPath of MCP_PATHS) {
  app.post(mcpPath, handleMcpPost);
  app.get(mcpPath, handleMcpGet);
  app.delete(mcpPath, handleMcpDelete);
}

sessionManager.startCleanup();


const server = app.listen(PORT, HOST, () => {
  logSystemEvent("worker_start", {
    details: {
      pid: process.pid,
      host: HOST,
      port: PORT,
      workspace: workspaceRoot,
    },
  });
  console.log("");
  console.log("========================================");
  console.log("  ChatGPT Local Worker");
  console.log("========================================");
  console.log(`  Local:     http://${HOST}:${PORT}`);
  console.log(`  MCP:       http://${HOST}:${PORT}${MCP_PATHS[0]}`);
  console.log(`  MCP alt:   http://${HOST}:${PORT}${MCP_PATHS[1]}`);
  console.log(`  Health:    http://${HOST}:${PORT}/health`);
  console.log(`  Default cwd: ${workspaceRoot}`);
  console.log(`  Host machine access: available to the Worker process`);
  console.log(`  Active Job boundary: confirmed Workspace only`);
  console.log(`  Session recovery: ${SESSION_RECOVERY ? "ON" : "OFF"}`);
  console.log(`  Auth:      ${MCP_TOKEN ? "ON (MCP_TOKEN in URL path)" : "OFF — dat MCP_TOKEN trong .env neu can path token"}`);
  console.log(`  PID:       ${process.pid}`);
  console.log("========================================");
  console.log("  Dang chay... (Ctrl+C de dung)");
  console.log("========================================");
  console.log("");
});

server.on("error", async (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n[LOI] Port ${PORT} da co server khac dang chay!`);
    console.error("Chay lenh sau de tim process:");
    console.error(`  netstat -ano | findstr ":${PORT}"`);
    console.error("Dung GPTWorker tray hoac .\\reset-runtime.ps1 de reset runtime cu\n");
  } else {
    console.error("\n[LOI] Khong the khoi dong server:", err.message, "\n");
  }
  logSystemEvent("worker_start_failed", {
    status: "error",
    summary: err.message,
    details: { code: err.code, host: HOST, port: PORT },
  });
  await flushRuntimeLog();
  process.exit(1);
});

process.on("SIGINT", () => {
  console.log("\n[DUNG] Server dang tat...");
  logSystemEvent("worker_stop", { summary: "SIGINT" });
  sessionManager.stopCleanup();
  const runtimeLogFlushed = flushRuntimeLog();
  server.close(() => {
    void runtimeLogFlushed.finally(() => process.exit(0));
  });
});

// Tranh process tu tat khi stdin dong (Windows)
if (process.stdin.isTTY) {
  process.stdin.resume();
}

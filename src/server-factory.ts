import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerJobTools } from "./tools/jobs.js";
import { buildServerInstructions } from "./lib/quickstart.js";
import type { McpUpstreamManager } from "./lib/mcp-upstream-manager.js";
import { getChatGptToolProfile, shouldExposeTool } from "./lib/tool-profile.js";
import { TOOL_RESULT_OUTPUT_SCHEMA } from "./lib/tool-result.js";
import { JobRuntime } from "./jobs/job-runtime.js";
import { runWithWorkspaceCwd } from "./lib/path-security.js";
import { acquireToolLease, releaseToolLease } from "./lib/work-registration.js";
import { requiresWorkHandle, toolFamily } from "./lib/tool-work-policy.js";

const NOOP_TOOL = {
  remove: () => {},
  update: () => {},
  enable: () => {},
  disable: () => {},
  handler: async () => ({ content: [] }),
  enabled: false,
} as unknown as RegisteredTool;

function configureToolRegistration(server: McpServer): void {
  const profile = getChatGptToolProfile();
  const original = server.registerTool.bind(server);
  server.registerTool = ((name, config, callback) => {
    const toolName = String(name);
    const isUpstreamProxy = toolName.includes("__");
    const requiresWork = requiresWorkHandle(toolName);

    if (!isUpstreamProxy && profile !== "full" && !shouldExposeTool(toolName, profile)) {
      return NOOP_TOOL;
    }

    const baseInputSchema = ((config as any).inputSchema || {}) as Record<string, unknown>;
    const inputSchema = requiresWork
      ? {
          ...baseInputSchema,
          execution_id: z
            .string()
            .min(1)
            .describe("Work execution id returned by the confirmed job_select activation"),
          authority_token: z
            .string()
            .min(1)
            .describe("Opaque work authority token returned with execution_id by job_select"),
        }
      : baseInputSchema;

    const description = requiresWork
      ? `${config.description || ""} Requires the active work_handle returned by job_select.`.trim()
      : config.description;

    const nextConfig = {
      ...config,
      ...(requiresWork ? { inputSchema, description } : {}),
      ...(!isUpstreamProxy && !config.outputSchema
        ? { outputSchema: TOOL_RESULT_OUTPUT_SCHEMA }
        : {}),
    };

    const wrappedCallback = requiresWork
      ? async (args: Record<string, unknown> = {}, ...rest: unknown[]) => {
          const executionId =
            typeof args.execution_id === "string" ? args.execution_id : undefined;
          const authorityToken =
            typeof args.authority_token === "string" ? args.authority_token : undefined;
          const lease = acquireToolLease(
            toolName,
            toolFamily(toolName),
            executionId,
            authorityToken
          );
          const toolArgs = { ...args };
          delete toolArgs.execution_id;
          delete toolArgs.authority_token;

          try {
            const result = await runWithWorkspaceCwd(lease.workspace, () =>
              (callback as any)(toolArgs, ...rest)
            );
            releaseToolLease(lease, "ok");
            return result;
          } catch (error) {
            releaseToolLease(
              lease,
              "error",
              error instanceof Error ? error.message : String(error)
            );
            throw error;
          }
        }
      : callback;

    return original(name, nextConfig as any, wrappedCallback as any);
  }) as typeof server.registerTool;
}

export interface ExecutionRuntimeController {
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  status(): {
    active: boolean;
    native_tool_count: number;
  };
}

export function createExecutionRuntimeController(
  server: McpServer,
  workspaceRoot: string,
  shellTimeout: number,
  upstreamManager?: McpUpstreamManager
): ExecutionRuntimeController {
  let nativeHandles: RegisteredTool[] = [];
  let active = false;
  let transition: Promise<void> | null = null;

  const activate = async (): Promise<void> => {
    if (active) return;
    if (transition) {
      await transition;
      if (active) return;
    }

    transition = (async () => {
      const [
        filesystem,
        shell,
        git,
        context,
        nodeRepl,
        ponytail,
        rewind,
        mcpBridge,
      ] = await Promise.all([
        import("./tools/filesystem.js"),
        import("./tools/shell.js"),
        import("./tools/git.js"),
        import("./tools/context.js"),
        import("./tools/node-repl.js"),
        import("./tools/ponytail.js"),
        import("./tools/rewind.js"),
        import("./tools/mcp-bridge.js"),
      ]);

      const configuredRegister = server.registerTool.bind(server);
      const captured: RegisteredTool[] = [];
      server.registerTool = ((name, config, callback) => {
        const handle = configuredRegister(name, config, callback);
        if (handle !== NOOP_TOOL) captured.push(handle);
        return handle;
      }) as typeof server.registerTool;

      try {
        filesystem.registerFilesystemTools(server);
        shell.registerShellTools(server, workspaceRoot, shellTimeout);
        git.registerGitTools(server, workspaceRoot);
        context.registerContextTools(server, workspaceRoot);
        nodeRepl.registerNodeReplTool(server, workspaceRoot);
        ponytail.registerPonytailTurnTool(server);
        rewind.registerRewindTools(server);
        if (upstreamManager) {
          mcpBridge.registerMcpBridgeTools(server, upstreamManager);
        }
      } catch (error) {
        for (const handle of captured.reverse()) {
          try {
            handle.remove();
          } catch {}
        }
        throw error;
      } finally {
        server.registerTool = configuredRegister as typeof server.registerTool;
      }

      nativeHandles = captured;

      if (upstreamManager) {
        upstreamManager.registerMcpServer(server);
        const { refreshProxiedTools } = await import("./lib/mcp-tool-proxy.js");
        await refreshProxiedTools(server, upstreamManager);
      }

      active = true;
      await server.sendToolListChanged();
    })();

    try {
      await transition;
    } finally {
      transition = null;
    }
  };

  const deactivate = async (): Promise<void> => {
    if (transition) await transition;
    if (!active && nativeHandles.length === 0) return;

    if (upstreamManager) {
      const { clearProxiedTools } = await import("./lib/mcp-tool-proxy.js");
      clearProxiedTools(server);
      upstreamManager.unregisterMcpServer(server);
    }

    for (const handle of nativeHandles.reverse()) {
      try {
        handle.remove();
      } catch {}
    }
    nativeHandles = [];
    active = false;
    await server.sendToolListChanged();
  };

  return {
    activate,
    deactivate,
    status: () => ({
      active,
      native_tool_count: nativeHandles.length,
    }),
  };
}

export function createMcpServer(
  workspaceRoot: string,
  shellTimeout: number,
  workspaceRoots: string[] = [workspaceRoot],
  fullDiskAccess = false,
  upstreamManager?: McpUpstreamManager,
  projectMemoryInstructions?: string
): McpServer {
  const server = new McpServer(
    {
      name: "local-worker-mcp-server",
      version: "2.2.0",
    },
    {
      capabilities: {
        logging: {},
        tools: { listChanged: true },
      },
      instructions: buildServerInstructions(
        workspaceRoot,
        workspaceRoots,
        fullDiskAccess,
        projectMemoryInstructions
      ),
    }
  );

  configureToolRegistration(server);

  const jobRuntime = new JobRuntime(workspaceRoot);
  const executionRuntime = createExecutionRuntimeController(
    server,
    workspaceRoot,
    shellTimeout,
    upstreamManager
  );

  // Idle sessions expose only the lightweight Job/control plane. Filesystem,
  // shell, git, context, REPL, rewind and upstream tools are loaded only after
  // a Job + Workspace is explicitly confirmed.
  registerJobTools(server, jobRuntime, {
    onWorkActivated: () => executionRuntime.activate(),
    onWorkStopped: () => executionRuntime.deactivate(),
  });

  return server;
}

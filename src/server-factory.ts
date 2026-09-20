import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerJobTools } from "./tools/jobs.js";
import { registerWorkGateway } from "./tools/work-gateway.js";
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
      version: "2.3.0",
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
  // Commands and Job selection remain control-plane only. The work_tool
  // gateway is lightweight and imports an execution family only when an
  // actual work operation is called.
  registerJobTools(server, jobRuntime);
  registerWorkGateway(server, workspaceRoot, shellTimeout, upstreamManager);

  return server;
}

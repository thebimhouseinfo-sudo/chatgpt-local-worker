import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerJobTools } from "./tools/jobs.js";
import { registerAdmissionTool } from "./tools/admission.js";
import { registerWorkGateway } from "./tools/work-gateway.js";
import { registerWorkspaceDiscoveryTool } from "./tools/workspace-discovery.js";
import { buildServerInstructions } from "./lib/quickstart.js";
import { AdmissionRuntime } from "./lib/activation-policy.js";
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
          const effectiveTool =
            toolName === "work_tool" && typeof args.tool === "string"
              ? args.tool
              : toolName;
          const lease = acquireToolLease(
            effectiveTool,
            toolFamily(effectiveTool),
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
      version: "2.5.2",
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

  // Admission authority is scoped to this MCP server/session so tokens cannot
  // authorize another chat/session.
  const admissionRuntime = new AdmissionRuntime();

  // The admission handshake is the first internal gate whenever ChatGPT is
  // considering GPTWorker for ordinary work. It returns ACTIVE/CONTROL/INACTIVE.
  registerAdmissionTool(server, admissionRuntime);

  const jobRuntime = new JobRuntime(workspaceRoot);
  const workResolver = registerWorkGateway(
    server,
    workspaceRoot,
    shellTimeout,
    upstreamManager
  );

  // workspace_discover is the minimal read-only pre-confirmation probe used
  // only after the user supplied a task + absolute local Workspace.
  registerWorkspaceDiscoveryTool(server, admissionRuntime);

  // Once a Job is nominated, warm its declared tool families in the
  // background while the user reads the confirmation prompt. Confirmation
  // waits for the current nomination's preload if it is still in flight.
  registerJobTools(server, jobRuntime, {
    nominate(job) {
      void workResolver
        .prepareJob(job.id, job.preload_families ?? [])
        .catch((error) => {
          console.warn(
            `[GPTWorker] Tool preload failed for ${job.id}:`,
            error instanceof Error ? error.message : error
          );
        });
    },
    wait(jobId) {
      return workResolver.waitForPreparedJob(jobId);
    },
    clear() {
      workResolver.clearPreparedJob();
    },
  }, admissionRuntime);

  return server;
}

import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerJobTools } from "./tools/jobs.js";
import { registerGptworkerControlTool } from "./tools/control.js";
import { registerAdmissionTool } from "./tools/admission.js";
import { registerWorkGateway } from "./tools/work-gateway.js";
import { registerWorkspaceDiscoveryTool } from "./tools/workspace-discovery.js";
import { AdmissionRuntime } from "./lib/activation-policy.js";
import { TOOL_RESULT_OUTPUT_SCHEMA } from "./lib/tool-result.js";
import { JobRuntime } from "./jobs/job-runtime.js";
import { runWithWorkspaceScope } from "./lib/path-security.js";
import { getCustomJobsRoot, getDefaultJobsRoot } from "./lib/worker-home.js";
import { acquireToolLease, releaseToolLease } from "./lib/work-registration.js";
import { requiresWorkHandle, toolFamily } from "./lib/tool-work-policy.js";

function configureToolRegistration(server: McpServer): void {
  const original = server.registerTool.bind(server);
  server.registerTool = ((name, config, callback) => {
    const toolName = String(name);
    const requiresWork = requiresWorkHandle(toolName);

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
      ...(!config.outputSchema
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
            const supportRoots = [
              path.join(getDefaultJobsRoot(), lease.jobId),
              path.join(getCustomJobsRoot(), lease.jobId),
            ];
            const result = await runWithWorkspaceScope(
              lease.workspace,
              supportRoots,
              () => (callback as any)(toolArgs, ...rest)
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
  serverInstructions: string
): McpServer {
  const server = new McpServer(
    {
      name: "local-worker-mcp-server",
      version: "2.5.3",
    },
    {
      capabilities: {
        logging: {},
        tools: { listChanged: true },
      },
      instructions: serverInstructions,
    }
  );

  configureToolRegistration(server);

  // Static command/help response. This is intentionally registered before
  // admission and Job Runtime because it does not need either of them.
  registerGptworkerControlTool(server);

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
    shellTimeout
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

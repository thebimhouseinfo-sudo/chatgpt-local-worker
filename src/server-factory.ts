import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerFilesystemTools } from "./tools/filesystem.js";
import { registerShellTools } from "./tools/shell.js";
import { registerGitTools } from "./tools/git.js";
import { registerContextTools } from "./tools/context.js";
import { registerJobTools } from "./tools/jobs.js";
import { registerRewindTools } from "./tools/rewind.js";
import { registerMcpBridgeTools } from "./tools/mcp-bridge.js";
import { registerNodeReplTool } from "./tools/node-repl.js";
import { registerPonytailTurnTool } from "./tools/ponytail.js";
import { buildServerInstructions } from "./lib/quickstart.js";
import type { McpUpstreamManager } from "./lib/mcp-upstream-manager.js";
import { getChatGptToolProfile, shouldExposeTool } from "./lib/tool-profile.js";
import { TOOL_RESULT_OUTPUT_SCHEMA } from "./lib/tool-result.js";
import { JobRuntime } from "./jobs/job-runtime.js";
import { runWithWorkspaceCwd } from "./lib/path-security.js";
import { acquireToolLease, releaseToolLease } from "./lib/work-registration.js";

const CONTROL_TOOLS = new Set([
  "job_list",
  "job_status",
  "job_select",
  "job_switch",
  "job_stop",
  "agent_status",
]);

const FILESYSTEM_TOOLS = new Set([
  "read_text_file", "read_file_base64", "write_file", "write_file_base64",
  "edit_file", "multi_edit", "replace_regex", "apply_patch", "list_directory",
  "glob", "grep", "delete_file", "create_directory", "delete_directory",
  "copy_file", "move_file", "search_files", "directory_tree", "list_allowed_directories",
]);

const SHELL_TOOLS = new Set([
  "run_command", "shell_status", "shell_reset", "start_process",
  "process_status", "process_output", "stop_process", "clear_processes",
]);

function toolFamily(toolName: string): string {
  if (FILESYSTEM_TOOLS.has(toolName)) return "filesystem";
  if (SHELL_TOOLS.has(toolName)) return "shell";
  if (toolName.startsWith("git_")) return "git";
  if (toolName.includes("checkpoint") || toolName.includes("rewind")) return "rewind";
  if (toolName.includes("repl")) return "repl";
  if (["project_context", "list_skills", "load_skill", "remember", "load_path_rules"].includes(toolName)) {
    return "context";
  }
  return "core";
}

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
    const requiresWork = !isUpstreamProxy && !CONTROL_TOOLS.has(toolName);

    // Upstream MCP tools are namespaced as <server>__<tool>. An enabled
    // upstream is always exposed directly, even when local tools use slim.
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

    // Every native Local Worker tool returns the stable
    // { ok, tool, summary, data } structuredContent envelope.
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
      version: "2.1.0",
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

  // Per-MCP-session state. Switching/stopping a job clears only this session.
  const jobRuntime = new JobRuntime(workspaceRoot);

  registerJobTools(server, jobRuntime);
  registerFilesystemTools(server);
  registerShellTools(server, workspaceRoot, shellTimeout);
  registerGitTools(server, workspaceRoot);
  registerContextTools(server, workspaceRoot);
  registerNodeReplTool(server, workspaceRoot);
  registerPonytailTurnTool(server);
  registerRewindTools(server);

  if (upstreamManager) {
    registerMcpBridgeTools(server, upstreamManager);
    upstreamManager.registerMcpServer(server);
  }

  return server;
}

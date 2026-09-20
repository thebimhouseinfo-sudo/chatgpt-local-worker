import { z } from "zod";
import type { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpUpstreamManager } from "../lib/mcp-upstream-manager.js";
import { getChatGptToolProfile, shouldExposeTool } from "../lib/tool-profile.js";
import { toolAnnotations } from "../lib/tool-annotations.js";

type ToolCallback = (args?: Record<string, unknown>, ...rest: unknown[]) => unknown;

interface CapturedTool {
  name: string;
  callback: ToolCallback;
}

interface FamilyCache {
  server: McpServer;
  tools: Map<string, CapturedTool>;
}

const FAMILY_TOOLS = {
  filesystem: [
    "read_text_file", "read_file_base64", "write_file", "write_file_base64",
    "edit_file", "multi_edit", "replace_regex", "apply_patch", "list_directory",
    "glob", "grep", "delete_file", "create_directory", "delete_directory",
    "copy_file", "move_file", "search_files", "directory_tree", "list_allowed_directories",
  ],
  shell: [
    "run_command", "shell_status", "shell_reset", "start_process",
    "process_status", "process_output", "stop_process", "clear_processes",
  ],
  git: [
    "git_status", "git_diff", "git_log", "git_add", "git_commit", "git_branch",
    "git_checkout", "git_restore", "git_push", "git_pull", "git_stash", "git_reset",
  ],
  context: [
    "list_skills", "load_skill", "project_context", "agent_status", "remember", "load_path_rules",
  ],
  rewind: ["rewind"],
  repl: ["node_repl"],
  ponytail: ["ponytail_turn"],
  mcp: ["mcp_servers", "mcp_tools", "mcp_call"],
} as const;

type ToolFamily = keyof typeof FAMILY_TOOLS;

export const WORK_TOOL_OPERATIONS = Object.values(FAMILY_TOOLS).flat();

const TOOL_FAMILY = new Map<string, ToolFamily>();
for (const [family, tools] of Object.entries(FAMILY_TOOLS) as Array<
  [ToolFamily, readonly string[]]
>) {
  for (const tool of tools) TOOL_FAMILY.set(tool, family);
}

function fakeHandle(): RegisteredTool {
  return {
    remove: () => {},
    update: () => {},
    enable: () => {},
    disable: () => {},
    handler: async () => ({ content: [] }),
    enabled: true,
  } as unknown as RegisteredTool;
}

function createCaptureServer(): FamilyCache {
  const tools = new Map<string, CapturedTool>();
  const server = {
    registerTool(
      name: string,
      _config: unknown,
      callback: ToolCallback
    ): RegisteredTool {
      tools.set(String(name), { name: String(name), callback });
      return fakeHandle();
    },
  } as unknown as McpServer;
  return { server, tools };
}

export interface WorkToolResolver {
  resolve(tool: string): Promise<CapturedTool>;
  status(): {
    loaded_families: string[];
    loaded_tool_count: number;
  };
}

export function createWorkToolResolver(
  workspaceRoot: string,
  shellTimeout: number,
  upstreamManager?: McpUpstreamManager
): WorkToolResolver {
  const loaded = new Map<ToolFamily, FamilyCache>();
  const pending = new Map<ToolFamily, Promise<FamilyCache>>();

  async function loadFamily(family: ToolFamily): Promise<FamilyCache> {
    const existing = loaded.get(family);
    if (existing) return existing;

    const inFlight = pending.get(family);
    if (inFlight) return inFlight;

    const loading = (async () => {
      const capture = createCaptureServer();

      if (family === "filesystem") {
        const module = await import("./filesystem.js");
        module.registerFilesystemTools(capture.server);
      } else if (family === "shell") {
        const module = await import("./shell.js");
        module.registerShellTools(capture.server, workspaceRoot, shellTimeout);
      } else if (family === "git") {
        const module = await import("./git.js");
        module.registerGitTools(capture.server, workspaceRoot);
      } else if (family === "context") {
        const module = await import("./context.js");
        module.registerContextTools(capture.server, workspaceRoot);
      } else if (family === "rewind") {
        const module = await import("./rewind.js");
        module.registerRewindTools(capture.server);
      } else if (family === "repl") {
        const module = await import("./node-repl.js");
        module.registerNodeReplTool(capture.server, workspaceRoot);
      } else if (family === "ponytail") {
        const module = await import("./ponytail.js");
        module.registerPonytailTurnTool(capture.server);
      } else if (family === "mcp") {
        if (!upstreamManager) {
          throw new Error("Upstream MCP manager is unavailable.");
        }
        const module = await import("./mcp-bridge.js");
        module.registerMcpBridgeTools(capture.server, upstreamManager);
      }

      loaded.set(family, capture);
      return capture;
    })();

    pending.set(family, loading);
    try {
      return await loading;
    } finally {
      pending.delete(family);
    }
  }

  return {
    async resolve(tool: string): Promise<CapturedTool> {
      const family = TOOL_FAMILY.get(tool);
      if (!family) {
        throw new Error(`Unknown work tool: ${tool}`);
      }
      const cache = await loadFamily(family);
      const captured = cache.tools.get(tool);
      if (!captured) {
        throw new Error(
          `Work tool '${tool}' was not registered by the '${family}' family.`
        );
      }
      return captured;
    },

    status() {
      return {
        loaded_families: [...loaded.keys()],
        loaded_tool_count: [...loaded.values()].reduce(
          (count, item) => count + item.tools.size,
          0
        ),
      };
    },
  };
}

export function registerWorkGateway(
  server: McpServer,
  workspaceRoot: string,
  shellTimeout: number,
  upstreamManager?: McpUpstreamManager
): WorkToolResolver {
  const resolver = createWorkToolResolver(
    workspaceRoot,
    shellTimeout,
    upstreamManager
  );
  const profile = getChatGptToolProfile();
  const exposed = WORK_TOOL_OPERATIONS.filter((name) =>
    shouldExposeTool(name, profile)
  );

  if (exposed.length === 0) {
    throw new Error("No work operations are enabled for the current tool profile.");
  }

  server.registerTool(
    "work_tool",
    {
      title: "GPTWorker Work Tool",
      description:
        "Execute one confirmed-work operation on demand. This is the only execution gateway: selecting or confirming a Job does not load filesystem/shell/git/etc. The requested operation family is imported only when this tool is actually called, then cached for later calls. Common operations: read_text_file, glob, grep, apply_patch, write_file, move_file, run_command, start_process, process_output, git_status, git_diff, git_commit, project_context, list_skills, load_skill, rewind, node_repl.",
      inputSchema: {
        tool: z.enum(exposed as [string, ...string[]]).describe(
          "Exact work operation to execute. Only the selected operation family is lazy-loaded."
        ),
        arguments: z
          .record(z.string(), z.any())
          .optional()
          .default({})
          .describe(
            "Arguments for the selected operation, using the same argument names as that operation."
          ),
      },
      annotations: toolAnnotations("edit"),
    },
    async ({ tool, arguments: args }) => {
      const captured = await resolver.resolve(tool);
      return captured.callback(args ?? {});
    }
  );

  return resolver;
}

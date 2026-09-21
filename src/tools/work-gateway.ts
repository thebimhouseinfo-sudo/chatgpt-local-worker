import { z } from "zod";
import type { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getChatGptToolProfile, shouldExposeTool } from "../lib/tool-profile.js";
import { toolAnnotations } from "../lib/tool-annotations.js";

type ToolCallback = (args?: Record<string, unknown>, ...rest: unknown[]) => any;

interface CapturedTool {
  name: string;
  config: { inputSchema?: Record<string, z.ZodTypeAny> };
  callback: ToolCallback;
}

interface FamilyCache {
  server: McpServer;
  tools: Map<string, CapturedTool>;
}

export const FAMILY_TOOLS = {
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
  repl: ["node_repl"],
} as const;

export type ToolFamily = keyof typeof FAMILY_TOOLS;
export const TOOL_FAMILIES = Object.keys(FAMILY_TOOLS) as ToolFamily[];
export const WORK_TOOL_OPERATIONS = Object.values(FAMILY_TOOLS).flat();

const PROCESS_LOADED_FAMILIES = new Set<ToolFamily>();

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
      config: { inputSchema?: Record<string, z.ZodTypeAny> },
      callback: ToolCallback
    ): RegisteredTool {
      tools.set(String(name), { name: String(name), config, callback });
      return fakeHandle();
    },
  } as unknown as McpServer;
  return { server, tools };
}

export interface WorkToolResolver {
  resolve(tool: string): Promise<CapturedTool>;
  prepareJob(jobId: string, families: readonly string[]): Promise<{
    job_id: string;
    generation: number;
    requested_families: ToolFamily[];
    prepared_families: ToolFamily[];
    stale: boolean;
  }>;
  waitForPreparedJob(jobId: string): Promise<void>;
  clearPreparedJob(): void;
  status(): {
    loaded_families: ToolFamily[];
    loaded_tool_count: number;
    prepared_job: string | null;
    prepared_families: ToolFamily[];
    preload_pending: boolean;
    preload_generation: number;
  };
}

export function createWorkToolResolver(
  workspaceRoot: string,
  shellTimeout: number
): WorkToolResolver {
  const loaded = new Map<ToolFamily, FamilyCache>();
  const pending = new Map<ToolFamily, Promise<FamilyCache>>();
  let preparedJob: string | null = null;
  let preparedFamilies = new Set<ToolFamily>();
  let preloadGeneration = 0;
  let preloadPromise: Promise<unknown> | null = null;

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
      } else if (family === "repl") {
        const module = await import("./node-repl.js");
        module.registerNodeReplTool(capture.server, workspaceRoot);
      }

      loaded.set(family, capture);
      PROCESS_LOADED_FAMILIES.add(family);
      return capture;
    })();

    pending.set(family, loading);
    try {
      return await loading;
    } finally {
      pending.delete(family);
    }
  }

  function normalizeFamilies(families: readonly string[]): ToolFamily[] {
    const known = new Set<ToolFamily>(TOOL_FAMILIES);
    return [...new Set(
      families.filter((family): family is ToolFamily =>
        known.has(family as ToolFamily)
      )
    )];
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

    async prepareJob(jobId: string, families: readonly string[]) {
      const generation = ++preloadGeneration;
      const requested = normalizeFamilies(families);
      preparedJob = jobId;
      preparedFamilies = new Set();

      const promise = (async () => {
        await Promise.all(
          requested.map(async (family) => {
            await loadFamily(family);
            if (generation === preloadGeneration && preparedJob === jobId) {
              preparedFamilies.add(family);
            }
          })
        );

        return {
          job_id: jobId,
          generation,
          requested_families: requested,
          prepared_families:
            generation === preloadGeneration && preparedJob === jobId
              ? [...preparedFamilies]
              : [],
          stale: generation !== preloadGeneration || preparedJob !== jobId,
        };
      })();

      preloadPromise = promise;
      try {
        return await promise;
      } finally {
        if (preloadPromise === promise) preloadPromise = null;
      }
    },

    async waitForPreparedJob(jobId: string): Promise<void> {
      if (preparedJob !== jobId) return;
      if (preloadPromise) await preloadPromise;
    },

    clearPreparedJob(): void {
      preloadGeneration += 1;
      preparedJob = null;
      preparedFamilies = new Set();
      preloadPromise = null;
    },

    status() {
      return {
        loaded_families: [...loaded.keys()],
        loaded_tool_count: [...loaded.values()].reduce(
          (count, item) => count + item.tools.size,
          0
        ),
        prepared_job: preparedJob,
        prepared_families: [...preparedFamilies],
        preload_pending: Boolean(preloadPromise),
        preload_generation: preloadGeneration,
      };
    },
  };
}

export function getWorkGatewayTelemetry() {
  return {
    loaded_families: [...PROCESS_LOADED_FAMILIES],
    loaded_family_count: PROCESS_LOADED_FAMILIES.size,
  };
}

export function registerWorkGateway(
  server: McpServer,
  workspaceRoot: string,
  shellTimeout: number
): WorkToolResolver {
  const resolver = createWorkToolResolver(
    workspaceRoot,
    shellTimeout
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
        "Execute one confirmed-work operation. The nominated Job's expected tool families are preloaded while waiting for user confirmation; any family not already prepared is still lazy-loaded on first use.",
      inputSchema: {
        tool: z.enum(exposed as [string, ...string[]]).describe(
          "Exact work operation to execute."
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
      const inputSchema = captured.config.inputSchema ?? {};
      const parsed = z.object(inputSchema).passthrough().parse(args ?? {});
      return captured.callback(parsed);
    }
  );

  return resolver;
}

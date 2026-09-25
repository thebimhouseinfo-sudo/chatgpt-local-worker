import { z } from "zod";
import type { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toolAnnotations } from "../lib/tool-annotations.js";
import { RUNTIME_FAMILIES, JOB_PRELOAD_FAMILIES } from "../lib/runtime-families.js";
import { getBrowserCapability } from "../lib/browser-capability.js";
import { BROWSER_OPERATIONS } from "../lib/browser-mcp-adapter.js";

type ToolCallback = (args?: Record<string, unknown>, ...rest: unknown[]) => any;

interface CapturedTool {
  name: string;
  config: { inputSchema?: Record<string, z.ZodTypeAny> };
  callback: ToolCallback;
}

interface FamilyCache {
  tools: Map<string, CapturedTool>;
}

export const FAMILY_TOOLS = {
  filesystem: [
    "read_text_file", "write_file", "edit_file", "apply_patch",
    "list_directory", "glob", "grep", "delete_file", "recycle_file", "hard_delete_file",
    "create_directory", "delete_directory", "copy_file", "move_file",
  ],
  shell: [
    "run_command", "start_process", "process_status", "process_output", "stop_process",
  ],
  context: ["project_context", "agent_status"],
  browser: BROWSER_OPERATIONS,
} as const;

export type ToolFamily = keyof typeof FAMILY_TOOLS;

export const TOOL_FAMILIES = [...RUNTIME_FAMILIES] as ToolFamily[];


export const WORK_TOOL_OPERATIONS = Object.values(FAMILY_TOOLS).flat();

const TOOL_FAMILY = new Map<string, ToolFamily>();
for (const [family, tools] of Object.entries(FAMILY_TOOLS) as Array<
  [ToolFamily, readonly string[]]
>) {
  for (const tool of tools) TOOL_FAMILY.set(tool, family);
}

const PROCESS_LOADED_FAMILIES = new Set<ToolFamily>();

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

function createCaptureServer(): FamilyCache & { server: McpServer } {
  const tools = new Map<string, CapturedTool>();
  const server = {
    registerTool(
      name: string,
      config: { inputSchema?: Record<string, z.ZodTypeAny> },
      callback: ToolCallback
    ): RegisteredTool {
      tools.set(String(name), {
        name: String(name),
        config,
        callback,
      });
      return fakeHandle();
    },
  } as unknown as McpServer;

  return { server, tools };
}

async function registerFamily(
  family: ToolFamily,
  server: McpServer,
  shellTimeout: number
): Promise<void> {
  switch (family) {
    case "filesystem": {
      const module = await import("./filesystem.js");
      module.registerFilesystemTools(server);
      return;
    }
    case "shell": {
      const module = await import("./shell.js");
      module.registerShellTools(server, shellTimeout);
      return;
    }
    case "context": {
      const module = await import("./context.js");
      module.registerContextTools(server);
      return;
    }
    case "browser": {
      const module = await import("./browser.js");
      module.registerBrowserTools(server);
      return;
    }
  }
}

function normalizePreloadFamilies(families: readonly string[]): ToolFamily[] {
  // Only the explicitly approved preload families may be warmed. Browser
  // always remains lazy, even if a Custom Job or caller supplies "browser".
  const runtimeFamilies = new Set<ToolFamily>(JOB_PRELOAD_FAMILIES);
  const normalized: ToolFamily[] = [];

  for (const family of families) {
    if (runtimeFamilies.has(family as ToolFamily)) {
      if (!normalized.includes(family as ToolFamily)) {
        normalized.push(family as ToolFamily);
      }
      continue;
    }


    console.warn(`[GPTWorker] Ignoring unknown preload family: ${family}`);
  }

  return normalized;
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
      await registerFamily(
        family,
        capture.server,
        shellTimeout
      );

      const cache: FamilyCache = { tools: capture.tools };
      loaded.set(family, cache);
      PROCESS_LOADED_FAMILIES.add(family);
      return cache;
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

    async prepareJob(jobId: string, families: readonly string[]) {
      const generation = ++preloadGeneration;
      const requested = normalizePreloadFamilies(families);

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

        const current =
          generation === preloadGeneration && preparedJob === jobId;

        return {
          job_id: jobId,
          generation,
          requested_families: requested,
          prepared_families: current ? [...preparedFamilies] : [],
          stale: !current,
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
          (count, cache) => count + cache.tools.size,
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
  shellTimeout: number,
  options: { browserAdvertised?: boolean } = {}
): WorkToolResolver {
  const resolver = createWorkToolResolver(shellTimeout);
  // This is the ACTUAL tools/list schema; disabled/unhealthy browser operations
  // are absent, not merely rejected at execution time. Each MCP session gets
  // a fresh capability snapshot on registration.
  const browserAdvertised = options.browserAdvertised ?? getBrowserCapability().advertised;
  const exposed = WORK_TOOL_OPERATIONS.filter(tool => browserAdvertised || !BROWSER_OPERATIONS.includes(tool as any));

  server.registerTool(
    "work_tool",
    {
      title: "GPTWorker Work Tool",
      description:
        "Execute one confirmed-work operation. Runtime families are local-only and lazy-loaded; supported Job preload families may be prepared while awaiting confirmation.",
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
      if (BROWSER_OPERATIONS.includes(tool as any) && !getBrowserCapability().advertised) {
        throw new Error("BROWSER_UNAVAILABLE: browser support is disabled or unhealthy");
      }
      const captured = await resolver.resolve(tool);
      const inputSchema = captured.config.inputSchema ?? {};
      const parsed = z.object(inputSchema).passthrough().parse(args ?? {});
      return captured.callback(parsed);
    }
  );

  return resolver;
}

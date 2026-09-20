import { createRequire } from "node:module";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import util from "node:util";
import vm from "node:vm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDefaultCwd } from "../lib/path-security.js";
import { toolAnnotations } from "../lib/tool-annotations.js";
import { toolResult } from "../lib/tool-result.js";
import { isComputerUseEnabled } from "../lib/plugin-config.js";

interface ReplState {
  context: vm.Context;
  workspaceRoot: string;
  skyAvailable: boolean;
  skyError?: string;
}

const states = new WeakMap<McpServer, ReplState>();

interface SkyTransport {
  request(method: string, params: unknown, options?: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}

interface WindowsHelperTransportConstructor {
  new (options: { helperCommand: string }): SkyTransport;
}

interface WindowsComputerUseClientConstructor {
  new (options: { transport: SkyTransport }): unknown;
}

export function createWorkspaceRequire(workspaceRoot: string) {
  const baseRequire = createRequire(path.join(workspaceRoot, "package.json"));
  return (specifier: string) => {
    if (
      specifier === "fs" ||
      specifier === "node:fs" ||
      specifier === "fs/promises" ||
      specifier === "node:fs/promises"
    ) {
      throw new Error(
        "Filesystem access is disabled inside node_repl. Use GPTWorker filesystem tools with absolute paths."
      );
    }
    return baseRequire(specifier);
  };
}

export function createWorkspaceProcessView(workspaceRoot: string): NodeJS.Process {
  const resolved = path.resolve(workspaceRoot);
  const env = {
    ...process.env,
    PWD: resolved,
    INIT_CWD: resolved,
  };

  return new Proxy(process, {
    get(target, prop) {
      if (prop === "cwd") return () => resolved;
      if (prop === "chdir") {
        return () => {
          throw new Error(
            "process.chdir() is disabled inside node_repl because it would change GPTWorker's global cwd. Use absolute paths rooted at workspaceRoot instead."
          );
        };
      }
      if (prop === "env") return env;
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
    set() {
      throw new Error("Top-level process mutation is disabled inside node_repl.");
    },
  }) as NodeJS.Process;
}

async function loadSky(): Promise<{ sky?: unknown; error?: string }> {
  if (!isComputerUseEnabled()) return { error: "Computer Use plugin is disabled in Admin UI" };
  if (process.platform !== "win32") return { error: "Computer Use is only available on Windows" };
  try {
    const runtimes = path.join(os.homedir(), "AppData", "Local", "OpenAI", "Codex", "runtimes", "cua_node");
    const versions = await fs.readdir(runtimes, { withFileTypes: true });
    const nodeModules = versions.filter((entry) => entry.isDirectory()).map((entry) => path.join(runtimes, entry.name, "bin", "node_modules"));
    const require = createRequire(import.meta.url);
    const entry = require.resolve("@oai/sky", { paths: nodeModules });
    const packageRoot = entry.slice(0, entry.indexOf(`${path.sep}dist${path.sep}`));
    const internal = path.join(packageRoot, "dist", "project", "cua", "sky_js", "src", "targets", "windows", "internal");
    const [{ WindowsHelperTransport }, { WindowsComputerUseClient }] = await Promise.all([
      import(pathToFileURL(path.join(internal, "helper_transport.js")).href) as Promise<{ WindowsHelperTransport: WindowsHelperTransportConstructor }>,
      import(pathToFileURL(path.join(internal, "computer_use_client.js")).href) as Promise<{ WindowsComputerUseClient: WindowsComputerUseClientConstructor }>,
    ]);
    const helper = new WindowsHelperTransport({ helperCommand: path.join(packageRoot, "bin", "windows", "codex-computer-use.exe") });
    const transport: SkyTransport = {
      request: (method, params, options) => helper.request(method, params, { ...options, createElicitation: async () => ({ action: "accept" }) }),
      close: () => helper.close(),
    };
    return { sky: new WindowsComputerUseClient({ transport }) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

async function createState(workspaceRoot: string): Promise<ReplState> {
  const output: string[] = [];
  const nodeRepl = {
    write: (value: unknown) => output.push(String(value)),
  };
  const sandbox: Record<string, unknown> = {
    Buffer,
    process: createWorkspaceProcessView(workspaceRoot),
    workspaceRoot,
    setTimeout,
    clearTimeout,
    fetch,
    require: createWorkspaceRequire(workspaceRoot),
    console: { log: (...values: unknown[]) => output.push(values.map((value) => util.inspect(value, { depth: 4 })).join(" ")) },
    nodeRepl,
    __localCoderOutput: output,
  };
  const loaded = await loadSky();
  if (loaded.sky) sandbox.sky = loaded.sky;
  return {
    context: vm.createContext(sandbox),
    workspaceRoot,
    skyAvailable: Boolean(loaded.sky),
    skyError: loaded.error,
  };
}

export function registerNodeReplTool(server: McpServer, _startupWorkspaceRoot: string): void {
  server.registerTool(
    "node_repl",
    {
      title: "Node REPL",
      description: "Stateful JavaScript session rooted at the confirmed active workspace. process.cwd() and workspaceRoot resolve to that workspace; process.chdir() is disabled. Direct fs/fs-promises access is blocked: use GPTWorker filesystem tools with absolute paths for file I/O. Store state on globalThis. When the Computer Use plugin is enabled and its skill is loaded, globalThis.sky exposes Codex Windows Computer Use.",
      inputSchema: {
        action: z.enum(["eval", "reset", "status"]).default("eval"),
        code: z.string().optional().describe("JavaScript. Use globalThis for state across calls; nodeRepl.write() emits text."),
        timeout_ms: z.number().int().min(100).max(60000).optional().default(30000),
      },
      annotations: toolAnnotations("edit"),
    },
    async ({ action, code, timeout_ms }) => {
      if (action === "reset") {
        states.delete(server);
        return toolResult("node_repl", { reset: true });
      }

      const activeWorkspace = getDefaultCwd();
      let state = states.get(server);
      if (!state || state.workspaceRoot !== activeWorkspace) {
        state = await createState(activeWorkspace);
        states.set(server, state);
      }
      if (action === "status") {
        return toolResult("node_repl", {
          persistent: true,
          workspace: state.workspaceRoot,
          computer_use_available: state.skyAvailable,
          computer_use_error: state.skyError,
        });
      }
      if (!code?.trim()) throw new Error("code is required for node_repl eval");
      if (!state.context.sky && state.skyAvailable) {
        const loaded = await loadSky();
        if (loaded.sky) state.context.sky = loaded.sky;
      }
      const output = state.context.__localCoderOutput as string[];
      output.length = 0;
      try {
        const value = await vm.runInContext(`(async () => { ${code}\n})()`, state.context, { timeout: timeout_ms }) as Promise<unknown>;
        return toolResult("node_repl", {
          workspace: state.workspaceRoot,
          output: output.join("\n"),
          value: value === undefined ? undefined : util.inspect(value, { depth: 5, maxArrayLength: 100 }),
          computer_use_available: state.skyAvailable,
        });
      } finally {
        const sky = state.context.sky as { close?: () => Promise<unknown> } | undefined;
        if (typeof sky?.close === "function") await sky.close();
        delete (state.context as Record<string, unknown>).sky;
      }
    }
  );
}

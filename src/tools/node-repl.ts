import { createRequire } from "node:module";
import path from "node:path";
import util from "node:util";
import vm from "node:vm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDefaultCwd } from "../lib/path-security.js";
import { toolAnnotations } from "../lib/tool-annotations.js";
import { toolResult } from "../lib/tool-result.js";

interface ReplState {
  context: vm.Context;
  workspaceRoot: string;
}

const states = new WeakMap<McpServer, ReplState>();

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

function createState(workspaceRoot: string): ReplState {
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
    console: {
      log: (...values: unknown[]) =>
        output.push(values.map((value) => util.inspect(value, { depth: 4 })).join(" ")),
    },
    nodeRepl,
    __gptWorkerOutput: output,
  };

  return {
    context: vm.createContext(sandbox),
    workspaceRoot,
  };
}

export function registerNodeReplTool(server: McpServer, _startupWorkspaceRoot: string): void {
  server.registerTool(
    "node_repl",
    {
      title: "Node REPL",
      description:
        "Stateful local JavaScript session rooted at the confirmed active workspace. process.cwd() and workspaceRoot resolve to that workspace; process.chdir() is disabled. Direct fs/fs-promises access is blocked: use GPTWorker filesystem tools with absolute paths for file I/O. Store persistent state on globalThis.",
      inputSchema: {
        action: z.enum(["eval", "reset", "status"]).default("eval"),
        code: z
          .string()
          .optional()
          .describe("JavaScript. Use globalThis for state across calls; nodeRepl.write() emits text."),
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
        state = createState(activeWorkspace);
        states.set(server, state);
      }

      if (action === "status") {
        return toolResult("node_repl", {
          persistent: true,
          workspace: state.workspaceRoot,
          local_only: true,
        });
      }

      if (!code?.trim()) throw new Error("code is required for node_repl eval");

      const output = state.context.__gptWorkerOutput as string[];
      output.length = 0;
      const value = (await vm.runInContext(
        `(async () => { ${code}\n})()`,
        state.context,
        { timeout: timeout_ms }
      )) as unknown;

      return toolResult("node_repl", {
        workspace: state.workspaceRoot,
        output: output.join("\n"),
        value:
          value === undefined
            ? undefined
            : util.inspect(value, { depth: 5, maxArrayLength: 100 }),
      });
    }
  );
}

import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import path from "path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDefaultCwd, validatePath } from "../lib/path-security.js";
import { assertShellCommandWorkspaceBound } from "../lib/shell-workspace-guard.js";
import { logToolActivity } from "../lib/activity-log.js";
import { toolAnnotations } from "../lib/tool-annotations.js";
import { toolResult } from "../lib/tool-result.js";
import {
  execInShellSession,
  getShellStatus,
  resetShellSession,
  getWinShell,
  transpileCompoundOperators,
} from "../lib/persistent-shell.js";

interface ManagedProcess {
  id: string;
  command: string;
  workspaceRoot: string;
  cwd: string;
  startedAt: string;
  child: ChildProcessWithoutNullStreams;
  stdout: string[];
  stderr: string[];
  exitCode: number | null;
  signal: NodeJS.Signals | null;
}

const processes = new Map<string, ManagedProcess>();
const MAX_LOG_CHARS = 400_000;

function appendLog(lines: string[], data: Buffer): void {
  lines.push(data.toString());
  let total = lines.reduce((sum, item) => sum + item.length, 0);
  while (total > MAX_LOG_CHARS && lines.length > 1) {
    const removed = lines.shift();
    total -= removed?.length || 0;
  }
}

function sameWorkspace(a: string, b: string): boolean {
  const left = path.resolve(a);
  const right = path.resolve(b);
  return process.platform === "win32"
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

function requireOwnedProcess(id: string, workspaceRoot: string): ManagedProcess {
  const item = processes.get(id);
  if (!item || !sameWorkspace(item.workspaceRoot, workspaceRoot)) {
    throw new Error(`Unknown process id for active workspace: ${id}`);
  }
  return item;
}

export function registerShellTools(
  server: McpServer,
  _startupCwd: string,
  timeoutSec: number
): void {
  server.registerTool(
    "run_command",
    {
      title: "Run Command",
      description:
        "Run shell commands to verify work (tests, build, lint). Shell cwd persists per confirmed workspace, never globally across Jobs. Use shell_status to inspect it. Use start_process for long jobs.",
      inputSchema: {
        command: z.string(),
        working_directory: z
          .string()
          .optional()
          .describe("One-off override rooted from the active workspace; it does not replace another workspace's shell state"),
      },
      annotations: toolAnnotations("command"),
    },
    async ({ command, working_directory }) => {
      const workspaceRoot = getDefaultCwd();
      const cwdOverride = working_directory
        ? await validatePath(working_directory)
        : undefined;
      const result = await execInShellSession(
        command,
        workspaceRoot,
        timeoutSec * 1000,
        cwdOverride
      );
      logToolActivity({
        tool: "run_command",
        action: "command",
        target: result.cwd,
        status: result.exit_code === 0 ? "ok" : "error",
        details: { command, exit_code: result.exit_code, workspace: workspaceRoot },
      });
      return toolResult("run_command", result, {
        ok: result.exit_code === 0,
        summary: `exit ${result.exit_code} in ${result.cwd}`,
      });
    }
  );

  server.registerTool(
    "shell_status",
    {
      title: "Shell Status",
      description:
        "Show the persistent shell state for the confirmed active workspace only.",
      inputSchema: {},
      annotations: toolAnnotations("read"),
    },
    async () => {
      const workspaceRoot = getDefaultCwd();
      const status = getShellStatus(workspaceRoot);
      return toolResult("shell_status", status, {
        summary: `cwd: ${status.cwd}`,
      });
    }
  );

  server.registerTool(
    "shell_reset",
    {
      title: "Shell Reset",
      description:
        "Reset this active workspace's persistent shell cwd. Does not affect other Jobs/workspaces.",
      inputSchema: { path: z.string().optional() },
      annotations: toolAnnotations("edit"),
    },
    async ({ path: dirPath }) => {
      const workspaceRoot = getDefaultCwd();
      const cwd = dirPath ? await validatePath(dirPath) : workspaceRoot;
      resetShellSession(cwd, workspaceRoot);
      return toolResult(
        "shell_reset",
        { workspace: workspaceRoot, cwd },
        { summary: `shell cwd reset to ${cwd}` }
      );
    }
  );

  server.registerTool(
    "start_process",
    {
      title: "Start Background Process",
      description:
        "Start a long-running command owned by the confirmed active workspace. Use process_output/process_status/stop_process afterwards.",
      inputSchema: {
        command: z.string(),
        working_directory: z.string().optional(),
      },
      annotations: toolAnnotations("command"),
    },
    async ({ command, working_directory }) => {
      const workspaceRoot = getDefaultCwd();
      assertShellCommandWorkspaceBound(command, workspaceRoot);
      const shellStatus = getShellStatus(workspaceRoot);
      const cwd = working_directory
        ? await validatePath(working_directory)
        : await validatePath(shellStatus.cwd || workspaceRoot);

      let shell = "bash";
      let effectiveCommand = command;
      let args = ["-lc", effectiveCommand];

      if (process.platform === "win32") {
        const winShellInfo = getWinShell();
        shell = winShellInfo.shell;
        if (!winShellInfo.isPwsh) {
          effectiveCommand = transpileCompoundOperators(command);
        }
        args = [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          effectiveCommand,
        ];
      }

      const child = spawn(shell, args, {
        cwd,
        windowsHide: true,
        env: {
          ...process.env,
          PWD: cwd,
          INIT_CWD: cwd,
          CI: "true",
          PAGER: "cat",
          GIT_PAGER: "cat",
          NO_COLOR: "1",
        },
      });
      const id = `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const item: ManagedProcess = {
        id,
        command,
        workspaceRoot,
        cwd,
        startedAt: new Date().toISOString(),
        child,
        stdout: [],
        stderr: [],
        exitCode: null,
        signal: null,
      };
      processes.set(id, item);
      child.stdout.on("data", (d: Buffer) => appendLog(item.stdout, d));
      child.stderr.on("data", (d: Buffer) => appendLog(item.stderr, d));
      child.on("close", (code, signal) => {
        item.exitCode = code;
        item.signal = signal;
      });
      logToolActivity({
        tool: "start_process",
        action: "start",
        target: cwd,
        status: "ok",
        details: { id, command, workspace: workspaceRoot },
      });
      return toolResult(
        "start_process",
        {
          id,
          pid: child.pid,
          command,
          workspace: workspaceRoot,
          cwd,
          started_at: item.startedAt,
        },
        { summary: `started ${id}` }
      );
    }
  );

  server.registerTool(
    "process_status",
    {
      title: "Process Status",
      description:
        "Show background process status for the confirmed active workspace only.",
      inputSchema: { id: z.string().optional() },
      annotations: toolAnnotations("read"),
    },
    async ({ id }) => {
      const workspaceRoot = getDefaultCwd();
      const processes_list = [...processes.values()]
        .filter(
          (p) =>
            sameWorkspace(p.workspaceRoot, workspaceRoot) &&
            (!id || p.id === id)
        )
        .map((p) => ({
          id: p.id,
          pid: p.child.pid,
          command: p.command,
          workspace: p.workspaceRoot,
          cwd: p.cwd,
          started_at: p.startedAt,
          running: p.exitCode === null && p.signal === null,
          exit_code: p.exitCode,
          signal: p.signal,
        }));
      return toolResult(
        "process_status",
        { workspace: workspaceRoot, processes: processes_list },
        { summary: `${processes_list.length} process(es)` }
      );
    }
  );

  server.registerTool(
    "process_output",
    {
      title: "Process Output",
      description:
        "Read stdout/stderr for a background process owned by the confirmed active workspace.",
      inputSchema: {
        id: z.string(),
        tail_chars: z
          .number()
          .int()
          .positive()
          .max(200000)
          .optional()
          .default(40000),
      },
      annotations: toolAnnotations("read"),
    },
    async ({ id, tail_chars }) => {
      const workspaceRoot = getDefaultCwd();
      const item = requireOwnedProcess(id, workspaceRoot);
      const data = {
        id,
        workspace: item.workspaceRoot,
        running: item.exitCode === null && item.signal === null,
        exit_code: item.exitCode,
        signal: item.signal,
        stdout: item.stdout.join("").slice(-tail_chars),
        stderr: item.stderr.join("").slice(-tail_chars),
      };
      return toolResult("process_output", data, {
        summary: `output for ${id}`,
      });
    }
  );

  server.registerTool(
    "stop_process",
    {
      title: "Stop Process",
      description:
        "Stop a background process owned by the confirmed active workspace.",
      inputSchema: {
        id: z.string(),
        force: z.boolean().optional().default(false),
      },
      annotations: toolAnnotations("edit"),
    },
    async ({ id, force }) => {
      const workspaceRoot = getDefaultCwd();
      const item = requireOwnedProcess(id, workspaceRoot);
      if (item.exitCode !== null || item.signal !== null) {
        return toolResult(
          "stop_process",
          { id, already_exited: true },
          { summary: `${id} already exited` }
        );
      }
      item.child.kill(force ? "SIGKILL" : "SIGTERM");
      logToolActivity({
        tool: "stop_process",
        action: "stop",
        target: item.cwd,
        status: "ok",
        details: { id, force, workspace: workspaceRoot },
      });
      return toolResult(
        "stop_process",
        { id, force },
        { summary: `stop sent to ${id}` }
      );
    }
  );

  server.registerTool(
    "clear_processes",
    {
      title: "Clear Finished Processes",
      description:
        "Remove finished background-process records owned by the confirmed active workspace.",
      inputSchema: {},
      annotations: toolAnnotations("edit"),
    },
    async () => {
      const workspaceRoot = getDefaultCwd();
      let cleared = 0;
      for (const [id, item] of processes) {
        if (
          sameWorkspace(item.workspaceRoot, workspaceRoot) &&
          (item.exitCode !== null || item.signal !== null)
        ) {
          processes.delete(id);
          cleared++;
        }
      }
      return toolResult(
        "clear_processes",
        { workspace: workspaceRoot, cleared },
        { summary: `cleared ${cleared}` }
      );
    }
  );
}

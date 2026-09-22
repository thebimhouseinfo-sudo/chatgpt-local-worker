import fs from "node:fs";
import fsp from "node:fs/promises";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  assertPathInsideWorkspaceSync,
  getDefaultCwd,
  validatePath,
} from "../lib/path-security.js";
import { assertShellCommandWorkspaceBound } from "../lib/shell-workspace-guard.js";
import { logToolActivity } from "../lib/activity-log.js";
import { toolAnnotations } from "../lib/tool-annotations.js";
import { toolResult } from "../lib/tool-result.js";

interface ShellExecResult {
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exit_code: number | null;
  timed_out: boolean;
}

interface ManagedProcess {
  id: string;
  command: string;
  workspaceRoot: string;
  cwd: string;
  startedAt: string;
  finishedAt: number | null;
  child: ChildProcessWithoutNullStreams;
  stdout: string[];
  stderr: string[];
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  error: string | null;
}

const processes = new Map<string, ManagedProcess>();
const MAX_LOG_CHARS = 400_000;
const PROCESS_RETENTION_MS = 30 * 60 * 1000;
const MAX_PROCESS_RECORDS = 100;

function samePath(a: string, b: string): boolean {
  const left = path.resolve(a);
  const right = path.resolve(b);
  return process.platform === "win32"
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

function appendLog(lines: string[], data: Buffer): void {
  lines.push(data.toString());
  let total = lines.reduce((sum, item) => sum + item.length, 0);
  while (total > MAX_LOG_CHARS && lines.length > 1) {
    total -= lines.shift()?.length ?? 0;
  }
}

function pruneProcessRegistry(): void {
  const now = Date.now();
  for (const [id, item] of processes) {
    if (item.finishedAt !== null && now - item.finishedAt > PROCESS_RETENTION_MS) {
      processes.delete(id);
    }
  }

  if (processes.size <= MAX_PROCESS_RECORDS) return;

  const finished = [...processes.values()]
    .filter((item) => item.finishedAt !== null)
    .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0));

  for (const item of finished) {
    if (processes.size <= MAX_PROCESS_RECORDS) break;
    processes.delete(item.id);
  }
}

function isRunning(item: ManagedProcess): boolean {
  return item.finishedAt === null && item.error === null;
}

function requireOwnedProcess(id: string, workspaceRoot: string): ManagedProcess {
  pruneProcessRegistry();
  const item = processes.get(id);
  if (!item || !samePath(item.workspaceRoot, workspaceRoot)) {
    throw new Error(`Unknown process id for active workspace: ${id}`);
  }
  return item;
}

function windowsShell(): { executable: string; supportsAndOr: boolean } {
  const configured = process.env.SHELL?.trim();
  if (
    configured &&
    /(?:^|[\\/])(pwsh|powershell)(?:\.exe)?$/i.test(configured)
  ) {
    return {
      executable: configured,
      supportsAndOr: /pwsh(?:\.exe)?$/i.test(configured),
    };
  }

  for (const candidate of [
    "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
    "C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe",
  ]) {
    if (fs.existsSync(candidate)) {
      return { executable: candidate, supportsAndOr: true };
    }
  }

  const windowsPowerShell =
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
  if (fs.existsSync(windowsPowerShell)) {
    return { executable: windowsPowerShell, supportsAndOr: false };
  }

  return { executable: "powershell.exe", supportsAndOr: false };
}

function transpileLegacyPowerShellAndOr(command: string): string {
  if (!command.includes("&&") && !command.includes("||")) return command;

  const parts: Array<{ kind: "command" | "and" | "or"; value: string }> = [];
  let buffer = "";
  let singleQuoted = false;
  let doubleQuoted = false;

  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    const next = command[i + 1];

    if (char === "'" && !doubleQuoted) {
      singleQuoted = !singleQuoted;
      buffer += char;
      continue;
    }
    if (char === '"' && !singleQuoted) {
      doubleQuoted = !doubleQuoted;
      buffer += char;
      continue;
    }

    if (!singleQuoted && !doubleQuoted && char === "&" && next === "&") {
      if (buffer.trim()) parts.push({ kind: "command", value: buffer.trim() });
      parts.push({ kind: "and", value: "&&" });
      buffer = "";
      i++;
      continue;
    }

    if (!singleQuoted && !doubleQuoted && char === "|" && next === "|") {
      if (buffer.trim()) parts.push({ kind: "command", value: buffer.trim() });
      parts.push({ kind: "or", value: "||" });
      buffer = "";
      i++;
      continue;
    }

    buffer += char;
  }

  if (buffer.trim()) parts.push({ kind: "command", value: buffer.trim() });
  if (parts.length <= 1 || parts[0]?.kind !== "command") return command;

  let output = `${parts[0].value}; $__gptworkerSuccess = $?`;
  for (let i = 1; i < parts.length; i += 2) {
    const operator = parts[i];
    const nextCommand = parts[i + 1];
    if (!operator || !nextCommand || nextCommand.kind !== "command") break;

    if (operator.kind === "and") {
      output += `; if ($__gptworkerSuccess) { ${nextCommand.value}; $__gptworkerSuccess = $? }`;
    } else if (operator.kind === "or") {
      output += `; if (-not $__gptworkerSuccess) { ${nextCommand.value}; $__gptworkerSuccess = $? }`;
    }
  }
  return output;
}

function shellInvocation(command: string): { executable: string; args: string[] } {
  if (process.platform !== "win32") {
    return { executable: "bash", args: ["-lc", command] };
  }

  const shell = windowsShell();
  const effectiveCommand = shell.supportsAndOr
    ? command
    : transpileLegacyPowerShellAndOr(command);

  return {
    executable: shell.executable,
    args: [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      effectiveCommand,
    ],
  };
}

function shellEnvironment(cwd: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PWD: cwd,
    INIT_CWD: cwd,
    CI: "true",
    PAGER: "cat",
    GIT_PAGER: "cat",
    NO_COLOR: "1",
    npm_config_yes: "true",
  };
}

function assertDirectoryChangesAreWorkspaceBound(
  command: string,
  workspaceRoot: string
): void {
  const matcher =
    /(?:^|[;&|]\s*)(?:cd|chdir|Set-Location|sl|pushd)\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/gi;

  for (const match of command.matchAll(matcher)) {
    const target = (match[1] || match[2] || match[3] || "").trim();
    if (!target) continue;
    if (!path.isAbsolute(target)) {
      throw new Error(
        "Shell directory changes require an absolute path inside the confirmed Workspace. " +
          `Use working_directory instead of a relative cd/Set-Location/pushd target: ${target}`
      );
    }
    assertPathInsideWorkspaceSync(target, workspaceRoot);
  }
}

async function resolveWorkingDirectory(
  workspaceRoot: string,
  requested?: string
): Promise<string> {
  const candidate = requested ? await validatePath(requested) : path.resolve(workspaceRoot);
  const cwd = assertPathInsideWorkspaceSync(candidate, workspaceRoot);
  const stat = await fsp.stat(cwd);
  if (!stat.isDirectory()) {
    throw new Error(`Shell working_directory is not a directory: ${cwd}`);
  }
  return cwd;
}

export async function runShellCommand(
  command: string,
  workspaceRoot: string,
  timeoutMs: number,
  workingDirectory?: string
): Promise<ShellExecResult> {
  const root = path.resolve(workspaceRoot);
  assertShellCommandWorkspaceBound(command, root);
  assertDirectoryChangesAreWorkspaceBound(command, root);
  const cwd = await resolveWorkingDirectory(root, workingDirectory);
  const invocation = shellInvocation(command);

  return new Promise((resolve, reject) => {
    const child = spawn(invocation.executable, invocation.args, {
      cwd,
      windowsHide: true,
      env: shellEnvironment(cwd),
    });
    child.stdin.end();

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.once("error", (error) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      reject(error);
    });

    child.once("close", (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;

      if (timedOut) {
        reject(new Error(`Command timed out after ${timeoutMs / 1000}s`));
        return;
      }

      resolve({
        command,
        cwd,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exit_code: code,
        timed_out: false,
      });
    });
  });
}

async function startManagedProcess(
  command: string,
  workspaceRoot: string,
  workingDirectory?: string
): Promise<ManagedProcess> {
  const root = path.resolve(workspaceRoot);
  assertShellCommandWorkspaceBound(command, root);
  assertDirectoryChangesAreWorkspaceBound(command, root);
  const cwd = await resolveWorkingDirectory(root, workingDirectory);
  const invocation = shellInvocation(command);

  const child = spawn(invocation.executable, invocation.args, {
    cwd,
    windowsHide: true,
    env: shellEnvironment(cwd),
  });

  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const item: ManagedProcess = {
    id,
    command,
    workspaceRoot: root,
    cwd,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    child,
    stdout: [],
    stderr: [],
    exitCode: null,
    signal: null,
    error: null,
  };

  processes.set(id, item);
  child.stdout.on("data", (data: Buffer) => appendLog(item.stdout, data));
  child.stderr.on("data", (data: Buffer) => appendLog(item.stderr, data));
  child.on("close", (code, signal) => {
    item.exitCode = code;
    item.signal = signal;
    item.finishedAt = Date.now();
    pruneProcessRegistry();
  });
  child.on("error", (error) => {
    item.error = error.message;
    item.stderr.push(error.message);
    item.finishedAt = Date.now();
  });

  try {
    await new Promise<void>((resolve, reject) => {
      child.once("spawn", () => resolve());
      child.once("error", reject);
    });
  } catch (error) {
    processes.delete(id);
    throw error;
  }

  pruneProcessRegistry();
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
        "Run a short shell command inside the confirmed Workspace. Each call starts from the Workspace root unless an absolute working_directory inside that Workspace is supplied.",
      inputSchema: {
        command: z.string(),
        working_directory: z
          .string()
          .optional()
          .describe(
            "Optional absolute directory inside the confirmed Workspace for this call only."
          ),
      },
      annotations: toolAnnotations("command"),
    },
    async ({ command, working_directory }) => {
      const workspaceRoot = getDefaultCwd();
      const result = await runShellCommand(
        command,
        workspaceRoot,
        timeoutSec * 1000,
        working_directory
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
    "start_process",
    {
      title: "Start Background Process",
      description:
        "Start a long-running command owned by the confirmed Workspace. Use process_status/process_output/stop_process afterwards.",
      inputSchema: {
        command: z.string(),
        working_directory: z
          .string()
          .optional()
          .describe(
            "Optional absolute directory inside the confirmed Workspace for this process."
          ),
      },
      annotations: toolAnnotations("command"),
    },
    async ({ command, working_directory }) => {
      const workspaceRoot = getDefaultCwd();
      const item = await startManagedProcess(
        command,
        workspaceRoot,
        working_directory
      );

      logToolActivity({
        tool: "start_process",
        action: "start",
        target: item.cwd,
        status: "ok",
        details: { id: item.id, command, workspace: workspaceRoot },
      });

      return toolResult(
        "start_process",
        {
          id: item.id,
          pid: item.child.pid,
          command,
          workspace: workspaceRoot,
          cwd: item.cwd,
          started_at: item.startedAt,
        },
        { summary: `started ${item.id}` }
      );
    }
  );

  server.registerTool(
    "process_status",
    {
      title: "Process Status",
      description:
        "Show background-process status for the confirmed Workspace only.",
      inputSchema: { id: z.string().optional() },
      annotations: toolAnnotations("read"),
    },
    async ({ id }) => {
      const workspaceRoot = getDefaultCwd();
      pruneProcessRegistry();

      const processList = [...processes.values()]
        .filter(
          (item) =>
            samePath(item.workspaceRoot, workspaceRoot) &&
            (!id || item.id === id)
        )
        .map((item) => ({
          id: item.id,
          pid: item.child.pid,
          command: item.command,
          workspace: item.workspaceRoot,
          cwd: item.cwd,
          started_at: item.startedAt,
          running: isRunning(item),
          exit_code: item.exitCode,
          signal: item.signal,
          error: item.error,
        }));

      return toolResult(
        "process_status",
        { workspace: workspaceRoot, processes: processList },
        { summary: `${processList.length} process(es)` }
      );
    }
  );

  server.registerTool(
    "process_output",
    {
      title: "Process Output",
      description:
        "Read stdout/stderr for a background process owned by the confirmed Workspace.",
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

      return toolResult(
        "process_output",
        {
          id,
          workspace: item.workspaceRoot,
          running: isRunning(item),
          exit_code: item.exitCode,
          signal: item.signal,
          error: item.error,
          stdout: item.stdout.join("").slice(-tail_chars),
          stderr: item.stderr.join("").slice(-tail_chars),
        },
        { summary: `output for ${id}` }
      );
    }
  );

  server.registerTool(
    "stop_process",
    {
      title: "Stop Process",
      description:
        "Stop a background process owned by the confirmed Workspace.",
      inputSchema: {
        id: z.string(),
        force: z.boolean().optional().default(false),
      },
      annotations: toolAnnotations("edit"),
    },
    async ({ id, force }) => {
      const workspaceRoot = getDefaultCwd();
      const item = requireOwnedProcess(id, workspaceRoot);

      if (!isRunning(item)) {
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
}

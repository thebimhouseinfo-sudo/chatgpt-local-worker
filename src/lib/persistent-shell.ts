import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { loadGlobalShellState, saveGlobalShellState } from "./global-shell-state.js";

export interface ShellExecResult {
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exit_code: number | null;
  timed_out: boolean;
}

interface ShellSessionState {
  workspaceRoot: string;
  cwd: string;
  initializedAt: string;
  history: string[];
}

const sessions = new Map<string, ShellSessionState>();
const MAX_HISTORY = 50;

function canonicalWorkspace(workspaceRoot: string): string {
  return path.resolve(workspaceRoot);
}

function workspaceKey(workspaceRoot: string): string {
  const resolved = canonicalWorkspace(workspaceRoot);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function newSession(
  workspaceRoot: string,
  cwd = workspaceRoot,
  initializedAt = new Date().toISOString(),
  history: string[] = []
): ShellSessionState {
  return {
    workspaceRoot: canonicalWorkspace(workspaceRoot),
    cwd: path.resolve(cwd),
    initializedAt,
    history: [...history].slice(-MAX_HISTORY),
  };
}

function ensureShellSession(workspaceRoot: string): ShellSessionState {
  const root = canonicalWorkspace(workspaceRoot);
  const key = workspaceKey(root);
  let state = sessions.get(key);
  if (!state) {
    state = newSession(root);
    sessions.set(key, state);
  }
  return state;
}

export function initShellSession(defaultCwd: string): void {
  const root = canonicalWorkspace(defaultCwd);
  sessions.set(workspaceKey(root), newSession(root));
}

/** Restore cwd from disk for one concrete workspace. */
export async function bootstrapShellSession(defaultCwd: string): Promise<void> {
  const root = canonicalWorkspace(defaultCwd);
  const saved = await loadGlobalShellState(root, root);
  const state = saved?.cwd
    ? newSession(root, saved.cwd, saved.updated_at, saved.recent_commands ?? [])
    : newSession(root);
  sessions.set(workspaceKey(root), state);
}

export function getShellCwd(workspaceRoot: string): string {
  return ensureShellSession(workspaceRoot).cwd;
}

export function resetShellSession(cwd: string, workspaceRoot = cwd): void {
  const root = canonicalWorkspace(workspaceRoot);
  const state = newSession(root, cwd);
  sessions.set(workspaceKey(root), state);
  void saveGlobalShellState(root, state.cwd, undefined, null);
}

export function getShellStatus(workspaceRoot: string) {
  const state = ensureShellSession(workspaceRoot);
  return {
    active: true,
    workspace: state.workspaceRoot,
    cwd: state.cwd,
    started_at: state.initializedAt,
    recent_commands: [...state.history].slice(-10),
  };
}

function stripQuotes(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function resolveCdTarget(_current: string, target: string): string {
  const cleaned = stripQuotes(target);
  if (!path.isAbsolute(cleaned)) {
    throw new Error(
      "Shell directory changes require an absolute path. Relative cd/Set-Location/pushd targets are not allowed: " + cleaned
    );
  }
  return path.resolve(cleaned);
}

/** Update cwd when cd / Set-Location appears at the start of a command. */
export function applyCwdDirectives(
  currentCwd: string,
  command: string
): { cwd: string; command: string } {
  let cwd = currentCwd;
  let rest = command.trim();

  for (let i = 0; i < 8; i++) {
    const psMatch = rest.match(/^(?:Set-Location|sl)\s+(.+?)(?:\s*;\s*|\s*&&\s*|$)/i);
    if (psMatch) {
      cwd = resolveCdTarget(cwd, psMatch[1]);
      rest = rest.slice(psMatch[0].length).trim();
      continue;
    }

    const cdMatch = rest.match(/^cd(?:\s+(.+?))?(?:\s*;\s*|\s*&&\s*|$)/i);
    if (cdMatch) {
      if (!cdMatch[1]) {
        throw new Error("Shell cd requires an explicit absolute path.");
      }
      cwd = resolveCdTarget(cwd, cdMatch[1]);
      rest = rest.slice(cdMatch[0].length).trim();
      continue;
    }

    const pushdMatch = rest.match(/^pushd\s+(.+?)(?:\s*;\s*|\s*&&\s*|$)/i);
    if (pushdMatch) {
      cwd = resolveCdTarget(cwd, pushdMatch[1]);
      rest = rest.slice(pushdMatch[0].length).trim();
      continue;
    }

    break;
  }

  return { cwd, command: rest || "pwd" };
}

export function transpileCompoundOperators(cmd: string): string {
  if (!cmd.includes("&&") && !cmd.includes("||")) return cmd;

  const tokens: { type: "text" | "&&" | "||"; value: string }[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let i = 0;

  while (i < cmd.length) {
    const char = cmd[i];
    const nextChar = cmd[i + 1];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += char;
      i++;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      i++;
    } else if (!inSingleQuote && !inDoubleQuote && char === "&" && nextChar === "&") {
      if (current.trim()) tokens.push({ type: "text", value: current.trim() });
      tokens.push({ type: "&&", value: "&&" });
      current = "";
      i += 2;
    } else if (!inSingleQuote && !inDoubleQuote && char === "|" && nextChar === "|") {
      if (current.trim()) tokens.push({ type: "text", value: current.trim() });
      tokens.push({ type: "||", value: "||" });
      current = "";
      i += 2;
    } else {
      current += char;
      i++;
    }
  }

  if (current.trim()) tokens.push({ type: "text", value: current.trim() });
  if (tokens.length <= 1) return cmd;

  let result = `${tokens[0].value}; $__localCoderSuccess = $?`;

  for (let j = 1; j < tokens.length; j += 2) {
    const op = tokens[j];
    const nextCmd = tokens[j + 1]?.value;
    if (!nextCmd) break;

    if (op.type === "&&") {
      result += `; if ($__localCoderSuccess) { ${nextCmd}; $__localCoderSuccess = $? }`;
    } else if (op.type === "||") {
      result += `; if (-not $__localCoderSuccess) { ${nextCmd}; $__localCoderSuccess = $? }`;
    }
  }

  return result;
}

export function getWinShell(): { shell: string; isPwsh: boolean } {
  const configuredShell = process.env.SHELL?.trim();
  if (
    configuredShell &&
    /(?:^|[\\/])(pwsh|powershell)(?:\.exe)?$/i.test(configuredShell)
  ) {
    return {
      shell: configuredShell,
      isPwsh: /pwsh(?:\.exe)?$/i.test(configuredShell),
    };
  }

  const pwshPaths = [
    "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
    "C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe",
  ];
  for (const p of pwshPaths) {
    if (fs.existsSync(p)) return { shell: p, isPwsh: true };
  }

  const sysPowerShell =
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
  if (fs.existsSync(sysPowerShell)) {
    return { shell: sysPowerShell, isPwsh: false };
  }

  return { shell: "powershell.exe", isPwsh: false };
}

function runOnce(
  command: string,
  cwd: string,
  timeoutMs: number
): Promise<ShellExecResult> {
  return new Promise((resolve, reject) => {
    let effectiveCommand = command;
    let shell = "bash";
    let args: string[] = ["-lc", effectiveCommand];

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
        npm_config_yes: "true",
      },
    });

    child.stdin?.end();

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout?.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));
    child.on("close", (code) => {
      clearTimeout(timer);
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
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export async function execInShellSession(
  command: string,
  workspaceRoot: string,
  timeoutMs: number,
  workingDirectory?: string
): Promise<ShellExecResult> {
  const root = canonicalWorkspace(workspaceRoot);
  const state = ensureShellSession(root);
  const oneOffCwd = workingDirectory ? path.resolve(workingDirectory) : undefined;
  const startCwd = oneOffCwd ?? state.cwd;
  const { cwd, command: effective } = applyCwdDirectives(startCwd, command);

  state.history.push(effective);
  if (state.history.length > MAX_HISTORY) state.history.shift();

  const result = await runOnce(effective, cwd, timeoutMs);

  if (!oneOffCwd) {
    state.cwd = cwd;
  }

  const prev = await loadGlobalShellState(root, root);
  await saveGlobalShellState(root, state.cwd, effective, prev);

  return result;
}

export function resetAllShellSessionsForTests(): void {
  sessions.clear();
}

import path from "node:path";
export const SHELL_WORKSPACE_GUARD_VERSION = "2026-09-24-redirection-v2";

import {
  assertPathInsideWorkspaceSync,
  getActiveSupportRoots,
  isPathInsideAnyRootSync,
} from "./path-security.js";

function stripTokenPunctuation(value: string): string {
  return value
    .trim()
    .replace(/^[&|;,(){}\[\]=]+/, "")
    .replace(/[&|;,(){}\[\],]+$/, "")
    .replace(/^['"]|['"]$/g, "");
}

function looksLikeAbsolutePath(value: string): boolean {
  const token = stripTokenPunctuation(value);
  if (!token) return false;

  if (looksLikeWindowsAbsolutePath(token)) return true;
  return token.startsWith("/");
}

function looksLikeWindowsAbsolutePath(value: string): boolean {
  const token = stripTokenPunctuation(value);
  return /^[A-Za-z]:[\\/]/.test(token) || /^\\\\[^\\]+\\[^\\]+/.test(token);
}

function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  let buffer = "";
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        buffer += ch;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (buffer) {
        tokens.push(buffer);
        buffer = "";
      }
      continue;
    }
    if (";&|".includes(ch)) {
      if (buffer) {
        tokens.push(buffer);
        buffer = "";
      }
      tokens.push(ch);
      continue;
    }
    buffer += ch;
  }
  if (buffer) tokens.push(buffer);
  return tokens;
}

function assertRedirectionsWorkspaceBound(
  command: string,
  workspaceRoot: string
): void {
  // Redirection targets are path-bearing syntax even when the whole nested
  // command is itself quoted, e.g. cmd /c "echo x>D:\\outside\\file.txt".
  const redirect =
    /(?:^|[^>])(?:\d*>>?|<<?)\s*(?:"([^"]+)"|'([^']+)'|([^\s"';&|<>]+))/g;

  for (const match of command.matchAll(redirect)) {
    const candidate = (match[1] || match[2] || match[3] || "").trim();
    if (!candidate) continue;

    const cleaned = stripTokenPunctuation(candidate);
    const absolute =
      path.isAbsolute(cleaned) || looksLikeWindowsAbsolutePath(cleaned);
    if (!absolute) {
      // Relative redirection remains inside the process cwd, which is already
      // forced to the confirmed Workspace.
      continue;
    }

    if (looksLikeWindowsAbsolutePath(cleaned) && process.platform !== "win32") {
      throw new Error(
        "WORKSPACE_BOUNDARY: shell redirection references a foreign absolute Windows path outside the confirmed Workspace: " +
          cleaned
      );
    }

    assertPathInsideWorkspaceSync(cleaned, workspaceRoot);
  }
}

function nestedShellPayloads(command: string): string[] {
  const payloads: string[] = [];
  // cmd.exe /c "..." and cmd /s /c "..." are especially important because
  // the quoted payload otherwise hides redirection/path syntax from a naïve
  // top-level token pass.
  const cmdPattern =
    /(?:^|[;&|]\s*|\s)(?:cmd|cmd\.exe)\b(?:(?![;&|]).)*?\/(?:c|k)\s+(?:"([^"]*)"|'([^']*)')/gi;
  for (const match of command.matchAll(cmdPattern)) {
    const payload = (match[1] ?? match[2] ?? "").trim();
    if (payload) payloads.push(payload);
  }

  // Also unwrap the common PowerShell -Command quoted form. This does not
  // attempt to interpret PowerShell; it merely exposes contained path-bearing
  // syntax to the same Workspace guards.
  const psPattern =
    /(?:^|[;&|]\s*|\s)(?:pwsh|powershell)(?:\.exe)?\b(?:(?![;&|]).)*?-(?:command|c)\s+(?:"([^"]*)"|'([^']*)')/gi;
  for (const match of command.matchAll(psPattern)) {
    const payload = (match[1] ?? match[2] ?? "").trim();
    if (payload) payloads.push(payload);
  }

  return payloads;
}

function assertNestedShellPayloadsWorkspaceBound(
  command: string,
  workspaceRoot: string
): void {
  const seen = new Set<string>();
  const queue = nestedShellPayloads(command);
  let depth = 0;

  while (queue.length) {
    if (++depth > 8) {
      throw new Error("WORKSPACE_BOUNDARY: nested shell command depth exceeds safe limit.");
    }
    const payload = queue.shift()!;
    if (seen.has(payload)) continue;
    seen.add(payload);

    assertRedirectionsWorkspaceBound(payload, workspaceRoot);
    assertGitContextSwitchesWorkspaceBound(payload, workspaceRoot);

    for (const candidate of extractPathLiterals(payload)) {
      try {
        assertPathInsideWorkspaceSync(candidate, workspaceRoot);
      } catch {
        throw new Error(
          "WORKSPACE_BOUNDARY: nested shell command references an absolute path outside the confirmed Workspace: " +
            candidate
        );
      }
    }

    queue.push(...nestedShellPayloads(payload));
  }
}

function assertGitContextSwitchesWorkspaceBound(
  command: string,
  workspaceRoot: string
): void {
  const tokens = tokenizeCommand(command);
  const separators = new Set([";", "&", "|", "&&", "||"]);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].toLowerCase();
    const base = token.replace(/^.*[\\/]/, "");
    if (base !== "git" && base !== "git.exe") continue;

    for (let j = i + 1; j < tokens.length && !separators.has(tokens[j]); j++) {
      const current = tokens[j];
      const lower = current.toLowerCase();
      let candidate: string | null = null;

      if (current === "-C") {
        candidate = tokens[++j] ?? null;
      } else if (lower === "-c") {
        // Git -c is config, NOT a path-changing option.
        j++;
        continue;
      } else if (lower === "--git-dir" || lower === "--work-tree") {
        candidate = tokens[++j] ?? null;
      } else if (lower.startsWith("--git-dir=")) {
        candidate = current.slice("--git-dir=".length);
      } else if (lower.startsWith("--work-tree=")) {
        candidate = current.slice("--work-tree=".length);
      }

      if (candidate === null) continue;
      if (!candidate.trim()) {
        throw new Error("WORKSPACE_BOUNDARY: Git path option is missing its path.");
      }

      const cleaned = stripTokenPunctuation(candidate);
      const absolute =
        path.isAbsolute(cleaned) || looksLikeWindowsAbsolutePath(cleaned);

      if (!absolute) {
        throw new Error(
          "WORKSPACE_BOUNDARY: Git repository context options require an absolute path inside the confirmed Workspace: " +
            cleaned
        );
      }

      // On Windows this performs canonical realpath/junction enforcement.
      // On non-Windows, a Windows-style path is necessarily foreign to the
      // local Workspace and must be rejected rather than normalized as relative.
      if (looksLikeWindowsAbsolutePath(cleaned) && process.platform !== "win32") {
        throw new Error(
          "WORKSPACE_BOUNDARY: Git repository context references a foreign absolute Windows path: " +
            cleaned
        );
      }

      assertPathInsideWorkspaceSync(cleaned, workspaceRoot);
    }
  }

  // Environment-based Git context switching is equivalent to -C/--git-dir.
  const envPattern =
    /(?:^|[;&|]\s*|\s)(GIT_DIR|GIT_WORK_TREE)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/gi;
  for (const match of command.matchAll(envPattern)) {
    const candidate = (match[2] || match[3] || match[4] || "").trim();
    if (!candidate) continue;
    if (looksLikeWindowsAbsolutePath(candidate) && process.platform !== "win32") {
      throw new Error(
        "WORKSPACE_BOUNDARY: Git environment references a foreign absolute Windows path: " +
          candidate
      );
    }
    assertPathInsideWorkspaceSync(candidate, workspaceRoot);
  }
}

function extractPathLiterals(command: string): string[] {
  const found = new Set<string>();

  // First capture quoted path literals as a whole. This is required on Windows
  // where normal Workspace paths commonly contain spaces (for example
  // "D:\\00 Other Works\\project"). Do not split those quoted spans again.
  const unquotedOnly = command.replace(/(["'])(.*?)\1/g, (match, _quote, inner) => {
    const value = String(inner ?? "").trim();
    if (value && looksLikeAbsolutePath(value)) found.add(value);
    return " ".repeat(match.length);
  });

  for (const raw of unquotedOnly.split(/\s+/)) {
    const token = stripTokenPunctuation(raw);
    if (looksLikeAbsolutePath(token)) found.add(token);
  }

  return [...found];
}

const SUPPORT_SCRIPT_EXTENSIONS = new Set([
  ".mjs",
  ".js",
  ".cjs",
  ".ts",
  ".py",
  ".ps1",
  ".cmd",
  ".bat",
  ".exe",
]);

function isTrustedSupportScriptReference(
  command: string,
  candidate: string
): boolean {
  const supportRoots = getActiveSupportRoots();
  if (!supportRoots.length) return false;
  if (!isPathInsideAnyRootSync(candidate, supportRoots)) return false;

  const ext = path.extname(candidate).toLowerCase();
  if (!SUPPORT_SCRIPT_EXTENSIONS.has(ext)) return false;

  const lower = command.toLowerCase();
  const interpreter =
    /(^|[;&|]\s*|\s)(node|tsx|python|python3|py|pwsh|powershell|bash|sh|cmd)(?:\.exe)?\s/.test(
      lower
    );
  const directPowerShellCall = /^\s*&\s*["']/.test(command);

  return interpreter || directPowerShellCall;
}

export function assertShellCommandWorkspaceBound(
  command: string,
  workspaceRoot: string
): void {
  if (!command.trim()) throw new Error("Shell command is empty");

  // Path-bearing shell syntax must be rejected before spawning any shell.
  // This includes nested cmd/PowerShell payloads and redirection targets.
  assertRedirectionsWorkspaceBound(command, workspaceRoot);
  assertGitContextSwitchesWorkspaceBound(command, workspaceRoot);
  assertNestedShellPayloadsWorkspaceBound(command, workspaceRoot);

  if (/(^|[\s'"=(:,;])\.\.[\\/]/.test(command)) {
    throw new Error(
      "WORKSPACE_BOUNDARY: shell command contains parent-directory traversal (../ or ..\\). " +
        "Use absolute paths inside the confirmed Workspace."
    );
  }

  for (const candidate of extractPathLiterals(command)) {
    try {
      assertPathInsideWorkspaceSync(candidate, workspaceRoot);
      continue;
    } catch {}

    if (isTrustedSupportScriptReference(command, candidate)) {
      continue;
    }

    throw new Error(
      "WORKSPACE_BOUNDARY: shell command references an absolute path outside the confirmed Workspace: " +
        candidate +
        ". Only declared Job support scripts may be read/executed outside the Workspace; project file arguments must stay inside the confirmed Workspace."
    );
  }
}

export function shellCommandPathLiteralsForTests(command: string): string[] {
  return extractPathLiterals(command);
}

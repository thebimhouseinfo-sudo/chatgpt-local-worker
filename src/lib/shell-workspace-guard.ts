import path from "node:path";
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

  if (process.platform === "win32") {
    return /^[A-Za-z]:[\\/]/.test(token) || /^\\\\[^\\]+\\[^\\]+/.test(token);
  }

  return token.startsWith("/");
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

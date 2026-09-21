import path from "node:path";
import { assertPathInsideWorkspaceSync } from "./path-security.js";

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

  for (const match of command.matchAll(/(["'])(.*?)\1/g)) {
    const value = match[2]?.trim();
    if (value && looksLikeAbsolutePath(value)) found.add(value);
  }

  for (const raw of command.split(/\s+/)) {
    const token = stripTokenPunctuation(raw);
    if (looksLikeAbsolutePath(token)) found.add(token);
  }

  return [...found];
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
    } catch (error) {
      throw new Error(
        "WORKSPACE_BOUNDARY: shell command references an absolute path outside the confirmed Workspace: " +
          candidate +
          ". Invoke installed tools by command name and keep file arguments inside the confirmed Workspace."
      );
    }
  }
}

export function shellCommandPathLiteralsForTests(command: string): string[] {
  return extractPathLiterals(command);
}

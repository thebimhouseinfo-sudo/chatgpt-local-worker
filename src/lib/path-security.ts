import fs from "fs";
import path from "path";
import os from "os";
import { AsyncLocalStorage } from "node:async_hooks";

let defaultCwd = process.cwd();
const callWorkspace = new AsyncLocalStorage<string>();

function comparablePath(value: string): string {
  const resolved = path.resolve(value);
  const filesystemRoot = path.parse(resolved).root;
  const normalized =
    resolved === filesystemRoot
      ? resolved
      : resolved.replace(/[\\/]+$/, "");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function realpathSyncSafe(value: string): string {
  const native = (fs.realpathSync as any).native as
    | ((value: string) => string)
    | undefined;
  return native ? native(value) : fs.realpathSync(value);
}

/**
 * Canonicalize the nearest existing ancestor so a path that passes through
 * a symlink/junction cannot escape the confirmed Workspace simply because
 * the final file does not exist yet.
 */
function canonicalPotentialPathSync(value: string): string {
  const resolved = path.resolve(value);
  let probe = resolved;
  const tail: string[] = [];

  while (true) {
    try {
      const real = realpathSyncSafe(probe);
      return path.resolve(real, ...tail);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTDIR") throw error;

      const parent = path.dirname(probe);
      if (parent === probe) return resolved;
      tail.unshift(path.basename(probe));
      probe = parent;
    }
  }
}

function pathIsInside(root: string, candidate: string): boolean {
  const rootComparable = comparablePath(root);
  const candidateComparable = comparablePath(candidate);
  return (
    candidateComparable === rootComparable ||
    candidateComparable.startsWith(rootComparable + path.sep)
  );
}

export function setDefaultCwd(cwd: string): void {
  defaultCwd = path.resolve(cwd);
}

export function getDefaultCwd(): string {
  return callWorkspace.getStore() ?? defaultCwd;
}

export function getActiveWorkspaceBoundary(): string | null {
  return callWorkspace.getStore() ?? null;
}

export function isWorkspaceBoundaryActive(): boolean {
  return Boolean(callWorkspace.getStore());
}

export function runWithWorkspaceCwd<T>(
  cwd: string,
  fn: () => T
): T {
  return callWorkspace.run(path.resolve(cwd), fn);
}

/** @deprecated use getDefaultCwd — kept for compatibility */
export function setAllowedRoots(roots: string[]): void {
  if (roots.length > 0) setDefaultCwd(roots[0]);
}

/** Effective active-work root; before work activation this is startup context only. */
export function getAllowedRoots(): string[] {
  return [getDefaultCwd()];
}

export function setFullDiskAccess(_enabled: boolean): void {}

/**
 * Host process capability only. Active Job path APIs are separately restricted
 * to the confirmed Workspace by validatePath().
 */
export function getFullDiskAccess(): boolean {
  return true;
}

export function isPathInsideWorkspaceSync(
  inputPath: string,
  workspaceRoot: string
): boolean {
  try {
    if (!path.isAbsolute(inputPath) || !path.isAbsolute(workspaceRoot)) {
      return false;
    }
    const root = canonicalPotentialPathSync(workspaceRoot);
    const candidate = canonicalPotentialPathSync(inputPath);
    return pathIsInside(root, candidate);
  } catch {
    return false;
  }
}

export function assertPathInsideWorkspaceSync(
  inputPath: string,
  workspaceRoot: string
): string {
  const trimmed = inputPath.trim();
  if (!trimmed) throw new Error("Path is empty");
  if (!path.isAbsolute(trimmed)) {
    throw new Error(
      "Absolute path required. Relative paths are not allowed for GPTWorker operations: " +
        trimmed
    );
  }

  const resolved = path.resolve(trimmed);
  const root = path.resolve(workspaceRoot);
  const canonicalRoot = canonicalPotentialPathSync(root);
  const canonicalCandidate = canonicalPotentialPathSync(resolved);

  if (!pathIsInside(canonicalRoot, canonicalCandidate)) {
    throw new Error(
      "WORKSPACE_BOUNDARY: path is outside the confirmed Workspace. " +
        `Workspace=${root}; path=${resolved}`
    );
  }

  return resolved;
}

export async function validatePath(inputPath: string): Promise<string> {
  const trimmed = inputPath.trim();
  if (!trimmed) throw new Error("Path is empty");

  if (!path.isAbsolute(trimmed)) {
    throw new Error(
      "Absolute path required. Relative paths are not allowed for GPTWorker filesystem operations: " +
        trimmed
    );
  }

  const resolved = path.resolve(trimmed);
  const activeWorkspace = callWorkspace.getStore();
  if (activeWorkspace) {
    return assertPathInsideWorkspaceSync(resolved, activeWorkspace);
  }

  // Pre-confirm/control-plane tools may validate a user-supplied absolute path,
  // but they do not receive work authority and cannot use this as Job execution.
  return resolved;
}

export function getMachineRoots(): string[] {
  if (process.platform === "win32") {
    const drives: string[] = [];
    for (let code = 65; code <= 90; code++) {
      const letter = String.fromCharCode(code);
      try {
        fs.accessSync(`${letter}:\\`, fs.constants.R_OK);
        drives.push(`${letter}:\\`);
      } catch {}
    }
    return drives.length ? drives : ["C:\\"];
  }
  return ["/", os.homedir()];
}

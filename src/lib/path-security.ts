import fs from "fs";
import path from "path";
import os from "os";
import { AsyncLocalStorage } from "node:async_hooks";

interface ExecutionScope {
  workspace: string;
  supportRoots: string[];
}

let defaultCwd = process.cwd();
const callScope = new AsyncLocalStorage<ExecutionScope>();

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
 * a symlink/junction cannot escape an authority root merely because the final
 * file does not exist yet.
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
  if (candidateComparable === rootComparable) return true;

  const separator = rootComparable.endsWith(path.sep) ? "" : path.sep;
  return candidateComparable.startsWith(rootComparable + separator);
}

function requireAbsolute(inputPath: string): string {
  const trimmed = inputPath.trim();
  if (!trimmed) throw new Error("Path is empty");
  if (!path.isAbsolute(trimmed)) {
    throw new Error(
      "Absolute path required. Relative paths are not allowed for GPTWorker operations: " +
        trimmed
    );
  }
  return path.resolve(trimmed);
}

export function setDefaultCwd(cwd: string): void {
  defaultCwd = path.resolve(cwd);
}

export function getDefaultCwd(): string {
  return callScope.getStore()?.workspace ?? defaultCwd;
}

export function getActiveWorkspaceBoundary(): string | null {
  return callScope.getStore()?.workspace ?? null;
}

export function getActiveSupportRoots(): string[] {
  return [...(callScope.getStore()?.supportRoots ?? [])];
}

export function isWorkspaceBoundaryActive(): boolean {
  return Boolean(callScope.getStore());
}

export function runWithWorkspaceScope<T>(
  cwd: string,
  supportRoots: readonly string[],
  fn: () => T
): T {
  const scope: ExecutionScope = {
    workspace: path.resolve(cwd),
    supportRoots: [...new Set(supportRoots.map((root) => path.resolve(root)))],
  };
  return callScope.run(scope, fn);
}

export function runWithWorkspaceCwd<T>(
  cwd: string,
  fn: () => T
): T {
  return runWithWorkspaceScope(cwd, [], fn);
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
 * Host process capability only. Active Job structured path APIs are separately
 * restricted to the confirmed Workspace. Job Pack support roots are read-only
 * inputs for declared skills/harness resources.
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
  const resolved = requireAbsolute(inputPath);
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

export function isPathInsideAnyRootSync(
  inputPath: string,
  roots: readonly string[]
): boolean {
  return roots.some((root) =>
    isPathInsideWorkspaceSync(inputPath, path.resolve(root))
  );
}

/**
 * Structured read access for active work.
 *
 * Project/user data remains Workspace-bound. The only extra readable roots are
 * the active Job Pack support roots so GPTWorker can load declared skills and
 * harness files without granting write authority there.
 */
export async function validateReadPath(inputPath: string): Promise<string> {
  const resolved = requireAbsolute(inputPath);
  const scope = callScope.getStore();
  if (!scope) return resolved;

  if (isPathInsideWorkspaceSync(resolved, scope.workspace)) {
    return resolved;
  }

  if (isPathInsideAnyRootSync(resolved, scope.supportRoots)) {
    return resolved;
  }

  throw new Error(
    "WORKSPACE_BOUNDARY: read path is outside the confirmed Workspace and active Job support roots. " +
      `Workspace=${scope.workspace}; path=${resolved}`
  );
}

/**
 * Structured write/mutation access for active work. No support-root exception:
 * Job Pack resources are read/execute support only and must not become output
 * locations.
 */
export async function validatePath(inputPath: string): Promise<string> {
  const resolved = requireAbsolute(inputPath);
  const scope = callScope.getStore();
  if (scope) {
    return assertPathInsideWorkspaceSync(resolved, scope.workspace);
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

import fs from "fs";
import path from "path";
import os from "os";
import { AsyncLocalStorage } from "node:async_hooks";

let defaultCwd = process.cwd();
const callWorkspace = new AsyncLocalStorage<string>();

export function setDefaultCwd(cwd: string): void {
  defaultCwd = path.resolve(cwd);
}

export function getDefaultCwd(): string {
  return callWorkspace.getStore() ?? defaultCwd;
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

/** Returns default working directory, not an access boundary */
export function getAllowedRoots(): string[] {
  return [getDefaultCwd()];
}

export function setFullDiskAccess(_enabled: boolean): void {}

export function getFullDiskAccess(): boolean {
  return true;
}

export async function validatePath(inputPath: string): Promise<string> {
  const trimmed = inputPath.trim();
  if (!trimmed) throw new Error("Path is empty");

  if (!path.isAbsolute(trimmed)) {
    throw new Error(
      "Absolute path required. Relative paths are not allowed for GPTWorker filesystem operations: " + trimmed
    );
  }

  return path.resolve(trimmed);
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
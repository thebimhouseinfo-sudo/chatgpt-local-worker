import os from "node:os";
import path from "path";
import { fileURLToPath } from "url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export function getWorkerHome(): string {
  const configured = (process.env.LOCAL_WORKER_HOME || "").trim();
  if (configured) return path.resolve(configured);

  // Install/source root. Works in both:
  // - src/lib/*.ts under tsx
  // - dist/lib/*.js after tsc
  return path.resolve(moduleDir, "../..");
}

export function getWorkerDataRoot(): string {
  const configured = (process.env.GPTWORKER_DATA_ROOT || "").trim();
  if (configured) return path.resolve(configured);

  const localAppData = (process.env.LOCALAPPDATA || "").trim();
  if (localAppData) return path.join(path.resolve(localAppData), "GPTWorker");

  const xdg = (process.env.XDG_DATA_HOME || "").trim();
  if (xdg) return path.join(path.resolve(xdg), "GPTWorker");

  return path.join(os.homedir(), ".local", "share", "GPTWorker");
}

export function getDefaultJobsRoot(): string {
  const configured = (process.env.DEFAULT_JOB_PACKS_PATH || "").trim();
  if (configured) return path.resolve(configured);
  return path.join(getWorkerHome(), "jobs");
}

export function getCustomJobsRoot(): string {
  // Compatibility override for tests/manual routing.
  const configured = (process.env.JOB_PACKS_PATH || "").trim();
  if (configured) return path.resolve(configured);
  return path.join(getWorkerDataRoot(), "jobs");
}

export function getJobPackRoots(): {
  defaults: string;
  custom: string;
} {
  return {
    defaults: getDefaultJobsRoot(),
    custom: getCustomJobsRoot(),
  };
}

// Backward-compatible alias: mutable authoring always targets custom jobs.
export function getJobsRoot(): string {
  return getCustomJobsRoot();
}

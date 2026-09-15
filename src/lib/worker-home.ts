import path from "path";
import { fileURLToPath } from "url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export function getWorkerHome(): string {
  const configured = (process.env.LOCAL_WORKER_HOME || "").trim();
  if (configured) return path.resolve(configured);

  // Works in both:
  // - src/lib/*.ts under tsx
  // - dist/lib/*.js after tsc
  return path.resolve(moduleDir, "../..");
}

export function getJobsRoot(): string {
  const configured = (process.env.JOB_PACKS_PATH || "").trim();
  if (configured) return path.resolve(configured);
  return path.join(getWorkerHome(), "jobs");
}

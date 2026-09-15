import fs from "fs/promises";
import path from "path";
import { getWorkerHome } from "./worker-home.js";

export interface WorkerPolicyBundle {
  path: string;
  content: string;
  loaded: boolean;
  truncated: boolean;
  bytes: number;
}

const DEFAULT_MAX_BYTES = parseInt(
  process.env.WORKER_POLICY_MAX_BYTES || "60000",
  10
);

export async function loadWorkerPolicy(
  maxBytes = DEFAULT_MAX_BYTES
): Promise<WorkerPolicyBundle> {
  const filePath = path.join(getWorkerHome(), "WORKER.md");

  try {
    const buf = await fs.readFile(filePath);
    const truncated = buf.length > maxBytes;
    const content = buf.subarray(0, maxBytes).toString("utf-8").trim();
    return {
      path: filePath,
      content,
      loaded: Boolean(content),
      truncated,
      bytes: Math.min(buf.length, maxBytes),
    };
  } catch {
    return {
      path: filePath,
      content: "",
      loaded: false,
      truncated: false,
      bytes: 0,
    };
  }
}

export function formatWorkerPolicyForInstructions(
  bundle: WorkerPolicyBundle
): string {
  if (!bundle.loaded) {
    return [
      "## Local Worker policy",
      `WORKER.md was not found at ${bundle.path}.`,
      "Do not guess Job Pack behavior. Use job_list/job_status before job-specific execution.",
    ].join("\n");
  }

  const note = bundle.truncated ? " (truncated)" : "";
  return [
    `## Local Worker policy: ${bundle.path}${note}`,
    bundle.content,
  ].join("\n");
}

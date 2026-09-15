import fs from "fs/promises";
import path from "path";
import { getWorkerHome } from "./worker-home.js";

export type WorkerStateStatus = "idle" | "confirmed";

export interface WorkerState {
  current_job: string | null;
  active_workspace: string | null;
  status: WorkerStateStatus;
  updated_at: string | null;
}

const EMPTY_STATE: WorkerState = {
  current_job: null,
  active_workspace: null,
  status: "idle",
  updated_at: null,
};

export function getWorkerStatePath(): string {
  return path.join(getWorkerHome(), "worker-state.json");
}

export async function readWorkerState(): Promise<WorkerState> {
  try {
    const raw = JSON.parse(await fs.readFile(getWorkerStatePath(), "utf8")) as Partial<WorkerState>;
    return {
      current_job: typeof raw.current_job === "string" ? raw.current_job : null,
      active_workspace:
        typeof raw.active_workspace === "string" ? path.resolve(raw.active_workspace) : null,
      status: raw.status === "confirmed" ? "confirmed" : "idle",
      updated_at: typeof raw.updated_at === "string" ? raw.updated_at : null,
    };
  } catch {
    return { ...EMPTY_STATE };
  }
}

export async function writeWorkerState(
  currentJob: string,
  activeWorkspace: string
): Promise<WorkerState> {
  const state: WorkerState = {
    current_job: currentJob,
    active_workspace: path.resolve(activeWorkspace),
    status: "confirmed",
    updated_at: new Date().toISOString(),
  };
  await fs.writeFile(getWorkerStatePath(), `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return state;
}

export async function clearWorkerState(): Promise<WorkerState> {
  const state: WorkerState = {
    ...EMPTY_STATE,
    updated_at: new Date().toISOString(),
  };
  await fs.writeFile(getWorkerStatePath(), `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return state;
}

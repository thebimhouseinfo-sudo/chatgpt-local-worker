import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { appendActivity } from "./activity-log.js";
import { getWorkerHome } from "./worker-home.js";

export interface WorkRegistration {
  executionId: string;
  authorityToken: string;
  driverEpoch: number;
  generation: number;
  jobId: string;
  workspace: string;
  workspaceKey: string;
  createdAt: string;
  lastActivityAt: string;
  callSequence: number;
}

export interface ToolLease {
  leaseId: string;
  family: string;
  tool: string;
  workId: string;
  jobId: string;
  workspace: string;
  workspaceKey: string;
  driverEpoch: number;
  generation: number;
  callSequence: number;
  acquiredAt: string;
  acquiredAtMs: number;
}

export class WorkRegistrationError extends Error {
  constructor(
    public readonly code: "NO_ACTIVE_WORK" | "WORKSPACE_BUSY",
    message: string
  ) {
    super(message);
    this.name = "WorkRegistrationError";
  }
}

const registrations = new Map<string, WorkRegistration>();
const workspaceOwners = new Map<string, string>();
const workspaceGenerations = new Map<string, number>();
const activeLeases = new Map<string, ToolLease>();
let epochPromise: Promise<number> | null = null;

function normalizeWorkspaceIdentity(value: string): string {
  let normalized = path.resolve(value);
  if (process.platform === "win32") normalized = normalized.toLowerCase();
  return normalized.replace(/[\\/]+$/, "");
}

function workspaceSlug(workspace: string): string {
  const base = path.basename(workspace).trim().toLowerCase();
  const slug = base
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "workspace";
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 6);
}

async function canonicalWorkspace(workspace: string): Promise<string> {
  const resolved = path.resolve(workspace);
  const real = await fs.realpath(resolved).catch(() => resolved);
  return normalizeWorkspaceIdentity(real);
}

async function nextDriverEpoch(): Promise<number> {
  if (epochPromise) return epochPromise;
  epochPromise = (async () => {
    const root = getWorkerHome();
    const file = path.join(root, ".gptworker-driver-epoch");
    await fs.mkdir(root, { recursive: true });
    const previous = await fs
      .readFile(file, "utf8")
      .then((raw) => Number.parseInt(raw.trim(), 10))
      .catch(() => 0);
    const next = Number.isFinite(previous) && previous >= 0 ? previous + 1 : 1;
    await fs.writeFile(file, String(next), "utf8");
    return next;
  })();
  return epochPromise;
}

function tokensEqual(actual: string, expected: string): boolean {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createWorkRegistration(
  jobId: string,
  workspaceInput: string
): Promise<WorkRegistration> {
  const workspace = await canonicalWorkspace(workspaceInput);
  const key = \`\${workspaceSlug(workspace)}#\${shortHash(workspace)}\`;
  const existingOwner = workspaceOwners.get(workspace);

  if (existingOwner && registrations.has(existingOwner)) {
    throw new WorkRegistrationError(
      "WORKSPACE_BUSY",
      \`Workspace is already registered by \${existingOwner}. Stop or explicitly replace that work registration before opening it again.\`
    );
  }

  const driverEpoch = await nextDriverEpoch();
  const generation = (workspaceGenerations.get(workspace) || 0) + 1;
  workspaceGenerations.set(workspace, generation);

  const executionId = \`exec:\${jobId}@\${key}:e\${driverEpoch}:g\${generation}\`;
  const now = new Date().toISOString();
  const registration: WorkRegistration = {
    executionId,
    authorityToken: randomBytes(24).toString("base64url"),
    driverEpoch,
    generation,
    jobId,
    workspace,
    workspaceKey: key,
    createdAt: now,
    lastActivityAt: now,
    callSequence: 0,
  };

  registrations.set(executionId, registration);
  workspaceOwners.set(workspace, executionId);

  appendActivity({
    kind: "system",
    action: "work_registered",
    status: "ok",
    target: key,
    summary: \`\${jobId} @ \${key}\`,
    details: {
      work_id: executionId,
      job_id: jobId,
      workspace_key: key,
      workspace,
      driver_epoch: driverEpoch,
      generation,
    },
  });

  return registration;
}

export function getPublicWorkHandle(registration: WorkRegistration) {
  return {
    execution_id: registration.executionId,
    authority_token: registration.authorityToken,
    job_id: registration.jobId,
    workspace: registration.workspace,
    workspace_key: registration.workspaceKey,
    driver_epoch: registration.driverEpoch,
    generation: registration.generation,
  };
}

export function validateWorkHandle(
  executionId: string | undefined,
  authorityToken: string | undefined
): WorkRegistration {
  if (!executionId || !authorityToken) {
    throw new WorkRegistrationError(
      "NO_ACTIVE_WORK",
      "NO_ACTIVE_WORK: execution_id + authority_token are required. Activate a Job + Workspace with job_select first."
    );
  }

  const registration = registrations.get(executionId);
  if (!registration || !tokensEqual(authorityToken, registration.authorityToken)) {
    throw new WorkRegistrationError(
      "NO_ACTIVE_WORK",
      "NO_ACTIVE_WORK: work handle is missing, stale, or invalid. Re-register the Job + Workspace."
    );
  }

  registration.lastActivityAt = new Date().toISOString();
  return registration;
}

export function releaseWorkRegistration(
  executionId: string,
  authorityToken: string
): WorkRegistration {
  const registration = validateWorkHandle(executionId, authorityToken);

  for (const lease of activeLeases.values()) {
    if (lease.workId === executionId) {
      activeLeases.delete(lease.leaseId);
      appendActivity({
        kind: "tool",
        tool: lease.tool,
        action: "tool_lease_released",
        status: "cancelled",
        target: registration.workspaceKey,
        summary: lease.leaseId,
        details: {
          lease_id: lease.leaseId,
          work_id: executionId,
          job_id: registration.jobId,
          workspace_key: registration.workspaceKey,
          family: lease.family,
          reason: "work_stopped",
        },
      });
    }
  }

  registrations.delete(executionId);
  if (workspaceOwners.get(registration.workspace) === executionId) {
    workspaceOwners.delete(registration.workspace);
  }

  appendActivity({
    kind: "system",
    action: "work_released",
    status: "ok",
    target: registration.workspaceKey,
    summary: executionId,
    details: {
      work_id: executionId,
      job_id: registration.jobId,
      workspace_key: registration.workspaceKey,
      generation: registration.generation,
    },
  });

  return registration;
}

export function acquireToolLease(
  tool: string,
  family: string,
  executionId: string | undefined,
  authorityToken: string | undefined
): ToolLease {
  let registration: WorkRegistration;
  try {
    registration = validateWorkHandle(executionId, authorityToken);
  } catch (error) {
    appendActivity({
      kind: "tool",
      tool,
      action: "tool_lease_rejected",
      status: "blocked",
      summary: error instanceof Error ? error.message : String(error),
      details: {
        work_id: executionId,
        family,
        reason: error instanceof WorkRegistrationError ? error.code : "INVALID_WORK_HANDLE",
      },
    });
    throw error;
  }

  registration.callSequence += 1;
  const sequence = registration.callSequence;
  const leaseId =
    \`tool:\${family}@\${registration.jobId}@\${registration.workspaceKey}\` +
    \`:e\${registration.driverEpoch}:g\${registration.generation}:c\${sequence}\`;
  const lease: ToolLease = {
    leaseId,
    family,
    tool,
    workId: registration.executionId,
    jobId: registration.jobId,
    workspace: registration.workspace,
    workspaceKey: registration.workspaceKey,
    driverEpoch: registration.driverEpoch,
    generation: registration.generation,
    callSequence: sequence,
    acquiredAt: new Date().toISOString(),
    acquiredAtMs: Date.now(),
  };
  activeLeases.set(leaseId, lease);

  appendActivity({
    kind: "tool",
    tool,
    action: "tool_lease_acquired",
    status: "ok",
    target: registration.workspaceKey,
    summary: leaseId,
    details: {
      lease_id: leaseId,
      work_id: registration.executionId,
      job_id: registration.jobId,
      workspace_key: registration.workspaceKey,
      workspace: registration.workspace,
      family,
      driver_epoch: registration.driverEpoch,
      generation: registration.generation,
      call_sequence: sequence,
    },
  });

  return lease;
}

export function releaseToolLease(
  lease: ToolLease,
  status: "ok" | "error" | "cancelled" = "ok",
  errorMessage?: string
): void {
  activeLeases.delete(lease.leaseId);
  appendActivity({
    kind: "tool",
    tool: lease.tool,
    action: "tool_lease_released",
    status,
    duration_ms: Date.now() - lease.acquiredAtMs,
    target: lease.workspaceKey,
    summary: errorMessage || lease.leaseId,
    details: {
      lease_id: lease.leaseId,
      work_id: lease.workId,
      job_id: lease.jobId,
      workspace_key: lease.workspaceKey,
      family: lease.family,
      driver_epoch: lease.driverEpoch,
      generation: lease.generation,
      call_sequence: lease.callSequence,
    },
  });
}

export function getActiveToolLeaseCount(): number {
  return activeLeases.size;
}

export function getWorkRegistrationCount(): number {
  return registrations.size;
}

export function resetWorkRegistrationStateForTests(): void {
  registrations.clear();
  workspaceOwners.clear();
  workspaceGenerations.clear();
  activeLeases.clear();
}

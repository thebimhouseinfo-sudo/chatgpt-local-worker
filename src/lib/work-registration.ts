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
const idleTimeoutHandlers = new Map<string, () => void>();
let epochPromise: Promise<number> | null = null;

function positiveEnvMs(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const WORK_IDLE_TIMEOUT_MS = positiveEnvMs(
  "WORK_REGISTRATION_IDLE_MS",
  10 * 60 * 1000
);
const WORK_IDLE_SWEEP_MS = positiveEnvMs(
  "WORK_REGISTRATION_SWEEP_MS",
  Math.min(60_000, Math.max(1_000, Math.floor(WORK_IDLE_TIMEOUT_MS / 4)))
);
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

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
  workspaceInput: string,
  onIdleTimeout?: () => void
): Promise<WorkRegistration> {
  const workspace = await canonicalWorkspace(workspaceInput);
  const key = `${workspaceSlug(workspace)}#${shortHash(workspace)}`;
  const existingOwner = workspaceOwners.get(workspace);

  if (existingOwner && registrations.has(existingOwner)) {
    throw new WorkRegistrationError(
      "WORKSPACE_BUSY",
      `Workspace is already registered by ${existingOwner}. Stop or explicitly replace that work registration before opening it again.`
    );
  }

  const driverEpoch = await nextDriverEpoch();
  const generation = (workspaceGenerations.get(workspace) || 0) + 1;
  workspaceGenerations.set(workspace, generation);

  const executionId = `exec:${jobId}@${key}:e${driverEpoch}:g${generation}`;
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
  if (onIdleTimeout) idleTimeoutHandlers.set(executionId, onIdleTimeout);

  appendActivity({
    kind: "system",
    action: "work_registered",
    status: "ok",
    target: key,
    summary: `${jobId} @ ${key}`,
    work_id: executionId,
    job_id: jobId,
    workspace_key: key,
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

function hasActiveLease(executionId: string): boolean {
  for (const lease of activeLeases.values()) {
    if (lease.workId === executionId) return true;
  }
  return false;
}

function releaseRegistration(
  registration: WorkRegistration,
  reason: "explicit_stop" | "idle_timeout"
): WorkRegistration {
  const executionId = registration.executionId;
  const idleTimeoutHandler = idleTimeoutHandlers.get(executionId);
  idleTimeoutHandlers.delete(executionId);

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
        work_id: executionId,
        lease_id: lease.leaseId,
        job_id: registration.jobId,
        workspace_key: registration.workspaceKey,
        tool_family: lease.family,
        details: {
          lease_id: lease.leaseId,
          work_id: executionId,
          job_id: registration.jobId,
          workspace_key: registration.workspaceKey,
          family: lease.family,
          reason,
        },
      });
    }
  }

  registrations.delete(executionId);
  if (workspaceOwners.get(registration.workspace) === executionId) {
    workspaceOwners.delete(registration.workspace);
  }

  if (reason === "idle_timeout") {
    try {
      idleTimeoutHandler?.();
    } catch (error) {
      appendActivity({
        kind: "system",
        action: "work_auto_stop_cleanup_failed",
        status: "error",
        target: registration.workspaceKey,
        summary: error instanceof Error ? error.message : String(error),
        work_id: executionId,
        job_id: registration.jobId,
        workspace_key: registration.workspaceKey,
      });
    }

    appendActivity({
      kind: "system",
      action: "work_auto_stopped",
      status: "ok",
      target: registration.workspaceKey,
      summary: executionId,
      work_id: executionId,
      job_id: registration.jobId,
      workspace_key: registration.workspaceKey,
      details: {
        work_id: executionId,
        job_id: registration.jobId,
        workspace_key: registration.workspaceKey,
        idle_timeout_ms: WORK_IDLE_TIMEOUT_MS,
        last_activity_at: registration.lastActivityAt,
      },
    });
  }

  appendActivity({
    kind: "system",
    action: "work_released",
    status: "ok",
    target: registration.workspaceKey,
    summary: executionId,
    work_id: executionId,
    job_id: registration.jobId,
    workspace_key: registration.workspaceKey,
    details: {
      work_id: executionId,
      job_id: registration.jobId,
      workspace_key: registration.workspaceKey,
      generation: registration.generation,
      reason,
    },
  });

  return registration;
}

export function releaseWorkRegistration(
  executionId: string,
  authorityToken: string
): WorkRegistration {
  const registration = validateWorkHandle(executionId, authorityToken);
  return releaseRegistration(registration, "explicit_stop");
}

export function sweepExpiredWorkRegistrations(nowMs = Date.now()): number {
  let released = 0;

  for (const registration of [...registrations.values()]) {
    if (hasActiveLease(registration.executionId)) continue;

    const lastActivityMs = Date.parse(registration.lastActivityAt);
    if (!Number.isFinite(lastActivityMs)) continue;
    if (nowMs - lastActivityMs < WORK_IDLE_TIMEOUT_MS) continue;

    releaseRegistration(registration, "idle_timeout");
    released += 1;
  }

  return released;
}

export function getWorkIdleTimeoutMs(): number {
  return WORK_IDLE_TIMEOUT_MS;
}

function startWorkRegistrationSweeper(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    try {
      sweepExpiredWorkRegistrations();
    } catch {
      // Runtime cleanup is fail-open; the next sweep retries.
    }
  }, WORK_IDLE_SWEEP_MS);
  cleanupTimer.unref?.();
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
      work_id: executionId,
      tool_family: family,
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
    `tool:${family}@${registration.jobId}@${registration.workspaceKey}` +
    `:e${registration.driverEpoch}:g${registration.generation}:c${sequence}`;
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
    work_id: registration.executionId,
    lease_id: leaseId,
    job_id: registration.jobId,
    workspace_key: registration.workspaceKey,
    tool_family: family,
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
  const registration = registrations.get(lease.workId);
  if (registration) registration.lastActivityAt = new Date().toISOString();
  appendActivity({
    kind: "tool",
    tool: lease.tool,
    action: "tool_lease_released",
    status,
    duration_ms: Date.now() - lease.acquiredAtMs,
    target: lease.workspaceKey,
    summary: errorMessage || lease.leaseId,
    work_id: lease.workId,
    lease_id: lease.leaseId,
    job_id: lease.jobId,
    workspace_key: lease.workspaceKey,
    tool_family: lease.family,
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
  idleTimeoutHandlers.clear();
}

startWorkRegistrationSweeper();

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { JobRuntime } from "../jobs/job-runtime.js";
import {
  createJobPack,
  updateJobPack,
  removeJobPack,
  inspectJobPackForRemoval,
  exportJobPack,
  importJobPack,
} from "../jobs/job-authoring.js";
import { JOB_PRELOAD_FAMILIES } from "../lib/runtime-families.js";
import { clearWorkerState } from "../lib/worker-state.js";
import type { AdmissionRuntime } from "../lib/activation-policy.js";
import { toolAnnotations } from "../lib/tool-annotations.js";
import { toolError, toolResult } from "../lib/tool-result.js";
import {
  buildGptworkerWelcome,
  GPTWORKER_DEFAULT_WELCOME_JOBS,
  GPTWORKER_HIDDEN_WELCOME_JOB_IDS,
} from "../lib/quickstart.js";
import {
  createWorkRegistration,
  getPublicWorkHandle,
  getWorkIdleTimeoutMs,
  releaseWorkRegistration,
  validateWorkHandle,
} from "../lib/work-registration.js";

const BindingsSchema = z.record(z.string(), z.string());

const JobFieldDefinitionSchema = z.object({
  key: z.string().min(1),
  type: z.string().min(1).optional(),
  required: z.boolean().optional(),
  description: z.string().optional(),
});

const JobConfirmationSchema = z.object({
  required: z.boolean().optional(),
  template: z.string().min(1).optional(),
});

const JobPreloadFamiliesSchema = z
  .array(z.enum(JOB_PRELOAD_FAMILIES))
  .optional()
  .describe(
    "Optional active runtime families to warm while awaiting Job confirmation."
  );

const JobFilesSchema = z
  .record(z.string(), z.string())
  .optional()
  .describe("Additional pack files keyed by relative path, e.g. skills/foo.md or harness/validate.mjs");

const CONFIRMATION_PROOF_TTL_MS = 30 * 60 * 1000;

interface SharedConfirmationProof {
  jobId: string;
  bindings: Record<string, string>;
  admissionToken: string;
  createdAt: number;
}

// Confirmation authority follows the opaque admission+confirmation token pair,
// not one transport session. This survives legitimate MCP transport rotation
// while preventing another admission flow from reusing a confirmation proof.
const SHARED_PENDING_CONFIRMATIONS = new Map<string, SharedConfirmationProof>();

const WELCOME_DEFAULT_IDS = new Set(
  GPTWORKER_DEFAULT_WELCOME_JOBS.map((job) => job.id)
);
const HIDDEN_WELCOME_IDS = new Set(
  GPTWORKER_HIDDEN_WELCOME_JOB_IDS.map((id) => id.toLowerCase())
);

function publicJobListing(result: any) {
  const jobs = Array.isArray(result?.jobs)
    ? result.jobs.filter((job: any) => {
        const id = String(job?.id || "").toLowerCase();
        return !HIDDEN_WELCOME_IDS.has(id);
      })
    : [];

  const visibleIds = new Set(
    jobs.map((job: any) => String(job?.id || "").toLowerCase())
  );

  return {
    ...result,
    jobs,
    suggested_job_ids: Array.isArray(result?.suggested_job_ids)
      ? result.suggested_job_ids.filter((id: string) =>
          visibleIds.has(String(id).toLowerCase())
        )
      : [],
    note:
      (result?.note ? String(result.note) + " " : "") +
      "Private/hidden Job ids are never exposed by public Job enumeration.",
  };
}

function welcomeJobsFromListing(jobs: any[]): Array<{
  id: string;
  name: string;
  description: string;
  source: "default" | "custom";
}> {
  const customJobs = jobs
    .filter((job) => {
      const id = String(job?.id || "").toLowerCase();
      return (
        job?.source === "custom" &&
        job?.status === "ready" &&
        !WELCOME_DEFAULT_IDS.has(id) &&
        !HIDDEN_WELCOME_IDS.has(id)
      );
    })
    .map((job) => ({
      id: String(job.id),
      name: String(job.name),
      description: String(job.description),
      source: "custom" as const,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return [
    ...GPTWORKER_DEFAULT_WELCOME_JOBS.map((job) => ({
      ...job,
      source: "default" as const,
    })),
    ...customJobs,
  ];
}

function stableBindings(bindings: Record<string, string> | undefined): string {
  return JSON.stringify(
    Object.fromEntries(Object.entries(bindings || {}).sort(([a], [b]) => a.localeCompare(b)))
  );
}

function normalizedConfirmationValue(key: string, value: string): string {
  const trimmed = value.trim();
  if (key !== "workspace" || !path.isAbsolute(trimmed)) return trimmed;
  const resolved = path.resolve(trimmed);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function confirmationBindingsCompatible(
  supplied: Record<string, string> | undefined,
  confirmed: Record<string, string>
): boolean {
  if (!supplied) return true;
  for (const [key, value] of Object.entries(supplied)) {
    const confirmedValue = confirmed[key];
    if (typeof confirmedValue !== "string") return false;
    if (
      normalizedConfirmationValue(key, value) !==
      normalizedConfirmationValue(key, confirmedValue)
    ) {
      return false;
    }
  }
  return true;
}


async function safe<T extends object>(
  tool: string,
  fn: () => Promise<T> | T
) {
  try {
    return toolResult(tool, await fn());
  } catch (error) {
    return toolError(
      tool,
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function validateWorkspacePath(rawWorkspace: string): Promise<string> {
  const trimmed = rawWorkspace.trim();
  if (!path.isAbsolute(trimmed)) {
    throw new Error(
      `FOLDER must be an absolute local path (for example D:\\Projects\\MyApp): ${trimmed}`
    );
  }
  const workspace = path.resolve(trimmed);
  const stat = await fs.stat(workspace).catch(() => null);
  if (!stat?.isDirectory()) {
    throw new Error(`Workspace folder does not exist or is not a directory: ${workspace}`);
  }
  return workspace;
}

async function validateResolvedWorkspace(result: any): Promise<void> {
  const workspace = result?.state?.bindings?.workspace;
  if (!workspace) return;
  await validateWorkspacePath(workspace);
}

export interface JobPreparationLifecycle {
  nominate(job: { id: string; preload_families?: string[] }): void;
  wait(jobId: string): Promise<void>;
  clear(): void;
}

async function persistActiveSelection(
  result: any,
  runtime: JobRuntime,
  lifecycle?: JobPreparationLifecycle
) {
  await validateResolvedWorkspace(result);
  if (result?.state?.phase !== "active") return result;

  const jobId = result?.job?.id;
  const workspace = result?.state?.bindings?.workspace;
  if (!jobId || !workspace) {
    throw new Error("Active job must have both a canonical job id and workspace binding.");
  }

  const registration = await createWorkRegistration(jobId, workspace, () => {
    runtime.stop();
    lifecycle?.clear();
  });

  return {
    ...result,
    work_handle: getPublicWorkHandle(registration),
    idle_timeout_ms: getWorkIdleTimeoutMs(),
    next:
      "Use work_handle.execution_id + work_handle.authority_token on every execution tool call. " +
      "The work registration auto-stops after 10 minutes without valid work-handle activity.",
  };
}

export function registerJobTools(
  server: McpServer,
  runtime: JobRuntime,
  lifecycle: JobPreparationLifecycle | undefined,
  admissionRuntime: AdmissionRuntime
): void {
  let sessionRuntime = runtime;

  const pendingRemovalConfirmations = new Map<
    string,
    { jobId: string; mode: "remove" | "interrupt_remove"; createdAt: number }
  >();

  function getRemovalProof(token: string | undefined) {
    const now = Date.now();
    for (const [key, proof] of pendingRemovalConfirmations) {
      if (now - proof.createdAt > CONFIRMATION_PROOF_TTL_MS) {
        pendingRemovalConfirmations.delete(key);
      }
    }
    if (!token) return undefined;
    return pendingRemovalConfirmations.get(token);
  }

  function rememberConfirmation(
    result: any,
    admissionToken: string
  ): void {
    // A fresh nomination supersedes only proofs that belong to the same
    // admission flow. Other chats/admissions remain independent.
    for (const [key, proof] of SHARED_PENDING_CONFIRMATIONS) {
      if (proof.admissionToken === admissionToken) {
        SHARED_PENDING_CONFIRMATIONS.delete(key);
      }
    }

    const token = result?.confirmation_token;
    const jobId = result?.job?.id;
    const bindings = result?.state?.bindings;
    if (!token || !jobId || !bindings) return;

    SHARED_PENDING_CONFIRMATIONS.set(token, {
      jobId,
      bindings: { ...bindings },
      admissionToken,
      createdAt: Date.now(),
    });
  }

  function getConfirmationProof(
    token: string | undefined,
    admissionToken: string | undefined
  ) {
    const now = Date.now();
    for (const [key, proof] of SHARED_PENDING_CONFIRMATIONS) {
      if (now - proof.createdAt > CONFIRMATION_PROOF_TTL_MS) {
        SHARED_PENDING_CONFIRMATIONS.delete(key);
      }
    }

    if (!token || !admissionToken) return undefined;
    const proof = SHARED_PENDING_CONFIRMATIONS.get(token);
    if (!proof || proof.admissionToken !== admissionToken) return undefined;
    return proof;
  }

  function cancelConfirmationProof(token: string | undefined): void {
    if (!token) return;
    const proof = SHARED_PENDING_CONFIRMATIONS.get(token);
    SHARED_PENDING_CONFIRMATIONS.delete(token);
    if (proof) {
      admissionRuntime.consume(proof.admissionToken);
    }
  }

  async function bindRuntimeToWorkspace(
    bindings?: Record<string, string>,
    allowReplace = false
  ): Promise<string | undefined> {
    const rawWorkspace = bindings?.workspace;
    if (!rawWorkspace) return undefined;

    const workspace = await validateWorkspacePath(rawWorkspace);
    const status = await sessionRuntime.status();
    const phase = status?.state?.phase;
    const currentWorkspace = status?.state?.bindings?.workspace
      ? path.resolve(status.state.bindings.workspace)
      : null;

    if (phase === "idle") {
      sessionRuntime = new JobRuntime();
      return workspace;
    }

    if (currentWorkspace === workspace) return workspace;

    if (allowReplace) {
      sessionRuntime = new JobRuntime();
      return workspace;
    }

    throw new Error(
      `A different workspace is already selected in this session: ${currentWorkspace || "unknown"}. Use job_switch to change FOLDER.`
    );
  }

  server.registerTool(
    "job_list",
    {
      title: "Job List",
      description:
        "Direct target for exact gr/job list or gptworker/job list. Also list available Job Packs for bare @gptworker when activation_request is supplied. Public enumeration returns only visible Jobs; private/hidden Jobs are never exposed by Welcome, explicit Job list, suggestion ids, descriptions, or tool metadata. Hidden Jobs remain directly selectable by exact id when the user explicitly invokes one. Never route gr/job list through gptworker_control. Do not call this tool merely because an ordinary chat request resembles a Job.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe(
            "Optional user wording/keyword for suggestion scoring among public visible Jobs only"
          ),
        activation_request: z
          .string()
          .optional()
          .describe(
            "Bare @gptworker only: exact current user text containing literal @gptworker. Arms this MCP session for the following Job+Workspace continuation."
          ),
      },
      annotations: toolAnnotations("read"),
    },
    async ({ query, activation_request }) =>
      safe("job_list", async () => {
        if (activation_request) {
          const armed = admissionRuntime.armExplicitAt(activation_request);
          if (!armed) {
            throw new Error(
              "ACTIVATION_REQUIRED: activation_request for bare Job listing must contain literal @gptworker."
            );
          }
        }
        const rawResult = await sessionRuntime.list(query);
        const result = publicJobListing(rawResult);

        if (activation_request) {
          const welcomeJobs = welcomeJobsFromListing(result.jobs);
          return {
            welcome_text: buildGptworkerWelcome(
              welcomeJobs
                .filter((job) => job.source === "custom")
                .map(({ id, name, description }) => ({
                  id,
                  name,
                  description,
                }))
            ),
            at_flow_armed: admissionRuntime.isExplicitAtFlowArmed(),
          };
        }

        return result;
      })
  );


  server.registerTool(
    "job_create",
    {
      title: "Job Create",
      description:
        "Dedicated creation tool for the gr/job create or gptworker/job create authoring flow once required definition fields are known. Create a new custom Job Pack under %LOCALAPPDATA%/GPTWorker/jobs/<id>. Create from scratch with name+description, or set clone_from to clone an existing default/custom Job into a new unique custom id. Bundled repo Job ids are reserved and cannot be reused. Never route the command to gptworker_control.",
      inputSchema: {
        id: z.string().min(1),
        clone_from: z.string().min(1).optional().describe("Optional existing Job id to clone into this new custom Job"),
        name: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        version: z.string().min(1).optional(),
        status: z.enum(["ready", "placeholder"]).optional(),
        aliases: z.array(z.string()).optional(),
        keywords: z.array(z.string()).optional(),
        inputs: z.array(JobFieldDefinitionSchema).optional(),
        outputs: z.array(JobFieldDefinitionSchema).optional(),
        permissions: z.record(z.string(), z.string()).optional(),
        confirmation: JobConfirmationSchema.optional(),
        skills: z.array(z.string()).optional(),
        harness_entrypoints: z.array(z.string()).optional(),
        validators: z.array(z.string()).optional(),
        preload_families: JobPreloadFamiliesSchema,
        job_md: z.string().optional(),
        skill_md: z.string().optional(),
        files: JobFilesSchema,
      },
      annotations: toolAnnotations("edit"),
    },
    async (args) =>
      safe("job_create", () =>
        createJobPack({
          id: args.id,
          clone_from: args.clone_from,
          name: args.name,
          description: args.description,
          version: args.version,
          status: args.status,
          aliases: args.aliases,
          keywords: args.keywords,
          inputs: args.inputs,
          outputs: args.outputs,
          permissions: args.permissions,
          confirmation: args.confirmation,
          skills: args.skills,
          harness_entrypoints: args.harness_entrypoints,
          validators: args.validators,
          preload_families: args.preload_families,
          job_md: args.job_md,
          skill_md: args.skill_md,
          files: args.files,
        })
      )
  );

  server.registerTool(
    "job_update",
    {
      title: "Job Update",
      description:
        "Dedicated update tool for gr/job update or gptworker/job update once the Job id and requested changes are known. Update an existing custom AppData Job Pack through staged copy + validation + replacement. Bundled repo defaults are read-only. Never route the command to gptworker_control.",
      inputSchema: {
        id: z.string().min(1),
        name: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        version: z.string().min(1).optional(),
        status: z.enum(["ready", "placeholder"]).optional(),
        aliases: z.array(z.string()).optional(),
        keywords: z.array(z.string()).optional(),
        inputs: z.array(JobFieldDefinitionSchema).optional(),
        outputs: z.array(JobFieldDefinitionSchema).optional(),
        permissions: z.record(z.string(), z.string()).optional(),
        confirmation: JobConfirmationSchema.optional(),
        skills: z.array(z.string()).optional(),
        harness_entrypoints: z.array(z.string()).optional(),
        validators: z.array(z.string()).optional(),
        preload_families: JobPreloadFamiliesSchema,
        job_md: z.string().optional(),
        skill_md: z.string().optional(),
        files: JobFilesSchema,
        remove_files: z.array(z.string()).optional(),
      },
      annotations: toolAnnotations("edit"),
    },
    async ({ id, ...patch }) =>
      safe("job_update", () => updateJobPack(id, patch))
  );

  server.registerTool(
    "job_remove",
    {
      title: "Job Remove",
      description:
        "Dedicated removal tool for gr/job remove or gptworker/job remove. Two-phase custom Job removal. First call confirmed=false: GPTWorker verifies the Job is custom and reports whether it has active WorkRegistrations or active tool leases. After explicit user confirmation, retry with confirmed=true + confirmation_token. If the Job is active in this chat, pass its work_handle so GPTWorker can stop that owned work before removal. Work owned by another chat is never stopped implicitly. Never route the command to gptworker_control.",
      inputSchema: {
        id: z.string().min(1).describe("Exact custom Job id to remove"),
        confirmed: z.boolean().optional().default(false).describe(
          "Set true only after explicit user confirmation of the returned removal prompt"
        ),
        confirmation_token: z.string().optional().describe(
          "Token returned by the preflight job_remove call"
        ),
        execution_id: z.string().optional().describe(
          "Current chat work_handle.execution_id when this exact Job is active here"
        ),
        authority_token: z.string().optional().describe(
          "Current chat work_handle.authority_token"
        ),
      },
      annotations: toolAnnotations("edit"),
    },
    async ({
      id,
      confirmed,
      confirmation_token,
      execution_id,
      authority_token,
    }) =>
      safe("job_remove", async () => {
        let preflight = await inspectJobPackForRemoval(id);

        if (!confirmed) {
          const mode =
            preflight.active_tool_count > 0
              ? "interrupt_remove"
              : "remove";
          const token = randomUUID();
          pendingRemovalConfirmations.set(token, {
            jobId: preflight.job_id,
            mode,
            createdAt: Date.now(),
          });

          const confirmationPrompt =
            preflight.active_tool_count > 0
              ? "Custom Job '" +
                preflight.job_id +
                "' đang làm việc (" +
                preflight.active_tool_count +
                " tool call đang chạy). Xác nhận ngắt Job và remove?"
              : preflight.active_work_count > 0
                ? "Custom Job '" +
                  preflight.job_id +
                  "' đang active nhưng hiện không có tool call đang chạy. Xác nhận job stop rồi remove?"
                : "Xóa custom Job '" +
                  preflight.job_id +
                  "' khỏi AppData?";

          return {
            ...preflight,
            removal_pending: true,
            confirmation_required: true,
            confirmation_mode: mode,
            confirmation_token: token,
            confirmation_prompt: confirmationPrompt,
          };
        }

        const proof = getRemovalProof(confirmation_token);
        if (!proof || proof.jobId !== preflight.job_id) {
          throw new Error(
            "Removal confirmation missing/stale. Call job_remove with confirmed=false first, show its exact prompt, then retry after explicit user confirmation."
          );
        }

        if (
          preflight.active_tool_count > 0 &&
          proof.mode !== "interrupt_remove"
        ) {
          const token = randomUUID();
          pendingRemovalConfirmations.delete(confirmation_token!);
          pendingRemovalConfirmations.set(token, {
            jobId: preflight.job_id,
            mode: "interrupt_remove",
            createdAt: Date.now(),
          });
          return {
            ...preflight,
            removal_pending: true,
            confirmation_required: true,
            confirmation_mode: "interrupt_remove",
            confirmation_token: token,
            confirmation_prompt:
              "Custom Job '" +
              preflight.job_id +
              "' bắt đầu làm việc sau lần xác nhận trước (" +
              preflight.active_tool_count +
              " tool call đang chạy). Xác nhận ngắt Job và remove?",
          };
        }

        if (preflight.active_work_count > 0) {
          if (!execution_id || !authority_token) {
            throw new Error(
              "JOB_ACTIVE: custom Job '" +
                preflight.job_id +
                "' still has active work. To interrupt/remove it, supply the current chat's matching work_handle after the user confirms. Work from another chat cannot be stopped implicitly."
            );
          }

          const work = validateWorkHandle(execution_id, authority_token);
          if (work.jobId !== preflight.job_id) {
            throw new Error(
              "JOB_ACTIVE: supplied work_handle belongs to Job '" +
                work.jobId +
                "', not '" +
                preflight.job_id +
                "'."
            );
          }

          releaseWorkRegistration(execution_id, authority_token);
          sessionRuntime.stop();
             preflight = await inspectJobPackForRemoval(id);

          if (preflight.active_work_count > 0) {
            throw new Error(
              "JOB_ACTIVE: another WorkRegistration still owns custom Job '" +
                preflight.job_id +
                "'. GPTWorker stopped only the confirmed work_handle; another chat must stop its own work or wait for the 10-minute idle timeout."
            );
          }
        }

        pendingRemovalConfirmations.delete(confirmation_token!);
        return removeJobPack(id);
      })
  );

  server.registerTool(
    "job_export",
    {
      title: "Job Export",
      description:
        "Dedicated export tool for gr/job export or gptworker/job export once id/destination are known. Export one custom AppData Job Pack as <id>.zip into an existing absolute local destination directory. Bundled repo Jobs cannot be exported. Never route the command to gptworker_control.",
      inputSchema: {
        id: z.string().min(1).describe("Exact custom Job id to export"),
        destination: z
          .string()
          .min(1)
          .describe("Absolute local destination directory for <id>.zip"),
      },
      annotations: toolAnnotations("edit"),
    },
    async ({ id, destination }) =>
      safe("job_export", () => exportJobPack(id, destination))
  );

  server.registerTool(
    "job_import",
    {
      title: "Job Import",
      description:
        "Dedicated import tool for gr/job import or gptworker/job import once source is known. Import one custom Job Pack ZIP into AppData. Source must be an absolute local .zip path or an absolute directory containing exactly one .zip. Import validates first and never overwrites existing/default Jobs. Never route the command to gptworker_control.",
      inputSchema: {
        source: z
          .string()
          .min(1)
          .describe("Absolute local .zip path or absolute directory containing exactly one Job ZIP"),
      },
      annotations: toolAnnotations("edit"),
    },
    async ({ source }) => safe("job_import", () => importJobPack(source))
  );

  server.registerTool(
    "job_status",
    {
      title: "Job Status",
      description:
        "Show active work only when the caller supplies its current work_handle. Without a work_handle, report idle/unemployed and never reuse the last Job or Workspace from another chat. Do not use job_status as a reason to activate GPTWorker in an otherwise ordinary chat.",
      inputSchema: {
        execution_id: z.string().optional().describe("Current work_handle.execution_id, if this chat has active work"),
        authority_token: z.string().optional().describe("Current work_handle.authority_token"),
      },
      annotations: toolAnnotations("read"),
    },
    async ({ execution_id, authority_token }) =>
      safe("job_status", async () => {
        if (!execution_id && !authority_token) {
          return {
            state: { phase: "idle", bindings: {} },
            active_job: null,
            active_work: null,
            idle_timeout_ms: getWorkIdleTimeoutMs(),
            note:
              "No work_handle supplied. This chat is unemployed until Job + Workspace are explicitly registered.",
          };
        }
        if (!execution_id || !authority_token) {
          throw new Error(
            "NO_ACTIVE_WORK: both execution_id and authority_token are required to inspect active work."
          );
        }
        const work = validateWorkHandle(execution_id, authority_token);
        return {
          ...(await sessionRuntime.status()),
          active_work: {
            execution_id: work.executionId,
            job_id: work.jobId,
            workspace: work.workspace,
            workspace_key: work.workspaceKey,
            driver_epoch: work.driverEpoch,
            generation: work.generation,
            last_activity_at: work.lastActivityAt,
          },
          idle_timeout_ms: getWorkIdleTimeoutMs(),
        };
      })
  );

  server.registerTool(
    "job_select",
    {
      title: "Job Select",
      description:
        "Select/configure/activate one Job Pack only after gptworker_admission returned ACTIVE. Requires its admission_token; direct entry without the handshake is rejected. Two-phase by default: nominate first, show confirmation, then activate only after explicit user confirmation. ACTIVE response returns work_handle; carry it to every execution tool call.",
      inputSchema: {
        job: z
          .string()
          .min(1)
          .describe("Exact job id/name/alias. /job <id> should map here."),
        bindings: BindingsSchema.optional().describe(
          "Concrete input/output values keyed by the selected job's job.yaml fields. workspace must be the absolute local folder being opened for this task."
        ),
        confirmed: z
          .boolean()
          .optional()
          .default(false)
          .describe("Set true only after explicit user confirmation"),
        admission_token: z
          .string()
          .min(1)
          .describe(
            "Opaque ACTIVE token returned by gptworker_admission. Required before Job nomination/activation."
          ),
        confirmation_token: z
          .string()
          .optional()
          .describe(
            "Token returned by the prior awaiting_confirmation response"
          ),
      },
      annotations: toolAnnotations("edit"),
    },
    async ({
      job,
      bindings,
      confirmed,
      admission_token,
      confirmation_token,
    }) =>
      safe("job_select", async () => {
        admissionRuntime.activation(admission_token, bindings);
        const validatedWorkspace = await bindRuntimeToWorkspace(bindings);
        if (validatedWorkspace) {
          admissionRuntime.bindWorkspace(admission_token, validatedWorkspace);
        }

        if (!confirmed) {
          const current = await sessionRuntime.status();
          let selected: any;

          if (
            current?.state?.phase === "awaiting_confirmation" &&
            current?.job?.id &&
            current.job.id !== job
          ) {
            lifecycle?.clear();
            const switched = await sessionRuntime.switch(job, bindings);
            selected = switched.current;
          } else {
            selected = await sessionRuntime.select({
              job,
              bindings,
              confirmed: false,
            });
          }

          rememberConfirmation(selected, admission_token);
          await validateResolvedWorkspace(selected);

          if (
            selected?.state?.phase === "awaiting_confirmation" &&
            selected?.job?.id
          ) {
            lifecycle?.nominate({
              id: selected.job.id,
              preload_families: selected.job.preload_families ?? [],
            });
            return {
              ...(await persistActiveSelection(selected, sessionRuntime, lifecycle)),
              tool_preload: {
                status: "warming",
                job_id: selected.job.id,
                families: selected.job.preload_families ?? [],
                note:
                  "Tool profile is preloading in the background while waiting for user confirmation.",
              },
            };
          }

          const prepared = await persistActiveSelection(
            selected,
            sessionRuntime,
            lifecycle
          );
          if ((prepared as any)?.work_handle) {
            admissionRuntime.consume(admission_token);
          }
          return prepared;
        }

        const proof = getConfirmationProof(confirmation_token, admission_token);
        if (!proof) {
          throw new Error(
            "Confirmation token missing/stale. Run job_select with confirmed=false, show the returned prompt, then retry after explicit user confirmation."
          );
        }

        if (!confirmationBindingsCompatible(bindings, proof.bindings)) {
          throw new Error(
            "Confirmation token is bound to different Job/Workspace bindings. Request a new confirmation before activation."
          );
        }

        const confirmedJob = proof.jobId;
        const confirmedBindings = proof.bindings;
        const status = await sessionRuntime.status();
        let activationToken = confirmation_token;
        const samePendingState =
          status?.state?.phase === "awaiting_confirmation" &&
          status?.state?.confirmation_token === confirmation_token;

        if (!samePendingState) {
          const primed = await sessionRuntime.select({
            job: confirmedJob,
            bindings: confirmedBindings,
            confirmed: false,
          });
          if (
            primed?.job?.id !== proof.jobId ||
            stableBindings(primed?.state?.bindings) !== stableBindings(proof.bindings)
          ) {
            throw new Error(
              "Confirmation token is bound to different Job/Workspace bindings. Request a new confirmation before activation."
            );
          }
          activationToken =
            (primed as any).confirmation_token || primed?.state?.confirmation_token;
        } else if (
          status?.job?.id !== proof.jobId ||
          stableBindings(status?.state?.bindings) !== stableBindings(proof.bindings)
        ) {
          throw new Error(
            "Confirmation token is bound to different Job/Workspace bindings. Request a new confirmation before activation."
          );
        }

        await lifecycle?.wait(proof.jobId);

        const confirmedWorkspace = proof.bindings.workspace;
        if (!confirmedWorkspace) {
          throw new Error(
            "Confirmed Job activation requires a Workspace binding."
          );
        }

        // Reserve execution authority before mutating JobRuntime to active.
        // If the Workspace is busy, the runtime remains awaiting_confirmation
        // and the user's confirmation proof remains retryable.
        const activationRuntime = sessionRuntime;
        const registration = await createWorkRegistration(
          proof.jobId,
          confirmedWorkspace,
          () => {
            activationRuntime.stop();
            lifecycle?.clear();
          }
        );

        let selected: any;
        try {
          selected = await activationRuntime.select({
            job: confirmedJob,
            bindings: confirmedBindings,
            confirmed: true,
            confirmationToken: activationToken,
          });
          await validateResolvedWorkspace(selected);
        } catch (error) {
          releaseWorkRegistration(
            registration.executionId,
            registration.authorityToken
          );
          throw error;
        }

        SHARED_PENDING_CONFIRMATIONS.delete(confirmation_token!);
        admissionRuntime.consume(admission_token);

        return {
          ...selected,
          work_handle: getPublicWorkHandle(registration),
          idle_timeout_ms: getWorkIdleTimeoutMs(),
          next:
            "Use work_handle.execution_id + work_handle.authority_token on every execution tool call. " +
            "The work registration auto-stops after 10 minutes without valid work-handle activity.",
        };
      })
  );

  server.registerTool(
    "job_switch",
    {
      title: "Job Switch",
      description:
        "Clear current session/persistent job state, then select a different Job Pack or FOLDER. Jobs that require confirmation still wait for explicit confirmation; no-confirm Jobs may activate immediately and must return a fresh work_handle.",
      inputSchema: {
        job: z.string().min(1),
        bindings: BindingsSchema.optional(),
        execution_id: z.string().optional().describe("Current work execution id, if an active registration exists"),
        authority_token: z.string().optional().describe("Current work authority token"),
        admission_token: z.string().optional().describe(
          "ACTIVE token from gptworker_admission; required when switching before an active work_handle exists"
        ),
      },
      annotations: toolAnnotations("edit"),
    },
    async ({ job, bindings, execution_id, authority_token, admission_token }) =>
      safe("job_switch", async () => {
        const isPreActiveSwitch = !execution_id && !authority_token;
        if (isPreActiveSwitch) {
          admissionRuntime.activation(admission_token, bindings);
        }

        let activeHandle:
          | { executionId: string; authorityToken: string }
          | undefined;
        if (execution_id || authority_token) {
          if (!execution_id || !authority_token) {
            throw new Error(
              "Both execution_id and authority_token are required to release the current work registration."
            );
          }

          const current = validateWorkHandle(execution_id, authority_token);
          activeHandle = {
            executionId: current.executionId,
            authorityToken: current.authorityToken,
          };
        }

        // Preflight a replacement Workspace before releasing current work.
        // A typo/nonexistent path must leave the existing work_handle intact.
        if (bindings?.workspace) {
          await validateWorkspacePath(bindings.workspace);
        }

        if (activeHandle) {
          releaseWorkRegistration(
            activeHandle.executionId,
            activeHandle.authorityToken
          );
        }

        const persistentState = await clearWorkerState();
        const validatedWorkspace = await bindRuntimeToWorkspace(bindings, true);
        if (isPreActiveSwitch && validatedWorkspace) {
          admissionRuntime.bindWorkspace(admission_token, validatedWorkspace);
        }

        lifecycle?.clear();
        const selected = await sessionRuntime.switch(job, bindings);
        if (admission_token) {
          rememberConfirmation(selected?.current, admission_token);
        }
        await validateResolvedWorkspace(selected?.current);

        const current = await persistActiveSelection(
          selected?.current,
          sessionRuntime,
          lifecycle
        );

        if (
          current?.state?.phase === "awaiting_confirmation" &&
          current?.job?.id
        ) {
          lifecycle?.nominate({
            id: current.job.id,
            preload_families: current.job.preload_families ?? [],
          });
        }

        if (isPreActiveSwitch && (current as any)?.work_handle) {
          admissionRuntime.consume(admission_token);
        }

        return {
          ...selected,
          current,
          worker_state: persistentState,
          tool_preload:
            current?.state?.phase === "awaiting_confirmation"
              ? {
                  status: "warming",
                  job_id: current.job.id,
                  families: current.job.preload_families ?? [],
                }
              : undefined,
        };
      })
  );

  server.registerTool(
    "job_stop",
    {
      title: "Job Stop",
      description:
        "Direct target for exact gr/job stop or gptworker/job stop, and contextual shortcut 8 immediately after the root command menu. Stop this MCP session and return it to idle. Pending/selected state can be cancelled without a work_handle. Active work requires this chat's current work_handle; never infer or stop another chat's Job/Workspace. Orphaned active work auto-stops after 10 minutes idle. NEVER route job stop through gptworker_control.",
      inputSchema: {
        execution_id: z.string().optional().describe("Current work_handle.execution_id"),
        authority_token: z.string().optional().describe("Current work_handle.authority_token"),
      },
      annotations: toolAnnotations("edit"),
    },
    async ({ execution_id, authority_token }) =>
      safe("job_stop", async () => {
        const hasAnyHandlePart = Boolean(execution_id || authority_token);

        if (hasAnyHandlePart) {
          if (!execution_id || !authority_token) {
            throw new Error(
              "Both execution_id and authority_token are required to stop active work."
            );
          }

          const released = releaseWorkRegistration(
            execution_id,
            authority_token
          );
          const stopped = sessionRuntime.stop();
          lifecycle?.clear();
          admissionRuntime.clear();
          pendingRemovalConfirmations.clear();

          return {
            ...stopped,
            released_work: {
              execution_id: released.executionId,
              job_id: released.jobId,
              workspace_key: released.workspaceKey,
            },
            worker_state: await clearWorkerState(),
          };
        }

        const status = await sessionRuntime.status();
        if (status?.state?.phase === "active") {
          throw new Error(
            "NO_ACTIVE_WORK: active work can be stopped only with this chat's execution_id + authority_token. " +
            "A new chat cannot stop another chat's work; orphaned work auto-stops after 10 minutes idle."
          );
        }

        // Pending/selected/idle state has no work registration. If this state
        // owns a confirmation proof, cancel exactly that proof/admission flow;
        // never clear authority belonging to another concurrent chat.
        cancelConfirmationProof(status?.state?.confirmation_token);

        const stopped = sessionRuntime.stop();
        lifecycle?.clear();
        admissionRuntime.clear();
        pendingRemovalConfirmations.clear();

        return {
          ...stopped,
          released_work: null,
          worker_state: {
            unchanged: true,
            reason: "No active work registration was released.",
          },
        };
      })
  );
}

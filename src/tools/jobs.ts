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
import { clearWorkerState } from "../lib/worker-state.js";
import { validateActivationGate } from "../lib/activation-policy.js";
import { toolAnnotations } from "../lib/tool-annotations.js";
import { toolError, toolResult } from "../lib/tool-result.js";
import {
  createWorkRegistration,
  getPublicWorkHandle,
  getWorkIdleTimeoutMs,
  releaseWorkRegistration,
  validateWorkHandle,
} from "../lib/work-registration.js";

const BindingsSchema = z.record(z.string(), z.string());
const ActivationTriggerSchema = z.enum(["explicit_gptworker", "task_with_workspace"]);

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

const JobFilesSchema = z
  .record(z.string(), z.string())
  .optional()
  .describe("Additional pack files keyed by relative path, e.g. skills/foo.md or harness/validate.mjs");

const CONFIRMATION_PROOF_TTL_MS = 30 * 60 * 1000;
const pendingConfirmations = new Map<
  string,
  { jobId: string; bindings: Record<string, string>; createdAt: number }
>();

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

function stableBindings(bindings: Record<string, string> | undefined): string {
  return JSON.stringify(
    Object.fromEntries(Object.entries(bindings || {}).sort(([a], [b]) => a.localeCompare(b)))
  );
}

function rememberConfirmation(result: any): void {
  const token = result?.confirmation_token;
  const jobId = result?.job?.id;
  const bindings = result?.state?.bindings;
  if (!token || !jobId || !bindings) return;
  pendingConfirmations.set(token, { jobId, bindings: { ...bindings }, createdAt: Date.now() });
}

function getConfirmationProof(token: string | undefined) {
  const now = Date.now();
  for (const [key, proof] of pendingConfirmations) {
    if (now - proof.createdAt > CONFIRMATION_PROOF_TTL_MS) pendingConfirmations.delete(key);
  }
  if (!token) return undefined;
  return pendingConfirmations.get(token);
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

async function persistActiveSelection(result: any, runtime: JobRuntime) {
  await validateResolvedWorkspace(result);
  if (result?.state?.phase !== "active") return result;

  const jobId = result?.job?.id;
  const workspace = result?.state?.bindings?.workspace;
  if (!jobId || !workspace) {
    throw new Error("Active job must have both a canonical job id and workspace binding.");
  }

  const registration = await createWorkRegistration(jobId, workspace, () => {
    runtime.stop();
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
  runtime: JobRuntime
): void {
  let sessionRuntime = runtime;

  async function bindRuntimeToWorkspace(
    bindings?: Record<string, string>,
    allowReplace = false
  ): Promise<void> {
    const rawWorkspace = bindings?.workspace;
    if (!rawWorkspace) return;

    const workspace = await validateWorkspacePath(rawWorkspace);
    const status = await sessionRuntime.status();
    const phase = status?.state?.phase;
    const currentWorkspace = status?.state?.bindings?.workspace
      ? path.resolve(status.state.bindings.workspace)
      : null;

    if (phase === "idle") {
      sessionRuntime = new JobRuntime(workspace);
      return;
    }

    if (currentWorkspace === workspace) return;

    if (allowReplace) {
      sessionRuntime = new JobRuntime(workspace);
      return;
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
        "List available Job Packs. Optional query only suggests matches; it never selects or runs a job.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe(
            "Optional user wording/keyword such as 'takeoff MTO' or 'repo lisp' for suggestion scoring only"
          ),
      },
      annotations: toolAnnotations("read"),
    },
    async ({ query }) => safe("job_list", () => sessionRuntime.list(query))
  );


  server.registerTool(
    "job_create",
    {
      title: "Job Create",
      description:
        "Create a new custom Job Pack under %LOCALAPPDATA%/GPTWorker/jobs/<id>. Create from scratch with name+description, or set clone_from to clone an existing default/custom Job into a new unique custom id. Bundled repo Job ids are reserved and cannot be reused.",
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
        "Update an existing custom AppData Job Pack through staged copy + validation + replacement. Bundled repo defaults are read-only.",
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
        "Two-phase custom Job removal. First call confirmed=false: GPTWorker verifies the Job is custom and reports whether it has active WorkRegistrations or active tool leases. After explicit user confirmation, retry with confirmed=true + confirmation_token. If the Job is active in this chat, pass its work_handle so GPTWorker can stop that owned work before removal. Work owned by another chat is never stopped implicitly.",
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
        "Export one custom AppData Job Pack as <id>.zip into an existing absolute local destination directory. Bundled repo Jobs cannot be exported.",
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
        "Import one custom Job Pack ZIP into AppData. Source must be an absolute local .zip path or an absolute directory containing exactly one .zip. Import validates first and never overwrites existing/default Jobs.",
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
        "Show active work only when the caller supplies its current work_handle. Without a work_handle, report idle/unemployed and never reuse the last Job or Workspace from another chat.",
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
        "Select/configure/activate one Job Pack only after the GPTWorker activation gate passes. Valid triggers: (1) the user explicitly invoked @gptworker in this chat, or (2) the activating user request itself included both a concrete task and an explicit absolute local workspace path. Never use memory, another chat, a recent workspace, project familiarity, or GPTWorker availability as activation evidence. Two-phase by default: show confirmation first; only activate after explicit user confirmation. ACTIVE response returns work_handle; carry it to every execution tool call.",
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
        activation_trigger: ActivationTriggerSchema.describe(
          "Required activation evidence. Use explicit_gptworker only when the user explicitly invoked @gptworker in this chat. Use task_with_workspace only when the activating user request itself contains both the concrete task and an explicit absolute local workspace path."
        ),
        activation_workspace: z
          .string()
          .optional()
          .describe(
            "For task_with_workspace only: the exact absolute local workspace supplied by the user in the activating request. Must match bindings.workspace."
          ),
        activation_request: z
          .string()
          .optional()
          .describe(
            "For task_with_workspace only: the concrete work request from the activating user message. Do not synthesize this from memory or a previous chat."
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
      activation_trigger,
      activation_workspace,
      activation_request,
      confirmation_token,
    }) =>
      safe("job_select", async () => {
        validateActivationGate({
          trigger: activation_trigger,
          activationWorkspace: activation_workspace,
          activationRequest: activation_request,
          bindings,
        });
        await bindRuntimeToWorkspace(bindings);

        if (!confirmed) {
          const selected = await sessionRuntime.select({
            job,
            bindings,
            confirmed: false,
          });
          rememberConfirmation(selected);
          await validateResolvedWorkspace(selected);
          return persistActiveSelection(selected, sessionRuntime);
        }

        const proof = getConfirmationProof(confirmation_token);
        if (!proof) {
          throw new Error(
            "Confirmation token missing/stale. Run job_select with confirmed=false, show the returned prompt, then retry after explicit user confirmation."
          );
        }

        const status = await sessionRuntime.status();
        let activationToken = confirmation_token;
        const samePendingState =
          status?.state?.phase === "awaiting_confirmation" &&
          status?.state?.confirmation_token === confirmation_token;

        if (!samePendingState) {
          const primed = await sessionRuntime.select({
            job,
            bindings,
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

        const selected = await sessionRuntime.select({
          job,
          bindings,
          confirmed: true,
          confirmationToken: activationToken,
        });
        pendingConfirmations.delete(confirmation_token!);
        await validateResolvedWorkspace(selected);
        return persistActiveSelection(selected, sessionRuntime);
      })
  );

  server.registerTool(
    "job_switch",
    {
      title: "Job Switch",
      description:
        "Clear current session/persistent job state, then select a different Job Pack or FOLDER. The replacement must still be explicitly confirmed before activation.",
      inputSchema: {
        job: z.string().min(1),
        bindings: BindingsSchema.optional(),
        execution_id: z.string().optional().describe("Current work execution id, if an active registration exists"),
        authority_token: z.string().optional().describe("Current work authority token"),
      },
      annotations: toolAnnotations("edit"),
    },
    async ({ job, bindings, execution_id, authority_token }) =>
      safe("job_switch", async () => {
        if (execution_id || authority_token) {
          if (!execution_id || !authority_token) {
            throw new Error("Both execution_id and authority_token are required to release the current work registration.");
          }
          releaseWorkRegistration(execution_id, authority_token);
        }
        const persistentState = await clearWorkerState();
        await bindRuntimeToWorkspace(bindings, true);
        const selected = await sessionRuntime.switch(job, bindings);
        rememberConfirmation(selected?.current);
        await validateResolvedWorkspace(selected?.current);
        return { ...selected, worker_state: persistentState };
      })
  );

  server.registerTool(
    "job_stop",
    {
      title: "Job Stop",
      description:
        "Stop this chat's active work. Always pass the current work_handle. Never infer or stop the most recent Job/Workspace from another chat. Orphaned work auto-stops after 10 minutes idle.",
      inputSchema: {
        execution_id: z.string().optional().describe("Current work_handle.execution_id"),
        authority_token: z.string().optional().describe("Current work_handle.authority_token"),
      },
      annotations: toolAnnotations("edit"),
    },
    async ({ execution_id, authority_token }) =>
      safe("job_stop", async () => {
        if (!execution_id || !authority_token) {
          throw new Error(
            "NO_ACTIVE_WORK: job_stop requires this chat's execution_id + authority_token. " +
            "A new chat cannot stop another chat's work; orphaned work auto-stops after 10 minutes idle."
          );
        }
        const released = releaseWorkRegistration(execution_id, authority_token);
        return {
          ...sessionRuntime.stop(),
          released_work: {
            execution_id: released.executionId,
            job_id: released.jobId,
            workspace_key: released.workspaceKey,
          },
          worker_state: await clearWorkerState(),
        };
      })
  );
}

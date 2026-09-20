import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { JobRuntime } from "../jobs/job-runtime.js";
import { setDefaultCwd } from "../lib/path-security.js";
import { resetShellSession } from "../lib/persistent-shell.js";
import {
  clearWorkerState,
  readWorkerState,
  writeWorkerState,
} from "../lib/worker-state.js";
import { toolAnnotations } from "../lib/tool-annotations.js";
import { toolError, toolResult } from "../lib/tool-result.js";
import {
  createWorkRegistration,
  getPublicWorkHandle,
  releaseWorkRegistration,
} from "../lib/work-registration.js";

const BindingsSchema = z.record(z.string(), z.string());

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

async function persistActiveSelection(result: any) {
  await validateResolvedWorkspace(result);
  if (result?.state?.phase !== "active") return result;

  const jobId = result?.job?.id;
  const workspace = result?.state?.bindings?.workspace;
  if (!jobId || !workspace) {
    throw new Error("Active job must have both a canonical job id and workspace binding.");
  }

  const registration = await createWorkRegistration(jobId, workspace);
  setDefaultCwd(workspace);
  resetShellSession(workspace);
  const persistentState = await writeWorkerState(jobId, workspace);
  return {
    ...result,
    worker_state: persistentState,
    work_handle: getPublicWorkHandle(registration),
    next:
      "Use work_handle.execution_id + work_handle.authority_token on every execution tool call. " +
      "Do not re-select the Job unless this work handle becomes invalid.",
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
    "job_status",
    {
      title: "Job Status",
      description:
        "Show current session job state plus the last confirmed persistent worker-state.json context. Persistent state is context only; a new task still requires JOB/FOLDER confirmation.",
      inputSchema: {},
      annotations: toolAnnotations("read"),
    },
    async () =>
      safe("job_status", async () => ({
        ...(await sessionRuntime.status()),
        worker_state: await readWorkerState(),
      }))
  );

  server.registerTool(
    "job_select",
    {
      title: "Job Select",
      description:
        "Select/configure/activate one Job Pack. Resolve JOB + absolute local workspace folder first. Two-phase by default: show confirmation first; only activate after explicit user confirmation. ACTIVE response returns work_handle; carry it to every execution tool call.",
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
        confirmation_token: z
          .string()
          .optional()
          .describe(
            "Token returned by the prior awaiting_confirmation response"
          ),
      },
      annotations: toolAnnotations("edit"),
    },
    async ({ job, bindings, confirmed, confirmation_token }) =>
      safe("job_select", async () => {
        await bindRuntimeToWorkspace(bindings);
        const selected = await sessionRuntime.select({
          job,
          bindings,
          confirmed,
          confirmationToken: confirmation_token,
        });
        await validateResolvedWorkspace(selected);
        return persistActiveSelection(selected);
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
        await validateResolvedWorkspace(selected?.current);
        return { ...selected, worker_state: persistentState };
      })
  );

  server.registerTool(
    "job_stop",
    {
      title: "Job Stop",
      description:
        "Stop the current job, release its Job + Workspace work registration, and clear worker-state.json.",
      inputSchema: {
        execution_id: z.string().min(1).describe("Current work_handle.execution_id"),
        authority_token: z.string().min(1).describe("Current work_handle.authority_token"),
      },
      annotations: toolAnnotations("edit"),
    },
    async ({ execution_id, authority_token }) =>
      safe("job_stop", async () => {
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

import fs from "fs/promises";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JobRuntime } from "../jobs/job-runtime.js";
import { setDefaultCwd } from "../lib/path-security.js";
import { resetShellSession } from "../lib/persistent-shell.js";
import {
  clearWorkerState,
  readWorkerState,
  writeWorkerState,
} from "../lib/worker-state.js";
import { toolAnnotations } from "../lib/tool-annotations.js";
import { toolError, toolResult } from "../lib/tool-result.js";

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

async function validateResolvedWorkspace(result: any): Promise<void> {
  const workspace = result?.state?.bindings?.workspace;
  if (!workspace) return;
  const stat = await fs.stat(workspace).catch(() => null);
  if (!stat?.isDirectory()) {
    throw new Error(`Workspace folder does not exist or is not a directory: ${workspace}`);
  }
}

async function persistActiveSelection(result: any) {
  await validateResolvedWorkspace(result);
  if (result?.state?.phase !== "active") return result;

  const jobId = result?.job?.id;
  const workspace = result?.state?.bindings?.workspace;
  if (!jobId || !workspace) {
    throw new Error("Active job must have both a canonical job id and workspace binding.");
  }

  setDefaultCwd(workspace);
  resetShellSession(workspace);
  const persistentState = await writeWorkerState(jobId, workspace);
  return { ...result, worker_state: persistentState };
}

export function registerJobTools(
  server: McpServer,
  runtime: JobRuntime
): void {
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
    async ({ query }) => safe("job_list", () => runtime.list(query))
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
        ...(await runtime.status()),
        worker_state: await readWorkerState(),
      }))
  );

  server.registerTool(
    "job_select",
    {
      title: "Job Select",
      description:
        "Select/configure/activate one Job Pack. Resolve JOB + local workspace folder first. Two-phase by default: show confirmation first; only activate after explicit user confirmation.",
      inputSchema: {
        job: z
          .string()
          .min(1)
          .describe("Exact job id/name/alias. /job <id> should map here."),
        bindings: BindingsSchema.optional().describe(
          "Concrete input/output values keyed by the selected job's job.yaml fields. workspace must be the local folder being opened for this task."
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
        const selected = await runtime.select({
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
        "Clear session job state, then select a different Job Pack. The new job/folder must still be explicitly confirmed before activation.",
      inputSchema: {
        job: z.string().min(1),
        bindings: BindingsSchema.optional(),
      },
      annotations: toolAnnotations("edit"),
    },
    async ({ job, bindings }) =>
      safe("job_switch", async () => {
        const selected = await runtime.switch(job, bindings);
        await validateResolvedWorkspace(selected?.current);
        return { ...selected, worker_state: await readWorkerState() };
      })
  );

  server.registerTool(
    "job_stop",
    {
      title: "Job Stop",
      description:
        "Stop the current job and clear worker-state.json so no job/workspace remains active.",
      inputSchema: {},
      annotations: toolAnnotations("edit"),
    },
    async () =>
      safe("job_stop", async () => ({
        ...runtime.stop(),
        worker_state: await clearWorkerState(),
      }))
  );
}

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JobRuntime } from "../jobs/job-runtime.js";
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
        "Show current per-session job state. Harness paths are exposed only after activation.",
      inputSchema: {},
      annotations: toolAnnotations("read"),
    },
    async () => safe("job_status", () => runtime.status())
  );

  server.registerTool(
    "job_select",
    {
      title: "Job Select",
      description:
        "Select/configure/activate one Job Pack. Two-phase by default: resolve concrete bindings first, then after the user confirms call again with confirmed=true and the confirmation token.",
      inputSchema: {
        job: z
          .string()
          .min(1)
          .describe("Exact job id/name/alias. /job <id> should map here."),
        bindings: BindingsSchema.optional().describe(
          "Concrete input/output values keyed by the selected job's job.yaml fields"
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
      safe("job_select", () =>
        runtime.select({
          job,
          bindings,
          confirmed,
          confirmationToken: confirmation_token,
        })
      )
  );

  server.registerTool(
    "job_switch",
    {
      title: "Job Switch",
      description:
        "Clear all previous job-specific state, then select a different Job Pack. The new job is not auto-confirmed.",
      inputSchema: {
        job: z.string().min(1),
        bindings: BindingsSchema.optional(),
      },
      annotations: toolAnnotations("edit"),
    },
    async ({ job, bindings }) =>
      safe("job_switch", () => runtime.switch(job, bindings))
  );

  server.registerTool(
    "job_stop",
    {
      title: "Job Stop",
      description:
        "Stop the current job and clear all job-specific state so its rules cannot leak into the next job.",
      inputSchema: {},
      annotations: toolAnnotations("edit"),
    },
    async () => safe("job_stop", () => runtime.stop())
  );
}

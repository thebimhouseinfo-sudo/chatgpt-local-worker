import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AdmissionRuntime } from "../lib/activation-policy.js";
import { toolAnnotations } from "../lib/tool-annotations.js";
import { toolResult } from "../lib/tool-result.js";

export function registerAdmissionTool(
  server: McpServer,
  admissionRuntime: AdmissionRuntime
): void {
  server.registerTool(
    "gptworker_admission",
    {
      title: "GPTWorker Admission",
      description:
        "Internal non-user-facing admission handshake for GPTWorker work. GPTWorker work activation is @-flow-only: ACTIVE when the exact current user turn literally contains @gptworker, or when a prior bare @gptworker armed this same MCP session and the current continuation supplies the absolute local Workspace (task details may still be incomplete). A fresh task plus local path in an unarmed session is always INACTIVE. CONTROL is for explicit gptworker/ commands. INACTIVE means GPTWorker must stop immediately; do not nominate a Job, do not inspect the workspace, and continue as normal ChatGPT or use the plugin/tool the user actually requested.",
      inputSchema: {
        user_turn: z
          .string()
          .min(1)
          .describe("Exact current user message being handled; do not synthesize or reconstruct it"),
        has_concrete_task: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            "Context only. Task details may be incomplete during an armed-flow continuation; missing Job inputs are collected later by the Job runtime. It never activates a fresh/unarmed session."
          ),
        workspace: z
          .string()
          .optional()
          .describe(
            "For an armed-flow continuation, pass the exact absolute local Workspace from the current reply. It never activates a fresh/unarmed session."
          ),
      },
      annotations: toolAnnotations("read"),
    },
    async ({ user_turn, has_concrete_task, workspace }) => {
      const decision = admissionRuntime.check({
        userTurn: user_turn,
        hasConcreteTask: has_concrete_task,
        workspace,
      });

      return toolResult("gptworker_admission", {
        internal_control_signal: true,
        render_to_user: false,
        ...decision,
        instruction:
          decision.mode === "INACTIVE"
            ? "STOP GPTWorker. Do not call any GPTWorker discovery/job/work tool. Continue the response as ordinary ChatGPT, or use another plugin/tool if that is what the user requested."
            : decision.mode === "CONTROL"
              ? "Handle only the explicit GPTWorker control command. Do not activate a Job unless the user separately starts work."
              : "GPTWorker is admitted for this conversation flow. Carry admission_token into pre-confirmation discovery and Job nomination.",
      });
    }
  );
}

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
        "Internal non-user-facing admission handshake for a concrete GPTWorker work request that is ready for nomination. Do NOT call this for a bare @gptworker/plugin invocation or when task/Workspace information is still missing; answer those cases directly in chat. Pass the exact current user turn. ACTIVE only when that turn literally contains @gptworker, or when ChatGPT identifies a concrete work request and the exact absolute local Workspace appears in that same turn. CONTROL is for explicit gptworker/ commands. INACTIVE means GPTWorker must stop immediately; do not ask the user to activate GPTWorker, do not nominate a Job, and continue as normal ChatGPT or use the plugin/tool the user actually requested.",
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
            "Semantic check by ChatGPT: true only when the current user turn contains a concrete work request"
          ),
        workspace: z
          .string()
          .optional()
          .describe(
            "Exact absolute local Workspace path from the current user turn, when one is present"
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

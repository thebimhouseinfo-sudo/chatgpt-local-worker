import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toolAnnotations } from "../lib/tool-annotations.js";
import {
  GPTWORKER_HELP,
  GPTWORKER_ROOT_MENU,
} from "../lib/quickstart.js";

export function registerGptworkerControlTool(server: McpServer): void {
  server.registerTool(
    "gptworker_control",
    {
      title: "GPTWorker Static Control",
      description:
        "Ultra-light static control surface. Call exactly once for gr/ or gptworker/ (surface=commands) or gr/help or gptworker/help (surface=help), including their immediate contextual shortcuts. No Job scan, admission, filesystem, workspace, runtime loading, or state changes. Return the tool text to the user verbatim and nothing else.",
      inputSchema: {
        surface: z
          .enum(["commands", "help"])
          .describe(
            "commands for gr/ or gptworker/; help for gr/help or gptworker/help"
          ),
      },
      outputSchema: {
        text: z.string(),
      },
      annotations: toolAnnotations("read"),
    },
    async ({ surface }) => {
      const text =
        surface === "commands" ? GPTWORKER_ROOT_MENU : GPTWORKER_HELP;

      return {
        content: [{ type: "text" as const, text }],
        structuredContent: { text },
      };
    }
  );
}

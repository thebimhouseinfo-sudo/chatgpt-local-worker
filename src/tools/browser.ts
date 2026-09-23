import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callBrowserTool, type BrowserOperation } from "../lib/browser-mcp-adapter.js";
import { toolAnnotations } from "../lib/tool-annotations.js";

const argumentSchemas = {
  browser_open: { url: z.string().url() },
  browser_snapshot: {
    interactive: z.boolean().optional(), compact: z.boolean().optional(),
    depth: z.number().int().min(0).max(30).optional(), selector: z.string().max(1000).optional(),
  },
  browser_click: { selector: z.string().min(1).max(1000) },
  browser_fill: { selector: z.string().min(1).max(1000), text: z.string().max(4000) },
  browser_press: { key: z.string().min(1).max(120) },
  browser_wait: { selector: z.string().min(1).max(1000) },
  browser_screenshot: {
    selector: z.string().max(1000).optional(), fullPage: z.boolean().optional(),
    format: z.enum(["png", "jpeg"]).optional(),
  },
  browser_get_url: {},
  browser_close: {},
} as const;

export function registerBrowserTools(server: McpServer): void {
  for (const [operation, fields] of Object.entries(argumentSchemas)) {
    server.registerTool(
      operation,
      {
        title: operation.replaceAll("_", " "),
        description: "Local/approved-preview Dev Coding browser QA. Requires active Dev Coding lease and explicitly enabled healthy browser.",
        inputSchema: fields as any,
        annotations: toolAnnotations(operation === "browser_snapshot" || operation === "browser_get_url" ? "read" : "edit"),
      },
      async (args: any) => {
        const result = await callBrowserTool(operation as BrowserOperation, args || {});
        // Preserve typed image blocks. Never convert screenshot/base64 data to
        // JSON or activity telemetry.
        return {
          content: result.content || [],
          isError: Boolean(result.isError),
          structuredContent: {
            ok: !result.isError, tool: operation,
            summary: result.isError ? "Browser operation failed" : "Browser operation completed",
            data: { content_types: (result.content || []).map((part: any) => part.type) },
          },
        };
      }
    );
  }
}

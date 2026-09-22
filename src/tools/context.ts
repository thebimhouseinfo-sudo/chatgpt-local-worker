import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logToolActivity } from "../lib/activity-log.js";
import { loadProjectContext } from "../lib/project-context-loader.js";
import {
  getDefaultCwd,
  validatePath,
} from "../lib/path-security.js";
import { toolAnnotations } from "../lib/tool-annotations.js";
import { toolResult } from "../lib/tool-result.js";
import { getWorkerDataRoot } from "../lib/worker-home.js";

export function registerContextTools(
  server: McpServer,
  _startupWorkspaceRoot: string
): void {
  server.registerTool(
    "project_context",
    {
      title: "Project Context",
      description:
        "Load project-local instructions and context. Without an explicit path, uses the confirmed active workspace.",
      inputSchema: {
        path: z
          .string()
          .optional()
          .describe("Absolute project directory; defaults to confirmed active workspace"),
        max_bytes_per_file: z
          .number()
          .int()
          .positive()
          .max(200000)
          .optional()
          .default(60000),
      },
      annotations: toolAnnotations("read"),
    },
    async ({ path: projectPath, max_bytes_per_file }) => {
      const root = projectPath
        ? await validatePath(projectPath)
        : getDefaultCwd();

      const bundle = await loadProjectContext(root, {
        maxBytes: Math.max(max_bytes_per_file, 25000),
        maxLines: 1000,
        workspaceRoots: [root],
      });

      const files = bundle.sections.map((section) => ({
        path: section.path,
        content: section.content,
        truncated: section.truncated,
        kind: section.kind,
      }));

      logToolActivity({
        tool: "project_context",
        action: "read",
        target: root,
        status: "ok",
        details: { files: files.length, bytes: bundle.total_bytes },
      });

      return toolResult("project_context", {
        root,
        files,
        count: files.length,
        total_bytes: bundle.total_bytes,
        loaded_at: bundle.loaded_at,
      });
    }
  );

  server.registerTool(
    "agent_status",
    {
      title: "Agent Status",
      description:
        "Local GPTWorker diagnostic for the confirmed Workspace and Worker runtime.",
      inputSchema: {},
      annotations: toolAnnotations("read"),
    },
    async () => {
      return toolResult("agent_status", {
        effective_scope: "confirmed-workspace-only",
        workspace_boundary_enforced: true,
        workspace: getDefaultCwd(),
        worker_data_root: getWorkerDataRoot(),
        pid: process.pid,
        node: process.version,
      });
    }
  );


}

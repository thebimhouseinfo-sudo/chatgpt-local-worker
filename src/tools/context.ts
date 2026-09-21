import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { audit, getAuditPath } from "../lib/audit.js";
import { getCheckpointConfig } from "../lib/checkpoint.js";
import { loadProjectContext } from "../lib/project-context-loader.js";
import {
  describePermissionProfile,
  getPermissionProfile,
} from "../lib/permissions.js";
import {
  getDefaultCwd,
  getFullDiskAccess,
  getMachineRoots,
  validatePath,
} from "../lib/path-security.js";
import { MCP_QUICKSTART } from "../lib/quickstart.js";
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

      await audit({
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
        "Local GPTWorker diagnostic: permissions, active workspace, machine roots, checkpoint safety, and tool profile.",
      inputSchema: {},
      annotations: toolAnnotations("read"),
    },
    async () => {
      return toolResult("agent_status", {
        permission_profile: getPermissionProfile(),
        permission_description: describePermissionProfile(),
        full_machine_access: false,
        host_full_disk_access: getFullDiskAccess(),
        workspace_boundary_enforced: true,
        effective_scope: "confirmed-workspace-only",
        default_cwd: getDefaultCwd(),
        host_machine_roots: getMachineRoots(),
        worker_data_root: getWorkerDataRoot(),
        audit_log: getAuditPath(),
        pid: process.pid,
        node: process.version,
        checkpoint: getCheckpointConfig(),
        tool_profile: process.env.CHATGPT_TOOL_PROFILE || "slim",
        quickstart: MCP_QUICKSTART,
      });
    }
  );


}

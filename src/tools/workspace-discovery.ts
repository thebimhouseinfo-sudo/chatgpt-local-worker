import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AdmissionRuntime } from "../lib/activation-policy.js";
import { globFiles } from "../lib/glob-search.js";
import { grepSearch } from "../lib/grep-search.js";
import { toolAnnotations } from "../lib/tool-annotations.js";
import { toolResult } from "../lib/tool-result.js";

const DiscoveryOperationSchema = z.enum([
  "list_directory",
  "glob",
  "grep",
  "read_text_file",
]);

function normalize(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

async function canonicalWorkspace(raw: string): Promise<string> {
  if (!path.isAbsolute(raw)) {
    throw new Error("Discovery workspace must be an absolute local path.");
  }
  const resolved = path.resolve(raw);
  const stat = await fs.stat(resolved).catch(() => null);
  if (!stat?.isDirectory()) {
    throw new Error(`Discovery workspace does not exist or is not a directory: ${resolved}`);
  }
  return fs.realpath(resolved).catch(() => resolved);
}

async function pathInsideWorkspace(workspace: string, raw?: string): Promise<string> {
  const target = raw?.trim() ? path.resolve(raw) : workspace;
  if (!path.isAbsolute(target)) {
    throw new Error("Discovery paths must be absolute.");
  }

  const real = await fs.realpath(target).catch(() => target);
  const rootKey = normalize(workspace);
  const targetKey = normalize(real);
  const inside =
    targetKey === rootKey ||
    targetKey.startsWith(rootKey.endsWith(path.sep) ? rootKey : rootKey + path.sep);
  if (!inside) {
    throw new Error(
      `Discovery is read-only and restricted to the supplied Workspace: ${workspace}`
    );
  }
  return real;
}

export function registerWorkspaceDiscoveryTool(
  server: McpServer,
  admissionRuntime: AdmissionRuntime
): void {
  server.registerTool(
    "workspace_discover",
    {
      title: "Workspace Discovery",
      description:
        "Read-only pre-confirmation discovery for choosing the correct Job. Requires an ACTIVE admission token from gptworker_admission. Use only enough listing/search/reading to nominate the Job. It never grants execution authority and cannot write, run shell commands, or leave the supplied Workspace.",
      inputSchema: {
        workspace: z
          .string()
          .min(1)
          .describe("Exact absolute local Workspace supplied by the user"),
        task: z
          .string()
          .min(1)
          .describe("Concrete task the user wants performed"),
        operation: DiscoveryOperationSchema,
        arguments: z.record(z.string(), z.any()).optional().default({}),
        admission_token: z
          .string()
          .min(1)
          .describe("Opaque ACTIVE token returned by gptworker_admission"),
      },
      annotations: toolAnnotations("read"),
    },
    async ({
      workspace,
      task,
      operation,
      arguments: args,
      admission_token,
    }) => {
      const root = await canonicalWorkspace(workspace);
      admissionRuntime.validate(admission_token, workspace);

      if (operation === "list_directory") {
        const dir = await pathInsideWorkspace(
          root,
          typeof args.path === "string" ? args.path : root
        );
        const entries = await fs.readdir(dir, { withFileTypes: true });
        return toolResult("workspace_discover", {
          task,
          workspace: root,
          operation,
          path: dir,
          entries: entries.slice(0, 300).map((entry) => ({
            name: entry.name,
            type: entry.isDirectory() ? "directory" : "file",
          })),
          truncated: entries.length > 300,
        });
      }

      if (operation === "glob") {
        const searchRoot = await pathInsideWorkspace(
          root,
          typeof args.path === "string" ? args.path : root
        );
        const pattern =
          typeof args.pattern === "string" && args.pattern.trim()
            ? args.pattern
            : "**/*";
        const maxResults =
          typeof args.max_results === "number"
            ? Math.max(1, Math.min(300, Math.trunc(args.max_results)))
            : 100;
        const matches = await globFiles(searchRoot, pattern, maxResults);
        return toolResult("workspace_discover", {
          task,
          workspace: root,
          operation,
          path: searchRoot,
          pattern,
          matches: matches.map((item) => item.path),
          count: matches.length,
        });
      }

      if (operation === "grep") {
        const searchRoot = await pathInsideWorkspace(
          root,
          typeof args.path === "string" ? args.path : root
        );
        if (typeof args.pattern !== "string" || !args.pattern.trim()) {
          throw new Error("grep discovery requires arguments.pattern");
        }
        const output = await grepSearch({
          pattern: args.pattern,
          path: searchRoot,
          glob: typeof args.glob === "string" ? args.glob : "*",
          outputMode:
            args.output_mode === "files_with_matches" || args.output_mode === "count"
              ? args.output_mode
              : "content",
          caseInsensitive: Boolean(args.case_insensitive),
          multiline: Boolean(args.multiline),
          headLimit:
            typeof args.head_limit === "number"
              ? Math.max(1, Math.min(300, Math.trunc(args.head_limit)))
              : 100,
          contextBefore: 0,
          contextAfter: 0,
          contextAround: 0,
        });
        return toolResult("workspace_discover", {
          task,
          workspace: root,
          operation,
          path: searchRoot,
          pattern: args.pattern,
          output,
        });
      }

      if (typeof args.path !== "string" || !args.path.trim()) {
        throw new Error("read_text_file discovery requires arguments.path");
      }
      const file = await pathInsideWorkspace(root, args.path);
      const stat = await fs.stat(file);
      if (!stat.isFile()) {
        throw new Error(`Discovery read target is not a file: ${file}`);
      }
      const maxBytes =
        typeof args.max_bytes === "number"
          ? Math.max(1_000, Math.min(200_000, Math.trunc(args.max_bytes)))
          : 60_000;
      const buf = await fs.readFile(file);
      return toolResult("workspace_discover", {
        task,
        workspace: root,
        operation,
        path: file,
        content: buf.subarray(0, maxBytes).toString("utf8"),
        truncated: buf.length > maxBytes,
        bytes: Math.min(buf.length, maxBytes),
      });
    }
  );
}

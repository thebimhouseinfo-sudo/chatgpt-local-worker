import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getDefaultCwd,
  validatePath,
  validateReadPath,
} from "../lib/path-security.js";
import { logToolActivity } from "../lib/activity-log.js";
import {
  applyMultiFilePatch,
  applyUnifiedPatchToText,
  buildSimpleDiff,
  isMultiFilePatch,
} from "../lib/patch.js";
import { globFiles, grepSearch } from "../lib/file-search.js";
import { toolAnnotations } from "../lib/tool-annotations.js";
import { toolResult } from "../lib/tool-result.js";

function samePath(a: string, b: string): boolean {
  const left = path.resolve(a);
  const right = path.resolve(b);
  return process.platform === "win32"
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

function wildcardMatcher(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.*+?^$(){}|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

async function requireFile(filePath: string): Promise<void> {
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) throw new Error(`Path is not a file: ${filePath}`);
}

async function requireDirectory(dirPath: string): Promise<void> {
  const stat = await fs.stat(dirPath);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${dirPath}`);
  }
}

async function applyExactEdit(
  filePath: string,
  oldText: string,
  newText: string,
  replaceAll: boolean
): Promise<{ original: string; next: string; replacements: number }> {
  const original = await fs.readFile(filePath, "utf-8");
  if (!oldText) throw new Error("old_text must not be empty");

  const replacements = original.split(oldText).length - 1;
  if (replacements === 0) {
    throw new Error("old_text not found in file. Ensure exact match.");
  }

  const next = replaceAll
    ? original.split(oldText).join(newText)
    : original.replace(oldText, newText);

  return {
    original,
    next,
    replacements: replaceAll ? replacements : 1,
  };
}

export function registerFilesystemTools(server: McpServer): void {
  server.registerTool(
    "read_text_file",
    {
      title: "Read Text File",
      description:
        "Read a text file inside the confirmed Workspace or active Job support roots. Use offset+limit for line-oriented partial reads.",
      inputSchema: {
        path: z.string(),
        offset: z.number().int().positive().optional(),
        limit: z.number().int().positive().optional(),
        head: z.number().int().positive().optional(),
        tail: z.number().int().positive().optional(),
      },
      annotations: toolAnnotations("read"),
    },
    async ({ path: filePath, offset, limit, head, tail }) => {
      if (head !== undefined && tail !== undefined) {
        throw new Error("Use either head or tail, not both.");
      }
      if (offset !== undefined && (head !== undefined || tail !== undefined)) {
        throw new Error("offset/limit cannot be combined with head/tail.");
      }

      const validPath = await validateReadPath(filePath);
      await requireFile(validPath);
      const content = await fs.readFile(validPath, "utf-8");

      if (offset !== undefined) {
        const lines = content.split("\n");
        const start = offset - 1;
        const end = limit === undefined ? lines.length : start + limit;
        const slice = lines.slice(start, end);
        const numbered = slice.map(
          (line, index) => `${String(start + index + 1).padStart(6, " ")}|${line}`
        );

        logToolActivity({
          tool: "read_text_file",
          action: "read",
          target: validPath,
          status: "ok",
          details: { offset, limit, lines: slice.length },
        });

        return toolResult("read_text_file", {
          path: validPath,
          content: numbered.join("\n"),
          offset,
          limit,
          lines: slice.length,
        });
      }

      const lines = head !== undefined || tail !== undefined
        ? content.split("\n")
        : null;
      const selected = head !== undefined
        ? lines!.slice(0, head).join("\n")
        : tail !== undefined
          ? lines!.slice(-tail).join("\n")
          : content;

      logToolActivity({
        tool: "read_text_file",
        action: "read",
        target: validPath,
        status: "ok",
      });

      return toolResult("read_text_file", {
        path: validPath,
        content: selected,
        head,
        tail,
      });
    }
  );

  server.registerTool(
    "write_file",
    {
      title: "Write File",
      description:
        "Create or overwrite a UTF-8 text file inside the confirmed Workspace.",
      inputSchema: {
        path: z.string(),
        content: z.string(),
      },
      annotations: toolAnnotations("edit"),
    },
    async ({ path: filePath, content }) => {
      const validPath = await validatePath(filePath);
      await fs.mkdir(path.dirname(validPath), { recursive: true });
      await fs.writeFile(validPath, content, "utf-8");
      const bytes = Buffer.byteLength(content, "utf-8");

      logToolActivity({
        tool: "write_file",
        action: "write",
        target: validPath,
        status: "ok",
        details: { bytes },
      });

      return toolResult("write_file", { path: validPath, bytes });
    }
  );

  server.registerTool(
    "edit_file",
    {
      title: "Edit File",
      description:
        "Apply one exact text replacement to a UTF-8 file. Use replace_all for every exact occurrence; use apply_patch for multiple structured edits.",
      inputSchema: {
        path: z.string(),
        old_text: z.string().min(1),
        new_text: z.string(),
        replace_all: z.boolean().optional().default(false),
        dry_run: z.boolean().optional().default(false),
      },
      annotations: toolAnnotations("edit"),
    },
    async ({ path: filePath, old_text, new_text, replace_all, dry_run }) => {
      const validPath = await validatePath(filePath);
      await requireFile(validPath);
      const { original, next, replacements } = await applyExactEdit(
        validPath,
        old_text,
        new_text,
        replace_all
      );
      const diff = buildSimpleDiff(original, next);

      if (!dry_run) {
        await fs.writeFile(validPath, next, "utf-8");
      }

      logToolActivity({
        tool: "edit_file",
        action: "edit",
        target: validPath,
        status: dry_run ? "dry-run" : "ok",
        details: { replacements, replace_all },
      });

      return toolResult(
        "edit_file",
        {
          path: validPath,
          diff,
          replacements,
          dry_run,
        },
        {
          summary: dry_run
            ? `dry-run ${validPath}`
            : `edited ${validPath}`,
        }
      );
    }
  );

  server.registerTool(
    "apply_patch",
    {
      title: "Apply Patch",
      description:
        "Preferred structured code edit. Supports single-file @@/unified hunks and multi-file *** Begin Patch forms.",
      inputSchema: {
        path: z
          .string()
          .optional()
          .describe(
            "Absolute target file for a single-file patch or absolute base path for a multi-file patch."
          ),
        patch: z.string(),
        dry_run: z.boolean().optional().default(false),
      },
      annotations: toolAnnotations("edit"),
    },
    async ({ path: filePath, patch, dry_run }) => {
      if (isMultiFilePatch(patch)) {
        if (!filePath) {
          throw new Error(
            "Absolute base path is required for multi-file patches."
          );
        }

        const validatedBase = await validatePath(filePath);
        const stat = await fs.stat(validatedBase);
        const baseDir = stat.isDirectory()
          ? validatedBase
          : path.dirname(validatedBase);

        const results = await applyMultiFilePatch(patch, {
          base_dir: baseDir,
          dry_run,
        });
        const failed = results.filter((result) => !result.ok);

        logToolActivity({
          tool: "apply_patch",
          action: "patch",
          target: baseDir,
          status: failed.length
            ? "error"
            : dry_run
              ? "dry-run"
              : "ok",
          details: {
            files: results.length,
            failed: failed.length,
          },
        });

        return toolResult(
          "apply_patch",
          {
            files: results,
            dry_run,
            multi_file: true,
          },
          {
            ok: failed.length === 0,
            summary:
              `patched ${results.length} file(s)` +
              (failed.length ? `, ${failed.length} failed` : ""),
          }
        );
      }

      if (!filePath) {
        throw new Error("path is required for single-file patches");
      }

      const validPath = await validatePath(filePath);
      await requireFile(validPath);
      const original = await fs.readFile(validPath, "utf-8");
      const next = applyUnifiedPatchToText(original, patch);
      const diff = buildSimpleDiff(original, next);

      if (!dry_run) {
        await fs.writeFile(validPath, next, "utf-8");
      }

      logToolActivity({
        tool: "apply_patch",
        action: "patch",
        target: validPath,
        status: dry_run ? "dry-run" : "ok",
      });

      return toolResult("apply_patch", {
        path: validPath,
        diff,
        dry_run,
      });
    }
  );

  server.registerTool(
    "list_directory",
    {
      title: "List Directory",
      description:
        "List immediate files and directories inside an absolute directory.",
      inputSchema: {
        path: z.string(),
        ignore: z.array(z.string()).optional(),
      },
      annotations: toolAnnotations("read"),
    },
    async ({ path: dirPath, ignore }) => {
      const validPath = await validateReadPath(dirPath);
      await requireDirectory(validPath);

      const ignoreMatchers = (ignore ?? []).map(wildcardMatcher);
      const entries = await fs.readdir(validPath, { withFileTypes: true });
      const items = entries
        .filter(
          (entry) =>
            !ignoreMatchers.some((matcher) => matcher.test(entry.name))
        )
        .map((entry) => ({
          name: entry.name,
          type: entry.isDirectory()
            ? "directory"
            : entry.isSymbolicLink()
              ? "symlink"
              : "file",
        }));

      logToolActivity({
        tool: "list_directory",
        action: "list",
        target: validPath,
        status: "ok",
        details: { count: items.length },
      });

      return toolResult("list_directory", {
        path: validPath,
        entries: items,
        count: items.length,
      });
    }
  );

  server.registerTool(
    "glob",
    {
      title: "Glob",
      description:
        "Find file paths by glob pattern. Defaults to the confirmed Workspace root.",
      inputSchema: {
        pattern: z.string(),
        path: z.string().optional(),
        max_results: z
          .number()
          .int()
          .positive()
          .max(500)
          .optional()
          .default(100),
      },
      annotations: toolAnnotations("read"),
    },
    async ({ pattern, path: searchPath, max_results }) => {
      const root = searchPath
        ? await validateReadPath(searchPath)
        : await validateReadPath(getDefaultCwd());
      await requireDirectory(root);
      const matches = await globFiles(root, pattern, max_results);

      logToolActivity({
        tool: "glob",
        action: "glob",
        target: root,
        status: "ok",
        details: { pattern, results: matches.length },
      });

      return toolResult("glob", {
        path: root,
        pattern,
        matches: matches.map((match) => match.path),
        count: matches.length,
      });
    }
  );

  server.registerTool(
    "grep",
    {
      title: "Grep",
      description:
        "Search text-file contents by regular expression. Modes: content, files_with_matches, count.",
      inputSchema: {
        pattern: z.string(),
        path: z.string().optional(),
        glob: z.string().optional().default("*"),
        output_mode: z
          .enum(["content", "files_with_matches", "count"])
          .optional()
          .default("content"),
        case_insensitive: z.boolean().optional().default(false),
        multiline: z.boolean().optional().default(false),
        head_limit: z
          .number()
          .int()
          .positive()
          .max(1000)
          .optional()
          .default(200),
        context_before: z
          .number()
          .int()
          .nonnegative()
          .max(20)
          .optional()
          .default(0),
        context_after: z
          .number()
          .int()
          .nonnegative()
          .max(20)
          .optional()
          .default(0),
        context_around: z
          .number()
          .int()
          .nonnegative()
          .max(20)
          .optional()
          .default(0),
      },
      annotations: toolAnnotations("read"),
    },
    async ({
      pattern,
      path: searchPath,
      glob: globPattern,
      output_mode,
      case_insensitive,
      multiline,
      head_limit,
      context_before,
      context_after,
      context_around,
    }) => {
      const root = searchPath
        ? await validateReadPath(searchPath)
        : await validateReadPath(getDefaultCwd());
      await requireDirectory(root);

      const output = await grepSearch({
        pattern,
        path: root,
        glob: globPattern,
        outputMode: output_mode,
        caseInsensitive: case_insensitive,
        multiline,
        headLimit: head_limit,
        contextBefore: context_before,
        contextAfter: context_after,
        contextAround: context_around,
      });

      logToolActivity({
        tool: "grep",
        action: "grep",
        target: root,
        status: "ok",
        details: { pattern, output_mode },
      });

      return toolResult("grep", {
        path: root,
        pattern,
        output_mode,
        output,
      });
    }
  );

  server.registerTool(
    "delete_file",
    {
      title: "Delete File",
      description: "Delete one file inside the confirmed Workspace.",
      inputSchema: { path: z.string() },
      annotations: toolAnnotations("destructive"),
    },
    async ({ path: filePath }) => {
      const validPath = await validatePath(filePath);
      await requireFile(validPath);
      await fs.unlink(validPath);

      logToolActivity({
        tool: "delete_file",
        action: "delete",
        target: validPath,
        status: "ok",
      });

      return toolResult("delete_file", { path: validPath });
    }
  );

  server.registerTool(
    "create_directory",
    {
      title: "Create Directory",
      description:
        "Create a directory inside the confirmed Workspace, including missing parents.",
      inputSchema: { path: z.string() },
      annotations: toolAnnotations("edit"),
    },
    async ({ path: dirPath }) => {
      const validPath = await validatePath(dirPath);
      await fs.mkdir(validPath, { recursive: true });

      logToolActivity({
        tool: "create_directory",
        action: "mkdir",
        target: validPath,
        status: "ok",
      });

      return toolResult("create_directory", { path: validPath });
    }
  );

  server.registerTool(
    "delete_directory",
    {
      title: "Delete Directory",
      description:
        "Recursively delete a directory inside the confirmed Workspace. The Workspace root itself cannot be deleted.",
      inputSchema: { path: z.string() },
      annotations: toolAnnotations("destructive"),
    },
    async ({ path: dirPath }) => {
      const validPath = await validatePath(dirPath);
      if (samePath(validPath, getDefaultCwd())) {
        throw new Error("Refusing to delete the confirmed Workspace root.");
      }
      await requireDirectory(validPath);
      await fs.rm(validPath, { recursive: true, force: true });

      logToolActivity({
        tool: "delete_directory",
        action: "rmdir",
        target: validPath,
        status: "ok",
      });

      return toolResult("delete_directory", { path: validPath });
    }
  );

  server.registerTool(
    "copy_file",
    {
      title: "Copy File",
      description:
        "Copy one file into the confirmed Workspace. The source may also be an active read-only Job support file.",
      inputSchema: {
        source: z.string(),
        destination: z.string(),
      },
      annotations: toolAnnotations("edit"),
    },
    async ({ source, destination }) => {
      const src = await validateReadPath(source);
      const dest = await validatePath(destination);
      await requireFile(src);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(src, dest);

      logToolActivity({
        tool: "copy_file",
        action: "copy",
        target: dest,
        status: "ok",
        details: { source: src },
      });

      return toolResult("copy_file", {
        source: src,
        destination: dest,
      });
    }
  );

  server.registerTool(
    "move_file",
    {
      title: "Move File",
      description:
        "Move or rename a file or directory inside the confirmed Workspace. The Workspace root itself cannot be moved.",
      inputSchema: {
        source: z.string(),
        destination: z.string(),
      },
      annotations: toolAnnotations("edit"),
    },
    async ({ source, destination }) => {
      const src = await validatePath(source);
      const dest = await validatePath(destination);

      if (samePath(src, getDefaultCwd())) {
        throw new Error("Refusing to move the confirmed Workspace root.");
      }

      await fs.stat(src);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.rename(src, dest);

      logToolActivity({
        tool: "move_file",
        action: "move",
        target: dest,
        status: "ok",
        details: { source: src },
      });

      return toolResult("move_file", {
        source: src,
        destination: dest,
      });
    }
  );
}

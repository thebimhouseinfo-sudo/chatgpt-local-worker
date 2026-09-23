import fs from "fs/promises";
import path from "path";
import { validatePath } from "./path-security.js";

/**
 * Apply single-file unified/context hunks and GPT-style multi-file patches.
 *
 * Single-file patches support:
 * - context hunks with "@@" and no line numbers;
 * - standard unified hunk headers such as "@@ -1,3 +1,4 @@";
 * - optional ---/+++ headers, which are ignored by the single-file parser;
 * - CRLF/LF preservation.
 *
 * Multi-file routing is intentionally limited to the explicit
 * "*** Begin Patch / Update File / Add File / Delete File" format.
 */

function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function detectEol(text: string): "\r\n" | "\n" {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

interface ParsedHunk {
  oldStart?: number;
  lines: Array<{ type: "context" | "remove" | "add"; text: string }>;
}

function parsePatch(patchText: string): ParsedHunk[] {
  const normalized = normalizeEol(patchText.trim());
  const rawLines = normalized.split("\n");
  const hunks: ParsedHunk[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    if (line.startsWith("---") || line.startsWith("+++") || line.startsWith("diff ")) {
      i++;
      continue;
    }
    if (!line.startsWith("@@")) {
      i++;
      continue;
    }

    const headerMatch = line.match(/^@@\s*-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
    if (line !== "@@" && !headerMatch) {
      throw new Error(`Invalid patch hunk header: ${line}`);
    }
    const hunk: ParsedHunk = {
      oldStart: headerMatch ? Number(headerMatch[1]) : undefined,
      lines: [],
    };
    i++;

    for (; i < rawLines.length; i++) {
      const patchLine = rawLines[i];
      if (patchLine.startsWith("@@")) {
        break;
      }
      if (patchLine === "\\ No newline at end of file") continue;
      if (patchLine.startsWith(" ")) {
        hunk.lines.push({ type: "context", text: patchLine.slice(1) });
      } else if (patchLine.startsWith("-")) {
        hunk.lines.push({ type: "remove", text: patchLine.slice(1) });
      } else if (patchLine.startsWith("+")) {
        hunk.lines.push({ type: "add", text: patchLine.slice(1) });
      } else if (patchLine.length === 0) {
        hunk.lines.push({ type: "context", text: "" });
      }
    }

    if (hunk.lines.length > 0) hunks.push(hunk);
  }

  if (hunks.length === 0) {
    throw new Error("No valid patch hunks found. Use @@ header with +/- lines.");
  }

  return hunks;
}

function hunkSearchPattern(hunk: ParsedHunk): string[] {
  const pattern: string[] = [];
  for (const entry of hunk.lines) {
    if (entry.type === "context" || entry.type === "remove") {
      pattern.push(entry.text);
    }
  }
  return pattern;
}

function hunkReplacement(hunk: ParsedHunk): string[] {
  const replacement: string[] = [];
  for (const entry of hunk.lines) {
    if (entry.type === "context" || entry.type === "add") {
      replacement.push(entry.text);
    }
  }
  return replacement;
}

function findPatternIndex(haystack: string[], needle: string[], startAt = 0): number {
  if (needle.length === 0) return startAt;

  outer: for (let i = startAt; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }

  return -1;
}

function applyHunkAtIndex(output: string[], hunk: ParsedHunk, index: number): void {
  const removeCount = hunk.lines.filter((l) => l.type === "context" || l.type === "remove").length;
  const replacement = hunkReplacement(hunk);
  output.splice(index, removeCount, ...replacement);
}

function applyHunkWithLineNumber(output: string[], hunk: ParsedHunk, delta: number): number {
  if (hunk.oldStart === undefined) {
    throw new Error("Missing line number in hunk header");
  }

  const targetIndex = hunk.oldStart - 1 + delta;
  const removeCount = hunk.lines.filter((l) => l.type === "context" || l.type === "remove").length;
  const replacement = hunkReplacement(hunk);
  const expected = hunkSearchPattern(hunk);
  if (
    targetIndex < 0 ||
    targetIndex > output.length ||
    expected.some((line, offset) => output[targetIndex + offset] !== line)
  ) {
    throw new Error(
      `Patch hunk mismatch at old line ${hunk.oldStart}: expected old/context lines do not match the current file.`
    );
  }
  output.splice(targetIndex, removeCount, ...replacement);
  return replacement.length - removeCount;
}

function applyHunkWithContextSearch(output: string[], hunk: ParsedHunk, searchFrom: number): number {
  const pattern = hunkSearchPattern(hunk);
  const index = findPatternIndex(output, pattern, searchFrom);
  if (index < 0) {
    const preview = pattern.slice(0, 3).join(" | ") || "(empty hunk)";
    throw new Error(`Patch context not found in file. Expected lines like: ${preview}`);
  }

  applyHunkAtIndex(output, hunk, index);
  return index + hunkReplacement(hunk).length;
}

export function applyUnifiedPatchToText(original: string, patchText: string): string {
  const eol = detectEol(original);
  const normalizedOriginal = normalizeEol(original);
  const output = normalizedOriginal.split("\n");
  const hunks = parsePatch(patchText);

  let delta = 0;
  let searchFrom = 0;

  for (const hunk of hunks) {
    if (hunk.oldStart !== undefined) {
      delta += applyHunkWithLineNumber(output, hunk, delta);
    } else {
      searchFrom = applyHunkWithContextSearch(output, hunk, searchFrom);
    }
  }

  const result = output.join("\n");
  return eol === "\r\n" ? result.replace(/\n/g, "\r\n") : result;
}

interface MultiPatchFileOp {
  path: string;
  operation: "create" | "update" | "delete";
  patch?: string;
  content?: string;
}

export interface MultiPatchResult {
  path: string;
  operation: "create" | "update" | "delete";
  ok: boolean;
  diff?: string;
  error?: string;
}

export function isMultiFilePatch(patchText: string): boolean {
  const text = patchText.trim();
  return (
    text.includes("*** Begin Patch") ||
    text.includes("*** Update File:") ||
    text.includes("*** Add File:") ||
    text.includes("*** Delete File:")
  );
}

function parseMultiFilePatch(
  patchText: string,
  baseDir?: string
): MultiPatchFileOp[] {
  const lines = normalizeEol(patchText.trim()).split("\n");
  const ops: MultiPatchFileOp[] = [];
  let current: MultiPatchFileOp | null = null;
  const chunk: string[] = [];

  const flush = () => {
    if (!current) return;

    if (current.operation === "create") {
      current.content = chunk
        .filter((line) => line.startsWith("+"))
        .map((line) => line.slice(1))
        .join("\n");
    } else if (current.operation === "update") {
      current.patch = chunk.join("\n");
    }

    ops.push(current);
    current = null;
    chunk.length = 0;
  };

  for (const line of lines) {
    if (line.startsWith("*** Update File:")) {
      flush();
      current = {
        path: resolvePatchPath(line.slice(16).trim(), baseDir),
        operation: "update",
      };
      continue;
    }

    if (line.startsWith("*** Add File:")) {
      flush();
      current = {
        path: resolvePatchPath(line.slice(13).trim(), baseDir),
        operation: "create",
      };
      continue;
    }

    if (line.startsWith("*** Delete File:")) {
      flush();
      ops.push({
        path: resolvePatchPath(line.slice(16).trim(), baseDir),
        operation: "delete",
      });
      continue;
    }

    if (line.startsWith("*** Begin Patch") || line.startsWith("*** End Patch")) {
      continue;
    }

    if (current) chunk.push(line);
  }

  flush();
  return ops;
}

function resolvePatchPath(input: string, baseDir?: string): string {
  const cleaned = input.trim().replace(/^['"]|['"]$/g, "");
  if (path.isAbsolute(cleaned)) return path.resolve(cleaned);
  if (baseDir) return path.resolve(baseDir, cleaned);
  return path.resolve(cleaned);
}

export async function applyMultiFilePatch(
  patchText: string,
  options?: { base_dir?: string; dry_run?: boolean }
): Promise<MultiPatchResult[]> {
  const baseDir = options?.base_dir;
  const dryRun = options?.dry_run ?? false;
  const ops = parseMultiFilePatch(patchText, baseDir);
  if (ops.length === 0) throw new Error("No file operations found in patch");

  for (const op of ops) {
    op.path = await validatePath(op.path);
  }

  // Validate every operation before any write. Unexpected commit-time I/O
  // failures can still yield partial success; this is not an atomic transaction.
  type PreparedOp = MultiPatchFileOp & { next?: string; diff: string };
  const prepared: PreparedOp[] = [];
  const results: MultiPatchResult[] = [];
  const seen = new Set<string>();
  let preflightFailed = false;

  for (const op of ops) {
    try {
      let identity: string;
      try {
        identity = await fs.realpath(op.path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        identity = op.path;
      }
      const key = process.platform === "win32" ? identity.toLowerCase() : identity;
      if (seen.has(key)) throw new Error("Duplicate target in multi-file patch");
      seen.add(key);

      if (op.operation === "delete") {
        const stat = await fs.stat(op.path);
        if (!stat.isFile()) throw new Error("Delete target is not a regular file");
        prepared.push({ ...op, diff: "[deleted]" });
      } else if (op.operation === "create") {
        try {
          await fs.lstat(op.path);
          throw new Error("Add File target already exists");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        const next = op.content ?? "";
        prepared.push({ ...op, next, diff: buildSimpleDiff("", next) });
      } else {
        const stat = await fs.stat(op.path);
        if (!stat.isFile()) throw new Error("Update target is not a regular file");
        const original = await fs.readFile(op.path, "utf-8");
        const next = applyUnifiedPatchToText(original, op.patch || "");
        prepared.push({ ...op, next, diff: buildSimpleDiff(original, next) });
      }
      results.push({ path: op.path, operation: op.operation, ok: true });
    } catch (err) {
      preflightFailed = true;
      results.push({
        path: op.path,
        operation: op.operation,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (preflightFailed) {
    return results.map((result) =>
      result.ok
        ? { ...result, ok: false, error: "Not applied: multi-file preflight failed" }
        : result
    );
  }

  if (dryRun) {
    return prepared.map(({ path: filePath, operation, diff }) => ({
      path: filePath, operation, ok: true, diff,
    }));
  }

  const committed: MultiPatchResult[] = [];
  for (let i = 0; i < prepared.length; i++) {
    const op = prepared[i];
    try {
      // Recheck authority just before mutation; a parent may have changed.
      await validatePath(op.path);
      if (op.operation === "delete") {
        await fs.unlink(op.path);
      } else if (op.operation === "create") {
        await fs.mkdir(path.dirname(op.path), { recursive: true });
        await validatePath(op.path);
        await fs.writeFile(op.path, op.next ?? "", { encoding: "utf-8", flag: "wx" });
      } else {
        await fs.writeFile(op.path, op.next ?? "", "utf-8");
      }
      committed.push({ path: op.path, operation: op.operation, ok: true, diff: op.diff });
    } catch (err) {
      committed.push({
        path: op.path,
        operation: op.operation,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
      for (const skipped of prepared.slice(i + 1)) {
        committed.push({
          path: skipped.path,
          operation: skipped.operation,
          ok: false,
          error: "Not applied: an earlier filesystem mutation failed",
        });
      }
      break;
    }
  }
  return committed;
}

export function buildSimpleDiff(oldContent: string, newContent: string): string {
  const oldLines = normalizeEol(oldContent).split("\n");
  const newLines = normalizeEol(newContent).split("\n");
  const diff: string[] = [];

  for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    if (oldLine !== newLine) {
      if (oldLine !== undefined) diff.push(`- ${oldLine}`);
      if (newLine !== undefined) diff.push(`+ ${newLine}`);
    }
  }

  return diff.join("\n") || "(no visible diff)";
}
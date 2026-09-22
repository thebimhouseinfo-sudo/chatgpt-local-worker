import fs from "node:fs/promises";
import path from "node:path";

const SKIPPED_DIRECTORIES = new Set([".git", "node_modules"]);

export interface FileMatch {
  path: string;
  mtimeMs: number;
}

export type GrepOutputMode = "content" | "files_with_matches" | "count";

export interface GrepOptions {
  pattern: string;
  path: string;
  glob?: string;
  outputMode?: GrepOutputMode;
  caseInsensitive?: boolean;
  multiline?: boolean;
  headLimit?: number;
  contextBefore?: number;
  contextAfter?: number;
  contextAround?: number;
}

function normalizeRelative(value: string): string {
  return value.replace(/\\/g, "/");
}

function escapeRegexChar(char: string): string {
  return /[\\^$+?.()|{}\[\]]/.test(char) ? `\\${char}` : char;
}

export function globPatternToRegExp(pattern: string): RegExp {
  const normalized = normalizeRelative(pattern.trim() || "*");
  let source = "";

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];

    if (char === "*") {
      if (normalized[i + 1] === "*") {
        const followedBySlash = normalized[i + 2] === "/";
        source += followedBySlash ? "(?:.*/)?" : ".*";
        i += followedBySlash ? 2 : 1;
      } else {
        source += "[^/]*";
      }
      continue;
    }

    if (char === "?") {
      source += "[^/]";
      continue;
    }

    source += escapeRegexChar(char);
  }

  return new RegExp(`^${source}$`, "i");
}

function matchesGlob(
  rootDir: string,
  filePath: string,
  matcher: RegExp
): boolean {
  const relative = normalizeRelative(path.relative(rootDir, filePath));
  return matcher.test(relative) || matcher.test(path.basename(filePath));
}

async function walkFiles(
  rootDir: string,
  visit: (filePath: string) => Promise<boolean | void>
): Promise<void> {
  async function walk(dir: string): Promise<boolean> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return false;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
        if (await walk(path.join(dir, entry.name))) return true;
        continue;
      }

      if (!entry.isFile() && !entry.isSymbolicLink()) continue;
      if (await visit(path.join(dir, entry.name))) return true;
    }

    return false;
  }

  await walk(rootDir);
}

export async function globFiles(
  rootDir: string,
  pattern: string,
  maxResults: number
): Promise<FileMatch[]> {
  const limit = Math.max(1, maxResults);
  const matcher = globPatternToRegExp(pattern);
  const matches: FileMatch[] = [];

  await walkFiles(rootDir, async (filePath) => {
    if (!matchesGlob(rootDir, filePath, matcher)) return false;

    try {
      const stat = await fs.stat(filePath);
      matches.push({ path: filePath, mtimeMs: stat.mtimeMs });
    } catch {}

    return matches.length >= limit;
  });

  matches.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return matches;
}

function buildContentRegex(
  pattern: string,
  caseInsensitive: boolean,
  multiline: boolean,
  global = false
): RegExp {
  let flags = "";
  if (global) flags += "g";
  if (caseInsensitive) flags += "i";
  if (multiline) flags += "m";
  return new RegExp(pattern, flags);
}

export async function grepSearch(options: GrepOptions): Promise<string> {
  const {
    pattern,
    path: searchRoot,
    glob = "*",
    outputMode = "content",
    caseInsensitive = false,
    multiline = false,
    headLimit = 200,
    contextBefore = 0,
    contextAfter = 0,
    contextAround = 0,
  } = options;

  const limit = Math.max(1, headLimit);
  const before = contextAround || contextBefore;
  const after = contextAround || contextAfter;
  const globMatcher = globPatternToRegExp(glob);
  const fileMatches = new Map<string, number>();
  const contentLines: string[] = [];

  await walkFiles(searchRoot, async (filePath) => {
    if (!matchesGlob(searchRoot, filePath, globMatcher)) return false;

    let text: string;
    try {
      text = await fs.readFile(filePath, "utf-8");
    } catch {
      return false;
    }

    if (multiline) {
      const regex = buildContentRegex(pattern, caseInsensitive, true, true);
      const count = [...text.matchAll(regex)].length;
      if (count > 0) {
        fileMatches.set(filePath, count);
        if (outputMode === "content") {
          contentLines.push(`${filePath}: [multiline match x${count}]`);
        }
      }
    } else {
      const regex = buildContentRegex(pattern, caseInsensitive, false);
      const lines = text.split("\n");

      for (let i = 0; i < lines.length; i++) {
        regex.lastIndex = 0;
        if (!regex.test(lines[i])) continue;

        fileMatches.set(filePath, (fileMatches.get(filePath) ?? 0) + 1);

        if (outputMode !== "content") continue;

        if (before > 0 || after > 0) {
          const start = Math.max(0, i - before);
          const end = Math.min(lines.length - 1, i + after);
          for (let j = start; j <= end && contentLines.length < limit; j++) {
            const separator = j === i ? ":" : "-";
            contentLines.push(
              `${filePath}${separator}${j + 1}: ${lines[j]}`
            );
          }
        } else {
          contentLines.push(`${filePath}:${i + 1}: ${lines[i].trim()}`);
        }

        if (contentLines.length >= limit) break;
      }
    }

    if (outputMode === "content") return contentLines.length >= limit;
    return fileMatches.size >= limit;
  });

  if (outputMode === "files_with_matches") {
    const files = [...fileMatches.keys()].slice(0, limit);
    return files.length ? files.join("\n") : "No matches found";
  }

  if (outputMode === "count") {
    const rows = [...fileMatches.entries()]
      .slice(0, limit)
      .map(([file, count]) => `${file}:${count}`);
    return rows.length ? rows.join("\n") : "No matches found";
  }

  return contentLines.length
    ? contentLines.slice(0, limit).join("\n")
    : "No matches found";
}

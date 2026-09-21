import fs from "fs/promises";
import path from "path";

const ROOT_CONTEXT_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  ".claude/CLAUDE.md",
  "CLAUDE.local.md",
  "README.md",
] as const;

const RULES_GLOB_MAX = 12;
const IMPORT_MAX_DEPTH = 4;
const DEFAULT_MAX_BYTES = parseInt(process.env.PROJECT_MEMORY_MAX_BYTES || "25000", 10);
const DEFAULT_MAX_LINES = parseInt(process.env.PROJECT_MEMORY_MAX_LINES || "200", 10);

export interface ProjectMemorySection {
  path: string;
  content: string;
  truncated: boolean;
  kind: "project" | "rule" | "import";
}

export interface ProjectMemoryBundle {
  root: string;
  workspace_roots: string[];
  sections: ProjectMemorySection[];
  total_bytes: number;
  loaded_at: string;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function stripHtmlComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, "");
}

function hasPathsFrontmatter(content: string): boolean {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return Boolean(match && /^paths\s*:/m.test(match[1]));
}

function isWithinRoots(candidate: string, roots: readonly string[]): boolean {
  const resolved = path.resolve(candidate);

  return roots.some((root) => {
    const relative = path.relative(path.resolve(root), resolved);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  });
}

async function expandImports(
  content: string,
  baseDir: string,
  allowedRoots: readonly string[],
  visited: Set<string>,
  depth: number
): Promise<string> {
  if (depth >= IMPORT_MAX_DEPTH) return content;

  const output: string[] = [];
  let inFence = false;

  for (const line of content.split(/\r?\n/)) {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      output.push(line);
      continue;
    }

    if (inFence) {
      output.push(line);
      continue;
    }

    const match = line.match(/^@([^\s`]+)\s*$/);
    if (!match) {
      output.push(line);
      continue;
    }

    const raw = match[1];
    if (raw.startsWith("~/")) {
      output.push("<!-- skipped non-project import -->");
      continue;
    }

    const resolved = path.isAbsolute(raw)
      ? path.resolve(raw)
      : path.resolve(baseDir, raw);

    if (!isWithinRoots(resolved, allowedRoots)) {
      output.push("<!-- skipped import outside configured workspace roots -->");
      continue;
    }

    if (visited.has(resolved)) {
      output.push("<!-- skipped circular project import -->");
      continue;
    }

    visited.add(resolved);

    try {
      const imported = stripHtmlComments(await fs.readFile(resolved, "utf-8"));
      const expanded = await expandImports(
        imported,
        path.dirname(resolved),
        allowedRoots,
        visited,
        depth + 1
      );
      output.push(`<!-- project import: ${resolved} -->`, expanded);
    } catch {
      output.push("<!-- project import unavailable -->");
    }
  }

  return output.join("\n");
}

async function readTextLimited(
  filePath: string,
  allowedRoots: readonly string[],
  maxBytes: number,
  maxLines: number,
  kind: ProjectMemorySection["kind"]
): Promise<ProjectMemorySection | null> {
  try {
    const buffer = await fs.readFile(filePath);
    const stripped = stripHtmlComments(buffer.toString("utf-8"));
    const expanded = await expandImports(
      stripped,
      path.dirname(filePath),
      allowedRoots,
      new Set([path.resolve(filePath)]),
      0
    );

    const lineLimited = expanded.split(/\r?\n/).slice(0, maxLines).join("\n");
    const bytes = Buffer.from(lineLimited, "utf-8");
    const content =
      bytes.length > maxBytes
        ? bytes.subarray(0, maxBytes).toString("utf-8")
        : lineLimited;

    const trimmed = content.trim();
    if (!trimmed) return null;

    return {
      path: filePath,
      content: trimmed,
      truncated:
        buffer.length > maxBytes ||
        expanded.split(/\r?\n/).length > maxLines ||
        Buffer.byteLength(lineLimited, "utf-8") > maxBytes,
      kind,
    };
  } catch {
    return null;
  }
}

async function listUnconditionalRuleFiles(rulesDir: string): Promise<string[]> {
  const found: string[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 3) return;

    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(full, depth + 1);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

      try {
        const content = await fs.readFile(full, "utf-8");
        if (!hasPathsFrontmatter(content)) found.push(full);
      } catch {}
    }
  }

  await walk(rulesDir, 0);
  return found.sort().slice(0, RULES_GLOB_MAX);
}

async function appendSection(
  sections: ProjectMemorySection[],
  totalBytes: { value: number },
  allowedRoots: readonly string[],
  maxBytes: number,
  maxLines: number,
  filePath: string,
  kind: ProjectMemorySection["kind"]
): Promise<void> {
  if (totalBytes.value >= maxBytes) return;

  const section = await readTextLimited(
    filePath,
    allowedRoots,
    maxBytes - totalBytes.value,
    maxLines,
    kind
  );

  if (!section?.content) return;

  sections.push(section);
  totalBytes.value += Buffer.byteLength(section.content, "utf-8");
}

export async function loadProjectMemory(
  workspaceRoot: string,
  opts?: { maxBytes?: number; maxLines?: number; workspaceRoots?: string[] }
): Promise<ProjectMemoryBundle> {
  const root = path.resolve(workspaceRoot);
  const workspace_roots = (opts?.workspaceRoots ?? [root]).map((item) =>
    path.resolve(item)
  );
  const allowedRoots = [...new Set([root, ...workspace_roots])];
  const maxBytes = opts?.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxLines = opts?.maxLines ?? DEFAULT_MAX_LINES;
  const sections: ProjectMemorySection[] = [];
  const totalBytes = { value: 0 };

  for (const relative of ROOT_CONTEXT_FILES) {
    const filePath = path.join(root, relative);
    if (!(await fileExists(filePath))) continue;

    await appendSection(
      sections,
      totalBytes,
      allowedRoots,
      maxBytes,
      maxLines,
      filePath,
      "project"
    );
  }

  const rulesDir = path.join(root, ".claude", "rules");
  if (totalBytes.value < maxBytes && (await fileExists(rulesDir))) {
    for (const ruleFile of await listUnconditionalRuleFiles(rulesDir)) {
      await appendSection(
        sections,
        totalBytes,
        allowedRoots,
        maxBytes,
        maxLines,
        ruleFile,
        "rule"
      );
    }
  }

  return {
    root,
    workspace_roots,
    sections,
    total_bytes: totalBytes.value,
    loaded_at: new Date().toISOString(),
  };
}

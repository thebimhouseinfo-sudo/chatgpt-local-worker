import { createHash } from "node:crypto";
import fs from "fs/promises";
import path from "path";
import { getWorkerDataRoot } from "./worker-home.js";

const MAX_BYTES = parseInt(process.env.AUTO_MEMORY_MAX_BYTES || "25000", 10);
const MAX_LINES = parseInt(process.env.AUTO_MEMORY_MAX_LINES || "200", 10);

function projectDir(workspaceRoot: string): string {
  const slug = createHash("sha256")
    .update(path.resolve(workspaceRoot))
    .digest("hex")
    .slice(0, 12);

  return path.join(getWorkerDataRoot(), "memory", "projects", slug);
}

function memoryPath(workspaceRoot: string): string {
  return path.join(projectDir(workspaceRoot), "MEMORY.md");
}

export async function loadAutoMemory(
  workspaceRoot: string
): Promise<string | null> {
  try {
    const buffer = await fs.readFile(memoryPath(workspaceRoot));
    const text = buffer.toString("utf-8");
    const lineLimited = text.split(/\r?\n/).slice(0, MAX_LINES).join("\n");
    const bytes = Buffer.from(lineLimited, "utf-8");
    const limited =
      bytes.length > MAX_BYTES
        ? bytes.subarray(0, MAX_BYTES).toString("utf-8")
        : lineLimited;

    return limited.trim() || null;
  } catch {
    return null;
  }
}

export async function appendAutoMemory(
  workspaceRoot: string,
  note: string
): Promise<string> {
  const dir = projectDir(workspaceRoot);
  const file = memoryPath(workspaceRoot);

  await fs.mkdir(dir, { recursive: true });

  let existing = "";
  try {
    existing = await fs.readFile(file, "utf-8");
  } catch {}

  const header = existing ? "" : "# GPTWorker memory (cross-session notes)\n\n";
  const line = `- ${new Date().toISOString().slice(0, 10)}: ${note.trim()}\n`;

  await fs.writeFile(file, header + existing + line, "utf-8");
  return file;
}

export function formatAutoMemoryForInstructions(
  content: string | null
): string {
  if (!content) return "";
  return ["## GPTWorker memory", content].join("\n");
}

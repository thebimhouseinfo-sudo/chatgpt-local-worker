import fs from "fs/promises";
import path from "path";

export interface SkillSummary {
  name: string;
  description: string;
  path: string;
  source?: "project";
}

function parseFrontmatter(content: string): { name?: string; description?: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const block = match[1];
  const name = block.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = block.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  return { name, description };
}

export async function loadProjectSkills(workspaceRoot: string): Promise<SkillSummary[]> {
  const skillsDir = path.join(workspaceRoot, ".claude", "skills");
  const out: SkillSummary[] = [];

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
      if (!entry.isDirectory()) continue;

      const skillFile = path.join(full, "SKILL.md");
      try {
        const content = await fs.readFile(skillFile, "utf-8");
        const fm = parseFrontmatter(content);
        const name = fm.name || entry.name;
        const description =
          fm.description ||
          content.split("\n").find((line) => line.trim() && !line.startsWith("#"))?.trim() ||
          name;
        out.push({
          name,
          description: description.slice(0, 200),
          path: skillFile,
          source: "project",
        });
      } catch {
        await walk(full, depth + 1);
      }
    }
  }

  await walk(skillsDir, 0);
  return out;
}

export async function loadProjectSkill(
  workspaceRoot: string,
  name: string,
  maxBytes = 200_000
): Promise<{
  skill: SkillSummary;
  content: string;
  truncated: boolean;
}> {
  const skill = (await loadProjectSkills(workspaceRoot)).find(
    (candidate) => candidate.name === name
  );
  if (!skill) throw new Error(`Unknown project skill: ${name}`);

  const data = await fs.readFile(skill.path);
  const content = data.subarray(0, maxBytes).toString("utf-8");

  return {
    skill,
    content,
    truncated: data.length > maxBytes,
  };
}

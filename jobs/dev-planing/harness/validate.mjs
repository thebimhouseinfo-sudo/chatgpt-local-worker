import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateJobPack } from "../../../shared-harness/job-pack-validator.mjs";

const packDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function validateDevPlaningPack() {
  const result = await validateJobPack(packDir);
  const requiredSkills = [
    "repository-analysis.md",
    "scope-and-constraints.md",
    "architecture-impact.md",
    "implementation-sequencing.md",
    "validation-and-risk.md",
    "handoff-artifacts.md",
  ].map((name) => `skills/${name}`);

  const templates = [
    "templates/ARCHITECTURE.md",
    "templates/IMPLEMENTATION_PLAN.md",
    "templates/TODO.md",
    "templates/TASKS.md",
  ];

  const requiredFiles = [
    ...requiredSkills,
    ...templates,
    "harness/bundle-lint.mjs",
    "harness/validate.mjs",
  ];

  for (const rel of requiredFiles) {
    try {
      await fs.access(path.join(packDir, rel));
    } catch {
      result.ok = false;
      result.errors.push(`missing dev-planing component '${rel}'`);
    }
  }

  result.dev_planing = {
    skills: requiredSkills.length,
    planning_bundle: templates,
    executable_task_ledger: true,
    source_editing: false,
  };

  return result;
}

async function main() {
  const result = await validateDevPlaningPack();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}

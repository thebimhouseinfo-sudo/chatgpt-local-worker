import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateJobPack } from "../../../shared-harness/job-pack-validator.mjs";

const packDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await validateJobPack(packDir);
const requiredSkills = [
  "repository-analysis.md",
  "scope-and-constraints.md",
  "architecture-impact.md",
  "implementation-sequencing.md",
  "validation-and-risk.md",
].map((name) => `skills/${name}`);
const requiredFiles = [
  ...requiredSkills,
  "templates/DEV_PLAN.md",
  "harness/plan-lint.mjs",
  "harness/validate.mjs",
];

for (const rel of requiredFiles) {
  try {
    await fs.access(path.join(packDir, rel));
  } catch {
    result.ok = false;
    result.errors.push(`missing dev-planning component '${rel}'`);
  }
}

result.dev_planning = {
  skills: requiredSkills.length,
  template: "templates/DEV_PLAN.md",
  source_editing: false,
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;

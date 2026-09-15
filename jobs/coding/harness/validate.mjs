import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateJobPack } from "../../../shared-harness/job-pack-validator.mjs";

const packDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await validateJobPack(packDir);
const requiredSkills = [
  "skills/repository-discovery.md",
  "skills/implementation.md",
  "skills/debugging.md",
  "skills/validation.md",
  "skills/git-review.md",
];

for (const rel of requiredSkills) {
  try {
    await fs.access(path.join(packDir, rel));
  } catch {
    result.ok = false;
    result.errors.push(`missing coding skill '${rel}'`);
  }
}

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateJobPack } from "../../../shared-harness/job-pack-validator.mjs";

const packDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await validateJobPack(packDir);
const requiredSkills = [
  "repository-discovery.md","implementation.md","debugging.md","testing.md","validation.md",
  "refactoring.md","dependencies-and-apis.md","security.md","performance.md","documentation-and-release.md","git-review.md"
].map((name) => `skills/${name}`);
const requiredHarness = ["inspect-repo.mjs","quality-gate.mjs","diff-gate.mjs","change-audit.mjs","dependency-gate.mjs","completion-gate.mjs","validate.mjs"].map((name) => `harness/${name}`);
for (const rel of [...requiredSkills, ...requiredHarness]) {
  try { await fs.access(path.join(packDir, rel)); } catch { result.ok = false; result.errors.push(`missing coding component '${rel}'`); }
}
result.coding = { skills: requiredSkills.length, harness_entrypoints: requiredHarness.length, formal_planning: false };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateJobPack } from "../../../shared-harness/job-pack-validator.mjs";

const packDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await validateJobPack(packDir);
const requiredSkills = [
  "repository-discovery.md","execution-planning.md","implementation.md","debugging.md","testing.md","validation.md",
  "refactoring.md","dependencies-and-apis.md","security.md","performance.md","documentation-and-release.md","git-review.md"
].map((name) => `skills/${name}`);
const requiredHarness = ["inspect-repo.mjs","execution-preflight.mjs","quality-gate.mjs","diff-gate.mjs","change-audit.mjs","dependency-gate.mjs","completion-gate.mjs","validate.mjs"].map((name) => `harness/${name}`);
for (const rel of [...requiredSkills, ...requiredHarness]) {
  try { await fs.access(path.join(packDir, rel)); } catch { result.ok = false; result.errors.push(`missing dev-coding component '${rel}'`); }
}
result.dev_coding = {
  skills: requiredSkills.length,
  harness_entrypoints: requiredHarness.length,
  execution_planning: true,
  context_first: true,
  targeted_repository_discovery: true,
  recommends_dev_planing_for_deep_planning: true,
  formal_plan_artifact_by_default: false,
};
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;

import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateJobPack } from "../../../shared-harness/job-pack-validator.mjs";

const packDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await validateJobPack(packDir);

result.layla = {
  universal_file_work: true,
  adaptive_workflow: true,
  specialist_job_precedence: true,
  task_appropriate_validation_required: true
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;

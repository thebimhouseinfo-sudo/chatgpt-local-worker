import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const requiredFiles = ["job.yaml", "JOB.md", "SKILL.md"];
const requiredMeta = [
  "id",
  "name",
  "version",
  "description",
  "aliases",
  "keywords",
  "inputs",
  "outputs",
  "permissions",
  "confirmation",
  "harness",
  "validators",
];

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function validateJobPack(packDir) {
  const errors = [];
  const absolute = path.resolve(packDir);

  for (const name of requiredFiles) {
    if (!(await exists(path.join(absolute, name)))) {
      errors.push(`missing ${name}`);
    }
  }

  if (!(await exists(path.join(absolute, "harness")))) {
    errors.push("missing harness/");
  }

  let meta = null;
  try {
    meta = JSON.parse(await fs.readFile(path.join(absolute, "job.yaml"), "utf8"));
  } catch (error) {
    errors.push(
      `job.yaml must use JSON-compatible YAML in v0.1: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (meta) {
    for (const key of requiredMeta) {
      if (!(key in meta)) errors.push(`job.yaml missing '${key}'`);
    }

    if (meta.id !== path.basename(absolute)) {
      errors.push(
        `job.yaml id '${meta.id}' must match directory '${path.basename(absolute)}'`
      );
    }

    const entrypoints = meta.harness?.entrypoints ?? [];
    for (const rel of entrypoints) {
      if (!(await exists(path.resolve(absolute, rel)))) {
        errors.push(`missing harness entrypoint '${rel}'`);
      }
    }

    for (const rel of meta.validators ?? []) {
      if (!(await exists(path.resolve(absolute, rel)))) {
        errors.push(`missing validator '${rel}'`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    pack: absolute,
    id: meta?.id ?? path.basename(absolute),
    errors,
  };
}

export async function validateAllJobs(jobsRoot) {
  const absolute = path.resolve(jobsRoot);
  const entries = await fs.readdir(absolute, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    results.push(await validateJobPack(path.join(absolute, entry.name)));
  }

  return {
    ok: results.every((result) => result.ok),
    jobs_root: absolute,
    results,
  };
}

async function main() {
  const thisFile = fileURLToPath(import.meta.url);
  const repoRoot = path.resolve(path.dirname(thisFile), "..");
  const argIndex = process.argv.indexOf("--job");

  const result =
    argIndex >= 0 && process.argv[argIndex + 1]
      ? await validateJobPack(process.argv[argIndex + 1])
      : await validateAllJobs(path.join(repoRoot, "jobs"));

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}

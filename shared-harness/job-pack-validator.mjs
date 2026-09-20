import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const requiredFiles = ["job.yaml", "JOB.md", "SKILL.md"];
const requiredMeta = [
  "id",
  "name",
  "version",
  "status",
  "description",
  "aliases",
  "keywords",
  "inputs",
  "outputs",
  "permissions",
  "confirmation",
  "skills",
  "harness",
  "validators",
];
const allowedStatuses = new Set(["ready", "placeholder"]);

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function resolveInsidePack(packDir, rel) {
  if (typeof rel !== "string" || !rel.trim()) {
    throw new Error("empty relative path");
  }
  const normalized = rel.replaceAll("\\", "/").replace(/^\.\/+/, "");
  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.split("/").some((part) => part === ".." || part === "")
  ) {
    throw new Error("path escapes Job Pack");
  }
  const absolute = path.resolve(packDir, ...normalized.split("/"));
  const root = path.resolve(packDir) + path.sep;
  if (absolute !== path.resolve(packDir) && !absolute.startsWith(root)) {
    throw new Error("path escapes Job Pack");
  }
  return absolute;
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

    if (!allowedStatuses.has(meta.status)) {
      errors.push(`job.yaml status must be one of: ${[...allowedStatuses].join(", ")}`);
    }

    const workspaceInput = Array.isArray(meta.inputs)
      ? meta.inputs.find((item) => item?.key === "workspace")
      : null;
    if (!workspaceInput || workspaceInput.required === false) {
      errors.push("job.yaml must define required input 'workspace'");
    }

    for (const rel of meta.skills ?? []) {
      try {
        if (!(await exists(resolveInsidePack(absolute, rel)))) {
          errors.push(`missing skill '${rel}'`);
        }
      } catch {
        errors.push(`invalid skill path '${rel}'`);
      }
    }

    const entrypoints = meta.harness?.entrypoints ?? [];
    for (const rel of entrypoints) {
      try {
        if (!(await exists(resolveInsidePack(absolute, rel)))) {
          errors.push(`missing harness entrypoint '${rel}'`);
        }
      } catch {
        errors.push(`invalid harness entrypoint path '${rel}'`);
      }
    }

    for (const rel of meta.validators ?? []) {
      try {
        if (!(await exists(resolveInsidePack(absolute, rel)))) {
          errors.push(`missing validator '${rel}'`);
        }
      } catch {
        errors.push(`invalid validator path '${rel}'`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    pack: absolute,
    id: meta?.id ?? path.basename(absolute),
    status: meta?.status ?? null,
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

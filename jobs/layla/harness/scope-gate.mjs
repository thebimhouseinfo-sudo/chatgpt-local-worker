import fs from "node:fs/promises";
import path from "node:path";

function allArgValues(name) {
  const values = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === name && process.argv[i + 1]) values.push(process.argv[i + 1]);
  }
  return values;
}

function oneArgValue(name) {
  return allArgValues(name)[0] ?? null;
}

async function resolveExistingOrLexical(target) {
  try {
    return await fs.realpath(target);
  } catch {
    return path.resolve(target);
  }
}

function isInside(root, target) {
  return target === root || target.startsWith(root + path.sep);
}

const rawWorkspace = oneArgValue("--workspace");
const targets = allArgValues("--path");

const result = {
  ok: false,
  workspace: rawWorkspace,
  resolved_workspace: null,
  targets: [],
  errors: [],
};

if (!rawWorkspace) {
  result.errors.push("missing --workspace");
} else if (!path.isAbsolute(rawWorkspace)) {
  result.errors.push("workspace must be an absolute local path");
} else if (targets.length === 0) {
  result.errors.push("at least one --path target is required");
} else {
  try {
    const workspace = await fs.realpath(rawWorkspace);
    const workspaceStat = await fs.stat(workspace);

    if (!workspaceStat.isDirectory()) {
      result.errors.push("workspace must point to a directory");
    } else {
      result.resolved_workspace = workspace;

      for (const rawTarget of targets) {
        if (!path.isAbsolute(rawTarget)) {
          result.targets.push({ path: rawTarget, ok: false, reason: "target must be absolute" });
          continue;
        }

        const resolvedTarget = await resolveExistingOrLexical(rawTarget);
        const inside = isInside(workspace, resolvedTarget);
        result.targets.push({
          path: rawTarget,
          resolved_path: resolvedTarget,
          ok: inside,
          reason: inside ? null : "target is outside the confirmed workspace",
        });
      }

      result.ok =
        result.errors.length === 0 &&
        result.targets.length > 0 &&
        result.targets.every((item) => item.ok);
    }
  } catch (error) {
    result.errors.push(
      `workspace is not accessible: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;

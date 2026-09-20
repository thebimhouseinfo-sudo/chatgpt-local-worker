import fs from "node:fs/promises";
import path from "node:path";

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const rawWorkspace = argValue("--workspace");

const result = {
  ok: false,
  workspace: rawWorkspace,
  resolved_workspace: null,
  warnings: [],
  errors: [],
};

if (!rawWorkspace) {
  result.errors.push("missing --workspace");
} else if (!path.isAbsolute(rawWorkspace)) {
  result.errors.push("workspace must be an absolute local path");
} else {
  try {
    const stat = await fs.stat(rawWorkspace);
    if (!stat.isDirectory()) {
      result.errors.push("workspace must point to an existing directory");
    } else {
      const resolved = await fs.realpath(rawWorkspace);
      result.resolved_workspace = resolved;

      if (path.parse(resolved).root === resolved) {
        result.warnings.push("workspace is a filesystem root; confirm this broad scope is intentional");
      }

      result.ok = true;
    }
  } catch (error) {
    result.errors.push(
      `workspace is not accessible: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;

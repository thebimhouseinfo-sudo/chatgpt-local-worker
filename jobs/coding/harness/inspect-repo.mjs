import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}

function run(cwd, command, args) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", shell: false });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

const cwd = path.resolve(arg("--cwd", process.cwd()));
const files = await fs.readdir(cwd).catch(() => []);
const has = (name) => files.includes(name);
const manifests = [
  "package.json", "pnpm-lock.yaml", "yarn.lock", "package-lock.json", "bun.lockb", "bun.lock",
  "pyproject.toml", "requirements.txt", "Pipfile", "poetry.lock",
  "go.mod", "Cargo.toml", "composer.json", "Gemfile", "pom.xml", "build.gradle", "build.gradle.kts"
].filter(has);

let packageScripts = {};
if (has("package.json")) {
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf8"));
    packageScripts = pkg.scripts || {};
  } catch {}
}

const gitRoot = run(cwd, "git", ["rev-parse", "--show-toplevel"]);
const git = gitRoot.ok ? {
  root: gitRoot.stdout,
  branch: run(cwd, "git", ["branch", "--show-current"]).stdout,
  status: run(cwd, "git", ["status", "--short"]).stdout.split(/\r?\n/).filter(Boolean),
} : null;

console.log(JSON.stringify({
  ok: true,
  cwd,
  git,
  manifests,
  package_scripts: packageScripts,
  signals: {
    node: has("package.json"),
    python: has("pyproject.toml") || has("requirements.txt") || has("Pipfile"),
    go: has("go.mod"),
    rust: has("Cargo.toml")
  }
}, null, 2));

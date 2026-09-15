import fs from "node:fs/promises";
import path from "node:path";
import { exists, readJson, run, lines, resolveCwd, emit } from "./lib/common.mjs";

const cwd = resolveCwd();
const entries = await fs.readdir(cwd, { withFileTypes: true }).catch(() => []);
const names = new Set(entries.map((entry) => entry.name));
const has = (name) => names.has(name);

const manifests = ["package.json","pyproject.toml","requirements.txt","Pipfile","go.mod","Cargo.toml","composer.json","Gemfile","pom.xml","build.gradle","build.gradle.kts"].filter(has);
const lockfiles = ["pnpm-lock.yaml","package-lock.json","yarn.lock","bun.lock","bun.lockb","poetry.lock","uv.lock","Pipfile.lock","Cargo.lock","composer.lock","Gemfile.lock"].filter(has);
const instructionFiles = ["AGENTS.md","CLAUDE.md","README.md","CONTRIBUTING.md","DEVELOPMENT.md"].filter(has);
const sourceDirs = ["src","app","apps","packages","lib","server","client","web","frontend","backend"].filter((name) => entries.some((entry) => entry.isDirectory() && entry.name === name));
const testDirs = ["test","tests","__tests__","spec","e2e"].filter((name) => entries.some((entry) => entry.isDirectory() && entry.name === name));

const pkg = has("package.json") ? await readJson(path.join(cwd, "package.json"), {}) : {};
let packageManager = pkg?.packageManager || null;
if (!packageManager) {
  if (has("pnpm-lock.yaml")) packageManager = "pnpm";
  else if (has("yarn.lock")) packageManager = "yarn";
  else if (has("bun.lock") || has("bun.lockb")) packageManager = "bun";
  else if (has("package-lock.json")) packageManager = "npm";
}

const workflowsDir = path.join(cwd, ".github", "workflows");
const ciWorkflows = await fs.readdir(workflowsDir).catch(() => []);
const gitRoot = run(cwd, "git", ["rev-parse", "--show-toplevel"]);
const git = gitRoot.ok ? {
  root: gitRoot.stdout,
  branch: run(cwd, "git", ["branch", "--show-current"]).stdout,
  head: run(cwd, "git", ["rev-parse", "--short", "HEAD"]).stdout,
  status: lines(run(cwd, "git", ["status", "--short", "--untracked-files=all"]).stdout),
} : null;

emit({
  ok: true,
  cwd,
  git,
  manifests,
  lockfiles,
  instruction_files: instructionFiles,
  source_dirs: sourceDirs,
  test_dirs: testDirs,
  ci_workflows: ciWorkflows,
  package_manager: packageManager,
  package_scripts: pkg?.scripts || {},
  monorepo_signals: {
    package_workspaces: Boolean(pkg?.workspaces),
    pnpm_workspace: await exists(path.join(cwd, "pnpm-workspace.yaml")),
    turbo: await exists(path.join(cwd, "turbo.json")),
    nx: await exists(path.join(cwd, "nx.json")),
  },
  languages: {
    node: has("package.json"),
    python: has("pyproject.toml") || has("requirements.txt") || has("Pipfile"),
    go: has("go.mod"),
    rust: has("Cargo.toml"),
    java: has("pom.xml") || has("build.gradle") || has("build.gradle.kts"),
  },
});

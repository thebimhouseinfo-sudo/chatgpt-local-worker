import path from "node:path";
import fs from "node:fs/promises";
import { arg, flag, exists, readJson, run, resolveCwd, emit, unique } from "./lib/common.mjs";

const cwd = resolveCwd();
const execute = flag("--run");
const timeoutMs = Number(arg("--timeout-ms", "600000"));
const selectedCategories = new Set(String(arg("--categories", "")).split(",").map((v) => v.trim()).filter(Boolean));
const commands = [];
const add = (category, reason, command, args) => commands.push({ category, reason, command, args });

if (await exists(path.join(cwd, "package.json"))) {
  const pkg = await readJson(path.join(cwd, "package.json"), {});
  const scripts = pkg?.scripts || {};
  let pm = "npm";
  if (await exists(path.join(cwd, "pnpm-lock.yaml"))) pm = "pnpm";
  else if (await exists(path.join(cwd, "yarn.lock"))) pm = "yarn";
  else if (await exists(path.join(cwd, "bun.lock")) || await exists(path.join(cwd, "bun.lockb"))) pm = "bun";
  const scriptOrder = [
    ["format:check", "format"], ["format-check", "format"], ["lint", "lint"],
    ["typecheck", "type"], ["type-check", "type"], ["check", "type"],
    ["test:unit", "test"], ["test", "test"], ["test:integration", "test"],
    ["build", "build"]
  ];
  const seenScripts = new Set();
  for (const [name, category] of scriptOrder) {
    if (!(name in scripts) || seenScripts.has(name)) continue;
    seenScripts.add(name);
    add(category, `package script: ${name}`, pm, ["run", name]);
  }
}

if (await exists(path.join(cwd, "go.mod"))) {
  add("test", "go.mod", "go", ["test", "./..."]);
  add("lint", "go.mod", "go", ["vet", "./..."]);
}
if (await exists(path.join(cwd, "Cargo.toml"))) {
  add("format", "Cargo.toml", "cargo", ["fmt", "--", "--check"]);
  add("test", "Cargo.toml", "cargo", ["test"]);
}
const pythonProject = await exists(path.join(cwd, "pyproject.toml")) || await exists(path.join(cwd, "requirements.txt")) || await exists(path.join(cwd, "Pipfile"));
const pythonTests = await exists(path.join(cwd, "tests")) || await exists(path.join(cwd, "test"));
if (pythonProject && pythonTests) add("test", "python project with tests", process.platform === "win32" ? "python" : "python3", ["-m", "pytest"]);

const rootFiles = await fs.readdir(cwd).catch(() => []);
const sln = rootFiles.find((name) => name.endsWith(".sln"));
if (sln) add("test", sln, "dotnet", ["test", sln]);
if (await exists(path.join(cwd, "mvnw")) || await exists(path.join(cwd, "mvnw.cmd"))) {
  const wrapper = process.platform === "win32" ? path.join(cwd, "mvnw.cmd") : path.join(cwd, "mvnw");
  add("test", "Maven wrapper", wrapper, ["test"]);
} else if (await exists(path.join(cwd, "pom.xml"))) add("test", "pom.xml", "mvn", ["test"]);
if (await exists(path.join(cwd, "gradlew")) || await exists(path.join(cwd, "gradlew.bat"))) {
  const wrapper = process.platform === "win32" ? path.join(cwd, "gradlew.bat") : path.join(cwd, "gradlew");
  add("test", "Gradle wrapper", wrapper, ["test"]);
}

const deduped = [];
const seen = new Set();
for (const item of commands) {
  const key = [item.command, ...item.args].join("\0");
  if (!seen.has(key)) { seen.add(key); deduped.push(item); }
}
const filtered = selectedCategories.size ? deduped.filter((item) => selectedCategories.has(item.category)) : deduped;
const results = execute ? filtered.map((item) => ({ ...item, ...run(cwd, item.command, item.args, { timeoutMs }) })) : [];
const ok = !execute || results.every((result) => result.ok);

emit({
  ok,
  cwd,
  mode: execute ? "run" : "discover",
  selected_categories: [...selectedCategories],
  discovered: filtered.map((item) => ({ category: item.category, reason: item.reason, command: [item.command, ...item.args].join(" ") })),
  results,
  note: execute ? "Executed discovered checks. Repository-specific guidance still outranks this generic gate." : "Discovery only. Add --run, optionally --categories lint,type,test,build,format, after choosing appropriate checks."
});
if (!ok) process.exitCode = 1;

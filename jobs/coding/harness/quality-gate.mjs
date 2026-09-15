import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }
function run(cwd, command, args) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", shell: false, stdio: "pipe" });
  return { command: [command, ...args].join(" "), status: result.status, ok: result.status === 0, stdout: (result.stdout || "").trim(), stderr: (result.stderr || "").trim() };
}

const cwd = path.resolve(arg("--cwd", process.cwd()));
const execute = process.argv.includes("--run");
const commands = [];

if (await exists(path.join(cwd, "package.json"))) {
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf8"));
    const scripts = pkg.scripts || {};
    let pm = "npm";
    if (await exists(path.join(cwd, "pnpm-lock.yaml"))) pm = "pnpm";
    else if (await exists(path.join(cwd, "yarn.lock"))) pm = "yarn";
    else if (await exists(path.join(cwd, "bun.lockb")) || await exists(path.join(cwd, "bun.lock"))) pm = "bun";
    for (const name of ["lint", "typecheck", "test", "build"]) {
      if (!(name in scripts)) continue;
      if (pm === "npm") commands.push({ reason: `package script: ${name}`, command: "npm", args: name === "test" ? ["test"] : ["run", name] });
      else commands.push({ reason: `package script: ${name}`, command: pm, args: ["run", name] });
    }
  } catch {}
}
if (await exists(path.join(cwd, "go.mod"))) commands.push({ reason: "go.mod", command: "go", args: ["test", "./..."] });
if (await exists(path.join(cwd, "Cargo.toml"))) commands.push({ reason: "Cargo.toml", command: "cargo", args: ["test"] });

const unique = [];
const seen = new Set();
for (const item of commands) {
  const key = [item.command, ...item.args].join("\0");
  if (!seen.has(key)) { seen.add(key); unique.push(item); }
}

const results = execute ? unique.map((item) => ({ ...item, ...run(cwd, item.command, item.args) })) : [];
const ok = !execute || results.every((result) => result.ok);
console.log(JSON.stringify({ ok, cwd, mode: execute ? "run" : "discover", discovered: unique.map((item) => ({ reason: item.reason, command: [item.command, ...item.args].join(" ") })), results }, null, 2));
if (!ok) process.exitCode = 1;

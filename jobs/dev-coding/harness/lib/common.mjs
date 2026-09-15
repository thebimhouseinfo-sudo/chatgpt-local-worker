import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

export function arg(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

export function flag(name) {
  return process.argv.includes(name);
}

export async function exists(target) {
  try { await fs.access(target); return true; } catch { return false; }
}

export async function readJson(target, fallback = null) {
  try { return JSON.parse(await fs.readFile(target, "utf8")); } catch { return fallback; }
}

export function lines(value) {
  return String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function unique(items) {
  return [...new Set(items)];
}

function clip(value, maxChars) {
  const text = String(value || "").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n...[truncated ${text.length - maxChars} chars]`;
}

export function run(cwd, command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: false,
    stdio: "pipe",
    timeout: options.timeoutMs ?? 600000,
    env: options.env ?? process.env,
  });
  return {
    command: [command, ...args].join(" "),
    ok: result.status === 0 && !result.error,
    status: result.status,
    signal: result.signal ?? null,
    stdout: clip(result.stdout, options.maxChars ?? 20000),
    stderr: clip(result.stderr || result.error?.message, options.maxChars ?? 20000),
  };
}

export function resolveCwd() {
  return path.resolve(arg("--cwd", process.cwd()));
}

export function emit(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

#!/usr/bin/env node
/**
 * Optional Vercel agent-browser setup. This script never makes agent-browser a
 * required GPTWorker dependency and never advertises browser tools itself.
 * The runtime discovery gate is implemented separately (B3).
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const AGENT_BROWSER_VERSION = "0.38.1";
export const AGENT_BROWSER_REQUIRED_NODE_MAJOR = 24;

export function browserConfigPath(env = process.env) {
  const root = (env.GPTWORKER_DATA_ROOT || "").trim()
    || (env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, "GPTWorker") : "")
    || (env.XDG_DATA_HOME ? path.join(env.XDG_DATA_HOME, "GPTWorker") : "")
    || path.join(os.homedir(), ".local", "share", "GPTWorker");
  return path.join(path.resolve(root), "browser-capability.json");
}

export function runOfficialCommand(command, args, { runner = spawnSync, env = process.env } = {}) {
  // On Windows npm global shims are .cmd files: use cmd.exe explicitly.
  const isWindows = process.platform === "win32";
  const executable = isWindows ? (env.ComSpec || "cmd.exe") : command;
  const commandArgs = isWindows ? ["/d", "/s", "/c", command, ...args] : args;
  const child = runner(executable, commandArgs, {
    env, encoding: "utf8", stdio: "inherit", shell: false, timeout: 180_000,
  });
  return child.status === 0 && !child.error;
}

async function writeConfig(file, settings) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + "." + process.pid + ".tmp";
  try {
    await fs.writeFile(tmp, JSON.stringify({
      schema_version: 1,
      enabled: settings.enabled,
      candidate_version: AGENT_BROWSER_VERSION,
      last_setup_status: settings.status,
      updated_at: new Date().toISOString(),
    }, null, 2) + "\n", { mode: 0o600 });
    await fs.rename(tmp, file);
  } finally {
    await fs.rm(tmp, { force: true }).catch(() => {});
  }
}

export async function configureBrowser(choice, {
  configPath = browserConfigPath(),
  nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10),
  runCommand = (command, args) => runOfficialCommand(command, args),
} = {}) {
  const enabled = String(choice).trim().toLowerCase() === "y";
  if (!enabled) {
    await writeConfig(configPath, { enabled: false, status: "DISABLED" });
    return { enabled: false, status: "DISABLED", configPath };
  }

  if (!Number.isInteger(nodeMajor) || nodeMajor < AGENT_BROWSER_REQUIRED_NODE_MAJOR) {
    await writeConfig(configPath, { enabled: true, status: "UNAVAILABLE" });
    return {
      enabled: true, status: "UNAVAILABLE", configPath,
      reason: `The pinned agent-browser@${AGENT_BROWSER_VERSION} declares Node.js >=24; detected Node.js ${process.version}. GPTWorker itself remains usable.`,
    };
  }

  for (const [command, args] of [
    ["npm", ["install", "-g", `agent-browser@${AGENT_BROWSER_VERSION}`]],
    ["agent-browser", ["install"]],
    ["agent-browser", ["doctor"]],
  ]) {
    if (!runCommand(command, args)) {
      await writeConfig(configPath, { enabled: true, status: "UNAVAILABLE" });
      return {
        enabled: true, status: "UNAVAILABLE", configPath,
        reason: `Official browser setup/diagnostic failed: ${command} ${args.join(" ")}`,
      };
    }
  }

  // Doctor is a preliminary setup check, NOT a proof of MCP schema/browser
  // compatibility; B0/B3 live health will re-evaluate before advertising tools.
  await writeConfig(configPath, { enabled: true, status: "PENDING_MCP_HEALTH" });
  return { enabled: true, status: "PENDING_MCP_HEALTH", configPath };
}

async function main() {
  const choice = process.argv[2] || "N";
  try {
    const result = await configureBrowser(choice);
    const message = result.reason || (
      result.status === "DISABLED"
        ? "Optional agent-browser disabled; no browser installation attempted."
        : "Optional browser installed/diagnosed; MCP runtime compatibility check remains required before tools can be exposed."
    );
    console.log(`[agent-browser] ${result.status}: ${message}`);
    console.log(`[agent-browser] Config: ${result.configPath}`);
    // Optional setup must never break unrelated GPTWorker setup.
  } catch (error) {
    console.error("[agent-browser] Optional setup failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1; // hard config I/O failure, rather than falsely reporting disabled
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

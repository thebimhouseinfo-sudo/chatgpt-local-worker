import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getWorkerDataRoot } from "./worker-home.js";

export const PINNED_AGENT_BROWSER_VERSION = "0.38.1";
const MIN_NODE_MAJOR = 24;
type BrowserStatus = "DISABLED" | "UNAVAILABLE" | "READY";
export interface BrowserCapability {
  status: BrowserStatus;
  enabled: boolean;
  advertised: boolean;
  reason?: string;
}
/**
 * Consent is independent of installation/health. The app must start without
 * an agent-browser binary, and even an installed binary is invisible on NO.
 * This check launches a CLI version probe only, NOT Chrome/MCP.
 */
export function getBrowserCapability(options: {
  configPath?: string;
  nodeMajor?: number;
  commandProbe?: () => { status: number | null; stdout?: string | Buffer | null; error?: Error };
} = {}): BrowserCapability {
  const configPath = options.configPath || path.join(getWorkerDataRoot(), "browser-capability.json");
  let config: any;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return { status: "DISABLED", enabled: false, advertised: false };
  }
  if (config?.enabled !== true) return { status: "DISABLED", enabled: false, advertised: false };
  if (config.schema_version !== 1 || config.candidate_version !== PINNED_AGENT_BROWSER_VERSION) {
    return { status: "UNAVAILABLE", enabled: true, advertised: false, reason: "Unrecognized browser config/version" };
  }
  if (config.last_setup_status !== "READY" || config.mcp_contract_version !== 1) {
    return { status: "UNAVAILABLE", enabled: true, advertised: false,
      reason: "Pinned browser MCP schema has not passed verified setup" };
  }
  const checked = Date.parse(config.mcp_verified_at);
  if (!Number.isFinite(checked) || checked > Date.now() + 60_000 ||
      Date.now() - checked > 24 * 60 * 60_000) {
    return { status: "UNAVAILABLE", enabled: true, advertised: false,
      reason: "Browser MCP schema verification is missing or stale; rerun setup" };
  }
  const major = options.nodeMajor ?? Number.parseInt(process.versions.node.split(".")[0], 10);
  if (major < MIN_NODE_MAJOR) {
    return { status: "UNAVAILABLE", enabled: true, advertised: false, reason: "agent-browser requires Node.js >=24" };
  }
  const probe = options.commandProbe || (() => {
    const win = process.platform === "win32";
    return spawnSync(win ? (process.env.ComSpec || "cmd.exe") : "agent-browser",
      win ? ["/d", "/s", "/c", "agent-browser", "--version"] : ["--version"],
      { encoding: "utf8", shell: false, timeout: 4000, windowsHide: true });
  });
  try {
    const result = probe();
    const versionOutput = String(result.stdout || "").trim();
    // Exact package version is mandatory; a different globally installed
    // version may change schemas and must never silently become READY.
    if (result.status !== 0 || result.error || !new RegExp(`(?:^|\\D)${PINNED_AGENT_BROWSER_VERSION.replace(/\\./g, "\\.")}(?:$|\\D)`).test(versionOutput)) {
      return { status: "UNAVAILABLE", enabled: true, advertised: false, reason: "Installed CLI unavailable or version mismatch" };
    }
  } catch {
    return { status: "UNAVAILABLE", enabled: true, advertised: false, reason: "CLI version probe failed" };
  }
  return { status: "READY", enabled: true, advertised: true };
}

export function assertBrowserCapability(): void {
  const capability = getBrowserCapability();
  if (!capability.advertised) throw new Error(`BROWSER_UNAVAILABLE: ${capability.reason || capability.status}`);
}

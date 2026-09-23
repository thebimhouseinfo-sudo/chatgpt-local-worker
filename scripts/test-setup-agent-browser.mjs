import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AGENT_BROWSER_VERSION, configureBrowser } from "./setup-agent-browser.mjs";

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-browser-setup-"));
const configPath = path.join(tmp, "browser-capability.json");
let calls = [];
const runCommand = (command, args) => { calls.push([command, args]); return true; };
try {
  // NO is consent, not installed state. A preexisting global binary changes nothing.
  let result = await configureBrowser("N", { configPath, nodeMajor: 24, runCommand });
  assert.equal(result.status, "DISABLED");
  assert.equal(JSON.parse(await fs.readFile(configPath, "utf8")).enabled, false);
  assert.deepEqual(calls, []);

  // Node <24 must fail closed without invoking the installer.
  result = await configureBrowser("Y", { configPath, nodeMajor: 22, runCommand });
  assert.equal(result.status, "UNAVAILABLE");
  assert.equal(JSON.parse(await fs.readFile(configPath, "utf8")).enabled, true);
  assert.deepEqual(calls, []);

  // YES uses only the exact pinned official install/doctor commands.
  result = await configureBrowser("Y", { configPath, nodeMajor: 24, runCommand });
  assert.equal(result.status, "PENDING_MCP_HEALTH");
  assert.deepEqual(calls, [
    ["npm", ["install", "-g", `agent-browser@${AGENT_BROWSER_VERSION}`]],
    ["agent-browser", ["install"]],
    ["agent-browser", ["doctor"]],
  ]);

  // Doctor failure is not READY even if npm and Chrome installation succeeded.
  calls = [];
  result = await configureBrowser("Y", {
    configPath, nodeMajor: 24,
    runCommand: (command, args) => {
      calls.push([command, args]);
      return command !== "agent-browser" || args[0] !== "doctor";
    },
  });
  assert.equal(result.status, "UNAVAILABLE");
  assert.equal(calls.length, 3);

  // Choosing NO on a subsequent run must revoke explicit consent.
  result = await configureBrowser("", { configPath, nodeMajor: 24, runCommand });
  assert.equal(result.status, "DISABLED");
  assert.equal(JSON.parse(await fs.readFile(configPath, "utf8")).enabled, false);
  console.log("test-setup-agent-browser: ok");
} finally {
  await fs.rm(tmp, { recursive: true, force: true });
}

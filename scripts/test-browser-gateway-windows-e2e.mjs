import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

if (process.platform !== "win32" || Number(process.versions.node.split(".")[0]) < 24) {
  console.error("ENVIRONMENT_LIMIT: full live gateway browser acceptance requires Windows and Node 24+");
  process.exit(2);
}
const root = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-browser-gateway-"));
const workdir = path.join(root, "dev-workspace");
const customDir = path.join(root, "custom-workspace");
await fs.mkdir(workdir, { recursive: true });
await fs.mkdir(customDir, { recursive: true });
const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end('<html><head><title>GPTWorker browser gateway</title></head><body>' +
    '<label for="name">Name</label><input id="name"/>' +
    '<button id="run" onclick="document.querySelector(\'#result\').textContent=\'PASS:\'+document.querySelector(\'#name\').value">Run</button>' +
    '<div id="result">NOT_RUN</div></body></html>');
});
const listen = () => new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => resolve(server.address().port));
});
const log = { result: "FAIL", checks: {}, screenshot_paths: [], node: process.version };
let mcpServer, client, registration;
try {
  const port = await listen();
  const { createMcpServer } = await import("../dist/server-factory.js");
  const work = await import("../dist/lib/work-registration.js");
  const capability = await import("../dist/lib/browser-capability.js");
  assert.equal(capability.getBrowserCapability().advertised, true,
    "Real pinned MCP setup must be READY before browser tests start");
  log.checks.pinned_live_consent = "PASS";
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  mcpServer = createMcpServer(30, "browser end-to-end fixture");
  client = new Client({ name: "gptworker-browser-gateway-e2e", version: "1.0" });
  await Promise.all([mcpServer.connect(serverTransport), client.connect(clientTransport)]);
  const tools = await client.listTools();
  const opEnum = tools.tools.find(x => x.name === "work_tool")?.inputSchema?.properties?.tool?.enum || [];
  for (const name of ["browser_open","browser_snapshot","browser_fill","browser_click","browser_get_url","browser_screenshot","browser_close"]) {
    assert.ok(opEnum.includes(name), "enabled browser tool missing: " + name);
  }
  assert.ok(!opEnum.includes("agent_browser_eval"), "unsafe upstream eval must never be exposed");
  log.checks.enabled_real_tools_list = "PASS";

  const other = await work.createWorkRegistration("layla", customDir);
  const denied = await client.callTool({ name: "work_tool", arguments: {
    execution_id: other.executionId, authority_token: other.authorityToken,
    tool: "browser_open", arguments: { url: `http://127.0.0.1:${port}/` },
  } }, undefined, { timeout: 12_000 });
  assert.equal(denied.isError, true, "Custom Job must be denied even with valid work handle");
  work.releaseWorkRegistration(other.executionId, other.authorityToken);
  log.checks.custom_job_denied = "PASS";

  registration = await work.createWorkRegistration("dev-coding", workdir);
  const call = async (tool, args = {}) => {
    const result = await client.callTool({ name: "work_tool", arguments: {
      execution_id: registration.executionId, authority_token: registration.authorityToken,
      tool, arguments: args,
    } }, undefined, { timeout: 40_000 });
    if (result.isError) throw new Error(tool + " failed: " +
      JSON.stringify(result.content).slice(0, 1200));
    return result;
  };
  const url = `http://127.0.0.1:${port}/`;
  await call("browser_open", { url });
  log.checks.open = "PASS";
  const snapshot = await call("browser_snapshot", { interactive: true });
  assert.ok(JSON.stringify(snapshot.content).includes("Run"), "Snapshot missing Run button");
  log.checks.snapshot = "PASS";
  await call("browser_fill", { selector: "#name", text: "DEV-CODING" });
  await call("browser_click", { selector: "#run" });
  const after = await call("browser_snapshot", { interactive: false });
  assert.ok(JSON.stringify(after.content).includes("PASS:DEV-CODING"), "Missing observed UI behavior");
  log.checks.ui_goal_observed = "PASS";
  const screenshot = await call("browser_screenshot", { format: "png" });
  assert.ok(screenshot.content.some(x => x.type === "image" || x.type === "text"));
  const evidence = path.join(workdir, ".gptworker", "dev-coding", "browser-evidence");
  const perExecution = await fs.readdir(evidence, { withFileTypes: true });
  assert.ok(perExecution.some(x => x.isDirectory()), "Missing approved screenshot directory");
  log.screenshot_paths = perExecution.map(x => x.name);
  log.checks.workspace_screenshot = "PASS";

  // Revocation invalidates old authority and releases the owned browser process.
  work.releaseWorkRegistration(registration.executionId, registration.authorityToken);
  const stale = await client.callTool({ name: "work_tool", arguments: {
    execution_id: registration.executionId, authority_token: registration.authorityToken,
    tool: "browser_snapshot", arguments: {},
  } }, undefined, { timeout: 12_000 });
  assert.equal(stale.isError, true, "Revoked handle must not permit browser calls");
  registration = null;
  log.checks.job_stop_revokes = "PASS";

  const cfg = path.join(process.env.LOCALAPPDATA, "GPTWorker", "browser-capability.json");
  const current = JSON.parse(await fs.readFile(cfg, "utf8"));
  await fs.writeFile(cfg, JSON.stringify({ ...current, enabled: false, last_setup_status: "DISABLED" }));
  const [offClientT, offServerT] = InMemoryTransport.createLinkedPair();
  const offServer = createMcpServer(30, "disabled browser fixture");
  const offClient = new Client({ name: "gptworker-browser-disabled", version: "1.0" });
  try {
    await Promise.all([offServer.connect(offServerT), offClient.connect(offClientT)]);
    const offTools = await offClient.listTools();
    const offEnum = offTools.tools.find(x => x.name === "work_tool")?.inputSchema?.properties?.tool?.enum || [];
    assert.equal(offEnum.some(x => x.startsWith("browser_")), false, "Disabled browser leaked into tools/list");
    log.checks.disabled_real_tools_list = "PASS";
  } finally {
    await offClient.close().catch(() => {});
    await offServer.close().catch(() => {});
  }
  log.result = "PASS";
} catch (error) {
  log.error = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
} finally {
  if (registration) {
    const work = await import("../dist/lib/work-registration.js");
    work.releaseWorkRegistration(registration.executionId, registration.authorityToken);
  }
  await client?.close().catch(() => {});
  await mcpServer?.close().catch(() => {});
  await new Promise(resolve => server.close(() => resolve()));
  console.log(JSON.stringify(log, null, 2));
  await fs.rm(root, { recursive: true, force: true, maxRetries: 6, retryDelay: 250 }).catch(() => {});
}

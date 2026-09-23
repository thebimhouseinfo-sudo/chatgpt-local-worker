import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getBrowserCapability } from "../dist/lib/browser-capability.js";
import { registerWorkGateway, FAMILY_TOOLS } from "../dist/tools/work-gateway.js";
import { assertApprovedBrowserUrl } from "../dist/lib/browser-mcp-adapter.js";
import { createMcpServer } from "../dist/server-factory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-browser-cap-"));
const cfg = path.join(tmp, "browser-capability.json");
const original = process.env.GPTWORKER_DATA_ROOT;
process.env.GPTWORKER_DATA_ROOT = tmp;
try {
  const healthy = () => ({ status: 0, stdout: "agent-browser 0.38.1" });
  assert.equal(getBrowserCapability({ configPath: cfg, nodeMajor: 24, commandProbe: healthy }).advertised, false);
  await fs.writeFile(cfg, JSON.stringify({
    schema_version: 1, enabled: false, candidate_version: "0.38.1",
    last_setup_status: "READY", mcp_contract_version: 1,
    mcp_verified_at: new Date().toISOString(),
  }));
  assert.equal(getBrowserCapability({ configPath: cfg, nodeMajor: 24, commandProbe: healthy }).advertised, false);
  await fs.writeFile(cfg, JSON.stringify({
    schema_version: 1, enabled: true, candidate_version: "0.38.1",
    last_setup_status: "READY", mcp_contract_version: 1,
    mcp_verified_at: new Date().toISOString(),
  }));
  assert.equal(getBrowserCapability({ configPath: cfg, nodeMajor: 22, commandProbe: healthy }).advertised, false);
  assert.equal(getBrowserCapability({ configPath: cfg, nodeMajor: 24, commandProbe: healthy }).advertised, true);
  assert.equal(getBrowserCapability({ configPath: cfg, nodeMajor: 24, commandProbe: () => ({ status: 0, stdout: "agent-browser 0.37.0" }) }).advertised, false);

  // Version match without a completed MCP handshake is insufficient.\n  await fs.writeFile(cfg, JSON.stringify({ schema_version: 1, enabled: true,\n    candidate_version: "0.38.1", last_setup_status: "PENDING_MCP_HEALTH" }));\n  assert.equal(getBrowserCapability({ configPath: cfg, nodeMajor: 24, commandProbe: healthy }).advertised, false);\n  await fs.writeFile(cfg, JSON.stringify({ schema_version: 1, enabled: true,\n    candidate_version: "0.38.1", last_setup_status: "READY", mcp_contract_version: 1,\n    mcp_verified_at: new Date(Date.now() - 48 * 60 * 60_000).toISOString() }));\n  assert.equal(getBrowserCapability({ configPath: cfg, nodeMajor: 24, commandProbe: healthy }).advertised, false);\n\n  const capture = new Map();
  const serverStub = {
    registerTool(name, config, callback) {
      capture.set(name, { config, callback });
      return { remove() {}, update() {}, enable() {}, disable() {}, enabled: true };
    },
  };
  registerWorkGateway(serverStub, 30, { browserAdvertised: false });
  const hidden = capture.get("work_tool").config.inputSchema.tool.options;
  assert.equal(hidden.some(name => FAMILY_TOOLS.browser.includes(name)), false);
  capture.clear();
  registerWorkGateway(serverStub, 30, { browserAdvertised: true });
  const visible = capture.get("work_tool").config.inputSchema.tool.options;
  assert.equal(FAMILY_TOOLS.browser.every(name => visible.includes(name)), true);
  assert.equal(visible.includes("agent_browser_eval"), false);

  // An actual MCP tools/list roundtrip checks the schema advertised to ChatGPT.
  // Current CI Node 22 intentionally cannot enable this optional release.
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer(30, "test");
  const client = new Client({ name: "browser-capability-test", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const list = await client.listTools();
  const work = list.tools.find(tool => tool.name === "work_tool");
  assert.ok(work, "missing work_tool");
  const advertised = work.inputSchema.properties.tool.enum;
  assert.equal(advertised.some(name => FAMILY_TOOLS.browser.includes(name)), false);
  await client.close();
  await server.close();

  for (const allowed of ["http://127.0.0.1:3000/", "http://localhost:5173/page", "http://[::1]:8000/"]) {
    assert.ok(assertApprovedBrowserUrl(allowed));
  }
  for (const denied of ["https://example.com", "file:///etc/passwd", "http://localhost.evil.test",
    "http://user:password@localhost/", "javascript:alert(1)"]) {
    assert.throws(() => assertApprovedBrowserUrl(denied), /BROWSER_ORIGIN_DENIED/);
  }
  console.log("test-browser-capability: ok");
} finally {
  if (original === undefined) delete process.env.GPTWORKER_DATA_ROOT;
  else process.env.GPTWORKER_DATA_ROOT = original;
  await fs.rm(tmp, { recursive: true, force: true });
}

import assert from "node:assert/strict";
import { validateMcpToolset, verifyBrowserMcp, REQUIRED_BROWSER_TOOLS, BROWSER_MCP_CONTRACT_VERSION } from "./verify-browser-mcp.mjs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";

const tools = Object.entries(REQUIRED_BROWSER_TOOLS).map(([name, required]) => ({
  name,
  inputSchema: {
    type: "object",
    properties: Object.fromEntries(required.map(field => [field, { type: "string" }])),
    required: name === "agent_browser_open" ? [] : required,
  },
}));
let checked = validateMcpToolset(tools);
assert.equal(checked.ok, true, JSON.stringify(checked));
assert.equal(checked.contract_version, BROWSER_MCP_CONTRACT_VERSION);
checked = validateMcpToolset(tools.filter(x => x.name !== "agent_browser_fill"));
assert.equal(checked.ok, false);
assert.deepEqual(checked.missing, ["agent_browser_fill"]);
const mismatch = structuredClone(tools);
const fill = mismatch.find(x => x.name === "agent_browser_fill");
fill.inputSchema.properties.text.type = "boolean";
checked = validateMcpToolset(mismatch);
assert.equal(checked.ok, false);
assert.ok(checked.mismatched.includes("agent_browser_fill:invalid-text"));
const weakRequired = structuredClone(tools);
weakRequired.find(x => x.name === "agent_browser_click").inputSchema.required = [];
assert.ok(validateMcpToolset(weakRequired).mismatched.includes("agent_browser_click:missing-required-selector"));
// Exercise the real MCP initialize/tools/list transport, not just static fixtures.
const linked = InMemoryTransport.createLinkedPair();
const mockServer = new McpServer({ name: "fake-pinned-agent-browser", version: "0.38.1" }, {
  capabilities: { tools: {} },
});
for (const [name, fields] of Object.entries(REQUIRED_BROWSER_TOOLS)) {
  const inputSchema = Object.fromEntries(fields.map(field => [field, z.string()]));
  mockServer.registerTool(name, { inputSchema }, async () => ({
    content: [{ type: "text", text: "ok" }],
  }));
}
await mockServer.connect(linked[1]);
try {
  const real = await verifyBrowserMcp({ transportFactory: () => linked[0] });
  assert.equal(real.ok, true);
  assert.equal(real.tool_count, tools.length);
} finally {
  await mockServer.close();
}

const brokenPair = InMemoryTransport.createLinkedPair();
const brokenServer = new McpServer({ name: "fake-broken-agent-browser", version: "0.38.1" }, {
  capabilities: { tools: {} },
});
brokenServer.registerTool("agent_browser_open", { inputSchema: { url: z.string().optional() } },
  async () => ({ content: [{ type: "text", text: "ok" }] }));
await brokenServer.connect(brokenPair[1]);
try {
  await assert.rejects(
    verifyBrowserMcp({ transportFactory: () => brokenPair[0] }),
    /BROWSER_MCP_SCHEMA_MISMATCH/
  );
} finally {
  await brokenServer.close();
}

console.log("test-browser-mcp-contract: ok");

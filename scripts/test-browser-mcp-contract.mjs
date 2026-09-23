import assert from "node:assert/strict";
import { validateMcpToolset, REQUIRED_BROWSER_TOOLS, BROWSER_MCP_CONTRACT_VERSION } from "./verify-browser-mcp.mjs";

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
console.log("test-browser-mcp-contract: ok");

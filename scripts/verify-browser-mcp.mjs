import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export const BROWSER_MCP_CONTRACT_VERSION = 1;
export const REQUIRED_BROWSER_TOOLS = Object.freeze({
  agent_browser_open: ["url"],
  agent_browser_snapshot: [],
  agent_browser_click: ["selector"],
  agent_browser_fill: ["selector", "text"],
  agent_browser_press: ["key"],
  agent_browser_wait_for_selector: ["selector"],
  agent_browser_screenshot: ["path"],
  agent_browser_get_url: [],
  agent_browser_close: [],
});
const DEFAULT_TIMEOUT = 12_000;

/** Schema contract, not a browser startup or URL-navigation check. */
export function validateMcpToolset(tools) {
  const byName = new Map();
  for (const tool of tools || []) {
    if (tool && typeof tool.name === "string") byName.set(tool.name, tool);
  }
  const missing = [], mismatched = [];
  for (const [name, required] of Object.entries(REQUIRED_BROWSER_TOOLS)) {
    const schema = byName.get(name)?.inputSchema;
    if (!schema) { missing.push(name); continue; }
    if (schema.type !== "object" || !schema.properties || typeof schema.properties !== "object") {
      mismatched.push(name + ":invalid-input-schema"); continue;
    }
    for (const field of required) {
      const prop = schema.properties[field];
      if (!prop || prop.type !== "string") mismatched.push(name + ":invalid-" + field);
    }
    // Tests must not mistake an optional field for a required one.
    if (["agent_browser_click", "agent_browser_fill", "agent_browser_press", "agent_browser_wait_for_selector"].includes(name)) {
      const actuallyRequired = schema.required || [];
      for (const field of required) if (!actuallyRequired.includes(field))
        mismatched.push(name + ":missing-required-" + field);
    }
  }
  return { ok: missing.length === 0 && mismatched.length === 0,
    contract_version: BROWSER_MCP_CONTRACT_VERSION, missing, mismatched };
}

export async function verifyBrowserMcp({ transportFactory, timeoutMs = DEFAULT_TIMEOUT } = {}) {
  const win = process.platform === "win32";
  const transport = transportFactory?.() || new StdioClientTransport({
    command: win ? (process.env.ComSpec || "cmd.exe") : "agent-browser",
    args: win ? ["/d", "/s", "/c", "agent-browser", "mcp"] : ["mcp"],
    stderr: "pipe",
  });
  const client = new Client({ name: "gptworker-browser-contract-check", version: "1.0.0" });
  let timer;
  const bounded = promise => Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("BROWSER_MCP_HEALTH_TIMEOUT")), timeoutMs); }),
  ]).finally(() => { clearTimeout(timer); timer = undefined; });
  try {
    await bounded(client.connect(transport));
    let cursor, pages = 0;
    const tools = [];
    do {
      if (++pages > 20) throw new Error("BROWSER_MCP_SCHEMA_PAGINATION_LIMIT");
      const page = await bounded(client.listTools(cursor ? { cursor } : {}));
      tools.push(...page.tools);
      cursor = page.nextCursor;
    } while (cursor);
    const checked = validateMcpToolset(tools);
    if (!checked.ok) throw new Error("BROWSER_MCP_SCHEMA_MISMATCH: " + JSON.stringify(checked));
    return { ...checked, pages, tool_count: tools.length };
  } finally {
    clearTimeout(timer);
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
  }
}

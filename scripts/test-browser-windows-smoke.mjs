import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { verifyBrowserMcp } from "./verify-browser-mcp.mjs";

const isWindows = process.platform === "win32";
if (!isWindows || Number(process.versions.node.split(".")[0]) < 24) {
  console.error("ENVIRONMENT_LIMIT: Windows and Node.js >=24 are required for this real-browser smoke.");
  process.exit(2);
}

const root = process.cwd();
const evidenceRoot = path.join(root, ".gptworker", "dev-coding", "windows-browser-smoke");
await fs.mkdir(evidenceRoot, { recursive: true });
const output = path.join(evidenceRoot, "browser-smoke-" + randomUUID() + ".png");
const server = http.createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end('<!doctype html><html><head><title>GPTWorker Browser Smoke</title></head><body>' +
    '<label for="name">Name</label><input id="name" />' +
    '<button id="go" onclick="document.getElementById(\'result\').textContent=\'HELLO \'+document.getElementById(\'name\').value">Go</button>' +
    '<p id="result">NOT RUN</p></body></html>');
});
const listen = () => new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => resolve(server.address().port));
});
let transport, client, session;
const report = { os: process.platform, node: process.version, result: "NOT_RUN", evidence: output, checks: {} };
try {
  const verified = await verifyBrowserMcp();
  report.checks.upstream_mcp_schema = verified.ok ? "PASS" : "FAIL";
  if (!verified.ok) throw new Error("Official agent-browser MCP schema verification failed");
  const port = await listen();
  const url = `http://127.0.0.1:${port}/`;
  session = "gptworker-smoke-" + randomUUID();
  transport = new StdioClientTransport({
    command: process.env.ComSpec || "cmd.exe",
    args: ["/d", "/s", "/c", "agent-browser", "mcp"],
    env: { ...process.env, AGENT_BROWSER_SESSION: session, AGENT_BROWSER_HEADED: "false" },
    stderr: "pipe",
  });
  client = new Client({ name: "gptworker-win-smoke", version: "1.0.0" });
  await client.connect(transport);
  async function call(name, args = {}) {
    const result = await client.callTool({ name: "agent_browser_" + name, arguments: {
      ...args, session, allowedDomains: ["127.0.0.1", "localhost"],
    } }, undefined, { timeout: 30000 });
    if (result.isError) throw new Error(name + " failed: " +
      result.content.filter(x => x.type === "text").map(x => x.text).join(" ").slice(0, 400));
    return result;
  }
  await call("open", { url, webmcp: false });
  report.checks.localhost_navigation = "PASS";
  const tree = await call("snapshot", { interactive: true });
  if (!JSON.stringify(tree.content).includes("Go")) throw new Error("Snapshot does not contain Go button");
  report.checks.snapshot = "PASS";
  await call("fill", { selector: "#name", text: "GPTWorker" });
  await call("click", { selector: "#go" });
  const result = await call("get_text", { selector: "#result" });
  if (!JSON.stringify(result.content).includes("HELLO GPTWorker")) throw new Error("Browser interaction did not update DOM");
  report.checks.interaction = "PASS";
  await call("screenshot", { path: output, format: "png", fullPage: false });
  const stat = await fs.stat(output);
  if (!stat.isFile() || stat.size < 100) throw new Error("Screenshot missing or empty");
  report.checks.screenshot = "PASS";
  const currentUrl = await call("get_url");
  if (!JSON.stringify(currentUrl.content).includes(url)) throw new Error("Current URL does not match localhost fixture");
  report.checks.current_url = "PASS";
  await call("close", { all: false });
  report.checks.session_close = "PASS";
  report.result = "PASS";
} catch (error) {
  report.result = "FAIL";
  report.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  await client?.callTool({ name: "agent_browser_close", arguments: {
    session, all: false,
  } }).catch(() => {});
  await client?.close().catch(() => {});
  await transport?.close().catch(() => {});
  await new Promise(resolve => server.close(() => resolve())).catch(() => {});
  console.log(JSON.stringify(report, null, 2));
}

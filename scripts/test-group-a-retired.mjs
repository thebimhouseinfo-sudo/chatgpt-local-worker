import fs from "node:fs/promises";

const retiredPaths = [
  "src/admin/localhost-guard.ts",
  "src/admin/routes.ts",
  "src/admin/server.ts",
  "public/ui/app.js",
  "public/ui/index.html",
  "public/ui/styles.css",
  "src/lib/mcp-upstream-manager.ts",
  "src/lib/mcp-upstream-config.ts",
  "src/lib/mcp-oauth-provider.ts",
  "src/lib/mcp-tool-proxy.ts",
  "src/tools/mcp-bridge.ts",
  "profiles/mcp-upstream.json",
  "src/lib/codex-hooks.ts",
  "src/tools/ponytail.ts",
  "src/lib/plugin-config.ts",
  "scripts/test-mcp-upstream.mjs",
  "scripts/test-mcp-oauth.mjs",
  "scripts/test-mcp-bridge-integration.mjs",
  "scripts/mock-http-mcp.mjs",
  "scripts/mock-stdio-mcp.mjs",
  "scripts/init-claude-md.mjs",
  "src/tools/node-repl.ts"
];

async function exists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

const failures = [];

for (const active of retiredPaths) {
  if (await exists(active)) failures.push(`retired Group A path still exists: ${active}`);
}

const checks = {
  "src/index.ts": [
    "startAdminServer",
    "ADMIN_PORT",
    "ADMIN_TOKEN",
    "initUpstreamManager",
    "mcp-upstream-manager",
  ],
  "src/lib/mcp-session-manager.ts": [
    "mcp-upstream-manager",
    "getUpstreamManager",
    "codex-hooks",
    "getCachedCodexSessionStartHooks",
    "primeCodexSessionStartHooks",
  ],
  "src/server-factory.ts": ["McpUpstreamManager", "mcp-upstream-manager"],
  "src/tools/work-gateway.ts": [
    "McpUpstreamManager",
    "mcp-upstream-manager",
    "mcp-bridge",
    "ponytail.js",
    "mcp_servers",
    "mcp_tools",
    "mcp_call",
  ],
  "src/tools/context.ts": [
    "mcp-upstream-manager",
    "getUpstreamManager",
    "upstream_mcp",
    ".codex/config.toml",
  ],
  "src/lib/quickstart.ts": ["mcp_servers", "mcp_tools", "mcp_call"],
  ".env.example": ["ADMIN_PORT", "ADMIN_TOKEN", "MCP_UPSTREAM_CONFIG"],
};

for (const [file, forbidden] of Object.entries(checks)) {
  const source = await fs.readFile(file, "utf8");
  for (const token of forbidden) {
    if (source.includes(token)) {
      failures.push(`${file} still contains retired Group A reference: ${token}`);
    }
  }
}

if (failures.length) {
  console.error("Group A retirement FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("test-group-a-retired: ok — retired Group A surfaces remain absent");

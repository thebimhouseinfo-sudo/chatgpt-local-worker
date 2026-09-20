import fs from "node:fs/promises";

const serverFactory = await fs.readFile("src/server-factory.ts", "utf8");
const sessionManager = await fs.readFile("src/lib/mcp-session-manager.ts", "utf8");
const tray = await fs.readFile("gptworker-tray.ps1", "utf8");
const start = await fs.readFile("start.ps1", "utf8");
const tunnel = await fs.readFile("openai-tunnel.ps1", "utf8");

const heavyStaticImports = [
  "./tools/filesystem.js",
  "./tools/shell.js",
  "./tools/git.js",
  "./tools/context.js",
  "./tools/node-repl.js",
  "./tools/ponytail.js",
  "./tools/rewind.js",
  "./tools/mcp-bridge.js",
];

for (const modulePath of heavyStaticImports) {
  const staticImport = new RegExp(
    `^import\\s+[^\\n]+from\\s+["']${modulePath.replaceAll(".", "\\.")}["'];?`,
    "m"
  );
  if (staticImport.test(serverFactory)) {
    throw new Error(`execution module must stay lazy: ${modulePath}`);
  }
  if (!serverFactory.includes(`import("${modulePath}")`)) {
    throw new Error(`lazy execution import missing: ${modulePath}`);
  }
}

if (!serverFactory.includes("onWorkActivated: () => executionRuntime.activate()")) {
  throw new Error("execution runtime is not tied to confirmed work activation");
}
if (!serverFactory.includes("onWorkStopped: () => executionRuntime.deactivate()")) {
  throw new Error("execution runtime is not unloaded on work stop");
}
if (sessionManager.includes("await runCodexSessionStartHooks")) {
  throw new Error("SessionStart hooks must not block MCP initialize");
}
if (!sessionManager.includes("getCachedCodexSessionStartHooks()")) {
  throw new Error("cached hook instructions are not used during initialize");
}
if (!sessionManager.includes("void primeCodexSessionStartHooks()")) {
  throw new Error("SessionStart hook background warmup is missing");
}

if (!tray.includes('"start.ps1") -ExtraArgs @("-Port", "$WorkerPort", "-Detach")')) {
  throw new Error("tray must launch Worker in detached mode");
}
if (!tray.includes('"openai-tunnel.ps1") -ExtraArgs @("-Port", "$WorkerPort", "-Detach")')) {
  throw new Error("tray must launch tunnel in detached mode");
}
if (!start.includes("[switch]$Detach") || !start.includes('Start-Process -FilePath "node.exe"')) {
  throw new Error("start.ps1 detached node launch is missing");
}
if (!tunnel.includes("[switch]$Detach") || !tunnel.includes("Start-Process -FilePath $bin")) {
  throw new Error("openai-tunnel.ps1 detached tunnel launch is missing");
}

console.log("test-idle-runtime: ok");

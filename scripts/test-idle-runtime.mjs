import fs from "node:fs/promises";

const serverFactory = await fs.readFile("src/server-factory.ts", "utf8");
const workGateway = await fs.readFile("src/tools/work-gateway.ts", "utf8");
const jobs = await fs.readFile("src/tools/jobs.ts", "utf8");
const sessionManager = await fs.readFile("src/lib/mcp-session-manager.ts", "utf8");
const tray = await fs.readFile("gptworker-tray.ps1", "utf8");
const start = await fs.readFile("start.ps1", "utf8");
const tunnel = await fs.readFile("openai-tunnel.ps1", "utf8");

const heavyModules = [
  "./tools/filesystem.js",
  "./tools/shell.js",
  "./tools/git.js",
  "./tools/context.js",
  "./tools/node-repl.js",
  "./tools/ponytail.js",
  "./tools/rewind.js",
  "./tools/mcp-bridge.js",
];

for (const modulePath of heavyModules) {
  if (serverFactory.includes(`import("${modulePath}")`)) {
    throw new Error(`server factory must not preload execution module: ${modulePath}`);
  }
}

if (!serverFactory.includes("registerWorkGateway(")) {
  throw new Error("lightweight work gateway is not registered");
}
if (!serverFactory.includes("registerWorkspaceDiscoveryTool(")) {
  throw new Error("minimal pre-confirmation workspace discovery is not registered");
}
if (!serverFactory.includes(".prepareJob(job.id")) {
  throw new Error("nominated Job profile is not preloaded while awaiting confirmation");
}
if (serverFactory.includes("onWorkActivated") || jobs.includes("onWorkActivated")) {
  throw new Error("Job confirmation must not activate execution modules");
}
if (!workGateway.includes('import("./filesystem.js")')) {
  throw new Error("filesystem family is not lazy imported by work gateway");
}
if (!workGateway.includes('import("./shell.js")')) {
  throw new Error("shell family is not lazy imported by work gateway");
}
if (!workGateway.includes('import("./git.js")')) {
  throw new Error("git family is not lazy imported by work gateway");
}
if (!workGateway.includes("async resolve(tool: string)")) {
  throw new Error("work gateway does not resolve operations on demand");
}
if (!workGateway.includes("async prepareJob(jobId: string")) {
  throw new Error("work gateway does not support nomination-time preload");
}
if (!workGateway.includes("preloadGeneration")) {
  throw new Error("work gateway must invalidate stale nomination preload generations");
}

if (sessionManager.includes("refreshProxiedTools")) {
  throw new Error("MCP session startup must not auto-discover upstream tools");
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

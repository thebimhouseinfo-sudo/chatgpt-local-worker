import fs from "node:fs/promises";

const serverFactory = await fs.readFile("src/server-factory.ts", "utf8");
const workGateway = await fs.readFile("src/tools/work-gateway.ts", "utf8");
const jobs = await fs.readFile("src/tools/jobs.ts", "utf8");
const sessionManager = await fs.readFile("src/lib/mcp-session-manager.ts", "utf8");
const tray = await fs.readFile("gptworker-tray.ps1", "utf8");
const start = await fs.readFile("start.ps1", "utf8");
const tunnel = await fs.readFile("openai-tunnel.ps1", "utf8");
if (/[^\x00-\x7F]/.test(tunnel)) {
  throw new Error("openai-tunnel.ps1 must remain ASCII-safe for Windows PowerShell 5.1");
}
const setupTest = await fs.readFile("setup-test.bat", "utf8");

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
if (!serverFactory.includes("registerAdmissionTool(server, admissionRuntime)")) {
  throw new Error("session-scoped GPTWorker admission handshake is not registered");
}
if (!serverFactory.includes("new AdmissionRuntime()")) {
  throw new Error("admission authority must be scoped to each MCP server/session");
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
if (
  !start.includes("[switch]$Detach") ||
  !start.includes("Get-Command node") ||
  !start.includes("Start-Process -FilePath $nodeExe")
) {
  throw new Error("start.ps1 detached node launch is missing");
}
if (!tunnel.includes("[switch]$Detach") || !tunnel.includes("Start-Process -FilePath $bin")) {
  throw new Error("openai-tunnel.ps1 detached tunnel launch is missing");
}
if (!tunnel.includes("Quote-ProcessArgument $ProfileFile")) {
  throw new Error("detached tunnel profile path must be quoted for Windows paths with spaces");
}
if (!tunnel.includes('$argumentLine = "run --profile-file $quotedProfile"')) {
  throw new Error("detached tunnel must pass a quoted profile path argument line");
}

for (const required of [
  "O Permissions, chon Restricted.",
  "Tim dong Tunnels, roi bat CA HAI quyen:",
  "[x] Read",
  "[x] Use",
  "KHONG chon Read Only",
  "KHONG can bat All cho toan bo API key.",
  "Neu co muc chon ChatGPT workspace, chon dung workspace",
  "API key giong nhu chia khoa",
]) {
  if (!tunnel.includes(required)) {
    throw new Error(`setup wizard is missing non-developer guidance: ${required}`);
  }
}

for (const required of [
  "không cần biết lập trình",
  "Tunnels: Read + Use",
  "KHÔNG chọn Read Only",
  "KHÔNG cần cấp All cho toàn bộ API key",
  "gõ bất kỳ chữ nào",
  "Kết nối GPTWorker với ChatGPT",
]) {
  if (!setupTest.includes(required)) {
    throw new Error(`setup-test UX contract missing: ${required}`);
  }
}

console.log("test-idle-runtime: ok");

import assert from "node:assert/strict";
import fs from "node:fs/promises";

const serverFactory = await fs.readFile("src/server-factory.ts", "utf8");
const workGateway = await fs.readFile("src/tools/work-gateway.ts", "utf8");
const sessionManager = await fs.readFile("src/lib/mcp-session-manager.ts", "utf8");
const context = await fs.readFile("src/tools/context.ts", "utf8");
const tray = await fs.readFile("gptworker-tray.ps1", "utf8");
const start = await fs.readFile("start.ps1", "utf8");
const tunnel = await fs.readFile("openai-tunnel.ps1", "utf8");
const packageJson = JSON.parse(await fs.readFile("package.json", "utf8"));
const packageLock = JSON.parse(await fs.readFile("package-lock.json", "utf8"));
const envExample = await fs.readFile(".env.example", "utf8");
const setupFlow = await fs.readFile("scripts/setup-flow.ps1", "utf8");
const buildRelease = await fs.readFile("scripts/build-release.ps1", "utf8");
const installer = await fs.readFile("installer/GPTWorker.iss", "utf8");

if (/[^\x00-\x7F]/.test(tunnel)) {
  throw new Error("openai-tunnel.ps1 must remain ASCII-safe for Windows PowerShell 5.1");
}

for (const modulePath of [
  "./tools/filesystem.js",
  "./tools/shell.js",
  "./tools/context.js",
]) {
  assert.equal(
    serverFactory.includes(`import("${modulePath}")`),
    false,
    `server factory must not preload execution module: ${modulePath}`
  );
}

for (const required of [
  "registerWorkGateway(",
  "registerJobTools(",
  ".prepareJob(job.id",
]) {
  assert.equal(serverFactory.includes(required), true, `server factory missing: ${required}`);
}

for (const retired of [
  "registerAdmissionTool(",
  "new AdmissionRuntime()",
  "registerWorkspaceDiscoveryTool(",
]) {
  assert.equal(
    serverFactory.includes(retired),
    false,
    `server factory must not preload retired PREPARE admission/discovery path: ${retired}`
  );
}

assert.equal(workGateway.includes('"hard_delete_file"'), true);
assert.equal(workGateway.includes('"delete_file"'), true);
assert.equal(workGateway.includes('"recycle_file"'), true);

for (const lazyModule of [
  'import("./filesystem.js")',
  'import("./shell.js")',
  'import("./context.js")',
]) {
  assert.equal(workGateway.includes(lazyModule), true, `gateway missing lazy import: ${lazyModule}`);
}

for (const retired of [
  "mcp-upstream",
  "mcp-bridge",
  "ponytail.js",
  "rewind.js",
  "McpUpstreamManager",
]) {
  assert.equal(workGateway.includes(retired), false, `gateway contains retired dependency: ${retired}`);
}

for (const retired of [
  "getUpstreamManager",
  "codex-hooks",
  "getCachedCodexSessionStartHooks",
  "primeCodexSessionStartHooks",
  "refreshProxiedTools",
]) {
  assert.equal(sessionManager.includes(retired), false, `session manager contains retired dependency: ${retired}`);
}

for (const required of [
  "enqueueSessionOp",
  'req.method !== "GET"',
  "scheduleDeleteGrace",
  "warmUpRecoveredSession",
  "gptworker-mcp-session-recovery",
]) {
  assert.equal(sessionManager.includes(required), true, `session stability behavior missing: ${required}`);
}

assert.equal(
  await fs.access("src/tools/node-repl.ts").then(() => true).catch(() => false),
  false,
  "node_repl implementation must remain retired"
);
assert.equal(
  workGateway.includes('import("./node-repl.js")'),
  false,
  "work gateway must not lazy-import retired node_repl"
);

for (const retired of ["getUpstreamManager", "upstream_mcp", "mcp-upstream"]) {
  assert.equal(context.includes(retired), false, `context contains retired dependency: ${retired}`);
}

assert.equal(
  tray.includes('"start.ps1") -ExtraArgs @("-Port", "$WorkerPort", "-Detach")'),
  true
);
assert.equal(
  tray.includes('"openai-tunnel.ps1") -ExtraArgs @("-Port", "$WorkerPort", "-Detach")'),
  true
);
// GPTWorker owns a dedicated port pair so common dev ports remain free.
assert.match(envExample, /^PORT=43120$/m);
assert.match(envExample, /^OPENAI_TUNNEL_HEALTH_PORT=43121$/m);
assert.equal(start.includes("[int]$Port = 43120"), true);
assert.equal(tray.includes("else { 43120 }"), true);
assert.equal(tray.includes("else { 43121 }"), true);
assert.equal(tunnel.includes("else { 43120 }"), true);
assert.equal(tunnel.includes("else { 43121 }"), true);
assert.equal(setupFlow.includes("[int]$envPort -eq 3000"), true);
assert.equal(setupFlow.includes("[int]$envTunnelPort -eq 8080"), true);
assert.equal(setupFlow.includes("$WorkerPort = 43120"), true);
assert.equal(setupFlow.includes("$TunnelPort = 43121"), true);

// setup.bat/source install must rebuild from current source rather than trust shipped dist.
assert.equal(setupFlow.includes('& npm ci --no-audit --no-fund'), true);
assert.equal(setupFlow.includes('& npm run build'), true);
assert.equal(setupFlow.includes('if (-not (Test-Path "src\\index.ts"))'), true);
assert.equal(setupFlow.includes('Runtime dist có sẵn — không build lại'), false);
assert.equal(buildRelease.includes('foreach ($dir in @("src", "jobs", "docs"))'), true);
assert.equal(buildRelease.includes('foreach ($dir in @("dist", "jobs", "docs"))'), false);
assert.equal(buildRelease.includes('"tsconfig.json"'), true);
assert.equal(start.includes('if (Test-Path "release-manifest.json") { return $false }'), false);

// Windows installer and manual launchers must carry GPTWorker branding.
assert.equal(buildRelease.includes('"gptworker icon.png"'), true);
assert.equal(buildRelease.includes('"gptworker.ico"'), true);
assert.equal(installer.includes("SetupIconFile="), true);
assert.equal(installer.includes('IconFilename: "{app}\\\\gptworker.ico"'), true);

assert.equal(start.includes("[switch]$Detach"), true);
assert.equal(start.includes("Get-Command node"), true);
assert.equal(start.includes("Start-Process -FilePath $nodeExe"), true);
assert.equal(tunnel.includes("[switch]$Detach"), true);
assert.equal(tunnel.includes("Start-Process -FilePath $bin"), true);
assert.equal(tunnel.includes("Quote-ProcessArgument $ProfileFile"), true);
assert.equal(tunnel.includes('$argumentLine = "run --profile-file $quotedProfile"'), true);

assert.equal(
  tunnel.includes('$ProfileName = "gptworker"'),
  true,
  "tunnel profile must use GPTWorker identity"
);
assert.equal(
  tunnel.includes("codex-local"),
  false,
  "legacy codex-local tunnel profile name must not remain active"
);
assert.equal(
  Object.prototype.hasOwnProperty.call(packageJson.bin ?? {}, "codex-mcp-server"),
  false,
  "legacy codex-mcp-server bin alias must not remain in package.json"
);
assert.equal(
  Object.prototype.hasOwnProperty.call(
    packageLock.packages?.[""]?.bin ?? {},
    "codex-mcp-server"
  ),
  false,
  "legacy codex-mcp-server bin alias must not remain in package-lock.json"
);

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
  assert.equal(tunnel.includes(required), true, `tunnel setup guidance missing: ${required}`);
}


console.log("test-idle-runtime: ok — control plane is local-only and lazy");

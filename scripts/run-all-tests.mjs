import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 4400 + (process.pid % 200);

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: "inherit",
      shell: false,
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exit ${code}`))
    );
  });
}

async function waitForHealth(url, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`timeout waiting for ${url}`);
}

async function runNpmScript(scriptName) {
  const npmExecPath = process.env.npm_execpath?.trim();

  // When invoked through npm, npm_execpath normally points at npm-cli.js.
  // Running that JS entrypoint through the current node.exe avoids Windows
  // Node 24 spawn(EINVAL) behavior for .cmd shims with shell:false.
  if (npmExecPath && /npm(?:-cli)?\.(?:js|cjs|mjs)$/i.test(npmExecPath)) {
    return run(process.execPath, [npmExecPath, "run", scriptName]);
  }

  if (process.platform === "win32") {
    const command = `npm run ${scriptName}`;
    return run(
      process.env.ComSpec || "cmd.exe",
      ["/d", "/s", "/c", command]
    );
  }

  return run("npm", ["run", scriptName]);
}

console.log("=== Default test suite ===");
await runNpmScript("test");

console.log("\n=== Runtime integration ===");
const server = spawn(process.execPath, ["dist/index.js"], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(port),
    CHATGPT_TOOL_PROFILE: "slim",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverLog = "";
server.stdout?.on("data", (chunk) => (serverLog += chunk.toString()));
server.stderr?.on("data", (chunk) => (serverLog += chunk.toString()));

try {
  const health = await waitForHealth(`http://127.0.0.1:${port}/health`);

  if (health.status !== "ok") throw new Error(`health not ok: ${JSON.stringify(health)}`);
  if (health.instructions?.mode !== "control-plane") {
    throw new Error(`unexpected instruction mode: ${JSON.stringify(health.instructions)}`);
  }
  if (health.instructions?.memory_files || health.instructions?.upstream_mcp) {
    throw new Error("health still exposes retired rich/upstream instruction state");
  }

  console.log(
    `OK  health: mode=${health.instructions.mode}, runtime=${health.runtimeMode}`
  );

  const initResponse = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "gptworker-validation", version: "1.0.0" },
      },
    }),
  });

  if (!initResponse.ok) {
    throw new Error(`initialize HTTP ${initResponse.status}: ${await initResponse.text()}`);
  }

  const sessionId = initResponse.headers.get("mcp-session-id");
  if (!sessionId) throw new Error("initialize did not return mcp-session-id");

  const listResponse = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "mcp-session-id": sessionId,
      "mcp-protocol-version": "2025-03-26",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    }),
  });

  const listJson = await listResponse.json();
  const tools = listJson?.result?.tools ?? [];
  const names = tools.map((tool) => tool.name);

  for (const required of ["gptworker_control", "job_list", "job_select", "work_tool"]) {
    if (!names.includes(required)) throw new Error(`tools/list missing ${required}`);
  }

  for (const retired of [
    "gptworker_admission",
    "workspace_discover",
    "mcp_call",
    "mcp_servers",
    "mcp_tools",
    "ponytail_turn",
    "rewind",
  ]) {
    if (names.includes(retired)) throw new Error(`tools/list exposes retired tool ${retired}`);
  }

  console.log(`OK  tools/list: ${names.length} tools, retired surfaces absent`);

  await run(process.execPath, [path.join(root, "scripts/test-mcp-session.mjs")], {
    ...process.env,
    PORT: String(port),
  });

  console.log("OK  MCP session recovery");
} catch (error) {
  console.error(serverLog);
  throw error;
} finally {
  server.kill();
}

console.log("\n=== ALL TARGET-ARCHITECTURE TESTS PASSED ===");

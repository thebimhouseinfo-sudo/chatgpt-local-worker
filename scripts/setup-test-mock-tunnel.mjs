#!/usr/bin/env node
import http from "node:http";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i], process.argv[i + 1]);
}
const port = Number(args.get("--port") || 0);
const workerPort = Number(args.get("--worker-port") || 0);
if (!Number.isInteger(port) || port <= 0) {
  console.error("mock tunnel requires --port <number>");
  process.exit(2);
}

const startedAt = new Date().toISOString();
const json = (res, status, body) => {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(text),
  });
  res.end(text);
};

const server = http.createServer((req, res) => {
  const path = new URL(req.url || "/", "http://127.0.0.1").pathname;
  if (path === "/readyz") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("ready");
    return;
  }
  if (path === "/healthz" || path === "/health/control-plane" || path === "/health/mcp" || path === "/health/oauth" || path === "/health") {
    json(res, 200, {
      ok: true,
      ready: true,
      mode: "setup-test-mock",
      worker_port: workerPort,
      started_at: startedAt,
    });
    return;
  }
  json(res, 404, { ok: false, error: "not found" });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[setup-test-mock-tunnel] ready on http://127.0.0.1:${port}`);
});

const stop = () => server.close(() => process.exit(0));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

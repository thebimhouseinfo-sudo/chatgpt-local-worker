import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  createWorkspaceProcessView,
  createWorkspaceRequire,
  registerNodeReplTool,
} from "../dist/tools/node-repl.js";

const source = await fs.readFile("src/tools/node-repl.ts", "utf8");

for (const forbidden of [
  "@oai/sky",
  "codex-computer-use",
  "WindowsHelperTransport",
  "WindowsComputerUseClient",
  "globalThis.sky",
  "plugin-config",
  "CODEX_HOME",
  "AppData/OpenAI/Codex",
]) {
  assert.equal(
    source.includes(forbidden),
    false,
    `node_repl contains retired dependency: ${forbidden}`
  );
}

const root = path.resolve(process.cwd());
const processView = createWorkspaceProcessView(root);
assert.equal(processView.cwd(), root);
assert.equal(processView.env.PWD, root);
assert.throws(() => processView.chdir(root), /disabled/i);

const workspaceRequire = createWorkspaceRequire(root);
for (const specifier of ["fs", "node:fs", "fs/promises", "node:fs/promises"]) {
  assert.throws(
    () => workspaceRequire(specifier),
    /Filesystem access is disabled/i,
    `node_repl must block ${specifier}`
  );
}

assert.equal(typeof workspaceRequire("path").join, "function");

const registered = new Map();
const fakeServer = {
  registerTool(name, config, callback) {
    registered.set(name, { config, callback });
    return {
      remove() {},
      update() {},
      enable() {},
      disable() {},
      enabled: true,
    };
  },
};

registerNodeReplTool(fakeServer, root);
const nodeRepl = registered.get("node_repl")?.callback;
assert.ok(nodeRepl, "node_repl was not registered");

const arithmetic = await nodeRepl({
  action: "eval",
  code: "2 + 3",
  timeout_ms: 30000,
});
assert.equal(arithmetic.structuredContent.ok, true);
assert.equal(arithmetic.structuredContent.data.output, "5");
assert.equal(arithmetic.structuredContent.data.value, "5");

const assign = await nodeRepl({
  action: "eval",
  code: "globalThis.acceptanceValue = 7",
  timeout_ms: 30000,
});
assert.equal(assign.structuredContent.data.output, "7");

const persistent = await nodeRepl({
  action: "eval",
  code: "globalThis.acceptanceValue + 1",
  timeout_ms: 30000,
});
assert.equal(persistent.structuredContent.data.output, "8");
assert.equal(persistent.structuredContent.data.value, "8");

const logged = await nodeRepl({
  action: "eval",
  code: "console.log('hello-repl'); 42",
  timeout_ms: 30000,
});
assert.equal(logged.structuredContent.data.output, "hello-repl");
assert.equal(logged.structuredContent.data.value, "42");

const awaited = await nodeRepl({
  action: "eval",
  code: "await Promise.resolve(9)",
  timeout_ms: 30000,
});
assert.equal(awaited.structuredContent.data.output, "9");
assert.equal(awaited.structuredContent.data.value, "9");

console.log("test-group-c2-node-repl: ok — node_repl is local-only");

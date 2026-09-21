import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  createWorkspaceProcessView,
  createWorkspaceRequire,
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

console.log("test-group-c2-node-repl: ok — node_repl is local-only");

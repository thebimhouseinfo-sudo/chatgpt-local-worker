import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { registerShellTools } from "../dist/tools/shell.js";
import { setDefaultCwd } from "../dist/lib/path-security.js";

process.env.ACTIVITY_LOG_DISABLED = "true";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-shell-stateless-"));
const sub = path.join(root, "sub");
await fs.mkdir(sub, { recursive: true });
setDefaultCwd(root);

const registered = new Map();
const server = {
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

registerShellTools(server, root, 15);

for (const required of [
  "run_command",
  "start_process",
  "process_status",
  "process_output",
  "stop_process",
]) {
  assert.ok(registered.has(required), `missing shell operation: ${required}`);
}
for (const retired of ["shell_status", "shell_reset", "clear_processes"]) {
  assert.equal(registered.has(retired), false, `${retired} must be retired`);
}

const runCommand = registered.get("run_command").callback;
const cwdScript = 'node -e "process.stdout.write(process.cwd())"';

const rootResult = await runCommand({ command: cwdScript });
assert.equal(rootResult.structuredContent.ok, true);
assert.equal(path.resolve(rootResult.structuredContent.data.cwd), path.resolve(root));
assert.equal(path.resolve(rootResult.structuredContent.data.stdout), path.resolve(root));

const subResult = await runCommand({
  command: cwdScript,
  working_directory: sub,
});
assert.equal(subResult.structuredContent.ok, true);
assert.equal(path.resolve(subResult.structuredContent.data.cwd), path.resolve(sub));
assert.equal(path.resolve(subResult.structuredContent.data.stdout), path.resolve(sub));

const rootAgain = await runCommand({ command: cwdScript });
assert.equal(
  path.resolve(rootAgain.structuredContent.data.cwd),
  path.resolve(root),
  "working_directory must not persist into the next command"
);

await assert.rejects(
  () => runCommand({ command: cwdScript, working_directory: "sub" }),
  /absolute path/i,
  "relative working_directory must be rejected"
);

await assert.rejects(
  () => runCommand({ command: "cd sub" }),
  /absolute path/i,
  "relative cd must be rejected"
);

const startProcess = registered.get("start_process").callback;
const processStatus = registered.get("process_status").callback;
const processOutput = registered.get("process_output").callback;

const started = await startProcess({
  command: 'node -e "setTimeout(() => console.log(\'process-ok\'), 50)"',
});
assert.equal(started.structuredContent.ok, true);
const id = started.structuredContent.data.id;
assert.equal(typeof id, "string");

await new Promise((resolve) => setTimeout(resolve, 250));

const status = await processStatus({ id });
assert.equal(status.structuredContent.ok, true);
assert.equal(status.structuredContent.data.processes.length, 1);
assert.equal(status.structuredContent.data.processes[0].running, false);

const output = await processOutput({ id, tail_chars: 4000 });
assert.match(output.structuredContent.data.stdout, /process-ok/);

await fs.rm(root, { recursive: true, force: true });
console.log("test-shell-stateless: ok");

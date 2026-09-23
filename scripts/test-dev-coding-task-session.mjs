import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runCommand } from "../jobs/dev-coding/harness/task-session.mjs";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-session-"));
const file = path.join(root, "app.js");
const taskId = "TASK-SESSION";
const options = extra => ({ "--cwd": root, "--task-id": taskId, ...extra });
try {
  await fs.writeFile(file, "export const value = 1;\n");
  assert.equal((await runCommand("discover", { "--cwd": root })).tasks.length, 0);
  const begin = await runCommand("begin", options({
    "--goal": "Change value to two", "--scope": JSON.stringify([file]),
    "--acceptance": JSON.stringify(["value-is-two"]), "--execution-id": "fresh-1", "--generation": "1",
  }));
  assert.equal(begin.ok, true);
  await assert.rejects(runCommand("begin", options({
    "--goal": "Delete prior state", "--scope": JSON.stringify([file]),
    "--acceptance": JSON.stringify(["value-is-two"]),
  })), /CHECKPOINT_EXISTS/);
  const list = await runCommand("discover", { "--cwd": root });
  assert.equal(list.tasks.length, 1);
  assert.equal(list.tasks[0].fingerprint_fresh, true);
  assert.equal((await runCommand("capture", options({ "--file": file }))).ok, true);
  await fs.writeFile(file, "export const value = 2;\n");
  await runCommand("wrote", options({ "--file": file }));
  const diff = await runCommand("diff", options());
  assert.equal(diff.ok, true);
  assert.equal(diff.changed.length, 1);
  assert.equal(diff.complete, false);
  const result = await runCommand("resume", options({
    "--execution-id": "fresh-2", "--generation": "2",
  }));
  assert.equal(result.stale, false);
  await fs.writeFile(file, "export const value = 3;\n");
  assert.equal((await runCommand("discover", { "--cwd": root })).tasks[0].fingerprint_fresh, false);
  const stale = await runCommand("resume", options({
    "--execution-id": "fresh-3", "--generation": "3",
  }));
  assert.equal(stale.stale, true);
  assert.equal(stale.next_action, "REVALIDATE_AFTER_SOURCE_DRIFT");
  await assert.rejects(runCommand("capture", options({ "--file": path.join(os.tmpdir(), "outside.js") })), /BOUNDARY/);
  for (let n = 0; n < 2; n++) {
    const iteration = await runCommand("iteration", options({
      "--signature": "identical-failure", "--active-ms": "1000", "--result": "FAIL",
    }));
    if (n === 0) assert.equal(iteration.ok, true);
    else {
      assert.equal(iteration.ok, false);
      assert.equal(iteration.reason, "REPEATED_UNINFORMATIVE_FAILURE");
    }
  }
  console.log("test-dev-coding-task-session: ok");
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runNegativeControl } from "../jobs/dev-coding/harness/negative-control.mjs";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-negative-control-"));
try {
  const target = path.join(root, "calculator.mjs");
  const mutant = path.join(root, "bad-calculator.mjs");
  const test = path.join(root, "calculator.test.mjs");
  await fs.writeFile(target, "export function sum(a,b) {return a+b;}\n");
  await fs.writeFile(mutant, "export function sum(a,b) {return a-b;}\n");
  await fs.writeFile(test, `import {test} from 'node:test';\nimport assert from 'node:assert/strict';\nimport {sum} from './calculator.mjs';\ntest('sum',()=>assert.equal(sum(2,3),5,'SUM_ACCEPTANCE_ASSERTION'));\n`);
  const original = await fs.readFile(target, "utf8");
  const unchangedTest = await fs.readFile(test, "utf8");
  const input = { workspace: root, implementationFile: target, mutantFile: mutant,
    testFile: test, acceptanceId: "sum-five", failureMarker: "SUM_ACCEPTANCE_ASSERTION" };
  let out = await runNegativeControl(input);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.mutant_exit, 1);
  assert.equal(out.restored_exit, 0);
  assert.equal(await fs.readFile(target, "utf8"), original);
  assert.equal(await fs.readFile(test, "utf8"), unchangedTest);

  out = await runNegativeControl({ ...input, failureMarker: "UNRELATED_NOT_FOUND" });
  assert.equal(out.ok, false, "A test-runner failure alone is not a meaningful negative control");
  assert.equal(out.reason, "MUTANT_DID_NOT_TRIGGER_NAMED_ASSERTION");
  assert.equal(await fs.readFile(target, "utf8"), original);

  await assert.rejects(runNegativeControl({ ...input, implementationFile: test }),
    /CONTROL_DENIED/);
  await assert.rejects(runNegativeControl({ ...input, implementationFile: path.join(os.tmpdir(), "outside") }),
    /ENOENT|WORKSPACE_BOUNDARY/);
  console.log("test-dev-coding-negative-control: ok");
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

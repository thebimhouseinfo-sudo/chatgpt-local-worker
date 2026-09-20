/**
 * Verify the ChatGPT-visible GPTWorker command contract is actually present
 * in MCP server instructions and cannot silently regress to an older menu.
 */
import assert from "node:assert/strict";
import {
  GPTWORKER_HELP,
  MCP_QUICKSTART,
  buildServerInstructions,
} from "../dist/lib/quickstart.js";

const expectedRootCommands = [
  "gptworker/help",
  "gptworker/job list",
  "gptworker/job create",
  "gptworker/job update",
  "gptworker/job remove",
  "gptworker/job export",
  "gptworker/job import",
  "gptworker/job stop",
];

const menuStart = MCP_QUICKSTART.indexOf(
  "When the user sends exactly gptworker/"
);
assert.notEqual(menuStart, -1, "root command contract marker missing");

const menuSlice = MCP_QUICKSTART.slice(menuStart).split("\n\n")[0];
const listed = menuSlice
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.startsWith("- gptworker/"))
  .map((line) => line.slice(2));

assert.deepEqual(
  listed,
  expectedRootCommands,
  "gptworker/ root menu must contain exactly the eight fixed commands"
);

const instructions = buildServerInstructions(
  "C:\\GPTWorker",
  ["C:\\GPTWorker"],
  true,
  "PROJECT CONTEXT SENTINEL"
);

for (const command of expectedRootCommands) {
  assert.ok(
    instructions.includes(command),
    `final MCP instructions missing root command: ${command}`
  );
}

assert.ok(
  instructions.includes("## GPTWorker root command surface"),
  "final MCP instructions missing MCP_QUICKSTART"
);
assert.ok(
  instructions.includes("GPTWorker giúp ChatGPT làm việc trực tiếp"),
  "final MCP instructions missing prewritten gptworker/help content"
);
assert.ok(
  instructions.includes("PROJECT CONTEXT SENTINEL"),
  "project context must remain present"
);

// Ensure each high-level contract is injected only once by this builder.
assert.equal(
  instructions.split("## GPTWorker root command surface").length - 1,
  1,
  "root command contract duplicated"
);
assert.equal(
  instructions.split("## Prewritten gptworker/help response").length - 1,
  1,
  "help response contract duplicated"
);

assert.ok(GPTWORKER_HELP.includes("gptworker/job remove"));
assert.ok(GPTWORKER_HELP.includes("gptworker/job export"));
assert.ok(GPTWORKER_HELP.includes("gptworker/job import"));

console.log("test-quickstart: ok");

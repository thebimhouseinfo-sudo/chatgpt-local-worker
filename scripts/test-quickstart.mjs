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
  instructions.includes("# GPTWorker Help"),
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

assert.ok(GPTWORKER_HELP.includes("**Job + Workspace local**"));
assert.ok(!GPTWORKER_HELP.includes("## Kích hoạt GPTWorker"));
assert.ok(MCP_QUICKSTART.includes("## GPTWorker activation gate"));
assert.ok(MCP_QUICKSTART.includes("task_with_workspace"));
assert.ok(MCP_QUICKSTART.includes("workspace_discover"));
assert.ok(MCP_QUICKSTART.includes("work_tool"));
assert.ok(MCP_QUICKSTART.includes("runtime.preload_families"));
assert.ok(MCP_QUICKSTART.includes("in the background while the user reads"));
assert.ok(MCP_QUICKSTART.includes("prior preload generation becomes stale"));
assert.ok(MCP_QUICKSTART.includes("do not nominate a Job or FOLDER") || MCP_QUICKSTART.includes("do not ask the user for JOB/FOLDER"));
assert.ok(GPTWORKER_HELP.includes("## Layla"));
assert.ok(GPTWORKER_HELP.includes("TXT, Markdown, Word, Excel, PowerPoint, PDF"));
assert.ok(GPTWORKER_HELP.includes("## Tạo Job mới"));
assert.ok(GPTWORKER_HELP.includes("## Quản lý Job"));
assert.ok(GPTWORKER_HELP.includes("## Cách dùng"));
assert.ok(GPTWORKER_HELP.includes("gptworker/job list"));
assert.ok(GPTWORKER_HELP.includes("gptworker/job create"));
assert.ok(GPTWORKER_HELP.includes("gptworker/job update"));
assert.ok(GPTWORKER_HELP.includes("gptworker/job remove"));
assert.ok(GPTWORKER_HELP.includes("gptworker/job export"));
assert.ok(GPTWORKER_HELP.includes("import"));
assert.ok(GPTWORKER_HELP.includes("gptworker/job stop"));
assert.equal(
  GPTWORKER_HELP.split("Từ tài liệu trong D:\\Meeting tạo một presentation.").length - 1,
  2,
  "the fixed help text must preserve the user-approved duplicate example exactly"
);
assert.equal(
  GPTWORKER_HELP.startsWith("# GPTWorker Help\n\nGPTWorker làm việc theo **Job + Workspace local**."),
  true,
  "fixed help header changed"
);
assert.equal(
  GPTWORKER_HELP.endsWith("Chỉ sau khi user xác nhận, GPTWorker mới bắt đầu thao tác với Workspace."),
  true,
  "fixed help footer changed"
);

console.log("test-quickstart: ok");

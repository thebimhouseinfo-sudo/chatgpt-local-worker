/**
 * Verify the ChatGPT-visible GPTWorker command contract is actually present
 * in MCP server instructions and cannot silently regress to an older menu.
 */
import assert from "node:assert/strict";
import {
  GPTWORKER_HELP,
  GPTWORKER_IDLE_PROMPT,
  GPTWORKER_ROOT_MENU,
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

assert.ok(
  MCP_QUICKSTART.includes("When the user sends exactly gptworker/"),
  "root command contract marker missing"
);

assert.deepEqual(
  GPTWORKER_ROOT_MENU.split("\n"),
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

assert.ok(GPTWORKER_IDLE_PROMPT.includes("Bạn muốn tôi giúp bạn làm gì?"));
assert.ok(GPTWORKER_IDLE_PROMPT.includes("1. coding"));
assert.ok(GPTWORKER_IDLE_PROMPT.includes("2. planning"));
assert.ok(GPTWORKER_IDLE_PROMPT.includes("3. layla"));
assert.ok(GPTWORKER_IDLE_PROMPT.includes("4. mto"));
assert.ok(
  GPTWORKER_IDLE_PROMPT.includes(
    "Hãy chọn Job và đưa tôi thư mục làm việc để bắt đầu, hoặc gõ gptworker/ để xem các system commands."
  )
);
for (const command of expectedRootCommands) {
  assert.ok(
    !GPTWORKER_IDLE_PROMPT.includes(command),
    `bare @gptworker greeting must not include system command: ${command}`
  );
}
assert.deepEqual(
  GPTWORKER_ROOT_MENU.split("\n"),
  expectedRootCommands,
  "gptworker/ must render exactly the eight fixed system commands"
);
assert.ok(MCP_QUICKSTART.includes("## Bare GPTWorker invocation — dynamic Job list"));
assert.ok(instructions.includes("gptworker/ — ZERO tools"));
assert.ok(MCP_QUICKSTART.includes("reply with the prewritten GPTWORKER_ROOT_MENU"));
assert.ok(MCP_QUICKSTART.includes("call \`job_list\` exactly once"));
assert.ok(MCP_QUICKSTART.includes("## Fast Job nomination"));
assert.ok(MCP_QUICKSTART.includes("skip discovery and nominate immediately"));
assert.ok(MCP_QUICKSTART.includes("do not call job_status"));
assert.ok(MCP_QUICKSTART.includes("ambiguity fallback"));
assert.ok(MCP_QUICKSTART.includes("the next user-visible message should be only this compact confirmation block"));
assert.ok(MCP_QUICKSTART.includes("do not narrate admission tokens"));
assert.ok(MCP_QUICKSTART.includes("continuation of a bare @gptworker flow previously armed in this same MCP session"));
assert.ok(instructions.includes("## Prewritten gptworker/ root menu"));
assert.ok(instructions.includes(GPTWORKER_ROOT_MENU));
assert.ok(instructions.includes("## Bare @gptworker response"));
assert.ok(instructions.includes("activation_request"));
assert.ok(instructions.includes("Render the returned available Jobs as a numbered list"));

assert.ok(GPTWORKER_HELP.includes("**Job + Workspace local**"));
assert.ok(!GPTWORKER_HELP.includes("## Kích hoạt GPTWorker"));
assert.ok(MCP_QUICKSTART.includes("## GPTWorker internal admission handshake"));
assert.ok(MCP_QUICKSTART.includes("Valid ACTIVE evidence is an explicit"));
assert.ok(MCP_QUICKSTART.includes("fresh/unarmed session are NOT activation evidence"));
assert.ok(MCP_QUICKSTART.includes("A fresh task + Workspace with no prior @gptworker must remain outside GPTWorker"));
assert.ok(GPTWORKER_HELP.includes("@gptworker sửa app ở D:\\Projects\\my-app"));
assert.ok(GPTWORKER_HELP.includes("@gptworker tổng hợp các file trong D:\\Reports"));
assert.ok(!GPTWORKER_HELP.includes("Thông thường không cần chọn Job thủ công. Chỉ cần nói"));
assert.ok(MCP_QUICKSTART.includes("gptworker_admission"));
assert.ok(MCP_QUICKSTART.includes("INACTIVE"));
assert.ok(MCP_QUICKSTART.includes("Continue answering as ordinary ChatGPT"));
assert.ok(MCP_QUICKSTART.includes("another plugin/tool"));
assert.ok(MCP_QUICKSTART.includes("admission_token"));
assert.ok(MCP_QUICKSTART.includes("The @-flow arm is one-shot"));
assert.ok(MCP_QUICKSTART.includes("starts with \`@gptworker\`"));
assert.ok(!MCP_QUICKSTART.includes("current user turn literally contains \`@gptworker\`"));
assert.ok(MCP_QUICKSTART.includes("keep reusing that same admission_token"));
assert.ok(MCP_QUICKSTART.includes("the admission_token is consumed"));
assert.ok(MCP_QUICKSTART.includes("work_handle is the only work authority"));
assert.ok(MCP_QUICKSTART.includes("job_stop can cancel pending/selected state without a work_handle"));
assert.ok(MCP_QUICKSTART.includes("active work still requires its work_handle"));
assert.ok(MCP_QUICKSTART.includes("task but omitted the absolute local Workspace"));
assert.ok(MCP_QUICKSTART.includes("call \`gptworker_admission\` once on that same @gptworker turn"));
assert.ok(MCP_QUICKSTART.includes("reuse that same admission_token when the user supplies the Workspace"));
assert.ok(MCP_QUICKSTART.includes("workspace_discover"));
assert.ok(MCP_QUICKSTART.includes("work_tool"));
assert.ok(MCP_QUICKSTART.includes("runtime.preload_families"));
assert.ok(MCP_QUICKSTART.includes("in the background while the user reads"));
assert.ok(MCP_QUICKSTART.includes("prior preload generation becomes stale"));
assert.ok(MCP_QUICKSTART.includes("Do not ask the user to activate GPTWorker"));
assert.ok(MCP_QUICKSTART.includes("do not ask for a Workspace on GPTWorker's behalf"));
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

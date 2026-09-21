/**
 * Verify the ChatGPT-visible GPTWorker command contract is actually present
 * in MCP server instructions and cannot silently regress to an older menu.
 */
import assert from "node:assert/strict";
import {
  GPTWORKER_HELP,
  GPTWORKER_IDLE_PROMPT,
  GPTWORKER_ROOT_MENU,
  GPTWORKER_DEFAULT_WELCOME_JOBS,
  GPTWORKER_HIDDEN_WELCOME_JOB_IDS,
  MCP_QUICKSTART,
  buildGptworkerWelcome,
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

assert.deepEqual(
  GPTWORKER_DEFAULT_WELCOME_JOBS.map((job) => job.id),
  ["dev-coding", "dev-planing", "layla"],
  "Welcome must keep exactly the three approved Default Jobs in positions 1-3"
);
assert.deepEqual(
  GPTWORKER_HIDDEN_WELCOME_JOB_IDS,
  ["mto"],
  "mto must stay hidden from bare @gptworker Welcome"
);
assert.ok(GPTWORKER_IDLE_PROMPT.includes("**GPTWorker**"));
assert.ok(GPTWORKER_IDLE_PROMPT.includes("Chọn Job bạn muốn sử dụng:"));
assert.ok(GPTWORKER_IDLE_PROMPT.includes("**1. Dev Coding**"));
assert.ok(GPTWORKER_IDLE_PROMPT.includes("**2. Dev Planing**"));
assert.ok(GPTWORKER_IDLE_PROMPT.includes("**3. Layla**"));
assert.ok(!GPTWORKER_IDLE_PROMPT.toLowerCase().includes("mto"));
assert.ok(
  GPTWORKER_IDLE_PROMPT.includes(
    "**Hãy chọn Job và đưa tôi thư mục làm việc để bắt đầu.**"
  )
);
assert.ok(
  GPTWORKER_IDLE_PROMPT.includes(
    "Hoặc gõ `gptworker/` để xem các system commands."
  )
);

const welcomeWithCustom = buildGptworkerWelcome([
  {
    id: "rename",
    name: "Rename",
    description: "đổi tên file hàng loạt.",
  },
]);
assert.ok(welcomeWithCustom.includes("**4. Rename** — đổi tên file hàng loạt."));
assert.ok(!welcomeWithCustom.toLowerCase().includes("mto"));

for (const command of expectedRootCommands) {
  assert.ok(
    !GPTWORKER_IDLE_PROMPT.includes(command),
    `bare @gptworker Welcome must not include system command: ${command}`
  );
}
assert.deepEqual(
  GPTWORKER_ROOT_MENU.split("\n"),
  expectedRootCommands,
  "gptworker/ must render exactly the eight fixed system commands"
);
assert.ok(MCP_QUICKSTART.includes("## Bare GPTWorker invocation — approved Welcome"));
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
assert.ok(instructions.includes("Return the tool's welcome_text verbatim"));

assert.ok(GPTWORKER_HELP.startsWith("# GPTWorker Help\n\n## 1. GPTWorker làm được gì?"));
assert.ok(GPTWORKER_HELP.includes("## 2. Cách sử dụng"));
assert.ok(GPTWORKER_HELP.includes("### Ví dụ 1 — Để GPTWorker tự chọn Job"));
assert.ok(
  GPTWORKER_HELP.includes(
    "@gptworker đọc project trong C:\\Projects\\SchoolApp và lập kế hoạch thêm chức năng bài tập"
  )
);
assert.ok(GPTWORKER_HELP.includes("### Ví dụ 2 — Gọi GPTWorker trước"));
assert.ok(
  GPTWORKER_HELP.includes(
    "Dev Coding  C:\\Projects\\MyApp sửa lỗi nút đăng nhập"
  )
);
assert.ok(GPTWORKER_HELP.includes("## 3. Job List"));
assert.ok(GPTWORKER_HELP.includes("GPTWorker luôn có 3 Job mặc định:"));
assert.ok(GPTWORKER_HELP.includes("**1. Dev Coding**"));
assert.ok(GPTWORKER_HELP.includes("**2. Dev Planing**"));
assert.ok(GPTWORKER_HELP.includes("**3. Layla**"));
assert.ok(GPTWORKER_HELP.includes("## 4. Custom Job"));
assert.ok(
  GPTWORKER_HELP.includes(
    "**Custom Job là cách bạn “train” GPTWorker làm việc theo đúng cách mình muốn.**"
  )
);
assert.ok(GPTWORKER_HELP.includes("Tạo một Job chuyên làm PowerPoint."));
assert.ok(GPTWORKER_HELP.includes("## 5. System Commands"));
for (const command of expectedRootCommands) {
  assert.ok(
    GPTWORKER_HELP.includes(command),
    `approved Help missing system command: ${command}`
  );
}
assert.ok(!GPTWORKER_HELP.includes("D:\\00 Other Works"));
assert.ok(!GPTWORKER_HELP.includes("absolute local"));
assert.ok(!GPTWORKER_HELP.includes("thư mục tuyệt đối"));
assert.ok(!GPTWORKER_HELP.includes("admission_token"));
assert.ok(!GPTWORKER_HELP.includes("work_handle"));
assert.ok(!GPTWORKER_HELP.includes("MCP session"));

assert.ok(MCP_QUICKSTART.includes("## GPTWorker internal admission handshake"));
assert.ok(MCP_QUICKSTART.includes("When the user sends exactly gptworker/help"));
assert.ok(MCP_QUICKSTART.includes("approved Welcome"));
assert.ok(MCP_QUICKSTART.includes("welcome_text"));
assert.ok(MCP_QUICKSTART.includes("three fixed default Jobs"));
assert.ok(MCP_QUICKSTART.includes("private \`mto\` Job is never shown in Welcome"));
assert.ok(MCP_QUICKSTART.includes("fresh/unarmed session are NOT activation evidence"));
assert.ok(MCP_QUICKSTART.includes("gptworker_admission"));
assert.ok(MCP_QUICKSTART.includes("INACTIVE"));
assert.ok(MCP_QUICKSTART.includes("admission_token"));
assert.ok(MCP_QUICKSTART.includes("The @-flow arm is one-shot"));
assert.ok(MCP_QUICKSTART.includes("work_handle is the only work authority"));
assert.ok(MCP_QUICKSTART.includes("workspace_discover"));
assert.ok(MCP_QUICKSTART.includes("work_tool"));
assert.ok(MCP_QUICKSTART.includes("runtime.preload_families"));

console.log("test-quickstart: ok");

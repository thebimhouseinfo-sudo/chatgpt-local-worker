/**
 * Lock user-approved GPTWorker UI copy and routing rules.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildInstructionContext } from "../dist/lib/instruction-context.js";
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

const expectedWelcome = `
**GPTWorker**

Chọn Job bạn muốn sử dụng:

**1. Dev Coding** — sửa code, debug, refactor, build/test project.

**2. Dev Planing** — đọc repo, phân tích, review kiến trúc và lập implementation plan / task list.

**3. Layla** — trợ lý đa năng cho file, tài liệu, Word, Excel, PowerPoint, PDF và các công việc linh hoạt.

Hãy cho tôi biết bạn muốn làm gì. Bạn có thể chọn Job ở trên, hoặc để tôi tự gợi ý Job phù hợp.

Khi tiện, hãy gửi **thư mục làm việc**. Bạn không cần đưa Job, thư mục và yêu cầu trong cùng một tin nhắn.

Hoặc gõ \`gr/\` để xem các system commands.
`.trim();

const expectedHelp = `
# GPTWorker Help

## 1. GPTWorker làm được gì?

GPTWorker giúp ChatGPT làm việc trực tiếp với file và project trên máy của bạn.

GPTWorker có thể:

- sửa code, debug, refactor, build và test project;
- đọc project, phân tích và lập kế hoạch;
- làm việc với tài liệu, Excel, PowerPoint, PDF và nhiều loại file khác;
- sử dụng **Custom Job** để làm việc theo cách riêng mà bạn đã dạy cho GPTWorker.

Mỗi công việc sẽ dùng một **Job** phù hợp và một **thư mục làm việc** do bạn chọn.

---

## 2. Cách sử dụng

### Ví dụ 1 — Để GPTWorker tự chọn Job

\`@gptworker đọc project trong C:\\Projects\\SchoolApp và lập kế hoạch thêm chức năng bài tập\`

GPTWorker sẽ tự chọn Job phù hợp và hiển thị:

\`JOB: Dev Planing\`
\`FOLDER: C:\\Projects\\SchoolApp\`

**Xác nhận bắt đầu?**

### Ví dụ 2 — Gọi GPTWorker trước

\`@gptworker\`

GPTWorker sẽ hiển thị danh sách Job hiện có.

Sau đó bạn có thể giao việc bình thường:

\`C:\\Projects\\MyApp sửa lỗi nút đăng nhập\`

hoặc tự chọn Job:

\`Dev Coding C:\\Projects\\MyApp sửa lỗi nút đăng nhập\`

GPTWorker sẽ hiển thị:

\`JOB: Dev Coding\`
\`FOLDER: C:\\Projects\\MyApp\`

**Xác nhận bắt đầu?**

---

## 3. Job List

GPTWorker luôn có 3 Job mặc định:

**1. Dev Coding** — sửa code, debug, refactor, thêm tính năng, build và test project.

**2. Dev Planing** — đọc project, phân tích kiến trúc và lập implementation plan / task list, không sửa source code.

**3. Layla** — trợ lý đa năng cho file, tài liệu, Excel, PowerPoint, PDF và các công việc linh hoạt.

Nếu có thêm **Custom Job**, các Job đó sẽ được liệt kê tiếp bên dưới.

Chỉ những Custom Job đang tồn tại và được phép hiển thị mới xuất hiện trong danh sách.

---

## 4. Custom Job

**Custom Job là cách bạn “train” GPTWorker làm việc theo đúng cách mình muốn.**

Thay vì mỗi lần đều giải thích lại quy trình, bạn có thể tạo một Job riêng chứa sẵn cách làm, các bước cần thực hiện và những công cụ được sử dụng.

Ví dụ, muốn tạo một Job chuyên làm PowerPoint:

\`gr/job create\`

Sau đó mô tả:

> Tạo một Job chuyên làm PowerPoint.
> Khi tôi đưa một thư mục tài liệu, hãy đọc nội dung, lập dàn ý, tạo slide ngắn gọn, thêm hình minh họa phù hợp và xuất file PowerPoint hoàn chỉnh.

Từ lần sau, Custom Job đó có thể xuất hiện trong danh sách khi gọi \`@gptworker\`.

---

## 5. System Commands

Gõ:

\`gr/\`

để xem các system commands.

Các command hiện có:

- \`gr/help\` — xem hướng dẫn sử dụng.
- \`gr/job list\` — xem các Job hiện có.
- \`gr/job create\` — tạo Custom Job mới.
- \`gr/job update\` — cập nhật một Custom Job.
- \`gr/job remove\` — xóa một Custom Job.
- \`gr/job export\` — xuất Custom Job ra file để lưu hoặc chia sẻ.
- \`gr/job import\` — nhập Custom Job từ file.
- \`gr/job stop\` — dừng công việc hiện tại và đưa GPTWorker về trạng thái idle.
`.trim();

const expectedRootMenu = `
Các command hiện có:

1 \`gr/help\` — xem hướng dẫn sử dụng.
2 \`gr/job list\` — xem các Job hiện có.
3 \`gr/job create\` — tạo Custom Job mới.
4 \`gr/job update\` — cập nhật một Custom Job.
5 \`gr/job remove\` — xóa một Custom Job.
6 \`gr/job export\` — xuất Custom Job ra file để lưu hoặc chia sẻ.
7 \`gr/job import\` — nhập Custom Job từ file.
8 \`gr/job stop\` — dừng công việc hiện tại và đưa GPTWorker về trạng thái idle.

Nhập tiếp \`1\` hoặc \`gr/help\` để xem hướng dẫn sử dụng.
Nhập tiếp \`3\` hoặc \`gr/job create\` để bắt đầu tạo custom job
`.trim();

assert.equal(
  GPTWORKER_IDLE_PROMPT,
  expectedWelcome,
  "Default Welcome must be byte-for-byte equal to the approved copy"
);
assert.equal(
  GPTWORKER_HELP,
  expectedHelp,
  "Help must be byte-for-byte equal to the approved copy"
);
assert.equal(
  GPTWORKER_ROOT_MENU,
  expectedRootMenu,
  "gr/ must be byte-for-byte equal to the approved command menu"
);

assert.deepEqual(
  GPTWORKER_DEFAULT_WELCOME_JOBS.map((job) => job.id),
  ["dev-coding", "dev-planing", "layla"]
);
assert.deepEqual(GPTWORKER_HIDDEN_WELCOME_JOB_IDS, ["mto"]);

const welcomeWithCustom = buildGptworkerWelcome([
  {
    id: "rename",
    name: "Rename",
    description: "đổi tên file hàng loạt.",
  },
]);
const inserted = "**4. Rename** — đổi tên file hàng loạt.";
assert.equal(
  welcomeWithCustom.replace("\n\n" + inserted + "\n\n", "\n\n"),
  expectedWelcome,
  "Adding a Custom Job must not change any character of the approved Welcome template"
);
assert.ok(welcomeWithCustom.includes(inserted));
assert.ok(!welcomeWithCustom.toLowerCase().includes("mto"));

const instructions = buildServerInstructions(
  "C:\\GPTWorker",
  ["C:\\GPTWorker"],
  "PROJECT CONTEXT SENTINEL"
);

assert.ok(instructions.includes("PROJECT CONTEXT SENTINEL"));
assert.ok(instructions.startsWith("# GPTWorker entry routing — HIGHEST PRIORITY"));
assert.ok(instructions.includes("gptworker_control once with surface=commands"));
assert.ok(instructions.includes("gptworker_control once with surface=help"));
assert.ok(instructions.includes("return the tool text verbatim and nothing else"));
assert.ok(instructions.includes("GPTWorker plugin/@ invocation opens a NEW PREPARE window"));
assert.ok(instructions.includes("If the invocation is bare, return welcome_text verbatim"));
assert.ok(instructions.includes("DO NOT force the generic Welcome"));
assert.ok(instructions.includes("ask only for missing JOB/FOLDER/TASK"));
assert.ok(instructions.includes("GPT may infer only JOB"));
assert.ok(instructions.includes("opens a NEW PREPARE window"));
assert.ok(instructions.includes("FOLDER is valid only if the user supplies it during this PREPARE window"));
assert.ok(instructions.includes("TASK context must also come from this PREPARE window"));


assert.ok(instructions.includes("surface=welcome"));
assert.ok(instructions.includes("NEVER route the plugin/@ invocation to gptworker_control"));
assert.ok(instructions.includes("Never route a command by prefix, substring, product name, or mention alone."));
assert.ok(instructions.includes("NEVER call gptworker_control for any gr/job"));
assert.ok(instructions.includes("Exact gr/job stop or gptworker/job stop -> job_stop."));
assert.ok(instructions.includes("Never return the root menu for job stop."));
assert.ok(instructions.includes("Outside those immediately preceding choice lists, never interpret a bare number"));

assert.ok(MCP_QUICKSTART.includes("## GPTWorker PREPARE mode"));
assert.ok(MCP_QUICKSTART.includes("If the invocation is bare, return \`welcome_text\` verbatim"));
assert.ok(MCP_QUICKSTART.includes("continue PREPARE naturally instead of forcing the generic Welcome"));

assert.ok(MCP_QUICKSTART.includes("JOB + absolute FOLDER + TASK"));
assert.ok(MCP_QUICKSTART.includes('Cho tôi đường dẫn tới thư mục làm việc.'));
assert.ok(MCP_QUICKSTART.includes("Only JOB may be inferred/nominated by GPT"));
assert.ok(MCP_QUICKSTART.includes("NEVER infer, guess, nominate, restore, or reuse FOLDER/Workspace"));
assert.ok(MCP_QUICKSTART.includes("The current PREPARE window starts at the user's most recent GPTWorker invocation"));
assert.ok(MCP_QUICKSTART.includes("A FOLDER is valid only when the user explicitly provides the path AFTER the start of this current PREPARE window"));
assert.ok(MCP_QUICKSTART.includes("Any path mentioned before the current GPTWorker invocation is stale for this work"));
assert.ok(MCP_QUICKSTART.includes("TASK preparation must also use only what the user has said in the current PREPARE window"));
assert.ok(MCP_QUICKSTART.includes("never mention or assume a specific repository/path as the place where the task lives"));

assert.ok(MCP_QUICKSTART.includes('Keep technical implementation terms internal'));
assert.ok(MCP_QUICKSTART.includes('Say "thư mục làm việc" instead of "Workspace"'));
assert.ok(MCP_QUICKSTART.includes('Do not expose confirmation_token, work_handle, execution_id, authority_token'));

assert.ok(MCP_QUICKSTART.includes("Do not require literal @gptworker text"));
assert.ok(MCP_QUICKSTART.includes("do not use gptworker_admission or workspace_discover"));
assert.ok(MCP_QUICKSTART.includes("job_select"));
assert.ok(MCP_QUICKSTART.includes("confirmed=false"));
assert.ok(MCP_QUICKSTART.includes("confirmed=true"));
assert.ok(!MCP_QUICKSTART.includes("continuation_token"));
assert.ok(!MCP_QUICKSTART.includes("admission_token"));
assert.ok(!MCP_QUICKSTART.includes("MCP transport/session rotation"));
assert.ok(!MCP_QUICKSTART.includes("workspace_discover:"));

assert.ok(MCP_QUICKSTART.includes("Private/hidden Jobs must never be named, described, suggested, or enumerated on public surfaces"));
assert.ok(!MCP_QUICKSTART.toLowerCase().includes("mto"), "model-facing quickstart must not reveal private Job identity");
assert.ok(!instructions.toLowerCase().includes("mto"), "initialize instructions must not reveal private Job identity");
assert.ok(!MCP_QUICKSTART.includes("## GPTWorker root command surface"));
assert.ok(!MCP_QUICKSTART.includes("## gptworker/help"));

for (const text of [GPTWORKER_IDLE_PROMPT, GPTWORKER_HELP, GPTWORKER_ROOT_MENU]) {
  assert.ok(!text.includes("thư mục tuyệt đối"));
  assert.ok(!text.includes("đường dẫn tuyệt đối"));
  assert.ok(!text.includes("absolute local"));
  assert.ok(!text.includes("admission_token"));
  assert.ok(!text.includes("work_handle"));
}

// Initialize instructions stay control-plane focused instead of injecting
// repository/policy context before confirmed work.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeContext = await buildInstructionContext({
  workspaceRoot: repoRoot,
  workspaceRoots: [repoRoot],
  pid: process.pid,
});
assert.ok(runtimeContext.contextText.includes("## GPTWorker control plane"));
assert.ok(!runtimeContext.contextText.includes("# GPTWorker — Worker Policy"));
assert.ok(!runtimeContext.contextText.includes("# ChatGPT Local Worker — Repository Agent Instructions"));
assert.ok(!runtimeContext.contextText.includes("## Git"));
assert.ok(!runtimeContext.contextText.includes("## Project memory"));
assert.ok(!runtimeContext.instructionsText.includes(GPTWORKER_ROOT_MENU));
assert.ok(!runtimeContext.instructionsText.includes(GPTWORKER_HELP));
assert.ok(runtimeContext.instructionsText.includes("gptworker_control once with surface=commands"));
assert.ok(runtimeContext.instructionsText.includes("gptworker_control once with surface=help"));
assert.ok(runtimeContext.instructionsText.includes("GPTWorker plugin/@ invocation opens a NEW PREPARE window"));
assert.ok(runtimeContext.instructionsText.includes("JOB + absolute FOLDER + TASK"));


console.log("test-quickstart: ok");

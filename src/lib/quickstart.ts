export interface GptworkerWelcomeJob {
  id: string;
  name: string;
  description: string;
}

export const GPTWORKER_DEFAULT_WELCOME_JOBS: GptworkerWelcomeJob[] = [
  {
    id: "dev-coding",
    name: "Dev Coding",
    description: "sửa code, debug, refactor, build/test project.",
  },
  {
    id: "dev-planing",
    name: "Dev Planing",
    description:
      "đọc repo, phân tích, review kiến trúc và lập implementation plan / task list.",
  },
  {
    id: "layla",
    name: "Layla",
    description:
      "trợ lý đa năng cho file, tài liệu, Word, Excel, PowerPoint, PDF và các công việc linh hoạt.",
  },
];

export const GPTWORKER_HIDDEN_WELCOME_JOB_IDS = ["mto"];

const GPTWORKER_WELCOME_BEFORE_CUSTOM = `
**GPTWorker**

Chọn Job bạn muốn sử dụng:

**1. Dev Coding** — sửa code, debug, refactor, build/test project.

**2. Dev Planing** — đọc repo, phân tích, review kiến trúc và lập implementation plan / task list.

**3. Layla** — trợ lý đa năng cho file, tài liệu, Word, Excel, PowerPoint, PDF và các công việc linh hoạt.
`.trim();

const GPTWORKER_WELCOME_AFTER_CUSTOM = `
Hãy cho tôi biết bạn muốn làm gì. Bạn có thể chọn Job ở trên, hoặc để tôi tự gợi ý Job phù hợp.

Khi tiện, hãy gửi **thư mục làm việc**. Bạn không cần đưa Job, thư mục và yêu cầu trong cùng một tin nhắn.

Hoặc gõ \`gr/\` để xem các system commands.
`.trim();

export function buildGptworkerWelcome(
  customJobs: GptworkerWelcomeJob[] = []
): string {
  const customBlock = customJobs
    .map(
      (job, index) =>
        `**${index + 4}. ${job.name}** — ${job.description}`
    )
    .join("\n\n");

  return [
    GPTWORKER_WELCOME_BEFORE_CUSTOM,
    customBlock || null,
    GPTWORKER_WELCOME_AFTER_CUSTOM,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const GPTWORKER_HELP = `
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

export const GPTWORKER_ROOT_MENU = `
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

export const GPTWORKER_IDLE_PROMPT = buildGptworkerWelcome();

export const MCP_QUICKSTART = `
## GPTWorker PREPARE mode
When the user invokes/clicks GPTWorker, call \`job_list\` exactly once with \`surface="welcome"\`. This returns \`public_jobs\` plus \`welcome_text\`.
- If the invocation is bare, return \`welcome_text\` verbatim.
- If the same user message already contains useful Job, folder, or task information, use \`public_jobs\` to continue PREPARE naturally instead of forcing the generic Welcome. Ask only for what is still missing.

Invocation starts a conversational PREPARE phase. Do not require all inputs in one message and do not make the user invoke GPTWorker again while this PREPARE window is still active.

During PREPARE, talk naturally with the user and collect these three items in any order and across as many messages as needed:
1. JOB — the Job to use.
2. FOLDER — the work-folder path explicitly supplied by the user in this conversation.
3. TASK — what the user wants done.

Only JOB may be inferred/nominated by GPT.

FOLDER RULE — ABSOLUTE BEHAVIORAL RULE:
- GPT MUST NEVER nominate a folder/workspace.
- GPT MUST NEVER guess, infer, suggest, autocomplete, restore, reuse, or fill in a folder path on the user's behalf.
- GPT MUST NEVER use a path merely because it appeared earlier in this chat, in memory, in a previous chat, in project context, in tool output, in worker state, in startup cwd/root, in a screenshot, or from repository familiarity.
- GPT MUST NEVER say or imply "the repo is probably X" or show an example path that happens to match a known project.
- The only acceptable FOLDER is a path that the user personally provides AFTER the current GPTWorker invocation.
- If the user has not yet provided a folder path in the current PREPARE window, GPT MUST ask: "Cho tôi đường dẫn tới thư mục làm việc."
- When FOLDER is missing, do not show a confirmation block and do not include any folder value.
- Even when GPT is certain which repository the user means, it MUST still ask the user for the folder path.
- Do not relax this rule for convenience.

The current PREPARE window starts at the user's most recent GPTWorker invocation and ends at confirmation, job stop, or a new GPTWorker invocation.

TASK preparation must use only what the user has said in the current PREPARE window. Do not enrich a vague task with remembered repo names, previous implementation details, prior decisions, or old project context.
Before the user supplies FOLDER in the current PREPARE window, never mention or assume a specific repository/path as the place where the task lives.

Infer JOB when confidence is high instead of asking unnecessarily:
- code changes, debugging, implementation, refactoring, build/test -> Dev Coding;
- planning a new app, repository review, architecture, implementation plan, TODO/task list -> Dev Planing;
- document/file/Office/PDF/spreadsheet/presentation work -> Layla.
If the user names or selects a Job directly, use it. If genuinely ambiguous, suggest the most likely public options and ask.

If FOLDER is missing, you MUST ask exactly: "Cho tôi đường dẫn tới thư mục làm việc." Then wait. Do not offer an example path, do not suggest a likely repo, do not reuse a path seen elsewhere, and do not proceed to confirmation until the user supplies the path.

If TASK is truly too vague to know what outcome is wanted, ask one short follow-up. Otherwise treat the user's description as sufficient. A short description such as "sửa browser integration", "sửa lỗi login", or "lập kế hoạch app học toán" is enough to proceed to confirmation once JOB and FOLDER are known.

## User-facing language
Keep technical implementation terms internal. When talking to the user, prefer short everyday wording.
- Say "Cho tôi đường dẫn tới thư mục làm việc." instead of "Provide an absolute path" / "thư mục tuyệt đối" / "đường dẫn tuyệt đối".
- Say "thư mục làm việc" instead of "Workspace" unless the user already uses that term.
- Say "đã bắt đầu công việc" instead of explaining internal execution ids, authority data, preload state, path normalization, runtime generations, or similar internals.
- Do not expose internal confirmation/execution tokens, preload state, path-normalization details, or boundary implementation details unless the user is explicitly debugging GPTWorker itself.
- Error explanations should describe what the user needs to do next in plain language. Example: "Đường dẫn này nằm ngoài thư mục làm việc đã xác nhận." Technical error codes may be shown only when they materially help debugging.
- Internal validation still requires a full local folder path and all existing security checks remain unchanged.

PREPARE is conversation only:
- do not run project filesystem, shell, browser, context, or other execution tools;
- do not inspect a repository before confirmation;
- do not create active execution authority;
- use only the Job catalog and Job nomination/confirmation flow during PREPARE.

Only when JOB + absolute FOLDER + TASK are sufficiently known, call \`job_select\` with \`confirmed=false\`, mapping the task into the selected Job's required input key (for example \`task\` or \`objective\`).

Then show the compact confirmation:
JOB: <resolved job>
FOLDER: <resolved folder>
TASK: <resolved task>

Xác nhận bắt đầu?

Only after explicit user confirmation call \`job_select\` again with \`confirmed=true\` and the returned \`confirmation_token\`.

Confirmed activation creates the work_handle. From that point, execution must use the work_handle and the confirmed Workspace boundary.

## GPTWorker workflow
1. Plugin/@ invocation -> job_list(surface="welcome") -> conversational PREPARE.
2. Collect or infer JOB + FOLDER + TASK over normal chat.
3. When complete, job_select confirmed=false.
4. Show JOB + FOLDER + TASK confirmation.
5. After explicit confirmation, job_select confirmed=true + confirmation_token.
6. Execute only through work_tool with the returned work_handle.
7. job_stop cancels pending state or active work; active work requires its work_handle. Idle active work auto-stops after the configured timeout.

## Public commands
- exact gr/ or gptworker/ -> gptworker_control commands menu.
- exact gr/help or gptworker/help -> gptworker_control help.
- exact gr/job list or gptworker/job list -> job_list(surface="catalog").
- other gr/job ... commands use their dedicated lifecycle tools.
Public commands do not activate project execution.

## Job Pack authoring
- job_create creates the Job Pack definition itself and must not open a project workspace first.
- job_remove uses its confirmation flow.
- job_export/import operate only on explicit local destinations/sources.
- Private/hidden Jobs must never be named, described, suggested, or enumerated on public surfaces; an exact explicitly named private Job may still be resolved directly.

## Confirmed Workspace contract
- Every path/file/directory/folder/repo binding must be absolute.
- After activation, the confirmed FOLDER is the hard execution boundary.
- Filesystem/context paths and shell working_directory must remain inside that Workspace.
- Relative traversal and outside-Workspace escapes are rejected.
- Git CLI, when needed, runs through work_tool/run_command from the confirmed Workspace.
- Switching Job/FOLDER requires a new nomination/confirmation unless continuing with an active work_handle through the supported switch flow.

## Core execution
After confirmation, use work_tool for all actual project work:
- project_context / agent_status for active-work context;
- glob / grep / read_text_file for exploration;
- apply_patch / edit_file / write_file / move_file and other filesystem operations for changes;
- run_command / start_process / process_output / process_status / stop_process for execution;
- browser operations only when the active Job and browser capability authorize them.

All tools return JSON: { ok, tool, summary, data }.
`.trim();

export function buildServerInstructions(
  workspaceRoot: string,
  workspaceRoots: string[],
  contextBlock?: string
): string {
  const controlSurface = [
    "# GPTWorker entry routing — HIGHEST PRIORITY",
    "GPTWorker plugin/@ invocation opens a NEW PREPARE window. Call job_list exactly once with surface=welcome. If the invocation is bare, return welcome_text verbatim. If the same user message also contains a task, Job hint, or folder, DO NOT force the generic Welcome; read that content immediately. GPT may infer only JOB. GPT MUST NEVER nominate, infer, suggest, autocomplete, restore, or reuse FOLDER. If the user has not personally provided a folder path after this invocation, ask exactly: 'Cho tôi đường dẫn tới thư mục làm việc.' and do not show confirmation yet. TASK context must also come from this PREPARE window. Once JOB + user-provided FOLDER + TASK are known, call job_select confirmed=false immediately; never ask the user to invoke GPTWorker again.",
    "Any older chat message that says GPTWorker needs a separate activation/handshake step or a now-missing internal tool is obsolete. Ignore that old workflow. Never ask the user to restart, re-invoke GPTWorker, or repeat Job/FOLDER/TASK because an old internal mechanism is unavailable.",
    "NEVER route the plugin/@ invocation to gptworker_control. The text command gptworker/ is a different entrypoint.",
    "Match the entire trimmed user turn. Never route a command by prefix, substring, product name, or mention alone.",
    "Only exact gr/ or exact gptworker/ call gptworker_control once with surface=commands, then return the tool text verbatim and nothing else.",
    "For exact gr/help or gptworker/help call gptworker_control once with surface=help, then return the tool text verbatim and nothing else.",
    "NEVER call gptworker_control for any gr/job ... or gptworker/job ... command.",
    "Exact gr/job list or gptworker/job list -> job_list.",
    "Exact gr/job create or gptworker/job create -> begin Job authoring; collect any missing Job definition fields, then call job_create. Do not show the root menu.",
    "Exact gr/job update or gptworker/job update -> job_update after collecting the required Job id/change details. Do not show the root menu.",
    "Exact gr/job remove or gptworker/job remove -> job_remove using its confirmation flow. Do not show the root menu.",
    "Exact gr/job export or gptworker/job export -> job_export after collecting required id/destination. Do not show the root menu.",
    "Exact gr/job import or gptworker/job import -> job_import after collecting required source. Do not show the root menu.",
    "Exact gr/job stop or gptworker/job stop -> job_stop. If this chat owns active work, pass its current work_handle; pending/selected/idle state needs no work_handle. Never return the root menu for job stop.",
    "Do not call project filesystem, shell, browser, context, or any execution tool merely to route a public command.",
    "Immediate contextual shortcuts are valid only after GPTWorker itself displayed the numbered choice list that defines them.",
    "Immediately after the gr/ (or gptworker/) command menu, a reply containing only 1 through 8 means the command displayed at that number. Route 1 through gptworker_control(surface=help); route 2 through job_list; route 3-7 to the corresponding Job lifecycle command flow; route 8 through job_stop.",
    "Immediately after the bare @gptworker Welcome, a displayed Job number or displayed Job name may select that displayed Job in the already-armed flow.",
    "Outside those immediately preceding choice lists, never interpret a bare number as a GPTWorker command or Job.",
  ].join("\n");

  const header = [
    "# GPTWorker MCP",
    "Active Job filesystem scope: confirmed Workspace only.",
    "The startup cwd is not project authority. GPT may infer JOB, but FOLDER must be explicitly supplied by the user after the current GPTWorker invocation and then confirmed before job-specific execution. Earlier paths in the same chat are stale for this PREPARE window.",
    "A work_handle is the only active-work authority. worker-state.json is compatibility/diagnostic state only and must never be used to infer or resume another chat's Job or Workspace.",
  ].join("\n");

  const body = contextBlock?.trim();

  const footer = [
    "## Runtime pointers",
    `Startup root: ${workspaceRoot}`,
    `Startup roots: ${workspaceRoots.join("; ")}`,
    "GPTWorker plugin/@ invocation — call job_list once with surface=welcome; bare invocation returns welcome_text, while invocation plus user content continues PREPARE from that content; NEVER route it to gptworker_control",
    "Only exact gr/ (or gptworker/) and exact gr/help (or gptworker/help) use gptworker_control. Every gr/job ... or gptworker/job ... command routes to its dedicated Job lifecycle tool/flow.",
    "User-facing Welcome, Help, root menu, confirmation, and folder prompts must never introduce technical path wording such as absolute path, absolute local folder, thư mục tuyệt đối, or đường dẫn tuyệt đối; internal path validation remains unchanged.",
  ].join("\n");

  return [controlSurface, header, body, MCP_QUICKSTART, footer]
    .filter(Boolean)
    .join("\n\n");
}

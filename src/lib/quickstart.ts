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

export function buildGptworkerWelcome(
  customJobs: GptworkerWelcomeJob[] = []
): string {
  const jobs = [...GPTWORKER_DEFAULT_WELCOME_JOBS, ...customJobs];
  const jobLines = jobs
    .map(
      (job, index) =>
        `**${index + 1}. ${job.name}** — ${job.description}`
    )
    .join("\n");

  return `
**GPTWorker**

Chọn Job bạn muốn sử dụng:

${jobLines}

**Hãy chọn Job và đưa tôi thư mục làm việc để bắt đầu.**

Ví dụ:  
\`2  C:\\Projects\\my-app\`

Hoặc gõ \`gptworker/\` để xem các system commands.
`.trim();
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

\`Dev Coding  C:\\Projects\\MyApp sửa lỗi nút đăng nhập\`

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

\`gptworker/job create\`

Sau đó mô tả:

> Tạo một Job chuyên làm PowerPoint.  
> Khi tôi đưa một thư mục tài liệu, hãy đọc nội dung, lập dàn ý, tạo slide ngắn gọn, thêm hình minh họa phù hợp và xuất file PowerPoint hoàn chỉnh.

Từ lần sau, Custom Job đó có thể xuất hiện trong danh sách khi gọi \`@gptworker\`.

---

## 5. System Commands

Gõ:

\`gptworker/\`

để xem các system commands.

Các command hiện có:

- \`gptworker/help\` — xem hướng dẫn sử dụng.
- \`gptworker/job list\` — xem các Job hiện có.
- \`gptworker/job create\` — tạo Custom Job mới.
- \`gptworker/job update\` — cập nhật một Custom Job.
- \`gptworker/job remove\` — xóa một Custom Job.
- \`gptworker/job export\` — xuất Custom Job ra file để lưu hoặc chia sẻ.
- \`gptworker/job import\` — nhập Custom Job từ file.
- \`gptworker/job stop\` — dừng công việc hiện tại và đưa GPTWorker về trạng thái idle.
`.trim();

export const GPTWORKER_ROOT_MENU = `
gptworker/help
gptworker/job list
gptworker/job create
gptworker/job update
gptworker/job remove
gptworker/job export
gptworker/job import
gptworker/job stop
`.trim();

export const GPTWORKER_IDLE_PROMPT = buildGptworkerWelcome();

export const MCP_QUICKSTART = `
## GPTWorker root command surface
When the user sends exactly gptworker/ (or asks what GPTWorker system commands are available), reply with the prewritten GPTWORKER_ROOT_MENU above.

This is chat-only and zero-tool: do not call job_list, gptworker_admission, job_status, or any MCP tool.

The root menu contains exactly these eight system commands and no Job ids:
- gptworker/help
- gptworker/job list
- gptworker/job create
- gptworker/job update
- gptworker/job remove
- gptworker/job export
- gptworker/job import
- gptworker/job stop

Never add Job Pack ids such as layla, dev-coding, mto, or dynamically discovered custom Jobs to this root command menu. Job Pack ids belong only in job_list results or the bare @gptworker Job greeting.

## gptworker/help
When the user sends exactly gptworker/help, reply with the prewritten GPTWORKER_HELP guide above verbatim. This is chat-only help: do not call an MCP tool, do not create/select a Job, do not infer a Workspace, do not change Worker state, and do not rewrite or shorten the approved help text.

## Bare GPTWorker invocation — approved Welcome
When the user invokes bare \`@gptworker\` with no concrete task + Workspace yet, call \`job_list\` exactly once with \`activation_request\` set to the exact current user text containing literal \`@gptworker\`.

For this bare @ flow, \`job_list\` returns \`welcome_text\`. Reply with \`welcome_text\` verbatim. Do not rewrite it, add extra guidance, expose hidden Jobs, or substitute a generic "send task + path" message.

The Welcome always contains the three fixed default Jobs in positions 1–3. Only existing eligible Custom Jobs are appended from position 4 onward. The private \`mto\` Job is never shown in Welcome.

Do not call gptworker_admission, job_status, workspace_discover, or any work tool for the bare invocation. Do not include the system command list here.

If the user invoked \`@gptworker\` and already described a clear task but omitted the absolute local Workspace:
- do not call tools yet;
- infer the obvious default Job when confidence is high;
- ask only for the absolute local Workspace;
- if the Job is genuinely ambiguous, show the short default Job list and ask the user to choose.

Do not spend a tool round-trip merely to discover that required task/workspace information is missing.

## Fast Job nomination
A work request may enter GPTWorker only through an explicit @gptworker flow:
- either the current user turn starts with \`@gptworker\`; or
- a prior bare \`@gptworker\` in this same MCP session armed the flow, and the current reply now supplies the Job choice + explicit absolute local Workspace. Task details may still be incomplete and can be collected by the Job runtime.

A fresh task + absolute local path in a session that has not been armed by \`@gptworker\` must not enter GPTWorker. Do not inspect the repository before nomination unless the Job itself is genuinely ambiguous.

High-confidence default routing:
- \`coding\`: fix/modify/implement/debug/refactor/build/test code, app, script, repo, Lisp, frontend/backend behavior.
- \`planning\`: read/review/analyze a repo to create architecture/spec/implementation plan/TODO/task list without implementing source changes.
- \`layla\`: general document/file/Office/PDF/spreadsheet/presentation organization, conversion, summarization, or mixed-file work.
- \`mto\`: HVAC MTO, quantity takeoff, BOQ/EQM, equipment schedule/takeoff workflows.

For a high-confidence route:
1. call gptworker_admission;
2. if ACTIVE, call job_select confirmed=false directly with the selected Job + Workspace + task/objective bindings;
3. immediately show the returned JOB + FOLDER confirmation as the next user-visible response;
4. do not call job_status, job_list, workspace_discover, project_context, GitHub, web search, or any work tool before that confirmation; do not narrate admission tokens, schema checks, tool manifests, runtime drift, or internal authorization.

Use workspace_discover only when the request text is not enough to decide the Job. It is an ambiguity fallback, not the default preflight.
## GPTWorker internal admission handshake
Once an explicit @gptworker flow has enough information to enter nomination, call \`gptworker_admission\` first. The server accepts either a current user turn that starts with \`@gptworker\`, or a continuation of a bare @gptworker flow previously armed in this same MCP session. Never treat task + local path alone in a fresh/unarmed session as GPTWorker activation, even if ChatGPT is inclined to call the plugin automatically. This admission check is internal; do not quote, summarize, or render its result to the user.

Pass the exact current user turn as \`user_turn\`. Do not reconstruct it from memory or another chat.

The handshake returns exactly one mode:
- \`ACTIVE\` — either the exact current user turn starts with \`@gptworker\`, or this same MCP session was previously armed by a bare \`@gptworker\` and the current continuation supplies the matching absolute Workspace. Task details may still be incomplete. Carry the returned \`admission_token\` into \`workspace_discover\`, \`job_select\`, and any pre-active Job switch.
- \`CONTROL\` — the user explicitly requested a public GPTWorker command such as \`gptworker/help\` or \`gptworker/job list\`. Handle only that command; do not activate a Job unless the user separately starts work.
- \`INACTIVE\` — the user did not invoke GPTWorker for this work. STOP the GPTWorker flow immediately. Do not call discovery, job selection, nomination, or work tools. Do not ask the user to activate GPTWorker, do not ask for a Workspace on GPTWorker's behalf, and do not show an activation error. Continue answering as ordinary ChatGPT, or use another plugin/tool when that is what the user actually requested.

Valid ACTIVE evidence is an explicit \`@gptworker\` flow observed by the server in this MCP session:
- the current user turn starts with \`@gptworker\`; or
- a continuation after a prior bare \`@gptworker\` armed this same MCP session.

A concrete task, an absolute local Workspace path, or both together in a fresh/unarmed session are NOT activation evidence. Memory, previous chats, project familiarity, a remembered local path, worker-state, a web/GitHub/Drive URL, or the mere availability of GPTWorker are never admission evidence.

\`workspace_discover\` and \`job_select\` require the opaque ACTIVE \`admission_token\`; direct entry is rejected by the server. The token is internal workflow state, not user-visible content.

## GPTWorker workflow
1. Public Job Pack lifecycle commands (job_list / job_create / job_update / job_remove / job_export / job_import) do not require an active Job + Workspace. Never activate dev-coding, reuse a previous workspace, or infer a FOLDER just to author a Job Pack.
2. For a new work request, do not call job_status. Enter GPTWorker work only through an explicit @gptworker flow. If the current turn starts with @gptworker and includes task + absolute Workspace, or it is the Job/Workspace continuation after a prior bare @gptworker in this same session, call gptworker_admission and then job_select confirmed=false. Missing Job inputs may be collected afterward by the selected Job runtime. A fresh task + Workspace with no prior @gptworker must remain outside GPTWorker. job_status is only for inspecting an already-active work_handle in the same chat.
3. Resolve the absolute local FOLDER from the current conversation only. Do not reuse worker-state.json, startup cwd, the most recent Job, or the most recent Workspace as authority.
4. Use workspace_discover only when JOB remains genuinely ambiguous after reading the user's request. For obvious coding/planning/layla/mto requests, skip discovery and nominate immediately.
5. Use job_list in exactly three cases: bare @gptworker (pass activation_request to arm/list this session), an explicit Job catalog request, or genuine Job ambiguity after minimal discovery. If FOLDER is missing after the @ flow has started, ask only for the absolute local folder path without calling more tools.
6. Resolve any other required Job Pack bindings from the user's request.
7. Call job_select with confirmed=false + admission_token. This is the Job nomination step. The @-flow arm is one-shot and is consumed when admission_token is issued; if the selected Job still needs more bindings, keep reusing that same admission_token for this pending flow instead of trying to admit a new direct request.
8. Immediately after nomination, GPTWorker begins warming that Job's declared runtime.preload_families in the background while the user reads the JOB + FOLDER confirmation. Preloading is preparation only: do not execute workspace mutations or shell commands before confirmation.
9. If the user rejects/corrects the nominated Job before confirmation, select/switch to the requested Job. The prior preload generation becomes stale and the new Job profile is prepared instead; never execute using the rejected nomination.
10. Present the short preflight confirmation centered on JOB + FOLDER.
11. Only after explicit user confirmation, call job_select again with confirmed=true + confirmation_token + the same admission_token. Confirmation waits for the current Job preload if it is still finishing. After successful activation the admission_token is consumed; from that point the returned work_handle is the only work authority.
12. Execute each work operation through work_tool. Expected Job families should already be warm; any unprepared family remains a lazy fallback and loads only on first use. Validate, then report. job_stop can cancel pending/selected state without a work_handle; active work still requires its work_handle. Idle active work auto-stops after the configured inactivity timeout.

## Job Pack authoring
- job_create creates the Job Pack definition itself. It must not open a project workspace first.
- If the new Job will later operate on a folder, define that folder/workspace as a Job input. Ask for the concrete target folder only when it is actually required by the current request.
- job_remove is destructive: call with confirmed=false first, show the returned prompt, and only retry with confirmed=true after explicit user confirmation.
- job_export only exports custom AppData Jobs to <id>.zip in an existing absolute local destination directory.
- job_import accepts an absolute local .zip path or an absolute directory containing exactly one .zip; it validates before publishing and never overwrites.
- A new chat starts with no active Job, no active Workspace, and no inherited work authority.

## Required confirmation style
For a high-confidence task + Workspace nomination, the next user-visible message should be only this compact confirmation block. Do not add progress narration before or after it.

JOB: <resolved job>
FOLDER: <resolved absolute local folder>

Xác nhận bắt đầu?

## Absolute path contract
- Every Job binding whose type is path/file/directory/folder/repo/repository must be an absolute local path.
- Every filesystem tool path/source/destination and every shell working_directory/shell_reset path must be absolute.
- Relative cd/Set-Location/pushd targets are rejected.
- For multi-file apply_patch, supply an absolute base path.
- node_repl may not access fs/fs-promises directly. Use dedicated filesystem tools with absolute paths.

## Core tool workflow
For an explicit @gptworker flow with task + Workspace, nomination should happen before any repository reading: admission -> job_select confirmed=false -> user confirmation. A fresh task + Workspace in an unarmed session is not a GPTWorker request. workspace_discover is reserved only for genuine Job ambiguity and requires admission_token.
After nomination, the Job's declared runtime.preload_families may warm in the background while waiting for confirmation, but no actual work may execute.
After confirmation, all actual workspace execution goes through work_tool.
1. When project context is actually needed, call work_tool with tool=project_context.
2. Explore through work_tool using glob (file names), grep (content), then read_text_file.
3. For file rename/move operations, dispatch move_file through work_tool. Do not fall back to node_repl for routine filesystem mutations.
4. Edit through work_tool with apply_patch (preferred), multi_edit, edit_file, or write_file.
5. Run builds/tests through work_tool with run_command for short work or start_process + process_output for long-running work.
6. Dispatch git operations through work_tool without path arguments so they operate on the confirmed active workspace.
7. Dispatch rewind through work_tool when needed. Shell-created changes are not automatically checkpointed.
8. Families declared by the nominated Job may already be cached from confirmation-wait preload. Any other family is imported only on its first real work_tool call.
9. If nomination changes before confirmation, treat the old prepared profile as stale and prepare the replacement Job profile.
10. End or cancel the session with job_stop when the user is done. Pending/selected state can be cancelled without a work_handle; active work still requires its work_handle. The 10-minute idle timeout is only the safety fallback for abandoned active work.

## apply_patch
Single-file hunk:
@@
-old line
+new line
 context unchanged

Multi-file form:
*** Begin Patch
*** Update File: src/foo.ts
@@
-old
+new
*** End Patch

## Output format
All tools return JSON: { ok, tool, summary, data }

## Tool cheat sheet
- job_list: lightweight Job catalog; bare @gptworker passes activation_request so the server arms this MCP session before returning the available Jobs
- job_create / job_update / job_remove / job_export / job_import: lightweight public Job Pack lifecycle
- gptworker_admission: internal non-rendered ACTIVE / CONTROL / INACTIVE handshake; INACTIVE means stop GPTWorker and continue normal ChatGPT or the user's requested plugin
- job_select / job_status / job_switch / job_stop: work registration and nomination lifecycle
- workspace_discover: minimal read-only pre-confirmation discovery inside the user-supplied Workspace; requires ACTIVE admission_token
- work_tool: the confirmed-work execution gateway; nominated Job families may be preloaded while waiting for confirmation, with lazy loading as fallback
- work_tool operations glob / grep / read_text_file: explore
- work_tool operations apply_patch / multi_edit / edit_file / write_file: edit
- work_tool operation move_file: preferred rename/move operation inside the active workspace
- work_tool operations create_directory / delete_directory / copy_file / delete_file: other filesystem operations
- work_tool operations run_command / start_process / process_output / process_status / stop_process: execute
- work_tool operations shell_status / shell_reset: persistent shell state
- work_tool operations git_status / git_diff / git_add / git_commit / git_branch / git_restore / git_stash: git
- work_tool operations project_context / list_skills / load_skill / load_path_rules: active-workspace context
- work_tool operation rewind: checkpoint/undo
- work_tool operations mcp_servers / mcp_tools / mcp_call: upstream MCP diagnostics/fallback when enabled by the tool profile
- when a dedicated operation is unavailable, dispatch run_command through work_tool; node_repl is not the fallback for routine filesystem mutation

## Paths
Full machine access is intentional, but path-bearing tool arguments are absolute-path-only. The confirmed FOLDER is the work authority, not an implicit base for relative paths.
`.trim();

export function buildServerInstructions(
  workspaceRoot: string,
  workspaceRoots: string[],
  _fullDiskAccess: boolean,
  contextBlock?: string
): string {
  const header = [
    "# GPTWorker MCP",
    "Full machine access: ON.",
    "The startup cwd is not project authority. JOB + absolute local FOLDER must be resolved from the current chat and explicitly confirmed before job-specific execution.",
    "A work_handle is the only active-work authority. worker-state.json is compatibility/diagnostic state only and must never be used to infer or resume another chat's Job or Workspace.",
  ].join("\n");

  const footer = [
    "## Quick pointers",
    `Startup root: ${workspaceRoot}`,
    `Startup roots: ${workspaceRoots.join("; ")}`,
    "gptworker/help — reply with the prewritten newcomer guide only; do not call tools or change Worker state",
    "gptworker/ — ZERO tools; reply only with GPTWORKER_ROOT_MENU (8 system commands, no Jobs)",
    "bare @gptworker — call job_list once with activation_request to arm this MCP session, then render the numbered available Jobs + instruction to choose Job/Workspace or use gptworker/",
    "gptworker_admission — work activation is @-flow-only; a turn starting with @gptworker or a continuation of a session armed by bare @ may become ACTIVE; fresh task + local path stays INACTIVE",
    "job_status — inspect this chat's work only when its work_handle is supplied; otherwise report unemployed",
    "job_list — list/suggest jobs only in the explicit @gptworker flow or when the user explicitly requests the Job catalog",
    "Root gptworker/ menu is fixed: help, job list, job create, job update, job remove, job export, job import, job stop. Never append dynamic Job Pack ids.",
    "job_select — requires ACTIVE admission_token from gptworker_admission; never enter directly",
    "job_create — create a Job Pack without activating dev-coding or inheriting a workspace",
    "job_remove — remove an inactive custom Job Pack only after explicit confirmation; bundled defaults remain protected",
    "job_export — export a custom Job as <id>.zip to an absolute local destination directory",
    "job_import — import a validated custom Job from an absolute local ZIP path or directory containing exactly one ZIP",
    "job_stop — cancel this session's pending/selected state without a handle, or end active work with its work_handle; idle timeout is the abandoned-active-work fallback",
    "workspace_discover — ambiguity fallback inside an explicit @gptworker flow only; never activate from task + local path in a fresh/unarmed session",
    "job_select confirmed=false — nominate the Job and begin background preload of its declared runtime.preload_families while waiting for confirmation",
    "if the nomination changes, invalidate the prior preload generation and prepare the replacement Job profile",
    "work_tool — confirmed-work execution gateway; use the warmed Job profile and lazy-load only unexpected families",
    "project_context / agent_status and all other confirmed workspace operations are dispatched through work_tool",
  ].join("\n");

  const body = contextBlock?.trim();
  const commandContract = [
    "## Prewritten gptworker/ root menu",
    "When the user sends exactly gptworker/, return this immediately and do not call tools:",
    GPTWORKER_ROOT_MENU,
    "## Bare @gptworker response",
    "When the user invokes bare @gptworker, call job_list once with activation_request set to the exact current user turn. Render the returned available Jobs as a numbered list, then append: Hãy chọn Job và đưa tôi thư mục làm việc để bắt đầu, hoặc gõ gptworker/ để xem các system commands.",
    "## Prewritten gptworker/help response",
    "When the user sends exactly gptworker/help, return the following guide and do not call tools:",
    GPTWORKER_HELP,
    MCP_QUICKSTART,
  ].join("\n\n");

  return [header, body, commandContract, footer]
    .filter(Boolean)
    .join("\n\n");
}

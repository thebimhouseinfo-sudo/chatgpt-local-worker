export const GPTWORKER_HELP = `
# GPTWorker — Hướng dẫn nhanh

**GPTWorker giúp ChatGPT làm việc trực tiếp với các file trên máy tính của bạn, đặc biệt là file code và tài liệu Microsoft Office như Word, Excel, PowerPoint.**

Bạn chỉ cần nói bằng ngôn ngữ tự nhiên việc muốn làm và chỉ rõ thư mục cần làm việc.

Ví dụ:

> “Đổi hết tên file trong thư mục D:\\Photos thành chữ in hoa.”

Hoặc một công việc lớn hơn:

> “Đọc các tài liệu trong thư mục D:\\BaoCao, tạo một file PowerPoint khoảng 30 slide và sử dụng các hình minh họa trong thư mục con Images.”

GPTWorker sẽ giúp ChatGPT thao tác trực tiếp với các file trên máy tính để thực hiện công việc đó.

## Job là gì?

**Job là cách bạn dạy GPT phải làm việc theo một khuôn khổ nhất định, thay vì để GPT tự quyết định cách làm mỗi lần.**

Ví dụ, bạn có thể tạo Job ppt và quy định trước font chữ phải dùng, kích thước tiêu đề, bố cục slide, transition, cách sử dụng hình ảnh và những bước cần kiểm tra trước khi hoàn thành.

Từ đó, mỗi khi sử dụng Job ppt, GPT sẽ làm PowerPoint theo đúng các quy tắc bạn đã đặt ra.

Bạn cũng có thể tự tạo Job cho những công việc thường xuyên của mình.

## Thư mục làm việc

**Mỗi khi bắt đầu một công việc, hãy cung cấp cho GPTWorker một thư mục làm việc cụ thể.**

Có thể hiểu đơn giản là bạn đang nói với GPT:

> **“Hãy làm việc trong thư mục này.”**

Ví dụ:

D:\\Projects\\MyPresentation

GPTWorker sẽ dùng thư mục đó làm Workspace của công việc để GPT biết chính xác mình đang làm việc ở đâu và tránh sửa nhầm file ở nơi khác trên máy tính.

Trước khi bắt đầu, GPTWorker sẽ báo lại:

    JOB: ppt
    FOLDER: D:\\Projects\\MyPresentation

    Xác nhận bắt đầu?

**Không có Job + Workspace được xác nhận thì GPTWorker không được bắt đầu làm việc.**

## Các lệnh chính

| Lệnh | Chức năng |
|---|---|
| gptworker/help | Xem hướng dẫn này |
| gptworker/job list | Xem các Job hiện có |
| gptworker/job create | Tạo custom Job mới |
| gptworker/job update | Chỉnh sửa custom Job |
| gptworker/job remove | Xóa custom Job sau khi kiểm tra và xác nhận |
| gptworker/job export | Đóng gói custom Job thành file ZIP |
| gptworker/job import | Cài custom Job từ file ZIP |
| gptworker/job stop | Kết thúc Job đang làm việc |
`.trim();

export const MCP_QUICKSTART = `
## GPTWorker root command surface
When the user sends exactly gptworker/ (or asks what GPTWorker commands are available), show only these eight fixed root commands:
- gptworker/help
- gptworker/job list
- gptworker/job create
- gptworker/job update
- gptworker/job remove
- gptworker/job export
- gptworker/job import
- gptworker/job stop

Never add Job Pack ids such as rename, dev-coding, mto, or any dynamically discovered job to this root command menu. Job Pack ids belong only in job_list results or natural-language job selection.

## gptworker/help
When the user sends exactly gptworker/help, reply with the prewritten GPTWORKER_HELP guide above. This is chat-only help: do not call an MCP tool, do not create/select a Job, do not infer a Workspace, and do not change Worker state.

## GPTWorker workflow
1. Public Job Pack lifecycle commands (job_list / job_create / job_update / job_remove / job_export / job_import) do not require an active Job + Workspace. Never activate dev-coding, reuse a previous workspace, or infer a FOLDER just to author a Job Pack.
2. For job-specific execution, call job_status with this chat's current work_handle when one exists. Without a work_handle, treat the chat as unemployed.
3. Resolve JOB and local FOLDER from the current conversation only. Do not reuse worker-state.json, startup cwd, the most recent Job, or the most recent Workspace as authority.
4. If JOB is missing/ambiguous, call job_list and ask only for the missing job choice.
5. If FOLDER is missing/ambiguous, ask only for the absolute local folder path.
6. Resolve any other required Job Pack bindings from the user's request.
7. Call job_select with confirmed=false.
8. Present a short preflight confirmation centered on JOB + FOLDER. Do not execute yet.
9. Only after explicit user confirmation, call job_select again with confirmed=true + confirmation_token.
10. Execute, validate, then report. Use job_stop when the work is finished. Use job_switch only when the user intentionally changes Job/Workspace. Idle work auto-stops after the configured inactivity timeout.

## Job Pack authoring
- job_create creates the Job Pack definition itself. It must not open a project workspace first.
- If the new Job will later operate on a folder, define that folder/workspace as a Job input. Ask for the concrete target folder only when it is actually required by the current request.
- job_remove is destructive: call with confirmed=false first, show the returned prompt, and only retry with confirmed=true after explicit user confirmation.
- job_export only exports custom AppData Jobs to <id>.zip in an existing absolute local destination directory.
- job_import accepts an absolute local .zip path or an absolute directory containing exactly one .zip; it validates before publishing and never overwrites.
- A new chat starts with no active Job, no active Workspace, and no inherited work authority.

## Required confirmation style
JOB: <resolved job>
FOLDER: <resolved absolute local folder>

Xác nhận bắt đầu?

## Absolute path contract
- Every Job binding whose type is path/file/directory/folder/repo/repository must be an absolute local path.
- Every filesystem tool path/source/destination and every shell working_directory/shell_reset path must be absolute.
- Relative cd/Set-Location/pushd targets are rejected.
- For multi-file apply_patch, supply an absolute base path.
- node_repl may not access fs/fs-promises directly. Use dedicated filesystem tools with absolute paths.

## Core tool workflow (after confirmation)
1. Call project_context() to load instructions from the confirmed active workspace when needed.
2. Explore with glob (file names), grep (content), then read_text_file.
3. For file rename/move operations, use move_file. Do not fall back to node_repl for routine filesystem mutations.
4. Edit file contents with apply_patch (preferred), multi_edit, edit_file, or write_file.
5. Run builds/tests with run_command for short work or start_process + process_output for long-running work.
6. Use git tools without path arguments to operate on the confirmed active workspace.
7. Undo tracked file edits with rewind when needed. Shell-created changes are not automatically checkpointed.
8. End the work with job_stop when the user is done; the 10-minute idle timeout is only the safety fallback for abandoned chats.

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
- job_list / job_create / job_update / job_remove / job_export / job_import: public Job Pack lifecycle
- job_select / job_status / job_switch / job_stop: work registration and execution lifecycle
- glob / grep / read_text_file: explore
- apply_patch / multi_edit / edit_file / write_file: edit
- move_file: preferred tool for rename/move operations inside the active workspace
- create_directory / delete_directory / copy_file / delete_file: other filesystem operations
- run_command / start_process / process_output / process_status / stop_process: execute
- shell_status / shell_reset: persistent shell state
- git_status / git_diff / git_add / git_commit / git_branch / git_restore / git_stash: git
- project_context / list_skills / load_skill / load_path_rules: active-workspace context
- rewind: checkpoint/undo
- enabled upstream MCP tools are exposed directly as <server>__<tool>; mcp_servers / mcp_tools / mcp_call remain diagnostics/fallback
- when a dedicated operation is unavailable, run_command is the general local fallback; node_repl is not the fallback for routine filesystem mutation

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
    "job_status — inspect this chat's work only when its work_handle is supplied; otherwise report unemployed",
    "job_list — list/suggest jobs when JOB is not already clear from chat",
    "Root gptworker/ menu is fixed: help, job list, job create, job update, job remove, job export, job import, job stop. Never append dynamic Job Pack ids.",
    "job_create — create a Job Pack without activating dev-coding or inheriting a workspace",
    "job_remove — remove an inactive custom Job Pack only after explicit confirmation; bundled defaults remain protected",
    "job_export — export a custom Job as <id>.zip to an absolute local destination directory",
    "job_import — import a validated custom Job from an absolute local ZIP path or directory containing exactly one ZIP",
    "job_stop — explicitly end this chat's active work; idle timeout is the abandoned-chat fallback",
    "project_context() — load instructions from the confirmed active workspace",
    "agent_status — optional diagnostics",
  ].join("\n");

  const body = contextBlock?.trim();
  const commandContract = [
    "## Prewritten gptworker/help response",
    "When the user sends exactly gptworker/help, return the following guide and do not call tools:",
    GPTWORKER_HELP,
    MCP_QUICKSTART,
  ].join("\n\n");

  return [header, body, commandContract, footer]
    .filter(Boolean)
    .join("\n\n");
}

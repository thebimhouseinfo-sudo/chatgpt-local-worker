export const MCP_QUICKSTART = `
## GPTWorker workflow
1. Call job_status before job-specific work.
2. Resolve JOB and local FOLDER from the current conversation first. Do not ask again when the chat already provides them clearly.
3. If JOB is missing/ambiguous, call job_list and ask only for the missing job choice.
4. If FOLDER is missing/ambiguous, ask only for the absolute local folder path.
5. Resolve any other required Job Pack bindings from the user's request.
6. Call job_select with confirmed=false.
7. Present a short preflight confirmation centered on JOB + FOLDER. Do not execute yet.
8. Only after explicit user confirmation, call job_select again with confirmed=true + confirmation_token.
9. Activation writes worker-state.json, switches the default cwd to the confirmed workspace, and makes it the anchor for filesystem/shell/git/project-context tools.
10. Execute, validate, then report. Use job_switch or job_stop when the user intentionally changes/stops work.

## Required confirmation style
JOB: <resolved job>
FOLDER: <resolved absolute local folder>

Xác nhận bắt đầu?

## Core tool workflow (after confirmation)
1. Call project_context() to load instructions from the confirmed active workspace when needed.
2. Explore with glob (file names), grep (content), then read_text_file.
3. Edit with apply_patch (preferred), multi_edit, edit_file, or write_file.
4. Run builds/tests with run_command for short work or start_process + process_output for long-running work.
5. Use git tools without path arguments to operate on the confirmed active workspace.
6. Undo tracked file edits with rewind when needed. Shell-created changes are not automatically checkpointed.

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
- job_list / job_select / job_status / job_switch / job_stop: controlled Job Runtime
- glob / grep / read_text_file: explore
- apply_patch / multi_edit / edit_file / write_file: edit
- create_directory / delete_directory / copy_file / move_file / delete_file: filesystem operations
- run_command / start_process / process_output / process_status / stop_process: execute
- shell_status / shell_reset: persistent shell state
- git_status / git_diff / git_add / git_commit / git_branch / git_restore / git_stash: git
- project_context / list_skills / load_skill / load_path_rules: active-workspace context
- rewind: checkpoint/undo
- enabled upstream MCP tools are exposed directly as <server>__<tool>; mcp_servers / mcp_tools / mcp_call remain diagnostics/fallback
- when a dedicated operation is unavailable, run_command is the general local fallback

## Paths
Full machine access is intentional. The confirmed FOLDER is the default working context, equivalent to Open Folder in an IDE. Absolute paths remain allowed when the task needs them.
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
    "The startup cwd is not project authority. JOB + absolute local FOLDER must be resolved and explicitly confirmed before job-specific execution.",
    "After confirmation, worker-state.json is the persistent source of current_job and active_workspace.",
  ].join("\n");

  const footer = [
    "## Quick pointers",
    `Startup root: ${workspaceRoot}`,
    `Startup roots: ${workspaceRoots.join("; ")}`,
    "job_status — session state + persistent worker-state.json",
    "job_list — list/suggest jobs when JOB is not already clear from chat",
    "project_context() — load instructions from the confirmed active workspace",
    "agent_status — optional diagnostics",
  ].join("\n");

  const body = contextBlock?.trim();
  if (!body) return `${header}\n\n${footer}`;
  return `${header}\n\n${body}\n\n${footer}`;
}

export const MCP_QUICKSTART = `
## Job-first workflow
1. Call job_status before starting job-specific work.
2. If idle, call job_list. Keywords only suggest a job; they never select one.
3. Select explicitly with job_select (or map /job <id> to job_select).
4. Resolve all required input/output bindings.
5. Present the returned confirmation_prompt to the user.
6. Only after explicit confirmation, call job_select again with confirmed=true + confirmation_token.
7. Execute with the existing core tools, then run the active Job Pack validators.
8. Use job_switch to change jobs (it clears old state) or job_stop to end/clear the job.

## Core tool workflow (after the job is active)
1. Project memory + git state are already in MCP instructions from WORKSPACE_PATH.
2. Call project_context(path) only for a different repo than WORKSPACE_PATH.
3. Explore with glob (file names) and grep (content), then read_text_file.
4. Edit with apply_patch (preferred), multi_edit, or write_file for new files.
5. Run builds/tests with run_command (short) or start_process + process_output (long).
6. Undo file edits with rewind (list → preview → restore). Shell/bash file changes are not tracked.

## Output format
All tools return JSON: { ok, tool, summary, data }

## Tool cheat sheet
- job_list / job_select / job_status / job_switch / job_stop: controlled Job Runtime
- glob / grep / read_text_file: explore (offset+limit for partial reads)
- apply_patch: single-file @@ hunks OR multi-file *** Begin Patch format
- create_directory / delete_directory / copy_file / move_file / delete_file
- run_command: persistent shell (cd persists); shell_status / shell_reset
- git_status / git_diff / git_add / git_commit / git_branch / git_restore / git_stash
- rewind: action=list|preview|restore|status — undo file edits via automatic checkpoints
- enabled upstream MCP tools are exposed directly as <server>__<tool> (for example chrome-devtools__list_pages, linear__get_user); prefer direct tools
- mcp_servers / mcp_tools / mcp_call — upstream diagnostics/fallback when a direct proxy is unavailable
- git_push / git_checkout / delete_directory: may be blocked by ChatGPT safety — use run_command fallback

## apply_patch — single file
@@
-old line
+new line
 context unchanged

## apply_patch — multi file
*** Begin Patch
*** Update File: src/foo.ts
@@
-old
+new
*** End Patch

## Paths
Full machine access — use ANY absolute path (C:\\, D:\\, etc.). Relative paths resolve from default cwd.
`.trim();

export function buildServerInstructions(
  workspaceRoot: string,
  workspaceRoots: string[],
  _fullDiskAccess: boolean,
  contextBlock?: string
): string {
  const header = [
    "# ChatGPT Local Worker MCP",
    `Default project: ${workspaceRoot}`,
    "Full machine access: ON. Tag this connector in ChatGPT before every task.",
    "Mandatory: choose/confirm a Job Pack before job-specific execution.",
  ].join("\n");

  const footer = [
    "## Quick pointers",
    `Workspace roots: ${workspaceRoots.join("; ")}`,
    "job_list — list/suggest jobs; never auto-select from keywords",
    "job_status — current per-session job state",
    "agent_status — full core-tool cheat sheet + apply_patch format",
    "project_context(path) — load project instructions from another repo",
  ].join("\n");

  const body = contextBlock?.trim();
  if (!body) return `${header}\n\n${footer}`;
  return `${header}\n\n${body}\n\n${footer}`;
}

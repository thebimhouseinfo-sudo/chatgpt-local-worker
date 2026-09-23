const CONTROL_TOOLS = new Set([
  "gptworker_control",
  "gptworker_admission",
  "job_list",
  "job_create",
  "job_update",
  "job_remove",
  "job_export",
  "job_import",
  "job_status",
  "job_select",
  "job_switch",
  "job_stop",
  "workspace_discover",
]);

const FILESYSTEM_TOOLS = new Set([
  "read_text_file", "write_file", "edit_file", "apply_patch",
  "list_directory", "glob", "grep", "delete_file",
  "create_directory", "delete_directory", "copy_file", "move_file",
]);

const BROWSER_TOOLS = new Set([
  "browser_open", "browser_snapshot", "browser_click", "browser_fill",
  "browser_press", "browser_wait", "browser_screenshot", "browser_get_url", "browser_close",
]);

const SHELL_TOOLS = new Set([
  "run_command", "start_process", "process_status", "process_output", "stop_process",
]);

export { CONTROL_TOOLS };

export function isControlTool(toolName: string): boolean {
  return CONTROL_TOOLS.has(toolName);
}

export function requiresWorkHandle(toolName: string): boolean {
  return !CONTROL_TOOLS.has(toolName);
}

export function toolFamily(toolName: string): string {
  if (FILESYSTEM_TOOLS.has(toolName)) return "filesystem";
  if (SHELL_TOOLS.has(toolName)) return "shell";
  if (BROWSER_TOOLS.has(toolName)) return "browser";
  if (["project_context", "agent_status"].includes(toolName)) {
    return "context";
  }
  return "core";
}

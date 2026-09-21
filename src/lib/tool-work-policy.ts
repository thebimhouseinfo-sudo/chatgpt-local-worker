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
  "agent_status",
]);

const FILESYSTEM_TOOLS = new Set([
  "read_text_file", "read_file_base64", "write_file", "write_file_base64",
  "edit_file", "multi_edit", "replace_regex", "apply_patch", "list_directory",
  "glob", "grep", "delete_file", "create_directory", "delete_directory",
  "copy_file", "move_file", "search_files", "directory_tree", "list_allowed_directories",
]);

const SHELL_TOOLS = new Set([
  "run_command", "shell_status", "shell_reset", "start_process",
  "process_status", "process_output", "stop_process", "clear_processes",
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
  if (toolName.startsWith("git_")) return "git";
  if (toolName.includes("repl")) return "repl";
  if (["project_context", "list_skills", "load_skill", "load_path_rules"].includes(toolName)) {
    return "context";
  }
  return "core";
}

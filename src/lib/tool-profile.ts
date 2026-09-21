import fs from "fs";
import path from "path";

export type ToolProfileName = "full" | "slim";

export const LOCAL_TOOL_CATALOG = [
  "gptworker_control", "gptworker_admission", "job_list", "job_create", "job_update", "job_remove", "job_export", "job_import", "job_select", "job_status", "job_stop", "job_switch", "workspace_discover", "work_tool",
  "read_text_file", "write_file", "edit_file", "multi_edit", "apply_patch", "glob", "grep", "list_directory", "move_file",
  "run_command", "shell_status", "shell_reset", "start_process", "process_output", "node_repl",
  "git_status", "git_diff", "git_add", "git_commit", "git_restore", "agent_status", "project_context",
  "remember", "load_path_rules", "list_skills", "load_skill",
];

interface LocalToolOverrides {
  enabled?: string[];
  disabled?: string[];
}

const overridesPath = () => path.resolve(process.cwd(), "profiles", "tool-overrides.json");
let cachedOverrides: LocalToolOverrides | null = null;

export function getLocalToolOverrides(): LocalToolOverrides {
  if (cachedOverrides) return cachedOverrides;
  try {
    cachedOverrides = JSON.parse(
      fs.readFileSync(overridesPath(), "utf-8")
    ) as LocalToolOverrides;
  } catch {
    cachedOverrides = {};
  }
  return cachedOverrides;
}

export function saveLocalToolOverrides(next: LocalToolOverrides): void {
  fs.mkdirSync(path.dirname(overridesPath()), { recursive: true });
  fs.writeFileSync(overridesPath(), JSON.stringify(next, null, 2));
  cachedOverrides = next;
}

/** Core tools for ChatGPT web — smaller tools/list payload, fewer discovery errors. */
export const SLIM_CHATGPT_TOOLS = new Set([
  "gptworker_control",
  "gptworker_admission",
  "job_list",
  "job_create",
  "job_update",
  "job_remove",
  "job_export",
  "job_import",
  "job_select",
  "job_status",
  "job_stop",
  "job_switch",
  "workspace_discover",
  "work_tool",
  "read_text_file",
  "write_file",
  "edit_file",
  "multi_edit",
  "apply_patch",
  "glob",
  "grep",
  "list_directory",
  "move_file",
  "run_command",
  "shell_status",
  "start_process",
  "process_output",
  "git_status",
  "git_diff",
  "git_add",
  "git_commit",
  "git_restore",
  "agent_status",
  "project_context",
  "remember",
  "load_path_rules",
  "list_skills",
  "load_skill",
  "node_repl",
]);

export function getChatGptToolProfile(): ToolProfileName {
  const raw = (process.env.CHATGPT_TOOL_PROFILE || "slim").trim().toLowerCase();
  return raw === "full" ? "full" : "slim";
}

export function shouldExposeTool(name: string, profile: ToolProfileName = getChatGptToolProfile()): boolean {
  const overrides = getLocalToolOverrides();
  if ((overrides.disabled ?? []).includes(name)) return false;
  if (profile === "full") return true;
  return SLIM_CHATGPT_TOOLS.has(name) || (overrides.enabled ?? []).includes(name);
}

import fs from "fs";
import path from "path";

export type ToolProfileName = "full" | "slim";

export const LOCAL_TOOL_CATALOG = [
  "gptworker_control", "gptworker_admission", "job_list", "job_create", "job_update", "job_remove", "job_export", "job_import", "job_select", "job_status", "job_stop", "job_switch", "workspace_discover", "work_tool",
  "read_text_file", "write_file", "edit_file", "apply_patch", "glob", "grep", "list_directory", "move_file",
  "run_command", "start_process", "process_status", "process_output", "stop_process",
  "agent_status", "project_context",
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

/**
 * work_tool is the slim top-level execution surface. Its inner local operations
 * are all available by default; only an explicit local disabled override may
 * remove one operation.
 */
export function shouldExposeWorkOperation(name: string): boolean {
  const overrides = getLocalToolOverrides();
  return !(overrides.disabled ?? []).includes(name);
}

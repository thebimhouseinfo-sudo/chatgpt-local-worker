import assert from "node:assert/strict";
import {
  LOCAL_TOOL_CATALOG,
  SLIM_CHATGPT_TOOLS,
  shouldExposeTool,
} from "../dist/lib/tool-profile.js";
import {
  isControlTool,
  requiresWorkHandle,
  toolFamily,
} from "../dist/lib/tool-work-policy.js";

for (const tool of [
  "apply_patch",
  "glob",
  "remember",
  "load_path_rules",
  "job_create",
  "job_update",
  "job_remove",
  "job_export",
  "job_import",
  "job_stop",
  "move_file",
  "gptworker_control",
  "gptworker_admission",
  "workspace_discover",
  "work_tool",
]) {
  assert.equal(shouldExposeTool(tool, "slim"), true, `${tool} missing from slim`);
}

for (const retired of [
  "mcp_servers",
  "mcp_tools",
  "mcp_call",
  "ponytail_turn",
  "rewind",
]) {
  assert.equal(LOCAL_TOOL_CATALOG.includes(retired), false, `${retired} remains in catalog`);
  assert.equal(SLIM_CHATGPT_TOOLS.has(retired), false, `${retired} remains in slim profile`);
}

assert.equal(shouldExposeTool("delete_directory", "slim"), false);
assert.equal(shouldExposeTool("delete_directory", "full"), true);
assert.equal(shouldExposeTool("help", "slim"), false);

for (const tool of LOCAL_TOOL_CATALOG) {
  const control = isControlTool(tool);
  const needsWork = requiresWorkHandle(tool);
  assert.notEqual(
    control,
    needsWork,
    `tool classification conflict for ${tool}: control=${control}, work=${needsWork}`
  );
}

assert.equal(toolFamily("read_text_file"), "filesystem");
assert.equal(toolFamily("run_command"), "shell");
assert.equal(toolFamily("git_status"), "git");
assert.equal(toolFamily("project_context"), "context");
assert.equal(toolFamily("node_repl"), "repl");

console.log("test-tool-profile: ok — local tool surface only");

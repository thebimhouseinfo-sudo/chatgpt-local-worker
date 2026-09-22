import assert from "node:assert/strict";
import {
  LOCAL_TOOL_CATALOG,
  SLIM_CHATGPT_TOOLS,
  shouldExposeTool,
  shouldExposeWorkOperation,
} from "../dist/lib/tool-profile.js";
import {
  isControlTool,
  requiresWorkHandle,
  toolFamily,
} from "../dist/lib/tool-work-policy.js";

for (const tool of [
  "job_create",
  "job_update",
  "job_remove",
  "job_export",
  "job_import",
  "job_stop",
  "gptworker_control",
  "gptworker_admission",
  "workspace_discover",
  "work_tool",
]) {
  assert.equal(shouldExposeTool(tool, "slim"), true, `${tool} missing from slim top-level surface`);
}

for (const operation of [
  "apply_patch",
  "delete_file",
  "create_directory",
  "copy_file",
  "process_status",
  "stop_process",
  "project_context",
  "agent_status",
  "node_repl",
]) {
  assert.equal(
    shouldExposeWorkOperation(operation),
    true,
    `${operation} must be available inside work_tool by default`
  );
}

for (const retired of [
  "mcp_servers",
  "mcp_tools",
  "mcp_call",
  "ponytail_turn",
  "rewind",
  "remember",
]) {
  assert.equal(LOCAL_TOOL_CATALOG.includes(retired), false, `${retired} remains in catalog`);
  assert.equal(SLIM_CHATGPT_TOOLS.has(retired), false, `${retired} remains in slim profile`);
}

assert.equal(shouldExposeTool("delete_directory", "slim"), false);
assert.equal(shouldExposeWorkOperation("delete_directory"), true);
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
assert.equal(toolFamily("project_context"), "context");
assert.equal(toolFamily("agent_status"), "context");
assert.equal(requiresWorkHandle("agent_status"), true);
assert.equal(toolFamily("node_repl"), "repl");

console.log("test-tool-profile: ok — local tool surface only");

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { registerWorkspaceDiscoveryTool } from "../dist/tools/workspace-discovery.js";

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-discovery-"));
const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-outside-"));

try {
  const file = path.join(tmpDir, "README.md");
  await fs.writeFile(file, "# Sample\nhello discovery\n", "utf8");
  await fs.writeFile(path.join(outsideDir, "secret.txt"), "outside\n", "utf8");

  const registered = new Map();
  const fakeServer = {
    registerTool(name, config, callback) {
      registered.set(name, { config, callback });
      return {
        remove() {},
        update() {},
        enable() {},
        disable() {},
        enabled: true,
      };
    },
  };

  registerWorkspaceDiscoveryTool(fakeServer);
  const discovery = registered.get("workspace_discover");
  if (!discovery) throw new Error("workspace_discover was not registered");

  const activationRequest = `Inspect files in ${tmpDir} and choose the right Job.`;

  const listResult = await discovery.callback({
    workspace: tmpDir,
    task: "inspect project",
    operation: "list_directory",
    arguments: {},
    activation_trigger: "task_with_workspace",
    activation_request: activationRequest,
  });
  if (!JSON.stringify(listResult).includes("README.md")) {
    throw new Error("discovery list did not return workspace file");
  }

  const readResult = await discovery.callback({
    workspace: tmpDir,
    task: "inspect project",
    operation: "read_text_file",
    arguments: { path: file },
    activation_trigger: "task_with_workspace",
    activation_request: activationRequest,
  });
  if (!JSON.stringify(readResult).includes("hello discovery")) {
    throw new Error("discovery read did not return file content");
  }

  let blocked = false;
  try {
    await discovery.callback({
      workspace: tmpDir,
      task: "inspect project",
      operation: "read_text_file",
      arguments: { path: path.join(outsideDir, "secret.txt") },
      activation_trigger: "task_with_workspace",
      activation_request: activationRequest,
    });
  } catch (error) {
    blocked = /restricted to the supplied Workspace/i.test(String(error?.message || error));
  }
  if (!blocked) {
    throw new Error("workspace_discover must reject paths outside supplied Workspace");
  }

  console.log("test-workspace-discovery: ok");
} finally {
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.rm(outsideDir, { recursive: true, force: true });
}

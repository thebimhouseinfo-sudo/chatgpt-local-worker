import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { registerWorkspaceDiscoveryTool } from "../dist/tools/workspace-discovery.js";
import { AdmissionRuntime } from "../dist/lib/activation-policy.js";

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

  const admissionRuntime = new AdmissionRuntime();
  registerWorkspaceDiscoveryTool(fakeServer, admissionRuntime);
  const discovery = registered.get("workspace_discover");
  if (!discovery) throw new Error("workspace_discover was not registered");

  const activationRequest = `Inspect files in ${tmpDir} and choose the right Job.`;
  const admission = admissionRuntime.check({
    userTurn: activationRequest,
    hasConcreteTask: true,
    workspace: tmpDir,
  });
  if (admission.mode !== "ACTIVE" || !admission.admission_token) {
    throw new Error("test admission did not become ACTIVE");
  }

  const listResult = await discovery.callback({
    workspace: tmpDir,
    task: "inspect project",
    operation: "list_directory",
    arguments: {},
    admission_token: admission.admission_token,
  });
  if (!JSON.stringify(listResult).includes("README.md")) {
    throw new Error("discovery list did not return workspace file");
  }

  const readResult = await discovery.callback({
    workspace: tmpDir,
    task: "inspect project",
    operation: "read_text_file",
    arguments: { path: file },
    admission_token: admission.admission_token,
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
      admission_token: admission.admission_token,
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

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createWorkToolResolver,
  registerWorkGateway,
} from "../dist/tools/work-gateway.js";
import { setDefaultCwd } from "../dist/lib/path-security.js";

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-work-gateway-"));
try {
  setDefaultCwd(tmpDir);
  const file = path.join(tmpDir, "sample.txt");
  await fs.writeFile(file, "hello gateway\n", "utf8");

  const resolver = createWorkToolResolver(tmpDir, 30);
  let status = resolver.status();
  if (status.loaded_families.length !== 0 || status.loaded_tool_count !== 0) {
    throw new Error("resolver must start with zero execution families loaded");
  }

  const readTool = await resolver.resolve("read_text_file");
  status = resolver.status();
  if (status.loaded_families.join(",") !== "filesystem") {
    throw new Error(`expected only filesystem family, got ${status.loaded_families}`);
  }

  const readResult = await readTool.callback({ path: file });
  if (!JSON.stringify(readResult).includes("hello gateway")) {
    throw new Error("deferred read_text_file callback did not execute");
  }

  await resolver.resolve("glob");
  status = resolver.status();
  if (status.loaded_families.length !== 1) {
    throw new Error("same-family operation must reuse the loaded filesystem family");
  }

  await resolver.resolve("git_status");
  status = resolver.status();
  if (!status.loaded_families.includes("git") || status.loaded_families.length !== 2) {
    throw new Error(`git must load independently on first use: ${status.loaded_families}`);
  }

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

  const gatewayResolver = registerWorkGateway(fakeServer, tmpDir, 30);
  if (gatewayResolver.status().loaded_families.length !== 0) {
    throw new Error("registering work_tool must not preload an execution family");
  }
  const gateway = registered.get("work_tool");
  if (!gateway) throw new Error("work_tool was not registered");

  const result = await gateway.callback({
    tool: "read_text_file",
    arguments: { path: file },
  });
  if (!JSON.stringify(result).includes("hello gateway")) {
    throw new Error("work_tool did not dispatch the deferred operation");
  }
  if (gatewayResolver.status().loaded_families.join(",") !== "filesystem") {
    throw new Error("work_tool must load only the requested family");
  }

  console.log("test-work-gateway: ok");
} finally {
  await fs.rm(tmpDir, { recursive: true, force: true });
}

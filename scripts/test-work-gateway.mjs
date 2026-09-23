import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createWorkToolResolver,
  registerWorkGateway,
  WORK_TOOL_OPERATIONS,
  FAMILY_TOOLS,
} from "../dist/tools/work-gateway.js";
import { setDefaultCwd } from "../dist/lib/path-security.js";

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-work-gateway-"));
try {
  setDefaultCwd(tmpDir);
  const file = path.join(tmpDir, "sample.txt");
  await fs.writeFile(file, "hello gateway\n", "utf8");

  const resolver = createWorkToolResolver(30);
  let status = resolver.status();
  if (status.loaded_families.length !== 0 || status.loaded_tool_count !== 0) {
    throw new Error("resolver must start with zero execution families loaded");
  }

  const preparedA = await resolver.prepareJob("job-a", ["filesystem"]);
  status = resolver.status();
  if (
    preparedA.stale ||
    status.prepared_job !== "job-a" ||
    !status.prepared_families.includes("filesystem")
  ) {
    throw new Error("nominated Job filesystem profile was not prepared");
  }

  const preparedB = await resolver.prepareJob("job-b", ["context"]);
  status = resolver.status();
  if (
    preparedB.stale ||
    status.prepared_job !== "job-b" ||
    status.prepared_families.includes("filesystem") ||
    !status.prepared_families.includes("context")
  ) {
    throw new Error("replacement nomination did not reset/reload prepared profile");
  }

  // Even a direct Custom Job preload request cannot eagerly load browser.
  const deniedBrowserPreload = await resolver.prepareJob("custom-job", ["browser"]);
  if (deniedBrowserPreload.requested_families.includes("browser") ||
      resolver.status().loaded_families.includes("browser")) {
    throw new Error("browser must never be a preloadable runtime family");
  }

  resolver.clearPreparedJob();
  status = resolver.status();
  if (status.prepared_job !== null || status.prepared_families.length !== 0) {
    throw new Error("prepared Job profile was not cleared");
  }

  const readTool = await resolver.resolve("read_text_file");
  status = resolver.status();
  if (!status.loaded_families.includes("filesystem")) {
    throw new Error(`expected filesystem family to be loaded, got ${status.loaded_families}`);
  }

  const readResult = await readTool.callback({ path: file });
  if (!JSON.stringify(readResult).includes("hello gateway")) {
    throw new Error("deferred read_text_file callback did not execute");
  }

  await resolver.resolve("glob");
  status = resolver.status();
  if (!status.loaded_families.includes("filesystem")) {
    throw new Error("same-family operation must reuse the loaded filesystem family");
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

  const gatewayResolver = registerWorkGateway(fakeServer, 30);
  if (gatewayResolver.status().loaded_families.length !== 0) {
    throw new Error("registering work_tool must not preload an execution family");
  }
  const gateway = registered.get("work_tool");
  if (!gateway) throw new Error("work_tool was not registered");

  const exposedOperations = gateway.config.inputSchema.tool.options;
  const expected = WORK_TOOL_OPERATIONS.filter(name => !FAMILY_TOOLS.browser.includes(name));
  if (exposedOperations.length !== expected.length) {
    throw new Error(
      `work_tool schema lost operations: expected ${expected.length}, got ${exposedOperations.length}`
    );
  }
  for (const operation of expected) {
    if (!exposedOperations.includes(operation)) {
      throw new Error(`work_tool schema is missing operation: ${operation}`);
    }
  }

  for (const operation of FAMILY_TOOLS.browser) {
    if (exposedOperations.includes(operation)) throw new Error("disabled browser tool visible in MCP schema: " + operation);
  }
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

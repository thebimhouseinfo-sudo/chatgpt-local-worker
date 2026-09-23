import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runNode(args, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== RUN ${label} ===`);
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: process.env,
      stdio: "inherit",
      shell: false,
    });

    child.on("error", (error) => {
      reject(new Error(`${label} spawn failed: ${error.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`=== PASS ${label} ===`);
        resolve();
        return;
      }
      reject(new Error(`${label} FAILED (exit ${code})`));
    });
  });
}

const tsc = path.join(root, "node_modules", "typescript", "bin", "tsc");
if (!fs.existsSync(tsc)) {
  throw new Error(
    "TypeScript compiler not found at node_modules/typescript/bin/tsc. Run npm install first."
  );
}

await runNode([tsc], "typescript");

const tests = [
  "scripts/test-group-a-retired.mjs",
  "scripts/test-group-b-retired.mjs",
  "scripts/test-group-c1-work-gateway.mjs",
  "scripts/test-group-c2-repl-retired.mjs",
  "scripts/test-group-c3-context.mjs",
  "scripts/test-group-c4-instruction-context.mjs",
  "scripts/test-post-review-round2-mapping.mjs",
  "scripts/test-workspace-boundary.mjs",
  "scripts/test-idle-runtime.mjs",
  "scripts/test-job-runtime.mjs",
  "scripts/test-activation-policy.mjs",
  "scripts/test-admission-tool.mjs",
  "scripts/test-job-list-arming.mjs",
  "scripts/test-job-confirmation-isolation.mjs",
  "scripts/test-job-confirmation-retry-after-busy.mjs",
  "scripts/test-job-admission-lifecycle.mjs",
  "scripts/test-job-admission-workspace-retry.mjs",
  "scripts/test-job-switch-lifecycle.mjs",
  "scripts/test-job-stop-pending.mjs",
  "scripts/test-job-authoring.mjs",
  "scripts/test-worker-state.mjs",
  "scripts/test-mcp-discover-compat.mjs",
  "scripts/test-dev-coding-harness.mjs",
  "scripts/test-setup-agent-browser.mjs",
  "scripts/test-dev-coding-checkpoint.mjs",
  "scripts/test-browser-capability.mjs",
  "scripts/test-dev-planing-harness.mjs",
  "scripts/test-layla-harness.mjs",
  "scripts/test-mto-harness.mjs",
  "scripts/test-patch.mjs",
  "scripts/test-tools.mjs",
  "scripts/test-filesystem-core.mjs",
  "scripts/test-activity-log.mjs",
  "scripts/test-runtime-log.mjs",
  "scripts/test-work-registration.mjs",
  "scripts/test-work-gateway.mjs",
  "scripts/test-workspace-discovery.mjs",
  "scripts/test-quickstart.mjs",
  "scripts/test-control-surface.mjs",
  "scripts/test-shell-persist.mjs"
];

let passed = 0;
for (const test of tests) {
  const label = path.basename(test);
  try {
    await runNode([path.join(root, test)], label);
    passed += 1;
  } catch (error) {
    console.error(`\n=== FAIL ${label} ===`);
    console.error(error instanceof Error ? error.message : String(error));
    console.error(`Passed before failure: ${passed}/${tests.length}`);
    process.exitCode = 1;
    break;
  }
}

if (!process.exitCode) {
  console.log(`\n=== DEFAULT TEST SUITE PASSED: ${passed}/${tests.length} ===`);
}

/**
 * Persistent shell state is isolated by concrete workspace.
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  bootstrapShellSession,
  execInShellSession,
  getShellStatus,
  resetAllShellSessionsForTests,
} from "../dist/lib/persistent-shell.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const stateDir = path.join(root, ".tool-test-tmp", "shell-persist");
const workspaceA = path.join(stateDir, "workspace-a");
const workspaceB = path.join(stateDir, "workspace-b");
const subA = path.join(workspaceA, "sub");
const subB = path.join(workspaceB, "sub");

process.env.MCP_SHELL_STATE_DIR = path.join(stateDir, "state");

let passed = 0;
let failed = 0;
function ok(m) { console.log(`OK  ${m}`); passed++; }
function fail(m, e) { console.error(`FAIL ${m}: ${e && e.stack || e}`); failed++; }

try {
  await fs.rm(stateDir, { recursive: true, force: true });
  await fs.mkdir(subA, { recursive: true });
  await fs.mkdir(subB, { recursive: true });
  resetAllShellSessionsForTests();

  await bootstrapShellSession(workspaceA);
  await bootstrapShellSession(workspaceB);

  await execInShellSession(`cd "${subA}"`, workspaceA, 5000);
  await execInShellSession(`cd "${subB}"`, workspaceB, 5000);

  const statusA = getShellStatus(workspaceA);
  const statusB = getShellStatus(workspaceB);
  if (path.resolve(statusA.cwd) !== path.resolve(subA)) {
    throw new Error(`workspace A cwd mismatch: ${statusA.cwd}`);
  }
  if (path.resolve(statusB.cwd) !== path.resolve(subB)) {
    throw new Error(`workspace B cwd mismatch: ${statusB.cwd}`);
  }
  ok("two workspaces keep independent shell cwd");

  let relativeCdBlocked = false;
  try {
    await execInShellSession("cd sub", workspaceA, 5000);
  } catch (error) {
    relativeCdBlocked = /absolute path/i.test(String(error?.message || error));
  }
  if (!relativeCdBlocked) throw new Error("relative cd target should be rejected");
  ok("relative shell directory changes are rejected");

  resetAllShellSessionsForTests();
  await bootstrapShellSession(workspaceA);
  const restoredA = getShellStatus(workspaceA).cwd;
  if (path.resolve(restoredA) !== path.resolve(subA)) {
    throw new Error(`persist failed for workspace A: ${restoredA}`);
  }
  ok("workspace shell cwd restores from its own persisted state");

  await bootstrapShellSession(workspaceB);
  const restoredB = getShellStatus(workspaceB).cwd;
  if (path.resolve(restoredB) !== path.resolve(subB)) {
    throw new Error(`persist failed for workspace B: ${restoredB}`);
  }
  ok("workspace B restore does not reuse workspace A state");
} catch (e) {
  fail("shell workspace isolation", e.message || e);
}

await fs.rm(stateDir, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-boundary-"));
const workspace = path.join(root, "workspace");
const outside = path.join(root, "outside");
const supportRoot = path.join(root, "job-support");
const stateDir = path.join(root, "shell-state");

await fs.mkdir(workspace, { recursive: true });
await fs.mkdir(outside, { recursive: true });
await fs.mkdir(path.join(supportRoot, "harness"), { recursive: true });
process.env.MCP_SHELL_STATE_DIR = stateDir;

const pathSecurity = await import("../dist/lib/path-security.js");
const {
  assertShellCommandWorkspaceBound,
} = await import("../dist/lib/shell-workspace-guard.js");
const {
  applyMultiFilePatch,
} = await import("../dist/lib/patch.js");
const {
  bootstrapShellSession,
  getShellStatus,
  resetAllShellSessionsForTests,
} = await import("../dist/lib/persistent-shell.js");
const {
  saveGlobalShellState,
} = await import("../dist/lib/global-shell-state.js");

const insideFile = path.join(workspace, "inside.txt");
const outsideFile = path.join(outside, "outside.txt");
const supportSkill = path.join(supportRoot, "skill.md");
const supportHarness = path.join(supportRoot, "harness", "validate.mjs");

await fs.writeFile(insideFile, "inside\n", "utf8");
await fs.writeFile(outsideFile, "outside\n", "utf8");
await fs.writeFile(supportSkill, "# support skill\n", "utf8");
await fs.writeFile(supportHarness, "console.log('support harness');\n", "utf8");

// Pre-confirm/control-plane absolute path validation remains possible without
// granting active Job authority.
assert.equal(
  await pathSecurity.validatePath(outsideFile),
  path.resolve(outsideFile)
);

await pathSecurity.runWithWorkspaceCwd(workspace, async () => {
  assert.equal(
    await pathSecurity.validatePath(insideFile),
    path.resolve(insideFile)
  );

  await assert.rejects(
    () => pathSecurity.validatePath(outsideFile),
    /WORKSPACE_BOUNDARY/
  );

  await assert.rejects(
    () => pathSecurity.validatePath("relative/file.txt"),
    /Absolute path required/
  );

  assert.deepEqual(pathSecurity.getAllowedRoots(), [path.resolve(workspace)]);

  // Multi-file patches must validate every resolved target, including an
  // absolute path embedded in patch text.
  const outsidePatch = [
    "*** Begin Patch",
    `*** Add File: ${outsideFile}`,
    "+should-not-write",
    "*** End Patch",
  ].join("\n");

  await assert.rejects(
    () =>
      applyMultiFilePatch(outsidePatch, {
        base_dir: workspace,
      }),
    /WORKSPACE_BOUNDARY/
  );
});


await pathSecurity.runWithWorkspaceScope(
  workspace,
  [supportRoot],
  async () => {
    assert.equal(
      await pathSecurity.validateReadPath(supportSkill),
      path.resolve(supportSkill)
    );
    assert.equal(
      await pathSecurity.validateReadPath(supportHarness),
      path.resolve(supportHarness)
    );

    await assert.rejects(
      () => pathSecurity.validatePath(supportSkill),
      /WORKSPACE_BOUNDARY/
    );

    await assert.rejects(
      () => pathSecurity.validateReadPath(outsideFile),
      /WORKSPACE_BOUNDARY/
    );

    assert.doesNotThrow(() =>
      assertShellCommandWorkspaceBound(
        `node "${supportHarness}" --cwd "${workspace}"`,
        workspace
      )
    );

    assert.throws(
      () =>
        assertShellCommandWorkspaceBound(
          `echo bad > "${supportHarness}"`,
          workspace
        ),
      /WORKSPACE_BOUNDARY/
    );
  }
);

// A symlink/junction inside the Workspace must not create an escape route.
const linkPath = path.join(workspace, "outside-link");
try {
  await fs.symlink(
    outside,
    linkPath,
    process.platform === "win32" ? "junction" : "dir"
  );
  await pathSecurity.runWithWorkspaceCwd(workspace, async () => {
    await assert.rejects(
      () => pathSecurity.validatePath(path.join(linkPath, "escaped.txt")),
      /WORKSPACE_BOUNDARY/
    );
  });
} catch (error) {
  if (!["EPERM", "EACCES", "ENOSYS"].includes(error?.code)) throw error;
  console.log("workspace boundary symlink test skipped: symlink unavailable");
}

// Shell guard allows Workspace paths and blocks outside paths / parent traversal.
assert.doesNotThrow(() =>
  assertShellCommandWorkspaceBound(
    `echo ok > "${insideFile}"`,
    workspace
  )
);


// Quoted Windows-style/space-containing Workspace paths must be treated as
// one literal, not re-split into a fake drive-level path such as "D:\\00".
const spacedWorkspace = path.join(root, "workspace with spaces");
await fs.mkdir(spacedWorkspace, { recursive: true });
const spacedFile = path.join(spacedWorkspace, "inside file.txt");
assert.doesNotThrow(() =>
  assertShellCommandWorkspaceBound(
    `echo ok > "${spacedFile}"`,
    spacedWorkspace
  )
);

assert.throws(
  () =>
    assertShellCommandWorkspaceBound(
      `echo bad > "${outsideFile}"`,
      workspace
    ),
  /WORKSPACE_BOUNDARY/
);

const traversalCommand =
  process.platform === "win32"
    ? "type ..\\outside\\outside.txt"
    : "cat ../outside/outside.txt";
assert.throws(
  () => assertShellCommandWorkspaceBound(traversalCommand, workspace),
  /WORKSPACE_BOUNDARY/
);

// Persisted shell cwd from an old/broken runtime must be clamped back into
// its owning Workspace instead of being trusted.
await saveGlobalShellState(workspace, outside, "legacy-bad-cwd", null);
resetAllShellSessionsForTests();
await bootstrapShellSession(workspace);
assert.equal(
  path.resolve(getShellStatus(workspace).cwd),
  path.resolve(workspace)
);


await fs.rm(root, {
  recursive: true,
  force: true,
  maxRetries: 8,
  retryDelay: 75,
});

console.log(
  "test-workspace-boundary: ok — active Job paths stay inside confirmed Workspace"
);

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-boundary-"));
const workspace = path.join(root, "workspace");
const outside = path.join(root, "outside");
const supportRoot = path.join(root, "job-support");

await fs.mkdir(workspace, { recursive: true });
await fs.mkdir(outside, { recursive: true });
await fs.mkdir(path.join(supportRoot, "harness"), { recursive: true });

const pathSecurity = await import("../dist/lib/path-security.js");
const {
  assertShellCommandWorkspaceBound,
} = await import("../dist/lib/shell-workspace-guard.js");
const {
  applyMultiFilePatch,
} = await import("../dist/lib/patch.js");
const {
  runShellCommand,
} = await import("../dist/tools/shell.js");

const insideFile = path.join(workspace, "inside.txt");
const outsideFile = path.join(outside, "outside.txt");
const supportSkill = path.join(supportRoot, "skill.md");
const supportHarness = path.join(supportRoot, "harness", "validate.mjs");

await fs.writeFile(insideFile, "inside\n", "utf8");
await fs.writeFile(outsideFile, "outside\n", "utf8");
await fs.writeFile(supportSkill, "# support skill\n", "utf8");
await fs.writeFile(supportHarness, "console.log('support harness');\n", "utf8");

// A scoped Job must never silently accept a relative or malformed root.
assert.throws(
  () => pathSecurity.runWithWorkspaceScope("relative-workspace", [], () => {}),
  /Absolute path required/
);
assert.throws(
  () => pathSecurity.runWithWorkspaceScope(workspace, ["relative-support"], () => {}),
  /Absolute path required/
);

// Pre-confirm/control-plane absolute path validation remains possible without
// granting active Job authority.
assert.equal(
  await pathSecurity.validatePath(outsideFile),
  path.resolve(outsideFile)
);

await pathSecurity.runWithWorkspaceScope(workspace, [], async () => {
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

  assert.equal(pathSecurity.getDefaultCwd(), path.resolve(workspace));

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
  await pathSecurity.runWithWorkspaceScope(workspace, [], async () => {
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

// Git repository-context switches are shell escape vectors even when the
// process cwd itself remains inside the Workspace.
for (const command of [
  `git -C "${outside}" status`,
  `git --git-dir "${path.join(outside, ".git")}" status`,
  `git --git-dir="${path.join(outside, ".git")}" status`,
  `git --work-tree "${outside}" status`,
  `git --work-tree="${outside}" status`,
  `GIT_DIR="${path.join(outside, ".git")}" git status`,
  `GIT_WORK_TREE="${outside}" git status`,
]) {
  assert.throws(
    () => assertShellCommandWorkspaceBound(command, workspace),
    /WORKSPACE_BOUNDARY/,
    `Git context escape must be rejected before execution: ${command}`
  );
}

// Lowercase git -c is configuration, not a repository path option.
assert.doesNotThrow(() =>
  assertShellCommandWorkspaceBound(
    'git -c core.quotepath=false status',
    workspace
  )
);

// On non-Windows runners, a Windows absolute path must still be recognized as
// an absolute escape rather than treated as a harmless relative token.
if (process.platform !== "win32") {
  assert.throws(
    () =>
      assertShellCommandWorkspaceBound(
        "git -C D:\\GPTWorker-Acceptance-Outside status",
        workspace
      ),
    /WORKSPACE_BOUNDARY/
  );
}

// Execution API must reject before Git can run and produce its own error.
await assert.rejects(
  () => runShellCommand(`git -C "${outside}" status`, workspace, 5000),
  /WORKSPACE_BOUNDARY/
);

// Exact acceptance regression: a nested cmd.exe payload must not hide an
// absolute redirection target from the Workspace guard.
const nestedCmdTarget = path.join(outside, "shell-should-not-exist.txt");
const nestedCmdEscape =
  `cmd /d /s /c "echo boundary-test>${nestedCmdTarget}"`;
assert.throws(
  () => assertShellCommandWorkspaceBound(nestedCmdEscape, workspace),
  /WORKSPACE_BOUNDARY/,
  "nested cmd redirection outside Workspace must be rejected"
);
await assert.rejects(
  () => runShellCommand(nestedCmdEscape, workspace, 5000),
  /WORKSPACE_BOUNDARY/
);
await assert.rejects(
  () => fs.access(nestedCmdTarget),
  /ENOENT/,
  "outside redirection target must not be created because rejection happens before spawn"
);

// Direct and nested PowerShell redirections must be subject to the same rule.
for (const command of [
  `echo bad > "${outsideFile}"`,
  `powershell -NoProfile -Command "echo bad > ${outsideFile}"`,
]) {
  assert.throws(
    () => assertShellCommandWorkspaceBound(command, workspace),
    /WORKSPACE_BOUNDARY/
  );
}

const traversalCommand =
  process.platform === "win32"
    ? "type ..\\outside\\outside.txt"
    : "cat ../outside/outside.txt";
assert.throws(
  () => assertShellCommandWorkspaceBound(traversalCommand, workspace),
  /WORKSPACE_BOUNDARY/
);

// Shell execution is stateless and starts from the confirmed Workspace unless
// an explicit absolute working_directory inside that Workspace is supplied.
const shellResult = await runShellCommand(
  'node -e "process.stdout.write(process.cwd())"',
  workspace,
  5000
);
assert.equal(
  pathSecurity.isPathInsideWorkspaceSync(shellResult.cwd, workspace),
  true
);
await assert.rejects(
  () =>
    runShellCommand(
      'node -e "process.stdout.write(process.cwd())"',
      workspace,
      5000,
      outside
    ),
  /WORKSPACE_BOUNDARY/
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

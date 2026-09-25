import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { registerFilesystemTools } from "../dist/tools/filesystem.js";
import {
  runWithWorkspaceScope,
  setDefaultCwd,
} from "../dist/lib/path-security.js";

process.env.ACTIVITY_LOG_DISABLED = "true";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-filesystem-core-"));
setDefaultCwd(root);

const registered = new Map();
const server = {
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

registerFilesystemTools(server);

const expected = [
  "read_text_file",
  "write_file",
  "edit_file",
  "apply_patch",
  "list_directory",
  "glob",
  "grep",
  "delete_file",
  "recycle_file",
  "hard_delete_file",
  "create_directory",
  "delete_directory",
  "copy_file",
  "move_file",
];
assert.deepEqual([...registered.keys()], expected);

assert.match(
  registered.get("delete_file").config.description,
  /Recycle Bin/,
  "normal delete must advertise Recycle Bin semantics"
);
assert.match(
  registered.get("hard_delete_file").config.description,
  /Permanently delete/,
  "hard delete must be explicitly irreversible"
);

for (const retired of [
  "read_file_base64",
  "write_file_base64",
  "multi_edit",
  "replace_regex",
  "search_files",
  "directory_tree",
  "list_allowed_directories",
]) {
  assert.equal(registered.has(retired), false, `${retired} must be retired`);
}

await runWithWorkspaceScope(root, [], async () => {
  const call = (name, args) => registered.get(name).callback(args);

  const file = path.join(root, "sample.txt");
  const copy = path.join(root, "copy.txt");
  const moved = path.join(root, "nested", "moved.txt");
  const dir = path.join(root, "temp-dir");

  let result = await call("write_file", {
    path: file,
    content: "alpha\nbeta\n",
  });
  assert.equal(result.structuredContent.ok, true);

  result = await call("read_text_file", { path: file });
  assert.match(result.structuredContent.data.content, /alpha/);

  result = await call("edit_file", {
    path: file,
    old_text: "alpha",
    new_text: "gamma",
  });
  assert.equal(result.structuredContent.data.replacements, 1);

  result = await call("apply_patch", {
    path: file,
    patch: "@@\n-gamma\n+delta\n beta\n",
  });
  assert.equal(result.structuredContent.ok, true);

  // Multi-file preflight must prevent any earlier successful mutation if a
  // later operation is invalid; dry-run must also leave files untouched.
  const groupedNew = path.join(root, "grouped-new.txt");
  const groupedPatch = [
    "*** Begin Patch",
    "*** Add File: grouped-new.txt",
    "+created",
    "*** Update File: sample.txt",
    "@@",
    "-wrong-old-line",
    "+should-not-apply",
    "*** End Patch",
  ].join("\n");
  result = await call("apply_patch", {
    path: root,
    patch: groupedPatch,
  });
  assert.equal(result.structuredContent.ok, false);
  await assert.rejects(() => fs.stat(groupedNew), { code: "ENOENT" });
  assert.match(await fs.readFile(file, "utf-8"), /delta/);

  const createPatch = [
    "*** Begin Patch",
    "*** Add File: grouped-new.txt",
    "+created",
    "*** End Patch",
  ].join("\n");
  result = await call("apply_patch", {
    path: root,
    patch: createPatch,
    dry_run: true,
  });
  assert.equal(result.structuredContent.ok, true);
  await assert.rejects(() => fs.stat(groupedNew), { code: "ENOENT" });

  result = await call("apply_patch", { path: root, patch: createPatch });
  assert.equal(result.structuredContent.ok, true);
  assert.equal(await fs.readFile(groupedNew, "utf-8"), "created");
  result = await call("apply_patch", { path: root, patch: createPatch });
  assert.equal(result.structuredContent.ok, false);
  assert.equal(await fs.readFile(groupedNew, "utf-8"), "created");

  const duplicatePatch = [
    "*** Begin Patch",
    "*** Update File: grouped-new.txt",
    "@@",
    "-created",
    "+first",
    "*** Delete File: grouped-new.txt",
    "*** End Patch",
  ].join("\n");
  result = await call("apply_patch", { path: root, patch: duplicatePatch });
  assert.equal(result.structuredContent.ok, false);
  assert.equal(await fs.readFile(groupedNew, "utf-8"), "created");

  const outside = path.join(root, "..", "gptworker-outside-do-not-create.txt");
  await assert.rejects(
    () => call("write_file", { path: outside, content: "escape" }),
    /WORKSPACE_BOUNDARY/
  );

  result = await call("copy_file", {
    source: file,
    destination: copy,
  });
  assert.equal(result.structuredContent.ok, true);

  result = await call("move_file", {
    source: copy,
    destination: moved,
  });
  assert.equal(result.structuredContent.ok, true);

  result = await call("create_directory", { path: dir });
  assert.equal(result.structuredContent.ok, true);

  result = await call("list_directory", { path: root });
  assert.equal(result.structuredContent.data.count >= 3, true);

  result = await call("glob", {
    path: root,
    pattern: "*.txt",
    max_results: 50,
  });
  assert.equal(result.structuredContent.data.count >= 2, true);

  result = await call("grep", {
    path: root,
    pattern: "delta",
    glob: "*.txt",
    output_mode: "content",
    head_limit: 20,
  });
  assert.match(result.structuredContent.data.output, /delta/);

  await assert.rejects(
    () => call("delete_directory", { path: root }),
    /Workspace root/
  );

  if (process.platform === "win32") {
    result = await call("delete_file", { path: moved });
    assert.equal(result.structuredContent.ok, true);
    assert.equal(result.structuredContent.data.recoverable, true);
    assert.equal(result.structuredContent.data.deletion_mode, "recycle_bin");
  } else {
    result = await call("hard_delete_file", { path: moved });
    assert.equal(result.structuredContent.ok, true);
    assert.equal(result.structuredContent.data.recoverable, false);
    assert.equal(result.structuredContent.data.deletion_mode, "permanent");
  }

  result = await call("delete_directory", { path: dir });
  assert.equal(result.structuredContent.ok, true);
});

await fs.rm(root, { recursive: true, force: true });
console.log("test-filesystem-core: ok");

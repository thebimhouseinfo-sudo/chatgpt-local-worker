import fs from "node:fs/promises";

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

const failures = [];

for (const filePath of [
  "src/lib/post-edit-hooks.ts",
  "src/lib/edit-enrichment.ts",
  "profiles/post-edit-hooks.json",
]) {
  if (await exists(filePath)) {
    failures.push(`post-edit hook compatibility path is active again: ${filePath}`);
  }
}

for (const filePath of [
  "legacy/quarantine/post-edit-hooks/post-edit-hooks.ts",
  "legacy/quarantine/post-edit-hooks/edit-enrichment.ts",
  "legacy/quarantine/post-edit-hooks/post-edit-hooks.json",
]) {
  if (!(await exists(filePath))) {
    failures.push(`post-edit hook quarantine copy is missing: ${filePath}`);
  }
}

const filesystem = await fs.readFile("src/tools/filesystem.ts", "utf8");
for (const token of [
  "edit-enrichment",
  "enrichAfterEdit",
  "post-edit-hooks",
  "post_edit_hooks",
]) {
  if (filesystem.includes(token)) {
    failures.push(`filesystem still references retired post-edit hook surface: ${token}`);
  }
}

const envExample = await fs.readFile(".env.example", "utf8");
if (envExample.includes("POST_EDIT_HOOKS")) {
  failures.push(".env.example still advertises POST_EDIT_HOOKS_CONFIG");
}

if (failures.length) {
  console.error("Post-edit hook quarantine FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "test-post-edit-hooks-quarantine: ok — post-edit hook compatibility chain is quarantined"
);

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

const activePaths = [
  "src/lib/skills-loader.ts",
  "src/lib/path-rules.ts",
];

const quarantinePaths = [
  "legacy/quarantine/claude-compat/skills-loader.ts",
  "legacy/quarantine/claude-compat/path-rules.ts",
];

for (const filePath of activePaths) {
  if (await exists(filePath)) {
    failures.push(`quarantined Claude compatibility file is active again: ${filePath}`);
  }
}

for (const filePath of quarantinePaths) {
  if (!(await exists(filePath))) {
    failures.push(`quarantine copy is missing: ${filePath}`);
  }
}

const staleReferences = {
  "src/tools/context.ts": [
    "../lib/skills-loader.js",
    "../lib/path-rules.js",
    "list_skills",
    "load_skill",
    "load_path_rules",
  ],
  "src/tools/work-gateway.ts": [
    "list_skills",
    "load_skill",
    "load_path_rules",
  ],
  "src/lib/tool-profile.ts": [
    "list_skills",
    "load_skill",
    "load_path_rules",
  ],
  "src/lib/quickstart.ts": [
    "list_skills",
    "load_skill",
    "load_path_rules",
  ],
  "src/lib/tool-work-policy.ts": [
    "list_skills",
    "load_skill",
    "load_path_rules",
  ],
};

for (const [filePath, forbidden] of Object.entries(staleReferences)) {
  const source = await fs.readFile(filePath, "utf8");
  for (const token of forbidden) {
    if (source.includes(token)) {
      failures.push(`${filePath} still references quarantined Claude compatibility surface: ${token}`);
    }
  }
}

for (const filePath of ["src/tools/context.ts", "src/tools/work-gateway.ts"]) {
  const source = await fs.readFile(filePath, "utf8");
  for (const required of ["project_context", "agent_status"]) {
    if (!source.includes(required)) {
      failures.push(`${filePath} lost required context operation: ${required}`);
    }
  }
}

if (failures.length) {
  console.error("Claude compatibility quarantine FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "test-claude-compat-quarantine: ok — legacy Claude loaders are quarantined and absent from active runtime"
);

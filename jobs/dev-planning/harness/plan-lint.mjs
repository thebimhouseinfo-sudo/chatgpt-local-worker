import fs from "node:fs/promises";
import path from "node:path";

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : null;
}

const requiredHeadings = [
  "## Objective",
  "## Repository Evidence",
  "## Constraints",
  "## Non-Goals",
  "## Architecture / Impact",
  "## Implementation Steps",
  "## Validation Plan",
  "## Risks",
  "## Open Questions",
  "## Handoff Notes",
];

const planArg = arg("--plan");
const errors = [];
let plan = null;
let content = "";

if (!planArg) {
  errors.push("missing --plan <path>");
} else {
  plan = path.resolve(planArg);
  try {
    content = await fs.readFile(plan, "utf8");
  } catch (error) {
    errors.push(`cannot read plan: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (content) {
  if (content.trim().length < 500) errors.push("plan is too short to be implementation-ready (<500 characters)");
  for (const heading of requiredHeadings) {
    if (!content.includes(heading)) errors.push(`missing required heading '${heading}'`);
  }

  const stepSection = content.split("## Implementation Steps")[1]?.split(/^## /m)[0] ?? "";
  if (!/^\s*1\.\s+/m.test(stepSection)) errors.push("Implementation Steps must contain at least one numbered step");

  const evidenceSection = content.split("## Repository Evidence")[1]?.split(/^## /m)[0] ?? "";
  if (evidenceSection.trim().length < 40) errors.push("Repository Evidence is too thin; include concrete repository findings");

  if (/\*\*\* Begin Patch|^@@\s+-\d/m.test(content)) {
    errors.push("plan contains patch/diff material; planning should describe changes, not implement them");
  }
}

const result = {
  ok: errors.length === 0,
  plan,
  required_headings: requiredHeadings,
  errors,
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;

import fs from "node:fs/promises";
import path from "node:path";

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : null;
}

const planArg = arg("--plan");
const errors = [];
const requiredHeadings = [
  "## Task ID",
  "## Objective / Acceptance",
  "## Governing Context",
  "## Scope",
  "## Non-Goals",
  "## Relevant Evidence",
  "## Implementation Steps",
  "## Validation",
  "## Risks / Assumptions",
  "## Escalation Condition",
];

let plan = null;
let content = "";
if (!planArg) {
  errors.push("missing --plan <task-plan-path>");
} else {
  plan = path.resolve(planArg);
  try {
    content = await fs.readFile(plan, "utf8");
  } catch (error) {
    errors.push(`cannot read task plan: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (content) {
  if (content.trim().length < 450) errors.push("task plan is too thin (<450 characters)");
  for (const heading of requiredHeadings) {
    if (!content.includes(heading)) errors.push(`missing required heading '${heading}'`);
  }
  const idSection = content.split("## Task ID")[1]?.split(/^## /m)[0] ?? "";
  if (!/TASK-[A-Z0-9.-]+/i.test(idSection)) errors.push("Task ID section must contain a TASK-* identifier");
  const steps = content.split("## Implementation Steps")[1]?.split(/^## /m)[0] ?? "";
  if (!/^\s*1\.\s+/m.test(steps)) errors.push("Implementation Steps must contain at least one numbered step");
  if (/\*\*\* Begin Patch|^@@\s+-\d/m.test(content)) errors.push("task plan contains patch/diff material");
}

const result = { ok: errors.length === 0, plan, required_headings: requiredHeadings, errors };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;

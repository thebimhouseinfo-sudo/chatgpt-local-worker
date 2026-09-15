import fs from "node:fs/promises";
import path from "node:path";

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : null;
}

const dirArg = arg("--dir");
const errors = [];
const files = {
  architecture: "ARCHITECTURE.md",
  plan: "IMPLEMENTATION_PLAN.md",
  todo: "TODO.md",
  tasks: "TASKS.md",
};

if (!dirArg) errors.push("missing --dir <planning-dir>");
const planningDir = dirArg ? path.resolve(dirArg) : null;
const contents = {};

if (planningDir) {
  for (const [key, name] of Object.entries(files)) {
    try {
      contents[key] = await fs.readFile(path.join(planningDir, name), "utf8");
    } catch (error) {
      errors.push(`cannot read ${name}: ${error instanceof Error ? error.message : String(error)}`);
      contents[key] = "";
    }
  }
}

const requiredHeadings = {
  architecture: [
    "## Current Architecture",
    "## Target Architecture",
    "## Boundaries & Responsibilities",
    "## Invariants & Constraints",
    "## Architecture Decisions",
    "## Open Architecture Questions",
    "## Repository Evidence",
  ],
  plan: [
    "## Objective",
    "## Inputs / Governing Architecture",
    "## Constraints",
    "## Non-Goals",
    "## Implementation Strategy",
    "## Phases",
    "## Validation Strategy",
    "## Risks",
    "## Open Questions",
    "## Task Mapping",
    "## Handoff Notes",
  ],
  todo: ["## Active Backlog", "## Deferred", "## Optional / Future", "## Out of Scope"],
  tasks: ["## Execution Rules", "## Completion Summary"],
};

for (const [key, headings] of Object.entries(requiredHeadings)) {
  const content = contents[key] || "";
  for (const heading of headings) {
    if (content && !content.includes(heading)) errors.push(`${files[key]} missing required heading '${heading}'`);
  }
}

if (contents.architecture && contents.architecture.trim().length < 700) {
  errors.push("ARCHITECTURE.md is too thin to be a durable handoff artifact (<700 characters)");
}
if (contents.plan && contents.plan.trim().length < 700) {
  errors.push("IMPLEMENTATION_PLAN.md is too thin to be implementation-ready (<700 characters)");
}

if (contents.plan) {
  const phases = contents.plan.split("## Phases")[1]?.split(/^## /m)[0] ?? "";
  if (!/^\s*1\.\s+/m.test(phases)) errors.push("IMPLEMENTATION_PLAN.md Phases must contain at least one numbered phase");
  if (/\*\*\* Begin Patch|^@@\s+-\d/m.test(contents.plan)) {
    errors.push("IMPLEMENTATION_PLAN.md contains patch/diff material; planning should describe changes, not implement them");
  }
}

if (contents.architecture) {
  const evidence = contents.architecture.split("## Repository Evidence")[1]?.split(/^## /m)[0] ?? "";
  if (evidence.trim().length < 40) errors.push("ARCHITECTURE.md Repository Evidence is too thin");
}

if (contents.tasks) {
  const taskRows = contents.tasks.split("\n").filter((line) => /^\|\s*TASK-[A-Z0-9.-]+\s*\|/i.test(line));
  if (!taskRows.length) errors.push("TASKS.md must contain at least one TASK-* row");
  const allowed = new Set(["TODO", "READY", "IN_PROGRESS", "BLOCKED", "DONE"]);
  const seen = new Set();
  for (const row of taskRows) {
    const cols = row.split("|").slice(1, -1).map((cell) => cell.trim());
    const id = cols[0];
    const status = cols[1];
    if (seen.has(id)) errors.push(`TASKS.md duplicate task id '${id}'`);
    seen.add(id);
    if (!allowed.has(status)) errors.push(`TASKS.md task '${id}' has invalid status '${status}'`);
    if (!cols[2]) errors.push(`TASKS.md task '${id}' is missing Task / Output`);
    if (!cols[4]) errors.push(`TASKS.md task '${id}' is missing Acceptance`);
  }
}

const result = {
  ok: errors.length === 0,
  planning_dir: planningDir,
  files,
  required_headings: requiredHeadings,
  errors,
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;

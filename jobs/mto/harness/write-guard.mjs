import path from "node:path";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function inside(root, target) {
  const rel = path.relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

const projectArg = arg("--project");
const targetArg = arg("--path");
const errors = [];

if (!projectArg) errors.push("missing --project <project-root>");
if (!targetArg) errors.push("missing --path <target-path>");

const project = projectArg ? path.resolve(projectArg) : null;
const target = project && targetArg ? path.resolve(project, targetArg) : targetArg ? path.resolve(targetArg) : null;
const allowedRoot = project ? path.join(project, "01 WIP", "SCHEDULE", "eqm") : null;
const outputRoot = project ? path.join(project, "02 Output") : null;
const scheduleRoot = project ? path.join(project, "01 WIP", "SCHEDULE") : null;

let allowed = false;
let reason = "invalid arguments";
if (project && target && allowedRoot) {
  if (outputRoot && inside(outputRoot, target)) {
    reason = "02 Output is forbidden for MTO writes";
  } else if (inside(allowedRoot, target)) {
    allowed = true;
    reason = "target is inside the only MTO write root: 01 WIP/SCHEDULE/eqm";
  } else if (scheduleRoot && inside(scheduleRoot, target)) {
    reason = "schedule templates outside eqm are read-only";
  } else {
    reason = "target is outside the MTO write root";
  }
}

if (!allowed && errors.length === 0) errors.push(reason);

const result = {
  ok: errors.length === 0 && allowed,
  project,
  target,
  allowed_root: allowedRoot,
  allowed,
  reason,
  errors,
  note: "This deterministic guard must pass before project writes. It complements, but does not replace, filesystem/MCP ACL enforcement."
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;

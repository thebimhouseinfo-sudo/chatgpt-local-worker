import fs from "node:fs/promises";
import path from "node:path";

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : null;
}

const dirArg = arg("--dir");
const taskId = arg("--task-id");
const errors = [];
const names = ["ARCHITECTURE.md", "IMPLEMENTATION_PLAN.md", "TODO.md", "TASKS.md"];
const planningDir = dirArg ? path.resolve(dirArg) : null;
const files = {};

if (!planningDir) errors.push("missing --dir <planning-dir>");

if (planningDir) {
  for (const name of names) {
    const full = path.join(planningDir, name);
    try {
      await fs.access(full);
      files[name] = { path: full, exists: true };
    } catch {
      files[name] = { path: full, exists: false };
      errors.push(`missing planning artifact '${name}'`);
    }
  }
}

const allowedStatuses = new Set(["TODO", "READY", "IN_PROGRESS", "BLOCKED", "DONE"]);
const taskRows = [];
const seenTaskIds = new Set();
let activeTask = null;

if (files["TASKS.md"]?.exists) {
  const content = await fs.readFile(files["TASKS.md"].path, "utf8");
  for (const line of content.split("\n")) {
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (!/^TASK-[A-Z0-9.-]+$/i.test(cells[0] || "")) continue;
    const [id, status, output, dependsOn, acceptance, subplan, notes] = cells;
    const normalizedId = id.toUpperCase();
    taskRows.push({ id: normalizedId, status, output, depends_on: dependsOn, acceptance, subplan, notes, row: line });
    if (seenTaskIds.has(normalizedId)) errors.push(`duplicate task id '${normalizedId}' in TASKS.md`);
    seenTaskIds.add(normalizedId);
    if (!allowedStatuses.has(status)) errors.push(`task '${normalizedId}' has invalid status '${status}'`);
    if (!output) errors.push(`task '${normalizedId}' is missing Task / Output`);
    if (!acceptance) errors.push(`task '${normalizedId}' is missing Acceptance`);
  }
  if (!taskRows.length) errors.push("TASKS.md does not contain any TASK-* rows");

  if (taskId) {
    const row = taskRows.find((item) => item.id.toLowerCase() === taskId.toLowerCase());
    activeTask = row ? { ...row, found: true } : { id: taskId, found: false };
    if (!row) errors.push(`task '${taskId}' not found in TASKS.md`);
  }
}

const result = {
  ok: errors.length === 0,
  planning_dir: planningDir,
  required_files: names,
  files,
  task_ledger: {
    allowed_statuses: [...allowedStatuses],
    task_count: taskRows.length,
    tasks: taskRows.map(({ row, ...task }) => task),
  },
  active_task: activeTask,
  read_order: ["ARCHITECTURE.md", "IMPLEMENTATION_PLAN.md", "TODO.md", "TASKS.md", "targeted source/tests/config"],
  note: "Planning bundle is context for dev-coding. TASKS.md is the progress ledger; architecture/general plan are not rewritten by routine coding work.",
  errors,
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;

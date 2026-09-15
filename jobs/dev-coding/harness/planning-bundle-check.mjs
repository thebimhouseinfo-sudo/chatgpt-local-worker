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

let activeTask = null;
if (planningDir && taskId && files["TASKS.md"]?.exists) {
  const content = await fs.readFile(files["TASKS.md"].path, "utf8");
  const row = content.split("\n").find((line) => {
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    return cells[0]?.toLowerCase() === taskId.toLowerCase();
  });
  activeTask = { id: taskId, found: Boolean(row), row: row || null };
  if (!row) errors.push(`task '${taskId}' not found in TASKS.md`);
}

const result = {
  ok: errors.length === 0,
  planning_dir: planningDir,
  required_files: names,
  files,
  active_task: activeTask,
  read_order: ["ARCHITECTURE.md", "IMPLEMENTATION_PLAN.md", "TODO.md", "TASKS.md", "targeted source/tests/config"],
  note: "Planning bundle is context for dev-coding. TASKS.md is the progress ledger; architecture/general plan are not rewritten by routine coding work.",
  errors,
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;

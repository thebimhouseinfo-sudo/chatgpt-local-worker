import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const harnessRoot = path.join(repoRoot, "jobs", "mto", "harness");

function run(script, args = [], expectedStatus = 0) {
  const result = spawnSync(process.execPath, [path.join(harnessRoot, script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, expectedStatus, `${script} unexpected status:\n${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

const validation = run("validate.mjs");
assert.equal(validation.ok, true);
assert.equal(validation.id, "mto");
assert.equal(validation.status, "ready");
assert.equal(validation.mto.operational, true);
assert.deepEqual(validation.mto.equipment.sort(), ["ac", "fan"]);
assert.equal(validation.mto.write_root, "01 WIP/SCHEDULE/eqm");
assert.equal(validation.mto.output_writes, false);
assert.equal(validation.mto.report_model, "canonical-markdown-per-equipment+revision");
assert.equal(validation.mto.harness_entrypoints, 5);

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "local-worker-mto-"));
try {
  const input = path.join(tmp, "00 Input");
  const schedule = path.join(tmp, "01 WIP", "SCHEDULE");
  const eqm = path.join(schedule, "eqm");
  await fs.mkdir(path.join(input, "2026 07 02", "ac"), { recursive: true });
  await fs.mkdir(path.join(input, "2026 07 02", "fan"), { recursive: true });
  await fs.mkdir(path.join(input, "2026 08 11", "ac"), { recursive: true });
  await fs.mkdir(path.join(input, "2026 08 15", "fan"), { recursive: true });
  await fs.mkdir(path.join(tmp, "01 WIP", "DESIGN DRAWING"), { recursive: true });
  await fs.mkdir(path.join(tmp, "01 WIP", "REVIT"), { recursive: true });
  await fs.mkdir(eqm, { recursive: true });
  await fs.mkdir(path.join(tmp, "02 Output"), { recursive: true });
  await fs.mkdir(path.join(tmp, "qto-rules", "_common"), { recursive: true });
  await fs.writeFile(path.join(tmp, "qto-rules", "_common", "tag-mapping.md"), "AC-1 = ACU 1\n", "utf8");
  await fs.writeFile(path.join(tmp, "qto-rules", "fan.md"), "# Project Fan Overrides\n", "utf8");
  await fs.writeFile(path.join(schedule, "AC Equipment Schedule.xlsx"), "template-ac", "utf8");
  await fs.writeFile(path.join(schedule, "Fan Equipment Schedule.xlsx"), "template-fan", "utf8");

  const latest = run("resolve-project.mjs", ["--project", tmp, "--equipment", "ac,fan", "--revision", "latest"]);
  assert.equal(latest.ok, true);
  assert.deepEqual(latest.requested_equipment, ["ac", "fan"]);
  const ac = latest.equipment.find((item) => item.equipment === "ac");
  const fan = latest.equipment.find((item) => item.equipment === "fan");
  assert.equal(ac.revision, "2026 08 11");
  assert.equal(fan.revision, "2026 08 15");
  assert.equal(ac.schedule_mode, "bootstrap");
  assert.equal(fan.schedule_mode, "bootstrap");
  assert.equal(ac.report_file, path.join(eqm, "_reports", "2026 08 11", "ac.md"));
  assert.equal(fan.report_file, path.join(eqm, "_reports", "2026 08 15", "fan.md"));
  assert.equal(ac.rules.project_common.some((p) => p.endsWith("tag-mapping.md")), true);
  assert.equal(fan.rules.project_equipment.endsWith(path.join("qto-rules", "fan.md")), true);

  await fs.writeFile(path.join(eqm, "Fan Equipment Schedule.xlsx"), "live-fan", "utf8");
  const explicit = run("resolve-project.mjs", ["--project", tmp, "--equipment", "fan", "--revision", "2026 07 02"]);
  assert.equal(explicit.ok, true);
  assert.equal(explicit.equipment[0].revision, "2026 07 02");
  assert.equal(explicit.equipment[0].schedule_mode, "update");

  const allowed = run("write-guard.mjs", ["--project", tmp, "--path", path.join(eqm, "Fan Equipment Schedule.xlsx")]);
  assert.equal(allowed.allowed, true);

  const allowedReport = run("write-guard.mjs", ["--project", tmp, "--path", fan.report_file]);
  assert.equal(allowedReport.allowed, true);

  const deniedTemplate = run("write-guard.mjs", ["--project", tmp, "--path", path.join(schedule, "Fan Equipment Schedule.xlsx")], 1);
  assert.equal(deniedTemplate.allowed, false);
  assert.match(deniedTemplate.reason, /read-only/i);

  const deniedOutput = run("write-guard.mjs", ["--project", tmp, "--path", path.join(tmp, "02 Output", "2026 09 15", "fan.xlsx")], 1);
  assert.equal(deniedOutput.allowed, false);
  assert.match(deniedOutput.reason, /forbidden/i);

  const auditDir = path.join(eqm, "_audit");
  await fs.mkdir(auditDir, { recursive: true });
  const auditFile = path.join(auditDir, "fan.json");
  await fs.writeFile(auditFile, JSON.stringify([
    {
      input_rev: "2026 08 15",
      run_timestamp: "2026-09-15T10:32:00+07:00",
      changes: [{ tag: "FAN-07", action: "added", source: "00 Input/2026 08 15/fan/eqm selection.xlsx" }],
      tbc: [],
      conflicts: [],
      unmatched_drawing_vs_selection: []
    }
  ], null, 2));
  const audit = run("audit-lint.mjs", ["--file", auditFile]);
  assert.equal(audit.ok, true);
  assert.equal(audit.run_count, 1);

  await fs.mkdir(path.dirname(fan.report_file), { recursive: true });
  await fs.writeFile(fan.report_file, `# MTO TAKEOFF REPORT — FAN\n\n## RUN SUMMARY\n\n- Project: Test\n- Equipment: fan\n- Input Revision: 2026 08 15\n- Schedule Mode: bootstrap\n- Live Schedule: Fan Equipment Schedule.xlsx\n- Run Timestamp: 2026-09-15T10:32:00+07:00\n- Rules Applied: base fan\n\n## EQUIPMENT SCHEDULE\n\n| REF. NO. | MAKE | MODEL |\n|---|---|---|\n| FAN-07 | TEST | F-1 |\n\n## CHANGE SUMMARY\n\n- Added: 1\n- Updated: 0\n- Unchanged: 0\n- Review Required / Disappeared: 0\n\n## TRACEABILITY & DATA SOURCE\n\n- FAN-07: 00 Input/2026 08 15/fan/eqm selection.xlsx\n\n## DRAWING RECONCILIATION\n\n- No mismatch.\n\n## CONFLICTS / TBC / REVIEW ITEMS\n\nNone\n\n## QUERY LIST (RFI)\n\nNone\n`, "utf8");
  const report = run("report-lint.mjs", ["--file", fan.report_file]);
  assert.equal(report.ok, true);

  const unsupported = run("resolve-project.mjs", ["--project", tmp, "--equipment", "hrv", "--revision", "latest"], 1);
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.errors.some((e) => e.includes("unsupported equipment")), true);

  await fs.mkdir(path.join(input, "2026 13 01"), { recursive: true });
  const invalidDate = run("resolve-project.mjs", ["--project", tmp, "--equipment", "fan", "--revision", "latest"], 1);
  assert.equal(invalidDate.ok, false);
  assert.equal(invalidDate.errors.some((e) => e.includes("invalid input revision date folder")), true);
} finally {
  await fs.rm(tmp, { recursive: true, force: true });
}

console.log("test-mto-harness: ok");
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function statKind(target) {
  try {
    const st = await fs.stat(target);
    return st.isDirectory() ? "dir" : st.isFile() ? "file" : "other";
  } catch {
    return null;
  }
}

function parseRevision(name) {
  const m = /^(\d{4}) (\d{2}) (\d{2})$/.exec(name);
  if (!m) return { format: false, valid: false, value: null };
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  const valid =
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day;
  return { format: true, valid, value: valid ? d.getTime() : null };
}

async function listDirs(root) {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function listFiles(root) {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function findChildDirCaseInsensitiveAny(root, wanted) {
  const entries = await listDirs(root);
  const byLower = new Map(entries.map((name) => [name.toLowerCase(), name]));
  for (const candidate of wanted || []) {
    const found = byLower.get(String(candidate).toLowerCase());
    if (found) return path.join(root, found);
  }
  return null;
}

async function findCanonicalExport(wipRoot, stem) {
  const files = await listFiles(wipRoot);
  const acceptedExtensions = new Set([".csv", ".xlsx", ".xls"]);
  const matches = files.filter((name) => {
    const ext = path.extname(name).toLowerCase();
    const base = path.basename(name, ext).toLowerCase();
    return acceptedExtensions.has(ext) && base === String(stem).toLowerCase();
  });
  if (matches.length === 1) return { file: path.join(wipRoot, matches[0]), matches };
  return { file: null, matches };
}

async function listMarkdown(root) {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".md"))
      .map((e) => path.join(root, e.name))
      .sort();
  } catch {
    return [];
  }
}

function isWithin(child, parent) {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

const packDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const project = path.resolve(arg("--project", process.cwd()));
const equipmentArg = arg("--equipment", "");
const revisionArgRaw = arg("--revision", null);
const revisionArg = revisionArgRaw ? revisionArgRaw.trim() : null;
const explicitSourceFileArg = arg("--source-file", null);
const errors = [];
const warnings = [];

let registry;
try {
  registry = JSON.parse(await fs.readFile(path.join(packDir, "rules", "equipment-registry.json"), "utf8"));
} catch (error) {
  errors.push(`cannot read equipment registry: ${error instanceof Error ? error.message : String(error)}`);
  registry = { equipment: {} };
}

const aliasToId = new Map();
for (const [id, meta] of Object.entries(registry.equipment || {})) {
  aliasToId.set(id.toLowerCase(), id);
  for (const alias of meta.aliases || []) aliasToId.set(String(alias).toLowerCase(), id);
}

const rawEquipment = equipmentArg.split(/[,;]+/).map((v) => v.trim()).filter(Boolean);
if (!rawEquipment.length) errors.push("missing --equipment <ac,fan,...>");
const equipmentIds = [];
for (const raw of rawEquipment) {
  const id = aliasToId.get(raw.toLowerCase());
  if (!id) {
    errors.push(`unsupported equipment/schedule '${raw}'. Supported runnable rules: ${Object.keys(registry.equipment || {}).join(", ")}`);
  } else if (!equipmentIds.includes(id)) {
    equipmentIds.push(id);
  }
}

const inputRoot = path.join(project, "00 Input");
const wipRoot = path.join(project, "01 WIP");
const drawingRoot = path.join(wipRoot, "DESIGN DRAWING");
const revitRoot = path.join(wipRoot, "REVIT");
const scheduleRoot = path.join(wipRoot, "SCHEDULE");
const eqmRoot = path.join(scheduleRoot, "eqm");
const auditRoot = path.join(eqmRoot, "_audit");
const reportRoot = path.join(eqmRoot, "_reports");
const outputRoot = path.join(project, "02 Output");
const projectRulesRoot = path.join(project, "qto-rules");

for (const [label, target] of [["00 Input", inputRoot], ["01 WIP", wipRoot], ["01 WIP/SCHEDULE", scheduleRoot]]) {
  if ((await statKind(target)) !== "dir") errors.push(`required project directory missing: ${label}`);
}
if ((await statKind(drawingRoot)) !== "dir") warnings.push("01 WIP/DESIGN DRAWING is missing; drawing reconciliation may be unavailable");
if ((await statKind(revitRoot)) !== "dir") warnings.push("01 WIP/REVIT is missing (ignored by MTO anyway)");
if ((await statKind(outputRoot)) !== "dir") warnings.push("02 Output is missing; MTO will still never create/write release output");

const revisionDirs = await listDirs(inputRoot);
const parsedRevisions = [];
for (const name of revisionDirs) {
  const parsed = parseRevision(name);
  if (parsed.format && !parsed.valid) {
    errors.push(`invalid input revision date folder '${name}'`);
  } else if (parsed.valid) {
    parsedRevisions.push({ name, value: parsed.value });
  } else {
    warnings.push(`ignored non-date input directory '${name}'`);
  }
}
parsedRevisions.sort((a, b) => b.value - a.value);

let explicitRevision = null;
if (revisionArg && revisionArg.toLowerCase() !== "latest") {
  const parsed = parseRevision(revisionArg);
  if (!parsed.format || !parsed.valid) {
    errors.push(`revision '${revisionArg}' must be a valid YYYY MM DD date, 'latest', or omitted for drawing-export schedules`);
  } else {
    explicitRevision = revisionArg;
    if (!parsedRevisions.some((item) => item.name === explicitRevision)) {
      errors.push(`input revision folder not found: ${explicitRevision}`);
    }
  }
}

const drawingIds = equipmentIds.filter((id) => registry.equipment[id]?.source_model === "drawing-export");
let explicitSourceFile = null;
if (explicitSourceFileArg) {
  if (drawingIds.length !== 1) {
    errors.push("--source-file may only be used when exactly one drawing-export schedule is requested");
  } else {
    explicitSourceFile = path.resolve(project, explicitSourceFileArg);
    if ((await statKind(explicitSourceFile)) !== "file") {
      errors.push(`drawing export source file not found: ${explicitSourceFile}`);
    } else if (!isWithin(explicitSourceFile, wipRoot)) {
      errors.push(`drawing export source file must be inside 01 WIP: ${explicitSourceFile}`);
    }
  }
}

const baseCommonRules = await listMarkdown(path.join(packDir, "rules", "_common"));
const projectCommonRules = await listMarkdown(path.join(projectRulesRoot, "_common"));
const resolved = [];

async function resolveSelectionInput(meta, id) {
  const requested = revisionArg || "latest";
  const folders = meta.input_folders || [];
  let revision = explicitRevision;
  let equipmentInput = null;

  if (revision) {
    equipmentInput = await findChildDirCaseInsensitiveAny(path.join(inputRoot, revision), folders);
    if (!equipmentInput) errors.push(`revision '${revision}' does not contain requested '${id}' input folder (accepted: ${folders.join(", ")})`);
  } else {
    for (const candidate of parsedRevisions) {
      const found = await findChildDirCaseInsensitiveAny(path.join(inputRoot, candidate.name), folders);
      if (found) {
        revision = candidate.name;
        equipmentInput = found;
        break;
      }
    }
    if (!revision || !equipmentInput) errors.push(`no valid input revision contains requested '${id}' input folder (accepted: ${folders.join(", ")})`);
  }

  return { requested_revision: requested, revision, input_dir: equipmentInput };
}

async function resolveOptionalSupplement(meta) {
  if (!revisionArg) return { revision: null, input_dir: null };
  const folders = meta.supplement_input_folders || [];
  if (!folders.length) return { revision: null, input_dir: null };

  if (explicitRevision) {
    const found = await findChildDirCaseInsensitiveAny(path.join(inputRoot, explicitRevision), folders);
    if (!found) warnings.push(`no optional supplemental input for drawing-export schedule in revision '${explicitRevision}' (accepted folders: ${folders.join(", ")})`);
    return { revision: found ? explicitRevision : null, input_dir: found };
  }

  for (const candidate of parsedRevisions) {
    const found = await findChildDirCaseInsensitiveAny(path.join(inputRoot, candidate.name), folders);
    if (found) return { revision: candidate.name, input_dir: found };
  }
  warnings.push(`no optional supplemental input found for drawing-export schedule (accepted folders: ${folders.join(", ")})`);
  return { revision: null, input_dir: null };
}

for (const id of equipmentIds) {
  const meta = registry.equipment[id];
  const status = meta.status || "stable";
  const sourceModel = meta.source_model || "selection";
  const requiredWarning = status === "draft"
    ? `RULE DRAFT / NOT FINAL — '${id}' is runnable for real-project development, but results must be checked carefully and implementation feedback should be used to refine the rule.`
    : null;
  if (requiredWarning) warnings.push(requiredWarning);

  let revision = null;
  let equipmentInput = null;
  let sourceFile = null;
  let requestedRevision = revisionArg;

  if (sourceModel === "selection") {
    const selection = await resolveSelectionInput(meta, id);
    revision = selection.revision;
    equipmentInput = selection.input_dir;
    requestedRevision = selection.requested_revision;
  } else if (sourceModel === "drawing-export") {
    if (explicitSourceFile && drawingIds[0] === id) {
      sourceFile = explicitSourceFile;
    } else {
      const canonical = await findCanonicalExport(wipRoot, meta.export_stem);
      if (canonical.matches.length > 1) {
        errors.push(`multiple canonical drawing exports found for '${id}': ${canonical.matches.join(", ")}`);
      } else if (!canonical.file) {
        errors.push(`drawing export not found for '${id}'. Expected 01 WIP/${meta.export_stem}.csv|xlsx|xls, or provide the current legacy WIP export with --source-file`);
      } else {
        sourceFile = canonical.file;
      }
    }

    const supplement = await resolveOptionalSupplement(meta);
    revision = supplement.revision;
    equipmentInput = supplement.input_dir;
  } else {
    errors.push(`unsupported source_model '${sourceModel}' for '${id}'`);
  }

  const template = path.join(scheduleRoot, meta.template);
  const liveSchedule = path.join(eqmRoot, meta.live_schedule);
  const auditFile = path.join(auditRoot, meta.audit_file);
  const reportFile = sourceModel === "drawing-export"
    ? path.join(reportRoot, "drawing-export", `${id}.md`)
    : revision ? path.join(reportRoot, revision, `${id}.md`) : null;
  const baseRule = path.join(packDir, meta.base_rule);
  const projectRule = path.join(project, meta.project_rule);
  const templateExists = (await statKind(template)) === "file";
  const liveExists = (await statKind(liveSchedule)) === "file";
  const baseRuleExists = (await statKind(baseRule)) === "file";
  const projectRuleExists = (await statKind(projectRule)) === "file";

  if (!templateExists) errors.push(`schedule template missing for '${id}': ${template}`);
  if (!baseRuleExists) errors.push(`base rule missing for '${id}': ${baseRule}`);

  resolved.push({
    equipment: id,
    rule_status: status,
    required_warning: requiredWarning,
    source_model: sourceModel,
    requested_revision: requestedRevision,
    revision,
    input_dir: equipmentInput,
    source_file: sourceFile,
    template,
    live_schedule: liveSchedule,
    schedule_mode: liveExists ? "update" : "bootstrap",
    audit_file: auditFile,
    report_file: reportFile,
    report_template: path.join(packDir, "templates", "TAKEOFF_REPORT.md"),
    rules: {
      base_common: baseCommonRules,
      base_equipment: baseRule,
      project_common: projectCommonRules,
      project_equipment: projectRuleExists ? projectRule : null,
      precedence: ["explicit-user-instruction", "project-rules", "base-rules"]
    }
  });
}

const result = {
  ok: errors.length === 0,
  project,
  requested_revision: revisionArg,
  requested_equipment: equipmentIds,
  structure: {
    input_root: inputRoot,
    wip_root: wipRoot,
    drawing_root: drawingRoot,
    revit_root: revitRoot,
    schedule_root: scheduleRoot,
    eqm_write_root: eqmRoot,
    audit_root: auditRoot,
    report_root: reportRoot,
    output_forbidden_root: outputRoot,
    project_rules_root: projectRulesRoot,
    eqm_root_exists: (await statKind(eqmRoot)) === "dir"
  },
  valid_revisions: parsedRevisions.map((item) => item.name),
  equipment: resolved,
  warnings,
  errors,
  note: "Stable and draft rules are runnable. Draft rules require an explicit user-facing warning and careful result review. Selection-driven rules resolve input revision; drawing-export rules use the current WIP export and do not require a synthetic input revision. No writes are performed by this harness."
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;

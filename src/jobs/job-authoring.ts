
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { appendActivity } from "../lib/activity-log.js";
import { getCustomJobsRoot, getDefaultJobsRoot, getWorkerDataRoot } from "../lib/worker-home.js";

export type JobPackStatus = "ready" | "placeholder";

export interface JobFieldDefinition {
  key: string;
  type?: string;
  required?: boolean;
  description?: string;
}

export interface JobConfirmationDefinition {
  required?: boolean;
  template?: string;
}

export interface JobPackDraft {
  id: string;
  clone_from?: string;
  name?: string;
  description?: string;
  version?: string;
  status?: JobPackStatus;
  aliases?: string[];
  keywords?: string[];
  inputs?: JobFieldDefinition[];
  outputs?: JobFieldDefinition[];
  permissions?: Record<string, string>;
  confirmation?: JobConfirmationDefinition;
  skills?: string[];
  harness_entrypoints?: string[];
  validators?: string[];
  job_md?: string;
  skill_md?: string;
  files?: Record<string, string>;
}

export interface JobPackPatch {
  name?: string;
  description?: string;
  version?: string;
  status?: JobPackStatus;
  aliases?: string[];
  keywords?: string[];
  inputs?: JobFieldDefinition[];
  outputs?: JobFieldDefinition[];
  permissions?: Record<string, string>;
  confirmation?: JobConfirmationDefinition;
  skills?: string[];
  harness_entrypoints?: string[];
  validators?: string[];
  job_md?: string;
  skill_md?: string;
  files?: Record<string, string>;
  remove_files?: string[];
}

export interface JobPackValidation {
  ok: boolean;
  pack: string;
  id: string;
  errors: string[];
}

const CORE_FILES = new Set(["job.yaml", "JOB.md", "SKILL.md"]);
const REQUIRED_META = [
  "id", "name", "version", "status", "description", "aliases", "keywords",
  "inputs", "outputs", "permissions", "confirmation", "skills", "harness", "validators",
] as const;

function assertJobId(id: string): string {
  const value = id.trim();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) {
    throw new Error("Job id must use lowercase letters, digits and hyphens only.");
  }
  return value;
}

function safeRelativePath(raw: string): string {
  const normalized = raw.replaceAll("\\", "/").replace(/^\.\/+/, "");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.split("/").some((part) => part === ".." || part === "")
  ) {
    throw new Error("Unsafe Job Pack relative path: " + raw);
  }
  return normalized;
}

function resolveInsidePack(packDir: string, rel: string): string {
  const safe = safeRelativePath(rel);
  const absolute = path.resolve(packDir, ...safe.split("/"));
  const root = path.resolve(packDir) + path.sep;
  if (absolute !== path.resolve(packDir) && !absolute.startsWith(root)) {
    throw new Error("Path escapes Job Pack: " + rel);
  }
  return absolute;
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function normalizeField(field: JobFieldDefinition) {
  return {
    key: field.key,
    type: field.type || "string",
    required: field.required ?? true,
    ...(field.description ? { description: field.description } : {}),
  };
}

function buildManifest(draft: JobPackDraft) {
  if (!draft.name?.trim() || !draft.description?.trim()) {
    throw new Error("name and description are required when creating a Job from scratch.");
  }
  return {
    id: assertJobId(draft.id),
    name: draft.name.trim(),
    version: draft.version?.trim() || "0.1.0",
    status: draft.status || "ready",
    description: draft.description.trim(),
    aliases: draft.aliases || [],
    keywords: draft.keywords || [],
    inputs: (
      draft.inputs || [
        {
          key: "workspace",
          type: "directory",
          required: true,
          description: "Target local workspace for this Job.",
        },
      ]
    ).map(normalizeField),
    outputs: (draft.outputs || []).map(normalizeField),
    permissions: draft.permissions || {},
    confirmation: {
      required: draft.confirmation?.required ?? true,
      template:
        draft.confirmation?.template ||
        "JOB: {job}\nFOLDER: {workspace}\n\nXác nhận bắt đầu?",
    },
    skills: draft.skills || [],
    harness: { entrypoints: draft.harness_entrypoints || [] },
    validators: draft.validators || [],
  };
}

async function readManifest(packDir: string): Promise<Record<string, any>> {
  const raw = await fs.readFile(path.join(packDir, "job.yaml"), "utf8");
  return JSON.parse(raw) as Record<string, any>;
}

async function writeText(target: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
}

async function writeExtraFiles(
  packDir: string,
  files: Record<string, string> | undefined
): Promise<void> {
  for (const [rel, content] of Object.entries(files || {})) {
    const safe = safeRelativePath(rel);
    if (CORE_FILES.has(safe)) {
      throw new Error("Use dedicated job_md/skill_md fields instead of files[" + safe + "].");
    }
    await writeText(resolveInsidePack(packDir, safe), content);
  }
}

async function removeExtraFiles(
  packDir: string,
  files: string[] | undefined
): Promise<void> {
  for (const rel of files || []) {
    const safe = safeRelativePath(rel);
    if (CORE_FILES.has(safe)) {
      throw new Error("Core Job Pack file cannot be removed: " + safe);
    }
    await fs.rm(resolveInsidePack(packDir, safe), { recursive: true, force: true });
  }
}

export async function validateJobPack(packDir: string): Promise<JobPackValidation> {
  const absolute = path.resolve(packDir);
  const errors: string[] = [];
  const id = path.basename(absolute);

  for (const file of CORE_FILES) {
    if (!(await exists(path.join(absolute, file)))) errors.push("missing " + file);
  }
  if (!(await exists(path.join(absolute, "harness")))) errors.push("missing harness/");

  let meta: Record<string, any> | null = null;
  try {
    meta = await readManifest(absolute);
  } catch (error) {
    errors.push(
      "job.yaml must use JSON-compatible YAML: " +
        (error instanceof Error ? error.message : String(error))
    );
  }

  if (meta) {
    for (const key of REQUIRED_META) {
      if (!(key in meta)) errors.push("job.yaml missing '" + key + "'");
    }
    if (meta.id !== id) {
      errors.push("job.yaml id '" + meta.id + "' must match directory '" + id + "'");
    }
    if (!["ready", "placeholder"].includes(meta.status)) {
      errors.push("job.yaml status must be ready or placeholder");
    }
    if (!meta.name || typeof meta.name !== "string") errors.push("job.yaml name must be non-empty");
    if (!meta.description || typeof meta.description !== "string") {
      errors.push("job.yaml description must be non-empty");
    }
    const workspaceInput = Array.isArray(meta.inputs)
      ? meta.inputs.find((item: any) => item?.key === "workspace")
      : undefined;
    if (!workspaceInput || workspaceInput.required === false) {
      errors.push("job.yaml must define required input 'workspace'");
    }

    const refs: Array<readonly [string, string]> = [
      ...((meta.skills || []) as string[]).map((rel) => ["skill", rel] as const),
      ...((meta.harness?.entrypoints || []) as string[]).map(
        (rel) => ["harness entrypoint", rel] as const
      ),
      ...((meta.validators || []) as string[]).map(
        (rel) => ["validator", rel] as const
      ),
    ];

    for (const [kind, rel] of refs) {
      try {
        const target = resolveInsidePack(absolute, rel);
        if (!(await exists(target))) errors.push("missing " + kind + " '" + rel + "'");
      } catch (error) {
        errors.push(
          kind + " '" + rel + "' is invalid: " +
            (error instanceof Error ? error.message : String(error))
        );
      }
    }
  }

  return { ok: errors.length === 0, pack: absolute, id: meta?.id || id, errors };
}

function stagingPackDir(jobId: string): string {
  return path.join(getWorkerDataRoot(), ".job-authoring-staging", randomUUID(), jobId);
}

async function publishNew(stageDir: string, liveDir: string): Promise<void> {
  await fs.mkdir(path.dirname(liveDir), { recursive: true });
  if (await exists(liveDir)) throw new Error("Job already exists: " + path.basename(liveDir));
  await fs.rename(stageDir, liveDir);
}

async function publishReplacement(stageDir: string, liveDir: string): Promise<void> {
  const backupRoot = path.join(getWorkerDataRoot(), ".job-authoring-backup", randomUUID());
  const backupDir = path.join(backupRoot, path.basename(liveDir));
  await fs.mkdir(backupRoot, { recursive: true });

  await fs.rename(liveDir, backupDir);
  try {
    await fs.rename(stageDir, liveDir);
    await fs.rm(backupRoot, { recursive: true, force: true });
  } catch (error) {
    await fs.rm(liveDir, { recursive: true, force: true }).catch(() => undefined);
    await fs.rename(backupDir, liveDir).catch(() => undefined);
    throw error;
  }
}

async function resolveCloneSource(idInput: string): Promise<{
  id: string;
  dir: string;
  source: "default" | "custom";
}> {
  const id = assertJobId(idInput);
  const defaultDir = path.join(getDefaultJobsRoot(), id);
  if (await exists(defaultDir)) return { id, dir: defaultDir, source: "default" };

  const customDir = path.join(getCustomJobsRoot(), id);
  if (await exists(customDir)) return { id, dir: customDir, source: "custom" };

  throw new Error("Unknown source Job '" + id + "'.");
}

async function createClonedJobPack(draft: JobPackDraft, liveDir: string) {
  const targetId = assertJobId(draft.id);
  const source = await resolveCloneSource(draft.clone_from!);
  const stageDir = stagingPackDir(targetId);
  const stageRoot = path.dirname(stageDir);

  try {
    await fs.mkdir(path.dirname(stageDir), { recursive: true });
    await fs.cp(source.dir, stageDir, { recursive: true });

    const current = await readManifest(stageDir);
    const next = {
      ...current,
      id: targetId,
      name: draft.name?.trim() || (String(current.name || source.id) + " Custom"),
      description:
        draft.description?.trim() ||
        String(current.description || "Custom clone of " + source.id),
      aliases: draft.aliases ?? [],
      ...(draft.version !== undefined ? { version: draft.version.trim() } : {}),
      ...(draft.status !== undefined ? { status: draft.status } : {}),
      ...(draft.keywords !== undefined ? { keywords: draft.keywords } : {}),
      ...(draft.inputs !== undefined
        ? { inputs: draft.inputs.map(normalizeField) }
        : {}),
      ...(draft.outputs !== undefined
        ? { outputs: draft.outputs.map(normalizeField) }
        : {}),
      ...(draft.permissions !== undefined
        ? { permissions: draft.permissions }
        : {}),
      ...(draft.confirmation !== undefined
        ? {
            confirmation: {
              required: draft.confirmation.required ?? true,
              template:
                draft.confirmation.template ||
                current.confirmation?.template ||
                "JOB: {job}\nFOLDER: {workspace}\n\nXác nhận bắt đầu?",
            },
          }
        : {}),
      ...(draft.skills !== undefined ? { skills: draft.skills } : {}),
      ...(draft.harness_entrypoints !== undefined
        ? { harness: { entrypoints: draft.harness_entrypoints } }
        : {}),
      ...(draft.validators !== undefined ? { validators: draft.validators } : {}),
      cloned_from: {
        job_id: source.id,
        source: source.source,
      },
    };

    await writeText(path.join(stageDir, "job.yaml"), JSON.stringify(next, null, 2) + "\n");
    if (draft.job_md !== undefined) {
      await writeText(path.join(stageDir, "JOB.md"), draft.job_md);
    }
    if (draft.skill_md !== undefined) {
      await writeText(path.join(stageDir, "SKILL.md"), draft.skill_md);
    }
    await writeExtraFiles(stageDir, draft.files);

    const validation = await validateJobPack(stageDir);
    if (!validation.ok) {
      throw new Error("Cloned Job validation failed: " + validation.errors.join("; "));
    }

    await publishNew(stageDir, liveDir);
    appendActivity({
      kind: "system",
      action: "job_created",
      status: "ok",
      target: targetId,
      summary: targetId + " cloned to AppData custom jobs/",
      details: {
        job_id: targetId,
        pack_dir: liveDir,
        source: "custom",
        cloned_from: source.id,
        cloned_from_source: source.source,
      },
    });
    return {
      job_id: targetId,
      pack_dir: liveDir,
      source: "custom",
      cloned_from: source.id,
      validation,
    };
  } finally {
    await fs.rm(stageRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function createJobPack(draft: JobPackDraft) {
  const id = assertJobId(draft.id);
  const jobsRoot = getCustomJobsRoot();
  const liveDir = path.join(jobsRoot, id);
  const defaultDir = path.join(getDefaultJobsRoot(), id);
  if (await exists(defaultDir)) {
    throw new Error(
      "Job '" + id + "' is a bundled default Job. Custom Job ids must be unique."
    );
  }
  if (await exists(liveDir)) throw new Error("Custom Job '" + id + "' already exists.");

  if (draft.clone_from) {
    return createClonedJobPack({ ...draft, id }, liveDir);
  }

  const stageDir = stagingPackDir(id);
  const stageRoot = path.dirname(stageDir);
  try {
    await fs.mkdir(path.join(stageDir, "harness"), { recursive: true });
    await writeText(path.join(stageDir, "harness", ".gitkeep"), "");
    await writeText(
      path.join(stageDir, "job.yaml"),
      JSON.stringify(buildManifest({ ...draft, id }), null, 2) + "\n"
    );
    await writeText(
      path.join(stageDir, "JOB.md"),
      draft.job_md?.trim() || "# " + draft.name! + "\n\n" + draft.description! + "\n"
    );
    await writeText(
      path.join(stageDir, "SKILL.md"),
      draft.skill_md?.trim() ||
        "# " + draft.name! + " — Operating SOP\n\nFollow the Job contract in JOB.md.\n"
    );
    await writeExtraFiles(stageDir, draft.files);

    const validation = await validateJobPack(stageDir);
    if (!validation.ok) {
      throw new Error("Job validation failed: " + validation.errors.join("; "));
    }

    await publishNew(stageDir, liveDir);
    appendActivity({
      kind: "system",
      action: "job_created",
      status: "ok",
      target: id,
      summary: id + " published to AppData custom jobs/",
      details: { job_id: id, pack_dir: liveDir, source: "custom" },
    });
    return { job_id: id, pack_dir: liveDir, validation };
  } finally {
    await fs.rm(stageRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function updateJobPack(idInput: string, patch: JobPackPatch) {
  const id = assertJobId(idInput);
  const jobsRoot = getCustomJobsRoot();
  const liveDir = path.join(jobsRoot, id);
  const defaultDir = path.join(getDefaultJobsRoot(), id);
  if (!(await exists(liveDir))) {
    if (await exists(defaultDir)) {
      throw new Error(
        "Job '" + id + "' is a bundled default Job and cannot be updated through custom Job authoring."
      );
    }
    throw new Error("Unknown custom Job '" + id + "'.");
  }

  const stageDir = stagingPackDir(id);
  const stageRoot = path.dirname(stageDir);
  try {
    await fs.mkdir(path.dirname(stageDir), { recursive: true });
    await fs.cp(liveDir, stageDir, { recursive: true });

    const current = await readManifest(stageDir);
    const next = {
      ...current,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description.trim() }
        : {}),
      ...(patch.version !== undefined ? { version: patch.version.trim() } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.aliases !== undefined ? { aliases: patch.aliases } : {}),
      ...(patch.keywords !== undefined ? { keywords: patch.keywords } : {}),
      ...(patch.inputs !== undefined
        ? { inputs: patch.inputs.map(normalizeField) }
        : {}),
      ...(patch.outputs !== undefined
        ? { outputs: patch.outputs.map(normalizeField) }
        : {}),
      ...(patch.permissions !== undefined
        ? { permissions: patch.permissions }
        : {}),
      ...(patch.confirmation !== undefined
        ? {
            confirmation: {
              required: patch.confirmation.required ?? true,
              template:
                patch.confirmation.template ||
                current.confirmation?.template ||
                "JOB: {job}\nFOLDER: {workspace}\n\nXác nhận bắt đầu?",
            },
          }
        : {}),
      ...(patch.skills !== undefined ? { skills: patch.skills } : {}),
      ...(patch.harness_entrypoints !== undefined
        ? { harness: { entrypoints: patch.harness_entrypoints } }
        : {}),
      ...(patch.validators !== undefined ? { validators: patch.validators } : {}),
      id,
    };

    await writeText(path.join(stageDir, "job.yaml"), JSON.stringify(next, null, 2) + "\n");
    if (patch.job_md !== undefined) {
      await writeText(path.join(stageDir, "JOB.md"), patch.job_md);
    }
    if (patch.skill_md !== undefined) {
      await writeText(path.join(stageDir, "SKILL.md"), patch.skill_md);
    }
    await writeExtraFiles(stageDir, patch.files);
    await removeExtraFiles(stageDir, patch.remove_files);

    const validation = await validateJobPack(stageDir);
    if (!validation.ok) {
      throw new Error("Job validation failed: " + validation.errors.join("; "));
    }

    await publishReplacement(stageDir, liveDir);
    appendActivity({
      kind: "system",
      action: "job_updated",
      status: "ok",
      target: id,
      summary: id + " updated in AppData custom jobs/",
      details: { job_id: id, pack_dir: liveDir, source: "custom" },
    });
    return { job_id: id, pack_dir: liveDir, validation };
  } finally {
    await fs.rm(stageRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function removeJobPack(idInput: string) {
  const id = assertJobId(idInput);
  const jobsRoot = getCustomJobsRoot();
  const liveDir = path.join(jobsRoot, id);
  const defaultDir = path.join(getDefaultJobsRoot(), id);
  if (!(await exists(liveDir))) {
    if (await exists(defaultDir)) {
      throw new Error(
        "Job '" + id + "' is a bundled default Job and cannot be removed through custom Job authoring."
      );
    }
    throw new Error("Unknown custom Job '" + id + "'.");
  }

  await fs.rm(liveDir, { recursive: true, force: false });
  appendActivity({
    kind: "system",
    action: "job_removed",
    status: "ok",
    target: id,
    summary: id + " removed from AppData custom jobs/",
    details: { job_id: id, pack_dir: liveDir, source: "custom" },
  });
  return { job_id: id, removed: true, pack_dir: liveDir };
}

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getJobPackRoots } from "../lib/worker-home.js";
import { JOB_PRELOAD_FAMILIES } from "../lib/runtime-families.js";

const JobFieldSchema = z.object({
  key: z.string().min(1),
  type: z.string().min(1).default("string"),
  required: z.boolean().optional().default(true),
  description: z.string().optional(),
});

const JobMetaSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    version: z.string().min(1).default("0.1.0"),
    status: z.enum(["ready", "placeholder"]).optional().default("ready"),
    description: z.string().min(1),
    aliases: z.array(z.string()).optional().default([]),
    keywords: z.array(z.string()).optional().default([]),
    inputs: z.array(JobFieldSchema).optional().default([]),
    outputs: z.array(JobFieldSchema).optional().default([]),
    permissions: z.record(z.string(), z.string()).optional().default({}),
    confirmation: z
      .object({
        required: z.boolean().optional().default(true),
        template: z
          .string()
          .min(1)
          .default("Tôi sẽ thực hiện job {job} với input/output đã nêu. Xác nhận chứ?"),
      })
      .optional()
      .default({
        required: true,
        template: "Tôi sẽ thực hiện job {job} với input/output đã nêu. Xác nhận chứ?",
      }),
    skills: z.array(z.string()).optional().default([]),
    harness: z
      .object({
        entrypoints: z.array(z.string()).optional().default([]),
      })
      .optional()
      .default({ entrypoints: [] }),
    validators: z.array(z.string()).optional().default([]),
    runtime: z
      .object({
        preload_families: z
          .array(z.enum(["filesystem", "shell", "git", "context", "rewind", "repl", "ponytail", "mcp"]))
          .optional()
          .default([]),
      })
      .optional()
      .default({ preload_families: [] }),
  })
  .passthrough();

export type JobMeta = z.infer<typeof JobMetaSchema>;
export type JobPhase =
  | "idle"
  | "selected"
  | "awaiting_confirmation"
  | "active";

type JobPackSource = "custom" | "default" | "explicit";

interface LoadedJobPack {
  dir: string;
  source: JobPackSource;
  meta: JobMeta;
  job_md: string;
  skill_md: string;
}

interface JobState {
  phase: JobPhase;
  job_id?: string;
  bindings: Record<string, string>;
  selected_at?: string;
  activated_at?: string;
  confirmation_prompt?: string;
  confirmation_token?: string;
}

export interface JobSelectOptions {
  job: string;
  bindings?: Record<string, string>;
  confirmed?: boolean;
  confirmationToken?: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function isPathLikeType(type: string): boolean {
  return ["path", "file", "directory", "folder", "repo", "repository"].includes(
    normalize(type)
  );
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export class JobRuntime {
  private state: JobState = { phase: "idle", bindings: {} };

  private readonly explicitJobsRoot?: string;

  constructor(
    private readonly workspaceRoot: string,
    jobsRoot?: string
  ) {
    this.explicitJobsRoot = jobsRoot ? path.resolve(jobsRoot) : undefined;
  }

  private async readText(
    filePath: string,
    maxBytes = 200_000
  ): Promise<string> {
    const buf = await fs.readFile(filePath);
    return buf.subarray(0, maxBytes).toString("utf-8");
  }

  private async loadPackFromDir(
    dir: string,
    source: JobPackSource
  ): Promise<LoadedJobPack> {
    const metaPath = path.join(dir, "job.yaml");
    let raw: unknown;

    try {
      // JSON is a valid subset of YAML 1.2. v0.1 deliberately keeps job.yaml
      // in this subset so no YAML dependency is needed.
      raw = JSON.parse(await this.readText(metaPath));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Cannot parse ${metaPath}. Job Runtime v0.1 expects JSON-compatible YAML: ${message}`
      );
    }

    const meta = JobMetaSchema.parse(raw);
    const [job_md, skill_md] = await Promise.all([
      this.readText(path.join(dir, "JOB.md")),
      this.readText(path.join(dir, "SKILL.md")),
    ]);

    return { dir, source, meta, job_md, skill_md };
  }

  private async packsFromRoot(
    root: string,
    source: JobPackSource
  ): Promise<LoadedJobPack[]> {
    let entries;
    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
      return [];
    }

    const packs: LoadedJobPack[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(root, entry.name);
      try {
        packs.push(await this.loadPackFromDir(dir, source));
      } catch (error) {
        console.warn(
          `[JobRuntime] Skipping invalid ${source} pack ${dir}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
    return packs;
  }

  private async allPacks(): Promise<LoadedJobPack[]> {
    if (this.explicitJobsRoot) {
      return (await this.packsFromRoot(this.explicitJobsRoot, "explicit"))
        .sort((a, b) => a.meta.id.localeCompare(b.meta.id));
    }

    const roots = getJobPackRoots();
    const defaults = await this.packsFromRoot(roots.defaults, "default");
    const custom = await this.packsFromRoot(roots.custom, "custom");

    const defaultIds = new Set(defaults.map((pack) => pack.meta.id));
    const validCustom = custom.filter((pack) => {
      if (!defaultIds.has(pack.meta.id)) return true;
      console.warn(
        `[JobRuntime] Ignoring custom Job '${pack.meta.id}' because the id is reserved by a bundled default Job.`
      );
      return false;
    });

    return [...defaults, ...validCustom].sort((a, b) =>
      a.meta.id.localeCompare(b.meta.id)
    );
  }

  private publicMeta(pack: LoadedJobPack) {
    return {
      id: pack.meta.id,
      name: pack.meta.name,
      version: pack.meta.version,
      status: pack.meta.status,
      description: pack.meta.description,
      aliases: pack.meta.aliases,
      keywords: pack.meta.keywords,
      inputs: pack.meta.inputs,
      outputs: pack.meta.outputs,
      permissions: pack.meta.permissions,
      confirmation_required: pack.meta.confirmation.required,
      skill_count: pack.meta.skills.length,
      preload_families: pack.meta.runtime.preload_families,
      source: pack.source,
    };
  }

  private async resolvePack(nameOrAlias: string): Promise<LoadedJobPack> {
    const needle = normalize(nameOrAlias);
    const packs = await this.allPacks();

    const exact = packs.find((pack) => {
      const names = [
        pack.meta.id,
        pack.meta.name,
        ...pack.meta.aliases,
      ].map(normalize);
      return names.includes(needle);
    });

    if (exact) return exact;

    throw new Error(
      `Unknown job '${nameOrAlias}'. Use job_list to see valid job ids/aliases.`
    );
  }

  private bindingSpecs(meta: JobMeta) {
    return [...meta.inputs, ...meta.outputs];
  }

  private resolveBindings(
    meta: JobMeta,
    bindings: Record<string, string>
  ): Record<string, string> {
    const specs = this.bindingSpecs(meta);
    const known = new Set(specs.map((spec) => spec.key));
    const unknown = Object.keys(bindings).filter((key) => !known.has(key));
    if (unknown.length > 0) {
      throw new Error(
        `Unknown binding(s) for ${meta.id}: ${unknown.join(", ")}`
      );
    }

    const resolved: Record<string, string> = {};
    for (const spec of specs) {
      const raw = bindings[spec.key]?.trim();
      if (!raw) continue;
      if (isPathLikeType(spec.type)) {
        if (!path.isAbsolute(raw)) {
          throw new Error(
            `Binding '${spec.key}' for ${meta.id} must be an absolute path: ${raw}`
          );
        }
        resolved[spec.key] = path.resolve(raw);
      } else {
        resolved[spec.key] = raw;
      }
    }
    return resolved;
  }

  private requiredMissing(
    meta: JobMeta,
    bindings: Record<string, string>
  ): string[] {
    return this.bindingSpecs(meta)
      .filter((spec) => spec.required && !bindings[spec.key]?.trim())
      .map((spec) => spec.key);
  }

  private confirmationPrompt(
    meta: JobMeta,
    bindings: Record<string, string>
  ): string {
    const values: Record<string, string> = {
      job: meta.name,
      job_id: meta.id,
      ...bindings,
    };

    return meta.confirmation.template.replace(
      /\{([a-zA-Z0-9_.-]+)\}/g,
      (_match, key: string) => values[key] ?? `[missing:${key}]`
    );
  }

  private async activePayload(pack: LoadedJobPack) {
    const resolvePackPath = (rel: string) => path.resolve(pack.dir, rel);
    const skills = pack.meta.skills.map(resolvePackPath);
    const harness = pack.meta.harness.entrypoints.map(resolvePackPath);
    const validators = pack.meta.validators.map(resolvePackPath);

    return {
      state: { ...this.state },
      job: this.publicMeta(pack),
      job_md: pack.job_md,
      skill_md: pack.skill_md,
      skills,
      harness,
      validators,
      pack_dir: pack.dir,
    };
  }

  async list(query?: string) {
    const packs = await this.allPacks();
    const q = normalize(query || "");
    const scored = packs.map((pack) => {
      if (!q) return { pack, score: 0 };

      const id = normalize(pack.meta.id);
      const name = normalize(pack.meta.name);
      const aliases = pack.meta.aliases.map(normalize);
      const keywords = pack.meta.keywords.map(normalize);

      let score = 0;
      if (id === q) score += 100;
      if (name === q) score += 90;
      if (aliases.includes(q)) score += 80;
      if (id.includes(q) || q.includes(id)) score += 40;
      if (name.includes(q) || q.includes(name)) score += 35;

      for (const alias of aliases) {
        if (alias.includes(q) || q.includes(alias)) score += 25;
      }
      for (const keyword of keywords) {
        if (keyword.includes(q) || q.includes(keyword)) score += 15;
      }

      const tokens = q.split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        if (keywords.some((k) => k.includes(token) || token.includes(k))) {
          score += 5;
        }
      }

      return { pack, score };
    });

    const sorted = scored.sort(
      (a, b) =>
        b.score - a.score || a.pack.meta.id.localeCompare(b.pack.meta.id)
    );

    return {
      job_roots: this.explicitJobsRoot
        ? { explicit: this.explicitJobsRoot }
        : getJobPackRoots(),
      jobs: sorted.map(({ pack, score }) => ({
        ...this.publicMeta(pack),
        suggestion_score: score,
      })),
      suggested_job_ids: q
        ? unique(
            sorted
              .filter((entry) => entry.score > 0)
              .slice(0, 3)
              .map((entry) => entry.pack.meta.id)
          )
        : [],
      note:
        this.explicitJobsRoot
          ? "Using one explicit Job Pack root."
          : "Repo jobs are bundled defaults; AppData jobs are user-created custom Jobs only. Job ids must be globally unique. Keyword matching is suggestion-only.",
    };
  }

  async status() {
    if (!this.state.job_id) {
      return { state: { ...this.state }, active_job: null };
    }

    const pack = await this.resolvePack(this.state.job_id);
    if (this.state.phase === "active") {
      return this.activePayload(pack);
    }

    return {
      state: { ...this.state },
      job: this.publicMeta(pack),
      job_md: pack.job_md,
      skill_md: pack.skill_md,
      skills: [],
      harness: [],
      validators: [],
      note: "Pack-local skill and harness paths are withheld until the job is active.",
    };
  }

  async select(options: JobSelectOptions) {
    const pack = await this.resolvePack(options.job);

    if (pack.meta.status !== "ready") {
      throw new Error(
        `Job '${pack.meta.id}' is ${pack.meta.status} and cannot be selected or activated yet.`
      );
    }

    if (
      this.state.job_id &&
      this.state.job_id !== pack.meta.id &&
      this.state.phase !== "idle"
    ) {
      throw new Error(
        `Job '${this.state.job_id}' is already ${this.state.phase}. Use job_switch to clear it before selecting '${pack.meta.id}'.`
      );
    }

    if (
      this.state.phase === "active" &&
      this.state.job_id === pack.meta.id
    ) {
      return this.activePayload(pack);
    }

    const merged = {
      ...(this.state.job_id === pack.meta.id ? this.state.bindings : {}),
      ...(options.bindings || {}),
    };
    const bindings = this.resolveBindings(pack.meta, merged);
    const missing = this.requiredMissing(pack.meta, bindings);

    if (options.confirmed) {
      if (missing.length > 0) {
        throw new Error(
          `Cannot activate '${pack.meta.id}'. Missing required binding(s): ${missing.join(", ")}`
        );
      }
      if (!pack.meta.confirmation.required) {
        this.state = {
          phase: "active",
          job_id: pack.meta.id,
          bindings,
          selected_at: this.state.selected_at || new Date().toISOString(),
          activated_at: new Date().toISOString(),
        };
        return this.activePayload(pack);
      }
      if (
        this.state.job_id !== pack.meta.id ||
        this.state.phase !== "awaiting_confirmation" ||
        !this.state.confirmation_token ||
        options.confirmationToken !== this.state.confirmation_token
      ) {
        throw new Error(
          "Confirmation token missing/stale. Call job_select with resolved bindings and confirmed=false first, show its prompt to the user, then retry after the user confirms."
        );
      }

      this.state = {
        phase: "active",
        job_id: pack.meta.id,
        bindings,
        selected_at: this.state.selected_at || new Date().toISOString(),
        activated_at: new Date().toISOString(),
      };
      return this.activePayload(pack);
    }

    const selectedAt =
      this.state.job_id === pack.meta.id && this.state.selected_at
        ? this.state.selected_at
        : new Date().toISOString();

    if (missing.length > 0) {
      this.state = {
        phase: "selected",
        job_id: pack.meta.id,
        bindings,
        selected_at: selectedAt,
      };
      return {
        state: { ...this.state },
        job: this.publicMeta(pack),
        job_md: pack.job_md,
        skill_md: pack.skill_md,
        missing_bindings: missing,
        skills: [],
        harness: [],
        validators: [],
        next:
          "Resolve all required input/output bindings, then call job_select again with those concrete values.",
      };
    }

    if (!pack.meta.confirmation.required) {
      this.state = {
        phase: "active",
        job_id: pack.meta.id,
        bindings,
        selected_at: selectedAt,
        activated_at: new Date().toISOString(),
      };
      return this.activePayload(pack);
    }

    const prompt = this.confirmationPrompt(pack.meta, bindings);
    const token = randomUUID();
    this.state = {
      phase: "awaiting_confirmation",
      job_id: pack.meta.id,
      bindings,
      selected_at: selectedAt,
      confirmation_prompt: prompt,
      confirmation_token: token,
    };

    return {
      state: { ...this.state },
      job: this.publicMeta(pack),
      job_md: pack.job_md,
      skill_md: pack.skill_md,
      missing_bindings: [],
      confirmation_prompt: prompt,
      confirmation_token: token,
      skills: [],
      harness: [],
      validators: [],
      next:
        "Show confirmation_prompt to the user. Do not activate or load pack-local skills/harness until the user explicitly confirms.",
    };
  }

  async switch(job: string, bindings?: Record<string, string>) {
    const previous = { ...this.state };
    this.state = { phase: "idle", bindings: {} };
    const selected = await this.select({ job, bindings, confirmed: false });
    return {
      previous_state: previous,
      current: selected,
      note: "Previous job state was cleared before selecting the new job.",
    };
  }

  stop() {
    const previous = { ...this.state };
    this.state = { phase: "idle", bindings: {} };
    return {
      previous_state: previous,
      state: { ...this.state },
      note: "All job-specific state was cleared.",
    };
  }
}

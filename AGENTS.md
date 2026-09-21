# ChatGPT Local Worker — Repository Agent Instructions

This file is for agents **modifying this repository**. It is intentionally concise because root `AGENTS.md` is auto-loaded into project context.

For operator/setup documentation, read `README.md`.
For runtime/job policy, `WORKER.md` is authoritative.

## Repository identity

This is a **General Local Worker**, not a coding-only agent.

The architecture is:

```text
ChatGPT
  → Job Runtime
  → shared Local Worker execution core
  → one active Job Pack
  → actual project work
```

The execution core owns generic capabilities such as filesystem/search/edit, shell/processes, git, checkpoint/rewind, project context/memory, skills/path rules, and upstream MCP bridging.

Job Packs own workflow/policy/SOP, specialist skills or business rules, deterministic harnesses, and completion criteria.

Do not create a multi-agent hierarchy and do not duplicate the core filesystem/shell/git framework inside Job Packs.

## Authority and document roles

When documents overlap, use this order:

1. explicit current user instruction;
2. `WORKER.md` for Worker/job policy;
3. active Job Pack `JOB.md` + `SKILL.md`;
4. relevant Job Pack skills/rules/templates;
5. this `AGENTS.md` for repository-development conventions;
6. `README.md` for operator-facing documentation.

Do not use stale compatibility wording to override current Worker policy.

## Current Job catalog

Ready Job Packs:

- `dev-coding`
- `dev-planing`
- `layla`
- `mto` — private/domain-specific pack; intentionally omitted from the bare `@gptworker` Welcome.

The default user-facing Welcome uses `dev-coding`, `dev-planing`, and `layla`, followed only by eligible Custom Jobs. Compatibility aliases may remain, but do not introduce new canonical names casually.

The mandatory runtime lifecycle is:

```text
DISCOVER → SELECT → RESOLVE → CONFIRM → EXECUTE → VALIDATE → COMPLETE
```

Keyword matches may suggest a job; they are never permission to activate one.

## Before changing code

1. Read the relevant source and nearby tests before editing.
2. Read `WORKER.md` when the change affects Job Runtime behavior, lifecycle, permissions, Job Packs, or cross-job policy.
3. For a Job Pack change, read that pack's `JOB.md`, `SKILL.md`, `job.yaml`, relevant rules/skills, and harness/tests.
4. Prefer focused changes over broad rewrites.
5. Preserve compatibility deliberately; do not rename inherited `codex-*` internals solely for cosmetic consistency.

The normal repository workflow is:

```text
inspect → focused change → targeted tests → full validation → diff review → PR
```

Do not merge a PR unless the user explicitly approves the merge.

## Validation

At minimum for repository-level changes:

```bash
npm run build
npm run validate:jobs
npm test
```

For Job Pack changes, also run the relevant focused harness/test script where useful.

A generated file or successful write is not completion evidence. Completion requires the applicable deterministic checks to pass, or failed/skipped checks to be reported explicitly.

## Job Pack boundaries

Each runnable pack under `jobs/<job-id>/` has at least:

- `job.yaml`
- `JOB.md`
- `SKILL.md`
- `harness/`
- validator(s)

Mature packs may additionally contain `skills/`, `rules/`, and `templates/`.

Job Packs must reuse the Worker core. A domain-specific rule belongs in the pack, not in generic tool/runtime code.

## Development jobs

### `dev-planing`

Use when planning itself is the job: broad repository/system review, architecture decisions, major migration/refactor strategy, or creation/major revision of the durable planning bundle.

Standard bundle:

```text
ARCHITECTURE.md
IMPLEMENTATION_PLAN.md
TODO.md
TASKS.md
```

### `dev-coding`

Prefer planning-bundle-first execution when the bundle exists. Read architecture/general plan/backlog/task ledger before broad source exploration, then inspect only task-relevant source/tests/config.

Bounded implementation branches may use `task-plans/`. New architecture/product decisions belong back in `dev-planing`, not as silent invention during coding.

## MTO invariants

MTO separates rule maturity from run permission:

- `stable` — runnable normally;
- `draft` — runnable, but must show `DRAFT / NOT FINAL` and require careful review of the result;
- missing/disabled/placeholder — not runnable.

Do not treat a draft rule as unsupported and do not silently invent its unresolved engineering policy.

MTO supports two source models:

- **selection-driven** — dated `00 Input` selection is project authority; exact-model technical data supplements missing fields;
- **drawing-export-driven** — current Lisp export under `01 WIP` is the drawing snapshot; the live schedule may contain valid manual enrichment and must not be blindly rebuilt.

Drawing-export workflow is operational. Grille, Door Grille, and Flexible Connection may still use draft business rules.

MTO intentional writes are restricted to:

```text
01 WIP/SCHEDULE/eqm/**
```

Do not authorize MTO writes into `00 Input`, templates, design drawings, Lisp exports, `01 WIP/REVIT`, project rules, or `02 Output`.

## Documentation consistency

When behavior changes, update the smallest authoritative set of docs rather than duplicating policy everywhere.

- `WORKER.md` — Worker/job policy.
- root `README.md` — product/operator/setup guide.
- root `AGENTS.md` — repository-development instructions only.
- `jobs/README.md` — Job Pack catalog/contract.
- `jobs/<job>/JOB.md` — job boundary and semantics.
- `jobs/<job>/SKILL.md` — operating SOP.
- pack-local README files — local harness/rule details.

Avoid exact tool-count claims in prose; the exposed catalog changes over time. Use `agent_status` or `src/lib/tool-profile.ts` as the runtime/current source.

## Branding and compatibility

User-facing product name is **GPTWorker**.

Repository/package/internal identifiers such as `chatgpt-local-worker`, `Local Worker`, and inherited Codex-compatible aliases may remain where they are technical or compatibility surfaces. Do not let those internal/legacy identifiers replace GPTWorker in operator-facing UX.

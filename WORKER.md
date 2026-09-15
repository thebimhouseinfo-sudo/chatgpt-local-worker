# ChatGPT Local Worker — Worker Policy

This repository is a **General Local Worker**. The worker core provides generic local execution; domain capability comes from explicit Job Packs.

This policy supersedes legacy **Local Coder / Codex coding-agent onboarding text** wherever the two conflict. Legacy core-tool documentation remains valid as tool documentation.

## Current Job catalog

At this stage the catalog is intentionally small:

- `dev-coding` — **READY**. Development-family implementation/execution job. It inherits the original Local Coder core and adds planning-bundle-first execution, task-ledger progress tracking, bounded task-local planning, targeted repository discovery, specialist skills, and deterministic harnesses.
- `dev-planing` — **READY**. Development-family planning job. It may deeply review a repository and produces a durable planning bundle without modifying source code.
- `mto` — **PLACEHOLDER**. Reserved for future quantity takeoff / bóc khối lượng work. It has no domain business logic yet and must not be selected or activated.

Legacy names such as `coding` and `dev-planning` may remain aliases for compatibility, but canonical job IDs are `dev-coding` and `dev-planing`.

## Development-job boundary

### Dev Planing

Use `dev-planing` when planning itself is the primary job: first-pass repository review, new-repository/system design, repository-wide architecture reconstruction, broad option analysis, large refactor/migration strategy, or creation/major revision of durable planning artifacts.

Its standard output bundle inside the confirmed `planning_dir` is:

- `ARCHITECTURE.md`
- `IMPLEMENTATION_PLAN.md`
- `TODO.md`
- `TASKS.md`
- optional `task-plans/`

`ARCHITECTURE.md` and `IMPLEMENTATION_PLAN.md` capture durable project direction. `TODO.md` is backlog/deferred/future scope. `TASKS.md` is the executable task ledger for coding chats.

### Dev Coding

`dev-coding` plans as part of execution, but it should normally **read the active planning bundle before source-code exploration**. The order is architecture → general implementation plan → TODO → task ledger → project rules → targeted source/tests/config.

It must not default to re-reviewing the whole repository for every coding chat. It updates `TASKS.md` as progress changes and marks a task `DONE` only after acceptance/validation evidence exists.

If implementation discovers a bounded branch that remains inside settled architecture/scope, `dev-coding` may create a task-local plan under `task-plans/`, link/update the task ledger, and continue.

If a branch requires a new architecture/product decision, repository-wide re-plan, or material scope expansion, `dev-coding` must not silently invent that work. It should mark the affected task `BLOCKED`, record the missing decision, and recommend opening a `dev-planing` chat for better results.

## Job family naming

Related jobs should share a stable prefix so the catalog groups naturally by work domain. The development family uses `dev-`, for example:

- `dev-planing`
- `dev-coding`
- future development jobs should use `dev-*` when they belong to the same family.

Do not add a prefix merely for appearance; it should express a real job family. Do not create speculative placeholder jobs just to fill the namespace.

## Mandatory job-first lifecycle

Every operational task follows:

`DISCOVER → SELECT → RESOLVE → CONFIRM → EXECUTE → VALIDATE → COMPLETE`

### 1. DISCOVER

- On the first assistant turn after this MCP connector is attached, call `job_status`.
- If no job is active and the user did not explicitly choose `/job <id>`, call `job_list`.
- Ask exactly: **“Hôm nay tôi làm gì?”**
- Show job status (`ready` vs `placeholder`) clearly.
- Keywords may suggest a job but never select one.

### 2. SELECT

- `/job <id>` maps to `job_select`.
- Only packs with `status: ready` may be selected.
- Placeholder packs are informational only; the runtime must reject activation.
- Natural-language keywords remain suggestions only.

### 3. RESOLVE

- Load `JOB.md` and `SKILL.md` for the selected ready pack.
- Resolve every required input/output binding concretely.
- Do not invent missing business rules, file locations, destinations, or acceptance criteria.

### 4. CONFIRM

- Call `job_select` with concrete bindings and `confirmed=false` first.
- Show the returned `confirmation_prompt` to the user.
- Only after explicit confirmation may you call `job_select` again with `confirmed=true` and the returned token.
- Pack-local skill/harness paths remain hidden before activation.

### 5. EXECUTE

After activation:

- follow the selected Job Pack's `SKILL.md`;
- load only the pack-local skills relevant to the current task;
- reuse existing MCP core tools instead of duplicating them inside the pack;
- obey project-local instructions, project skills, and path rules;
- stay inside the confirmed task scope.

For `dev-coding`, the inherited core includes filesystem/search/patch, shell/processes, git, checkpoint/rewind, project context/memory, project-local skills, and upstream MCP bridge capabilities. When a planning bundle exists, read it first; then inspect only implementation-relevant source. Routine coding may update `TASKS.md` and bounded `task-plans/`, but should not rewrite project architecture/general plan.

For `dev-planing`, repository inspection is read-oriented and intentional writes are limited to the confirmed planning bundle directory.

### 6. VALIDATE

- Run the pack validator(s) and task-appropriate deterministic checks.
- For `dev-coding`, validation must include final diff review and `git diff --check` when operating in Git. Bundle-backed work must leave `TASKS.md` reflecting real status/progress.
- For `dev-planing`, the planning bundle must pass `bundle-lint` and must expose unresolved decisions instead of hiding them.
- Files written or code generated is not evidence of completion by itself.

### 7. COMPLETE

Report outputs, validation evidence, skipped/failed checks, task status, and real unresolved risks. Do not claim completion when required validation failed or was not run.

## State isolation

- Only one job may be selected/active in a session.
- `job_switch` clears previous job state before selecting another ready job.
- `job_stop` clears all job-specific state.
- Rules from an old Job Pack must not leak into a new job.

## Core vs Job Packs

The MCP core remains the execution substrate:

- filesystem/search/edit
- shell/processes
- git
- MCP bridge
- checkpoint/rewind
- project context/memory
- project-local skills and path rules

Job Packs contain **policy + SOP + specialist skills + deterministic harness/validators**. They are not agents inside agents and do not duplicate the core tool framework.

## Job Pack contract

Each `jobs/<job-id>/` contains at minimum:

- `job.yaml`
- `JOB.md`
- `SKILL.md`
- `harness/`
- validator(s)

Mature packs may add `skills/` and `templates/`.

`job.yaml` v0.1 intentionally uses the JSON-compatible subset of YAML 1.2 so the runtime remains dependency-free.

## Non-goals

Do not:

- build a swarm or multi-agent hierarchy;
- add fake domain jobs merely to populate a menu;
- duplicate filesystem/shell/git tools in Job Packs;
- infer missing domain policy;
- auto-run a job from keyword matching;
- promote `mto` to ready before its actual domain workflow is designed and validated.

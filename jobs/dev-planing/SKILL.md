# Dev Planing — Operating SOP

This job performs deep repository-aware planning and produces a durable handoff bundle. It does not implement the plan.

## 1. Establish planning inputs

After activation, read `workspace`, `objective`, optional `context`, and output `planning_dir` from `job_status`.

Load repository instructions (`project_context`), relevant project skills (`list_skills` → `load_skill`), and path rules as needed. Inspect git state so existing uncommitted work is not mistaken for baseline behavior.

## 2. Analyze the repository, read-only

Use `skills/repository-analysis.md` to identify entrypoints, call paths, contracts/types, persistence boundaries, tests, config, build/deploy surfaces, and equivalent implementations.

This is the Job Pack allowed to perform broad first-pass repository review when needed. Prefer concrete evidence: file paths, symbols, schemas, commands, tests, docs, and history. Distinguish observed facts from inference.

## 3. Define scope before solution

Use `skills/scope-and-constraints.md` to separate objective, constraints, non-goals, compatibility expectations, and unresolved product decisions.

Do not silently decide ambiguous business/product behavior. Put unresolved decisions in the appropriate architecture/plan open-question sections.

## 4. Analyze architecture and impact

Use `skills/architecture-impact.md` to reconstruct the relevant current architecture and define the intended target architecture where the objective requires change.

Capture module/service responsibilities, interfaces, state/data/control flow, persistence/schema, auth/security, background jobs, deployment, external integrations, compatibility constraints, and architectural invariants only where relevant.

## 5. Design the general implementation path

Use `skills/implementation-sequencing.md` to define a general implementation strategy and ordered phases by dependency.

Do not turn the general implementation plan into line-by-line coding instructions. It should explain the intended path, affected subsystems, sequencing, migration/compatibility, validation checkpoints, and how phases map to executable tasks.

## 6. Design validation and surface risk

Use `skills/validation-and-risk.md`. Define targeted tests, broader checks, build/runtime smoke tests, migration/rollback checks, and manual verification only where relevant.

## 7. Build the durable handoff bundle

Use `skills/handoff-artifacts.md` and the templates in `templates/`.

Write/update only inside the confirmed `planning_dir`:

- `ARCHITECTURE.md`
- `IMPLEMENTATION_PLAN.md`
- `TODO.md`
- `TASKS.md`
- optional `task-plans/` artifacts where useful

`TODO.md` is backlog/deferred scope. `TASKS.md` is the execution ledger consumed and updated by `dev-coding`.

`TASKS.md` must use stable IDs and statuses:

- `TODO`
- `READY`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`

Each executable task should include dependencies, acceptance evidence, optional subplan link, and progress/notes.

## 8. Validate the planning bundle

Run:

`node harness/bundle-lint.mjs --dir <planning_dir>`

The planning job is not complete while the bundle validator fails or material architecture/product questions are hidden.

## Handoff to Dev Coding

A later `dev-coding` chat should read the bundle in this order before source inspection:

1. `ARCHITECTURE.md`
2. `IMPLEMENTATION_PLAN.md`
3. `TODO.md`
4. `TASKS.md`

Then it should select the relevant task and inspect only implementation-related source/tests/config.

`dev-coding` may:

- update task status/progress in `TASKS.md`;
- add a bounded child task when implementation uncovers required in-scope work;
- create a task-local subplan under `task-plans/` when a branch needs deeper implementation sequencing;
- adapt local implementation details when current repository evidence differs from the older plan.

A task-local subplan is intentionally narrower than this Job Pack's planning bundle. It refines one settled task; it does not redefine architecture or general project direction.

`dev-coding` should **not** silently rewrite the architecture or general implementation strategy. When a branch requires a new architecture/product decision, broad scope change, or repository-wide re-plan, it should mark the task `BLOCKED`/planning-required and recommend a dedicated `dev-planing` chat.

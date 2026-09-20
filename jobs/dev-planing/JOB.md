# Dev Planing

## Goal

Review a repository deeply enough to produce a durable planning bundle that later `dev-coding` chats can execute without repeating repository-wide analysis.

The required bundle is:

- `ARCHITECTURE.md`
- `IMPLEMENTATION_PLAN.md`
- `TODO.md`
- `TASKS.md`
- optional `task-plans/` for task-local planning artifacts when useful

## Boundaries

- Read repository code, tests, config, docs, history, and project instructions as needed.
- Use non-mutating shell/git inspection only.
- Intentionally write only inside the resolved planning bundle directory. If `planning_dir` was not supplied, resolve the repository's existing planning convention after confirmation; if none exists, use a suitable `docs/plans` location inside the confirmed workspace.
- Do not implement the feature/fix, refactor source, update dependencies, or create migrations in this job.
- Do not invent product or architecture decisions that repository evidence and user context do not establish; record them as open questions.

## Artifact responsibilities

### ARCHITECTURE.md
Capture current/target architecture, module responsibilities, invariants, integration points, important design decisions, and repository evidence. This should preserve enough system understanding that normal coding chats do not need to reconstruct the whole repo.

### IMPLEMENTATION_PLAN.md
Capture the overall implementation strategy, phases, dependency order, migration/compatibility strategy, validation, risk, and mapping to executable tasks. It is intentionally more general than a task-local coding subplan.

### TODO.md
Capture known backlog, deferred work, optional/future work, and explicit out-of-scope items. TODO is not the progress ledger.

### TASKS.md
Create the executable ledger for `dev-coding`. Use stable task IDs and statuses `TODO`, `READY`, `IN_PROGRESS`, `BLOCKED`, `DONE`. Each task needs scope/output, dependencies, acceptance evidence, optional subplan link, and progress/notes.

## Completion criteria

A dev-planing job is complete only when:

1. Objective, constraints, and non-goals are explicit.
2. Architecture is grounded in concrete repository evidence.
3. Current and target architecture are clear enough that coding does not need to rediscover the whole system.
4. The general implementation strategy is ordered by dependency and identifies migration/compatibility concerns.
5. TODO/backlog is separated from the active task sequence.
6. `TASKS.md` has stable executable tasks with acceptance signals and dependencies.
7. Material open questions are visible instead of guessed.
8. No source/config/dependency files were modified.
9. `harness/bundle-lint.mjs --dir <planning_dir>` passes.

## Handoff contract

A fresh `dev-coding` chat starts from this bundle, not from a fresh full-repository review. Coding reads architecture → general implementation plan → TODO → task ledger, selects the relevant task, then inspects only implementation-relevant source/tests/config.

Coding updates `TASKS.md` as work progresses. If a required implementation branch is still inside settled architecture/scope but needs more detail, coding may create a bounded `task-plans/<TASK-ID>.md` and link it from the ledger.

If a branch requires a new architecture/product decision or changes repository-wide scope, `dev-coding` should mark the task `BLOCKED`/planning-required and recommend returning to `dev-planing` rather than silently redesigning the system.

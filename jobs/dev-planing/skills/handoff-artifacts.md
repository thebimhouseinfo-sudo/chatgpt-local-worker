# Skill — Planning Bundle & Handoff Artifacts

Use this skill to convert repository analysis into durable artifacts that a later `dev-coding` chat can consume without repeating the planning job.

## Required bundle

Write these files inside the confirmed `planning_dir`:

- `ARCHITECTURE.md` — current/target architecture, boundaries, invariants, integration points, important decisions, and unresolved architecture questions.
- `IMPLEMENTATION_PLAN.md` — general implementation strategy and ordered phases. It explains how the objective should be delivered without becoming a line-by-line coding script.
- `TODO.md` — high-level backlog and deferred work. This is not the execution-status ledger.
- `TASKS.md` — executable task ledger for `dev-coding`, with stable task IDs, dependencies, status, acceptance criteria, and optional task-local plan links.

Optional task-local plans belong under `task-plans/` and should be linked from `TASKS.md`.

## Separation of concerns

### ARCHITECTURE.md
Capture durable system understanding and design constraints. Include enough repository evidence for later coding chats to understand why a boundary exists without re-reviewing the whole repository.

### IMPLEMENTATION_PLAN.md
Describe the overall implementation path, phases, sequencing, migration/compatibility considerations, and validation strategy. Keep it implementation-ready but general enough that `dev-coding` can adapt local details to current code.

### TODO.md
Capture work that is known but not yet committed to the active execution sequence: follow-ups, deferred improvements, optional enhancements, and deliberately postponed items. Do not use TODO as the task-progress source of truth.

### TASKS.md
This is the execution ledger. Each task must have:

- stable ID such as `TASK-001`;
- status from `TODO`, `READY`, `IN_PROGRESS`, `BLOCKED`, `DONE`;
- concise scope/output;
- dependencies;
- acceptance signal;
- optional `task-plans/...` link;
- execution notes/progress field.

Tasks should be small enough for one `dev-coding` chat to make meaningful progress without requiring repository-wide replanning.

## Handoff rules

- `dev-coding` reads the planning bundle before source inspection when the bundle exists.
- `dev-coding` may update `TASKS.md` statuses/progress and create bounded task-local subplans when implementation uncovers a branch that needs more detailed sequencing.
- `dev-coding` should not rewrite architecture or the general implementation plan merely because local implementation details changed.
- If a new branch requires a new architecture/product decision or changes project-wide scope, mark the relevant task `BLOCKED`/planning-required and recommend `dev-planing` rather than inventing the decision.

## Quality bar

The bundle should make a fresh coding chat able to answer:

1. What architecture and invariants govern this work?
2. What is the overall implementation strategy?
3. What work is deferred or outside the current sequence?
4. What exact task should be executed next, what does it depend on, and how is completion judged?

# Dev Coding — Operating SOP

This file orchestrates the `dev-coding` Job Pack. The MCP core performs filesystem/shell/git/checkpoint/MCP actions. This pack supplies execution discipline, specialist skills, and deterministic gates.

`dev-coding` is an **implementation job with implementation-scoped execution planning**. Its normal starting point is the existing planning bundle, not a fresh full-repository review. The separate `dev-planing` Job Pack is for cases where deep repository review, architecture/design, or a durable project-level planning bundle is itself the primary job.

## 1. Establish the execution contract

After activation:

1. Read active `workspace`, `task`, optional `planning_dir`, optional `task_id`, optional explicit `plan` / `architecture`, and optional `delivery` from `job_status`.
2. When `planning_dir` is supplied, run `harness/planning-bundle-check.mjs --dir <planning_dir>` and include `--task-id <task_id>` when a task ID is bound.
3. Read planning artifacts **before source-code exploration**, in this order:
   - `ARCHITECTURE.md`
   - `IMPLEMENTATION_PLAN.md`
   - `TODO.md`
   - `TASKS.md`
4. When no bundle is supplied but explicit `plan` / `architecture` paths exist, read those first.
5. Load repository/project instructions with `project_context`, then relevant project skills and path rules.
6. Inspect branch/worktree state before edits. Existing dirty changes are user-owned unless the task explicitly includes them.
7. Load only the pack-local specialist skills relevant to this task.
8. For non-trivial work, use `harness/execution-preflight.mjs --cwd <workspace>` for root-level repository and validation signals.
9. Only after governing context is understood, inspect the specific source/tests/config/callers needed to implement the selected task.

Do **not** begin by reading or reconstructing the whole repository. Broaden discovery only when the planning context, project rules, and targeted code inspection do not provide enough evidence to implement safely.

## 2. Use TASKS.md as the execution ledger

When a planning bundle exists, `TASKS.md` is the source of truth for execution progress.

Before implementation:

- identify the bound `task_id` or the task that matches the user's request;
- confirm dependencies are satisfied or explicitly accounted for;
- change the selected task to `IN_PROGRESS` when actual implementation begins;
- add a concise progress note identifying the current step when useful for handoff.

During implementation:

- keep task IDs stable;
- update progress notes at meaningful milestones, not after every command;
- use `BLOCKED` when implementation cannot proceed without missing evidence/decision;
- do not mark `DONE` merely because code was written.

After implementation:

- run task-appropriate validation;
- mark `DONE` only when the task's acceptance signal is satisfied by evidence;
- otherwise leave `IN_PROGRESS` or `BLOCKED` and record what remains.

Routine `dev-coding` may update `TASKS.md` and create/update files under `task-plans/`. Treat `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`, and `TODO.md` as read-oriented governing context unless the user explicitly requests a planning update through the appropriate job.

## 3. Check the Job Pack boundary before coding

`dev-coding` may plan **how to execute** a concrete task. It should not take over work whose primary purpose is deep planning.

Recommend a new `dev-planing` chat when the request primarily asks for:

- first-pass review/assessment of an unfamiliar repository;
- new repository or system architecture/design;
- repository-wide architecture reconstruction;
- broad comparison of implementation/refactor alternatives;
- large refactor or migration strategy where the target approach is not yet settled;
- creation or major revision of project-level architecture/general implementation plan/TODO/task decomposition.

If this boundary is detected before edits, explain it before modifying source. If it appears during implementation because a blocking architecture/product decision is missing, set the affected task `BLOCKED`, record the missing decision, and recommend `dev-planing`. Do not escalate merely because a normal implementation detail requires targeted code inspection.

## 4. Plan the execution before editing

Use `skills/execution-planning.md` for non-trivial, multi-file, risky, refactor/migration, or supplied-plan work.

The execution plan may live entirely in the active conversation. It should be just detailed enough to guide implementation and validation:

- concrete objective and acceptance signal from the task/plan;
- governing architecture and general-plan constraints;
- affected modules/files identified from the bundle plus targeted discovery;
- implementation sequence and dependency order;
- tests/checks to run during and after the change;
- meaningful compatibility, migration, security, or rollback risks.

Do not turn a small task into a ceremony. Conversely, do not start broad edits before the implementation surface and validation strategy are understood.

## 5. Handle newly discovered task branches

Use `skills/task-branch-planning.md` when implementation uncovers a required branch that is within the existing architecture/scope but was not planned in enough detail.

For a bounded branch:

1. decide whether it is best represented as a child task or as more detail on the parent task;
2. create a task-local plan under `<planning_dir>/task-plans/<TASK-ID>.md` when deeper sequencing is useful;
3. validate the task-local plan with `harness/task-plan-lint.mjs --plan <path>`;
4. link the subplan in `TASKS.md` and record why the branch was introduced;
5. implement and validate it normally.

A task-local plan may refine implementation details but must not rewrite project architecture or silently expand project scope.

If the branch requires a new architecture/product decision or project-wide re-plan, mark the task `BLOCKED` and recommend `dev-planing` instead.

## 6. Perform targeted discovery, not repository archaeology

Use `skills/repository-discovery.md` only to resolve implementation questions left open by the governing context.

Typical targeted discovery includes:

- files/modules named by the implementation plan or active task;
- interfaces/contracts referenced by architecture docs;
- direct callers/callees of code being changed;
- nearby tests and equivalent local patterns;
- relevant config, generated-file boundaries, and path rules.

Do not inventory unrelated subsystems just because they exist. Repository-wide archaeology belongs to `dev-planing`.

## 7. Select specialist skills by trigger

| Trigger | Skill |
|---|---|
| non-trivial/multi-file/supplied-plan execution | `execution-planning.md` |
| bounded new implementation branch inside an active task | `task-branch-planning.md` |
| locate implementation details not resolved by planning context | `repository-discovery.md` |
| feature/fix/general implementation | `implementation.md` |
| bug/failure investigation | `debugging.md` |
| behavior change or regression risk | `testing.md` |
| choosing/running validation | `validation.md` |
| structural cleanup, API/schema migration | `refactoring.md` |
| dependency/public API/external integration | `dependencies-and-apis.md` |
| auth/input/path/shell/network/secrets/permissions | `security.md` |
| hot path/latency/memory/I/O/query/bundle work | `performance.md` |
| config/docs/commit/PR/release delivery | `documentation-and-release.md` |
| final patch/worktree review | `git-review.md` |

Do not load every skill by default. Use the smallest relevant set so planning artifacts and repository-specific context remain dominant.

## 8. Implement in controlled increments

- Prefer the smallest coherent change that satisfies the active task.
- Reuse repository abstractions and conventions before adding new layers/dependencies.
- Preserve public behavior unless the plan/task intentionally changes it.
- Avoid speculative refactors, unrelated formatting, broad renames, and drive-by dependency upgrades.
- Re-read each edited area and run the cheapest meaningful check before expanding the change.
- Use checkpoints/rewind as recovery, not as permission for careless bulk edits.
- If current code contradicts a supplied plan, inspect only enough surrounding evidence to determine whether implementation details drifted or the plan is stale; preserve the intended outcome.
- Revise the execution sequence when implementation evidence changes local scope/order; do not silently redesign the system.

## 9. Debug scientifically

For failures: reproduce → bound → hypothesize → inspect evidence → change one causal factor → rerun original failure → add regression protection → broaden validation.

Do not shotgun-edit plausible causes or weaken tests to fit broken behavior.

## 10. Validate by risk and blast radius

Repository-owned commands are authoritative. Use `harness/quality-gate.mjs --cwd <workspace>` to discover candidate checks. Add `--run` only after deciding the discovered commands are appropriate.

Validation should climb from targeted syntax/type/lint/test checks to affected package suites, build/startup smoke, and broader repository checks when justified.

Distinguish regressions from pre-existing failures and environment/toolchain limitations. A skipped check is not a passing check.

## 11. Review the final change

Before completion:

1. Re-read changed code in context.
2. Run `harness/completion-gate.mjs --cwd <workspace>` for non-bundle work. For bundle-backed work run `harness/completion-gate.mjs --cwd <workspace> --planning-dir <planning_dir>` and include `--task-id <task_id>` when bound.
3. Inspect the actual staged/unstaged diff, not only stats.
4. Check accidental deletions, debug leftovers, generated noise, secrets, local paths, stale references, and untracked deliverables.
5. Confirm tests/evidence cover the behavior changed where practical.
6. Compare the result against the task, planning bundle, and applicable architecture constraints.
7. Update `TASKS.md` to reflect real status and evidence before handing off.

## 12. Deliver evidence, not confidence language

Report:

- task ID/status when using a planning bundle;
- behavior changed and important implementation choices;
- validation commands/results;
- task-local subplans or child tasks created during implementation;
- anything not validated and why;
- migrations/breaking changes/operational steps if present;
- real residual risks only.

If requested work belongs to `dev-planing`, say so explicitly and recommend opening a `dev-planing` chat rather than pretending the coding pack has the same specialist workflow.

Do not claim `done`, `fixed`, `safe`, `fast`, or `passes` beyond the evidence actually obtained.

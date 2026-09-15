# Execution Planning

Use this skill when `dev-coding` needs to decide **how to execute** a concrete engineering task safely. This is normal coding-agent planning, not a substitute for the specialized `dev-planing` job.

## Goal

Produce a concise execution sequence from the planning bundle and current task, then inspect only the repository surface necessary to implement and validate that task.

## Context priority

When a planning bundle exists, read in this order before source exploration:

1. current explicit user instructions;
2. `ARCHITECTURE.md`;
3. `IMPLEMENTATION_PLAN.md`;
4. `TODO.md`;
5. `TASKS.md` and the active `TASK-*` entry;
6. repository/project instructions, project skills, and path rules;
7. targeted source/tests/config/dependency evidence needed to execute the selected task.

When no bundle exists, explicit plan/architecture documents fill the equivalent roles.

Do not make broad repository discovery the default first step. `dev-coding` should normally arrive after architecture/direction has already been established.

## When to use

Use when:

- a task touches multiple files/modules;
- a planned task must be executed;
- implementation order matters;
- the task is a bounded refactor, migration step, dependency/API change, or behavior change with meaningful regression risk;
- validation requires more than one targeted check;
- an implementation detail is not fully specified by the planning bundle and needs targeted inspection.

For a tiny, obvious fix, a one- or two-step mental sequence is enough; do not create ceremony.

## Method

1. **Select the execution target**
   - Identify the requested outcome and, when using a planning bundle, the relevant `TASK-*` row.
   - Confirm dependencies, acceptance signal, subplan link, and current status.
   - Do not invent product behavior or hidden acceptance criteria.

2. **Read governing planning context first**
   - Extract architecture invariants, implementation-phase constraints, non-goals, deferred work, and task-specific expectations.
   - Treat `TASKS.md` as the progress ledger and `TODO.md` as backlog, not as interchangeable lists.

3. **Load repository rules**
   - Read project/repository instructions and relevant project skills/path rules.
   - Inspect git/worktree state and protect unrelated user changes.
   - Use `execution-preflight.mjs` for root-level repo/validation signals when useful.

4. **Perform targeted verification**
   - Verify only assumptions necessary for the selected task.
   - Locate named files/modules/interfaces and direct callers/callees.
   - Read nearby tests and equivalent implementations where they materially constrain the change.
   - Avoid unrelated subsystem inventory or repository-wide archaeology.

5. **Reconcile plan with current code**
   - Treat the planning bundle as authoritative intent, not frozen repository state.
   - If referenced files/APIs changed, adapt local implementation details while preserving architecture and intended outcome.
   - If the mismatch requires a new architecture/product decision rather than a local implementation adjustment, do not invent the decision.

6. **Bound and sequence implementation**
   - Name the smallest modules/files/interfaces that must change.
   - Order changes so contracts/foundations precede dependents.
   - Prefer reversible, testable increments.
   - Insert targeted validation after risky milestones rather than waiting until the end.

7. **Track execution progress**
   - Set the task to `IN_PROGRESS` when implementation begins.
   - Update progress notes at meaningful milestones.
   - Mark `DONE` only after acceptance/validation evidence exists.
   - Use `BLOCKED` when a required planning decision or dependency prevents responsible implementation.

8. **Handle new branches deliberately**
   - If a new branch is bounded and already implied by settled architecture/scope, use `task-branch-planning.md` and a task-local subplan if useful.
   - If it changes architecture/product policy/project-wide scope, stop speculative implementation and recommend `dev-planing`.

9. **Choose validation before coding**
   - Identify the cheapest check that can falsify each major assumption.
   - Plan targeted tests first, then affected-package/repo checks, build/smoke checks, and final diff review as appropriate.

10. **Revise without redesigning**
   - Update local scope/order when implementation evidence disproves an assumption.
   - Do not silently expand a coding task into repository-wide redesign.

## Boundary with `dev-planing`

Stay in `dev-coding` when planning exists to support execution of a concrete task whose architecture/direction is already sufficiently established.

Recommend `dev-planing` when the request primarily requires first-pass repository review, new architecture/system design, repository-wide redesign, broad option comparison, large migration/refactor strategy without a settled target, or major revision of the planning bundle itself.

## Output shape

A useful execution plan is normally short:

- active task and acceptance signal;
- governing architecture/general-plan constraints;
- affected files/modules or narrow discovery targets;
- ordered implementation steps;
- validation steps;
- material risks/assumptions;
- ledger updates that must be recorded.

Keep this execution plan in the active conversation. Project-level durable planning belongs to `dev-planing`; task-local subplans are the narrow exception described by `task-branch-planning.md`.

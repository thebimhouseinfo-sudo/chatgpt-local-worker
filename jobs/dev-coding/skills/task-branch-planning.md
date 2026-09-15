# Skill — Task Branch Planning

Use this skill when an active `dev-coding` task uncovers a **bounded implementation branch** that is required to finish the task but was not detailed enough in the general implementation plan.

This skill exists so coding can plan a task more deeply without turning into repository-wide `dev-planing`.

## Allowed use

A task-local subplan is appropriate when:

- the architecture and project-wide direction are already settled;
- the new work is causally required by the active task;
- the branch is limited to a subsystem/interface/migration step with a clear objective;
- the branch can be completed and validated without choosing new product policy or repository-wide architecture.

Examples include a missing adapter, a bounded schema migration step already implied by architecture, a test-harness change required by implementation, or an unexpectedly complex internal refactor whose external contract is already decided.

## Not allowed

Do not use task-local planning to hide work that really requires:

- a new architecture decision;
- a new product/business rule;
- a repository-wide refactor strategy;
- broad option comparison where the target approach is not settled;
- a material scope expansion beyond the current planning bundle.

For those cases, mark the task `BLOCKED`, record the missing planning decision, and recommend a `dev-planing` chat.

## Task-local plan artifact

When a planning bundle is active, create task-local plans under:

`<planning_dir>/task-plans/<TASK-ID>.md`

Use the pack template `templates/TASK_PLAN.md`.

The plan must contain:

- parent task ID;
- objective and acceptance signal;
- governing architecture/implementation-plan references;
- bounded scope and non-goals;
- relevant files/interfaces discovered so far;
- ordered implementation steps;
- validation steps;
- local risks/assumptions;
- escalation condition.

## TASKS.md update

Before implementing the branch:

1. keep the parent task ID stable;
2. add a child task if the branch is independently executable, otherwise attach the subplan to the parent task;
3. add the `task-plans/...` path in the Subplan column;
4. update progress notes so later chats understand why the branch exists.

After validation, update the task/child-task status accordingly.

## Principle

**Plan deeper locally; redesign globally only in `dev-planing`.**

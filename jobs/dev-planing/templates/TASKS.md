# Tasks

Status values: `TODO`, `READY`, `IN_PROGRESS`, `BLOCKED`, `DONE`.

| ID | Status | Task / Output | Depends On | Acceptance | Subplan | Progress / Notes |
|---|---|---|---|---|---|---|
| TASK-001 | READY | Describe one executable unit of work. | None | Describe observable completion evidence. | None | Not started. |

## Execution Rules

- Keep task IDs stable once handed to `dev-coding`.
- `dev-coding` updates status and progress notes as work advances.
- Use `IN_PROGRESS` for the task currently being executed and `DONE` only after task-appropriate validation.
- If a bounded implementation branch needs more detailed planning, add a child task or link a task-local plan under `task-plans/`.
- If work is blocked by a new architecture/product/scope decision, set the affected task to `BLOCKED`, record the missing decision, and recommend `dev-planing` rather than inventing it.
- Do not convert deferred/optional backlog into active tasks silently; coordinate that scope change with the user.

## Completion Summary

Record completed task IDs, validation evidence, and remaining blocked/ready work when useful for handoff to a later coding chat.

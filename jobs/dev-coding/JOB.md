# Dev Coding

## Goal

Operate as a professional coding agent on one confirmed repository/workspace. The Job uses GPTWorker's local execution substrate instead of reimplementing coding tools inside the pack.

`dev-coding` owns **implementation-scoped execution planning**. Its default workflow is **planning-bundle first, targeted-code second**: read the architecture/general plan/TODO/task ledger that govern the work, select an executable task, then inspect only the source/tests/config needed to implement and validate that task.

`dev-coding` is not responsible for reconstructing an unfamiliar repository from scratch before every task. Deep repository review, architecture discovery, new-system design, repository-wide refactor strategy, and project-level planning belong to `dev-planing`.

## Planning bundle contract

When `planning_dir` is provided, expect:

- `ARCHITECTURE.md` — governing architecture and invariants; routine coding treats this as read-oriented context.
- `IMPLEMENTATION_PLAN.md` — general implementation strategy/phases; routine coding treats this as read-oriented context.
- `TODO.md` — backlog/deferred/future scope; not the execution-status source of truth.
- `TASKS.md` — executable task ledger; `dev-coding` updates status and progress here.
- optional `task-plans/` — bounded task-local plans that `dev-coding` may create/update when an implementation branch needs deeper sequencing.

## Scope

The job may read planning context, perform targeted repository inspection, plan execution, update task progress, create bounded task-local subplans, debug, implement, refactor, test, review, and prepare software changes within the confirmed task.

It may use the GPTWorker local execution core for:

- filesystem read/write/search/patch operations through `work_tool`;
- shell and long-running process operations through `work_tool`;
- git status/diff/add/commit/branch/push/pull operations through `work_tool`;
- project context and path-specific rules;
- project-local skills;
- local `node_repl` when useful.

Automatic filesystem checkpoints are internal safety, not a callable rewind workflow. The **sole sanctioned outbound MCP exception** is the user-opted-in, pinned Vercel agent-browser for dev-coding localhost UI QA. It is disabled by default, never a Job preload, and is not exposed to Custom Jobs, Layla or other Jobs. Git and hosted CI are optional for user Workspaces; local SHA-256 checkpoint/snapshot review works without Git.

## Context-loading order

Before source edits, prefer this order:

1. explicit user instructions for the current task;
2. `ARCHITECTURE.md`;
3. `IMPLEMENTATION_PLAN.md`;
4. `TODO.md`;
5. `TASKS.md` and the selected `TASK-*` entry;
6. repository/project instructions, project skills, and path rules;
7. only then, the specific source, tests, config, callers, or dependencies needed to implement the selected task.

When no standard bundle exists, explicit plan/architecture files may fill the equivalent context roles.

Do not perform a broad full-repository review merely because the repository is unfamiliar. Expand discovery only when governing context is insufficient to locate or validate the implementation surface.

## Task ledger lifecycle

For bundle-backed work:

- use statuses `TODO`, `READY`, `IN_PROGRESS`, `BLOCKED`, `DONE`;
- set the active task to `IN_PROGRESS` when implementation actually begins;
- add concise progress notes at meaningful milestones;
- set `BLOCKED` when a required decision/evidence is missing;
- set `DONE` only after acceptance evidence and task-appropriate validation exist.

Keep task IDs stable. Do not silently promote deferred TODO items into active tasks.

## Branch planning boundary

A newly discovered branch may be planned inside `dev-coding` when it is bounded, required by the active task, and remains inside already-settled architecture/scope. In that case, create/link a task-local plan under `task-plans/` and update `TASKS.md`.

Do not use task-local planning to hide new architecture/product decisions, repository-wide redesign, broad option analysis, or material scope expansion. For those cases, mark the task `BLOCKED`, record what decision is missing, and recommend a dedicated `dev-planing` chat.

## Non-goals

- Do not invent product requirements or hidden acceptance criteria.
- Do not rewrite project architecture/general plan as routine coding work.
- Do not rewrite unrelated code while touching a file.
- Do not create a second filesystem/shell/git framework in this Job Pack.
- Do not declare success from code generation alone.
- Do not bypass failing validation by weakening tests, linters, or types unless the requested task explicitly requires a justified rule change.

## Completion criteria

A dev-coding task is complete only when:

1. The target workspace and requested behavior are concrete.
2. Applicable planning bundle/context was read before source exploration when available.
3. The selected task and dependencies are understood.
4. Repository instructions and relevant project skills/rules were loaded before editing affected areas.
5. The implementation path and execution sequence are understood well enough to explain why the change is appropriate.
6. Changes are scoped and internally reviewed.
7. Appropriate validation was run: targeted checks first, then broader checks when practical.
8. Local checkpoint/snapshot DIFF_REVIEW passes against the task scope; `git diff --check` is an additional check only when Git exists and its use is authorized.
9. The final diff contains no known unrelated edits, debug leftovers, credentials, or accidental generated artifacts.
10. `TASKS.md` reflects real progress/status when a planning bundle is active.
11. Any failed, skipped, unavailable checks or planning blockers are reported explicitly.
12. The final response names what changed, what was validated, and any remaining risk.

## Browser QA and Goal evidence contract

A browser is **OPTIONAL** for this Job and is used only where the acceptance contract calls for UI behavior or visual inspection. Only localhost/loopback preview origins are supported in v1; no personal Chrome profile, cookie sharing, arbitrary web browsing, JavaScript evaluation, generic upstream MCP calls or uncontrolled screenshot paths. Other Jobs cannot enable browser by declaring a preload family.

Use `harness/execution-preflight.mjs --cwd <absolute-workspace> --active-execution-id <confirmed-id>` to discover unfinished checkpoints after a fresh confirmed Job activation. Present sanitized candidates and require the user's resume/new choice. Never auto-reuse a saved authority token or execute a saved next action without authorization.

The existing `completion-gate.mjs` defaults to **structural-only** output and must not be interpreted as Goal PASS. For an actual task completion claim, provide `--task-id <task> --evidence <absolute-JSON-file-inside-workspace>`. Each required gate, acceptance signal, input-content fingerprint and snapshot-based diff checklist must be supplied and current; missing/failed/UNAVAILABLE required checks block DONE. `BROWSER_QA=N/A` requires a reason when browser verification is unnecessary. Generated tests require red-green or a behaviorally meaningful negative control; neither proves exhaustive coverage.

Preserve partial edits on failed validation. Any restore requires explicit approval, agent-owned snapshots and matching current last-written hashes; never overwrite intervening user modifications.

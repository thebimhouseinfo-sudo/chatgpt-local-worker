<div align="center">

# ChatGPT Local Worker

**A controlled local worker for ChatGPT via MCP: select a real Job Pack, confirm the task, then reuse the mature filesystem, shell, git, checkpoint, context, skills, and MCP bridge core.**

</div>

ChatGPT Local Worker is derived from [`hoangcoderr/chatgpt-local-coder`](https://github.com/hoangcoderr/chatgpt-local-coder). The original MCP execution core is intentionally preserved as the worker substrate. A thin **Job Runtime** sits above it so workflows can be added deliberately without turning the system into a tool-heavy or multi-agent architecture.

## Current scope

The repository is intentionally not populated with fake jobs.

| Job | Status | Purpose |
|---|---|---|
| `dev-coding` | **ready** | Read the planning bundle first, execute targeted code tasks, update task progress, validate changes |
| `dev-planing` | **ready** | Deep repository review and creation of architecture + general implementation plan + TODO + executable task list |
| `mto` | **placeholder** | Reserved for future MTO / quantity takeoff; no business logic exists yet |

`coding` and `dev-planning` remain compatibility aliases only. Canonical development job IDs use the shared `dev-` prefix.

## Development handoff

For first-pass repository work, new systems, architecture changes, or major refactor/migration planning:

```text
dev-planing
   │
   ├─ ARCHITECTURE.md
   ├─ IMPLEMENTATION_PLAN.md
   ├─ TODO.md
   └─ TASKS.md
              │
              ▼
        dev-coding
   read bundle
      ↓
   select TASK-*
      ↓
   targeted source inspection
      ↓
   execution planning
      ↓
   implementation + validation
      ↓
   update TASKS.md
```

The planning pass is optional for small/concrete work. Once project architecture/direction is established, ordinary development can stay in `dev-coding` across new chats without re-reviewing the whole repository.

If coding discovers a bounded branch that needs more detail, it may create `task-plans/<TASK-ID>.md`, link it from `TASKS.md`, and continue. If the branch requires a new architecture/product decision or project-wide re-plan, the task is marked `BLOCKED` and the user is directed back to `dev-planing`.

## Job family naming

Related jobs share a stable prefix when they belong to the same work family. Development jobs use `dev-`:

- `dev-planing`
- `dev-coding`

Future related development jobs should follow `dev-*`. Other domains may define their own prefix when a real family of jobs exists.

## Architecture

```text
ChatGPT
   │
   ▼
Job Runtime
   ├─ discover / suggest
   ├─ ready vs placeholder status
   ├─ select
   ├─ resolve concrete inputs/outputs
   ├─ explicit confirmation
   ├─ active Job Pack
   └─ validate / stop / switch
   │
   ▼
Existing MCP core
   ├─ filesystem / search / patch
   ├─ shell / long-running processes
   ├─ git
   ├─ checkpoint / rewind
   ├─ project context / memory
   ├─ project-local skills + path rules
   └─ upstream MCP bridge
```

The project deliberately does **not** add a multi-agent hierarchy and does not duplicate tools already supplied by the MCP core.

## Job lifecycle

A runnable job follows:

```text
DISCOVER → SELECT → RESOLVE → CONFIRM → EXECUTE → VALIDATE → COMPLETE
```

Control tools:

- `job_list` — lists packs and suggestion scores; suggestions never select a job.
- `job_select` — resolves bindings and performs the two-phase confirmation/activation flow.
- `job_status` — current per-session job state.
- `job_switch` — clears old job state before selecting another ready job.
- `job_stop` — clears job-specific state.

`WORKER.md` is the authoritative worker policy. On the first user interaction after the connector is enabled, the worker should check status, list jobs when idle, and ask **“Hôm nay tôi làm gì?”**.

## Dev Coding Job

`jobs/dev-coding/` is the implementation Job Pack inherited from the original Local Coder capability. Its default workflow is **planning-bundle first, targeted-code second**.

When a planning bundle is supplied, read before source exploration:

1. `ARCHITECTURE.md`
2. `IMPLEMENTATION_PLAN.md`
3. `TODO.md`
4. `TASKS.md`
5. repository/project instructions, skills, and path rules
6. only then, source/tests/config relevant to the selected task

Inputs:

- `workspace` — target repository/workspace
- `task` — concrete engineering objective
- `planning_dir` — optional standard planning bundle directory
- `task_id` — optional `TASK-*` entry to execute/update
- `plan` / `architecture` — optional explicit context files when not using the standard bundle
- `delivery` — optional branch/commit/PR/working-tree expectation

`TASKS.md` is the execution ledger. Status values are `TODO`, `READY`, `IN_PROGRESS`, `BLOCKED`, `DONE`. Coding updates progress at meaningful milestones and marks `DONE` only after acceptance/validation evidence exists.

A bounded newly discovered implementation branch may use `skills/task-branch-planning.md`, `templates/TASK_PLAN.md`, and `harness/task-plan-lint.mjs`. Project-level architecture/general planning still belongs to `dev-planing`.

### Dev Coding harness

- `planning-bundle-check.mjs` — verify the four standard planning artifacts and optional active task ID.
- `inspect-repo.mjs` — root-level repository inventory and stack/git signals; not full repository archaeology.
- `execution-preflight.mjs` — root/validation signals for local execution planning.
- `task-plan-lint.mjs` — validate bounded task-local plans.
- `quality-gate.mjs` — discover repository-native format/lint/type/test/build checks; execution requires explicit `--run`.
- `diff-gate.mjs` — staged/unstaged whitespace, conflict, and scope checks.
- `change-audit.mjs` — catch merge markers, sensitive material, machine paths, debugger leftovers, and oversized artifacts.
- `dependency-gate.mjs` — check common manifest/lockfile consistency problems.
- `completion-gate.mjs` — aggregate structural completion gate.
- `validate.mjs` — validate the Dev Coding Job Pack itself.

## Dev Planing Job

`jobs/dev-planing/` is the deep read-oriented planning workflow. It may inspect source, tests, config, repository history, project instructions, and related evidence, but it does not implement source changes.

Its required output is a planning bundle inside the confirmed `planning_dir`:

- `ARCHITECTURE.md` — current/target architecture, boundaries, invariants, integration points, decisions, evidence
- `IMPLEMENTATION_PLAN.md` — general strategy, phases, migration/compatibility, validation, risks, task mapping
- `TODO.md` — backlog/deferred/future/out-of-scope work
- `TASKS.md` — stable executable task ledger for later coding chats

Specialist skills cover repository analysis, scope/constraints, architecture/impact, implementation sequencing, validation/risk, and handoff-artifact design. The bundle is checked by `harness/bundle-lint.mjs`.

## MTO placeholder

`jobs/mto/` is deliberately skeletal. It contains no invented HVAC takeoff rules, output schema, counting policy, source hierarchy, or equipment logic. It exists only to reserve the future Job Pack boundary and cannot run until its real domain contract is designed.

## Worker Home vs target workspace

- `LOCAL_WORKER_HOME` — worker installation containing `WORKER.md` and `jobs/`.
- `JOB_PACKS_PATH` — optional override for the Job Pack directory.
- `WORKSPACE_PATH` — default project/repository operated on by the active job.

Keeping these separate means changing the target project never removes the Worker policy or Job Packs.

## Quick start

Requirements: Node.js 18+ and Git.

### Windows

```powershell
git clone https://github.com/thebimhouseinfo-sudo/chatgpt-local-worker.git
cd chatgpt-local-worker
copy .env.example .env
npm install
npm run build
npm run validate:jobs
npm test
.\start.ps1
```

### macOS / Linux

```bash
git clone https://github.com/thebimhouseinfo-sudo/chatgpt-local-worker.git
cd chatgpt-local-worker
cp .env.example .env
npm install
npm run build
npm run validate:jobs
npm test
npm start
```

Set `WORKSPACE_PATH` in `.env` to the default project the worker should operate on. Existing Local Coder tunnel/auth mechanisms remain available.

## Validation

Validate Job Pack structure:

```bash
npm run validate:jobs
```

Run the full inherited + Local Worker suite:

```bash
npm test
```

The suite builds TypeScript, tests Job Runtime activation/placeholder behavior, tests both `dev-coding` and `dev-planing` harnesses, then runs the inherited upstream tests.

## Confirmation boundary

For ready packs, `job_select` is two-phase:

1. Select the job and provide its concrete required bindings.
2. Runtime returns a resolved confirmation prompt and opaque token.
3. ChatGPT presents the prompt to the user.
4. Only after explicit confirmation may it call `job_select` again with `confirmed=true` and that token.
5. Pack-local skill/harness paths are exposed only after activation.

Placeholder packs are rejected before this flow begins.

## Repository structure

```text
chatgpt-local-worker/
├─ WORKER.md
├─ jobs/
│  ├─ dev-coding/        # ready: bundle-aware implementation
│  ├─ dev-planing/       # ready: deep planning + bundle authoring
│  └─ mto/               # placeholder, non-runnable
├─ shared-harness/
├─ profiles/
├─ src/
│  ├─ jobs/              # Job Runtime
│  ├─ tools/             # existing core + job control tools
│  └─ lib/
└─ scripts/
```

## Design rule for future jobs

Do not add a new Job Pack just because a domain name exists. Add it only when the domain has enough real evidence to define its inputs/outputs, rules, SOP, deterministic harness, and completion criteria without guessing. Related jobs should share a meaningful family prefix.

## Upstream and license

Core MCP implementation is based on [`hoangcoderr/chatgpt-local-coder`](https://github.com/hoangcoderr/chatgpt-local-coder) and remains under the repository's MIT license.

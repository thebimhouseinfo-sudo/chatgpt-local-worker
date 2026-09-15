<div align="center">

# ChatGPT Local Worker

**A controlled local worker for ChatGPT via MCP: select a real Job Pack, confirm the task, then reuse the mature filesystem, shell, git, checkpoint, context, skills, and MCP bridge core.**

</div>

ChatGPT Local Worker is derived from [`hoangcoderr/chatgpt-local-coder`](https://github.com/hoangcoderr/chatgpt-local-coder). The original MCP execution core is intentionally preserved as the worker substrate. A thin **Job Runtime** sits above it so workflows can be added deliberately without turning the system into a tool-heavy or multi-agent architecture.

## Current scope

The repository is intentionally not populated with fake jobs.

| Job | Status | Purpose |
|---|---|---|
| `dev-coding` | **ready** | Execute repository/code changes with implementation-scoped planning and validation |
| `dev-planing` | **ready** | Analyze a repository and produce an implementation-ready development plan without editing source code |
| `mto` | **placeholder** | Reserved for future MTO / quantity takeoff; no business logic exists yet |

`coding` and `dev-planning` remain compatibility aliases only. Canonical development job IDs use the shared `dev-` prefix.

For development work that benefits from a dedicated planning pass, the intended handoff is:

```text
dev-planing
   │
   └─ development plan artifact
              │
              ▼
        dev-coding
   execution planning + implementation + validation
```

This handoff is optional. Once architecture/direction is established, ordinary implementation work can stay entirely in `dev-coding`, which still performs the local execution planning needed for each task.

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

`jobs/dev-coding/` is the implementation Job Pack inherited from the original Local Coder capability. It includes **implementation-scoped execution planning**: enough repository review, sequencing, risk identification, and validation planning to safely execute a concrete task.

Inputs:

- `workspace` — target repository/workspace
- `task` — concrete engineering objective to execute
- `plan` — optional plan artifact from `dev-planing` or the user
- `delivery` — optional branch/commit/PR/working-tree delivery expectation

Its specialist skills cover repository discovery, execution planning, implementation, debugging, testing, validation, refactoring/migrations, dependencies/APIs, security, performance, documentation/release hygiene, and git/diff review.

A supplied plan is treated as authoritative intent rather than frozen repository state; `dev-coding` verifies assumptions and adapts implementation details to the current workspace. Use `dev-planing` when planning itself is the job: first-pass repository review, new-repository/system design, large architecture/refactor/migration strategy, or a durable implementation plan for later coding chats.

### Dev Coding harness

- `inspect-repo.mjs` — repository inventory and stack/git signals.
- `execution-preflight.mjs` — deterministic repository + validation evidence for local execution planning; does not generate architecture or a formal plan.
- `quality-gate.mjs` — discovers repository-native format/lint/type/test/build checks; execution requires explicit `--run`.
- `diff-gate.mjs` — staged/unstaged whitespace, conflict, and scope checks.
- `change-audit.mjs` — catches merge markers, sensitive material, machine paths, debugger leftovers, and oversized artifacts.
- `dependency-gate.mjs` — checks common manifest/lockfile consistency problems.
- `completion-gate.mjs` — aggregate structural completion gate.
- `validate.mjs` — validates the Dev Coding Job Pack itself.

## Dev Planing Job

`jobs/dev-planing/` is a separate read-oriented planning workflow.

It may inspect source, tests, config, repository history, project instructions, and related evidence. Its only intentional write target is the confirmed `plan` output artifact.

Specialist skills cover:

- repository analysis
- scope & constraints
- architecture/impact analysis
- implementation sequencing
- validation & risk planning

The output follows `templates/DEV_PLAN.md` and is checked by `harness/plan-lint.mjs`. The plan must separate repository evidence, constraints, non-goals, implementation steps, validation, risks, and open questions. Missing product/architecture decisions remain explicit instead of being guessed.

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

Run the full test suite:

```bash
npm test
```

The CI workflow runs both on pushes to `main` and on pull requests.

## Adding a future Job Pack

Do **not** add a Job Pack merely because a domain name exists.

A real pack should be based on known work:

1. real input artifacts;
2. actual output requirements;
3. domain rules and ambiguity policy;
4. SOP/skills that reduce model improvisation;
5. deterministic harness/validation where deterministic checks are possible;
6. explicit completion criteria.

Until those are known, leave the job unimplemented. `mto` is the single intentional placeholder because that domain is already planned for later design.

## Attribution

The repository started from [`hoangcoderr/chatgpt-local-coder`](https://github.com/hoangcoderr/chatgpt-local-coder). Upstream attribution is preserved while the product identity and workflow have changed to **ChatGPT Local Worker**.

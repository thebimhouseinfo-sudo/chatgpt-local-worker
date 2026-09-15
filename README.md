<div align="center">

# ChatGPT Local Worker

**A controlled local worker for ChatGPT via MCP: select a real Job Pack, confirm the task, then reuse the mature filesystem, shell, git, checkpoint, context, skills, and MCP bridge core.**

</div>

ChatGPT Local Worker is derived from [`hoangcoderr/chatgpt-local-coder`](https://github.com/hoangcoderr/chatgpt-local-coder). The original MCP execution core is intentionally preserved as the worker substrate. A thin **Job Runtime** sits above it so workflows can be added deliberately without turning the system into a tool-heavy or multi-agent architecture.

## Current scope

The repository is intentionally not populated with fake jobs.

| Job | Status | Purpose |
|---|---|---|
| `coding` | **ready** | Execute concrete repository/code changes and validate them; no formal development planning |
| `dev-planning` | **ready** | Analyze a repository and produce an implementation-ready development plan without editing source code |
| `mto` | **placeholder** | Reserved for future MTO / quantity takeoff; no business logic exists yet |

`mto` appears in discovery so the future slot is explicit, but the Job Runtime refuses to select or activate placeholder packs.

For non-trivial development work the intended handoff is:

```text
dev-planning
   │
   └─ development plan artifact
              │
              ▼
           coding
   implementation + validation
```

This handoff is optional. A small, already-concrete coding task can go directly to `coding`.

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

## Coding Job

`jobs/coding/` is the execution Job Pack inherited from the original Local Coder capability. It does **not** perform formal development planning.

Inputs:

- `workspace` — target repository/workspace
- `task` — concrete engineering objective to execute
- `plan` — optional plan artifact from `dev-planning` or the user
- `delivery` — optional branch/commit/PR/working-tree delivery expectation

Its specialist skills cover repository discovery, implementation, debugging, testing, validation, refactoring/migrations, dependencies/APIs, security, performance, documentation/release hygiene, and git/diff review.

If a task requires unresolved product or architecture decisions, `coding` must surface that gap rather than silently becoming a planner. Use `dev-planning` for formal repository-aware design work.

### Coding harness

- `inspect-repo.mjs` — repository inventory and stack/git signals.
- `quality-gate.mjs` — discovers repository-native format/lint/type/test/build checks; execution requires explicit `--run`.
- `diff-gate.mjs` — staged/unstaged whitespace, conflict, and scope checks.
- `change-audit.mjs` — catches merge markers, sensitive material, machine paths, debugger leftovers, and oversized artifacts.
- `dependency-gate.mjs` — checks common manifest/lockfile consistency problems.
- `completion-gate.mjs` — aggregate structural completion gate.
- `validate.mjs` — validates the Coding Job Pack itself.

## Development Planning Job

`jobs/dev-planning/` is a separate read-oriented planning workflow.

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

Run the full inherited + Local Worker suite:

```bash
npm test
```

The suite builds TypeScript, tests Job Runtime activation/placeholder behavior, tests both `coding` and `dev-planning` harnesses, then runs the inherited upstream tests.

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
│  ├─ coding/            # ready: implementation
│  ├─ dev-planning/      # ready: planning only
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

Do not add a new Job Pack just because a domain name exists. Add it only when the domain has enough real evidence to define its inputs/outputs, rules, SOP, deterministic harness, and completion criteria without guessing.

## Upstream and license

Core MCP implementation is based on [`hoangcoderr/chatgpt-local-coder`](https://github.com/hoangcoderr/chatgpt-local-coder) and remains under the repository's MIT license.

<div align="center">

# ChatGPT Local Worker

**A controlled local worker for ChatGPT via MCP: select a real Job Pack, confirm the task, then reuse the mature filesystem, shell, git, checkpoint, context, skills, and MCP bridge core.**

</div>

ChatGPT Local Worker is derived from [`hoangcoderr/chatgpt-local-coder`](https://github.com/hoangcoderr/chatgpt-local-coder). The original MCP execution core is intentionally preserved as the worker substrate. A thin **Job Runtime** sits above it so domain workflows can be added deliberately without turning the system into a tool-heavy or multi-agent architecture.

## Current scope

The repository is intentionally not populated with fake jobs.

| Job | Status | Purpose |
|---|---|---|
| `coding` | **ready** | Professional repository engineering, inheriting the complete Local Coder core |
| `mto` | **placeholder** | Reserved for future MTO / quantity takeoff; no business logic exists yet |

`mto` appears in discovery so the future slot is explicit, but the Job Runtime refuses to select or activate placeholder packs.

## Architecture

```text
ChatGPT
   │
   ▼
Job Runtime
   ├─ discover / suggest
   ├─ ready vs placeholder status
   ├─ select
   ├─ resolve concrete inputs
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

`jobs/coding/` is the first production-quality Job Pack. It is not a thin placeholder around the word “coding”. It inherits the proven Local Coder execution layer and adds an explicit engineering workflow.

```text
jobs/coding/
├─ job.yaml
├─ JOB.md
├─ SKILL.md
├─ skills/
│  ├─ repository-discovery.md
│  ├─ implementation.md
│  ├─ debugging.md
│  ├─ validation.md
│  └─ git-review.md
└─ harness/
   ├─ inspect-repo.mjs
   ├─ quality-gate.mjs
   ├─ diff-gate.mjs
   └─ validate.mjs
```

The coding workflow explicitly uses existing core capabilities such as `project_context`, `list_skills` / `load_skill`, path-specific rules, search/read/patch, persistent shell, git, checkpoint/rewind, and enabled upstream MCP servers.

### Coding harness

- `inspect-repo.mjs` — deterministic repository inventory: Git state, manifests, stack signals, package scripts.
- `quality-gate.mjs` — discovers repository-native lint/type/test/build commands and can run the discovered set only when invoked with `--run`.
- `diff-gate.mjs` — checks Git worktree scope and `git diff --check`, plus staged/unstaged summaries.
- `validate.mjs` — validates the Coding Job Pack itself, including required specialist skills.

The harness supports the coding agent; it does not replace repository-owned test/build commands or the generic core tools.

## MTO placeholder

`jobs/mto/` is deliberately skeletal. It contains no invented HVAC takeoff rules, output schema, counting policy, source hierarchy, or equipment logic. It exists only to reserve the future Job Pack boundary. It can become `ready` later when the actual MTO workflow is designed from real project inputs and expected outputs.

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

The suite builds TypeScript, tests Job Runtime activation/placeholder behavior, tests the coding lifecycle, then runs the inherited upstream tests.

## Confirmation boundary

For a ready pack such as `coding`, `job_select` is two-phase:

1. Select the job and provide concrete required bindings (`workspace`, `task`).
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
│  ├─ coding/            # ready
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

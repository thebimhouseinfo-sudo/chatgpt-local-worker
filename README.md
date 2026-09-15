<div align="center">

# ChatGPT Local Worker

**A controlled general local worker for ChatGPT via MCP — select a Job Pack first, then reuse the existing filesystem, shell, git, checkpoint, and MCP bridge core.**

</div>

ChatGPT Local Worker is derived from [`hoangcoderr/chatgpt-local-coder`](https://github.com/hoangcoderr/chatgpt-local-coder). The original MCP execution core is intentionally kept as intact as possible. This repository adds a thin **Job Runtime** above that core so coding becomes one job among many instead of the identity of the agent.

## Design principle

```text
ChatGPT
   │
   ▼
Job Runtime
   ├─ discover / suggest
   ├─ select
   ├─ resolve concrete inputs + outputs
   ├─ explicit confirmation
   ├─ active Job Pack
   └─ validate / stop / switch
   │
   ▼
Existing MCP core
   ├─ filesystem
   ├─ shell / processes
   ├─ git
   ├─ checkpoint / rewind
   ├─ project context / memory
   └─ upstream MCP bridge
```

The project deliberately does **not** add a multi-agent hierarchy and does not duplicate tools already supplied by the MCP core.

## Job-first lifecycle

Every job-specific task follows:

```text
DISCOVER → SELECT → RESOLVE → CONFIRM → EXECUTE → VALIDATE → COMPLETE
```

The runtime exposes five control tools:

- `job_list` — list Job Packs and optionally score keyword-based suggestions. A suggestion never selects a job.
- `job_select` — select/configure a pack, resolve bindings, and perform the second confirmation-token call that activates it.
- `job_status` — show current per-session job state.
- `job_switch` — clear the old job state before selecting another job.
- `job_stop` — clear all job-specific state.

A command such as `/job hvac-takeoff` maps conceptually to `job_select`. Natural-language terms such as `takeoff`, `MTO`, `bốc khối lượng`, `repo`, `code`, or `lisp` are **suggestions only** and never permission to execute.

## First-turn behavior

`WORKER.md` is the authoritative worker policy. On the first assistant turn after this MCP connector is attached, ChatGPT should check job state, list jobs when idle, and ask:

> **Hôm nay tôi làm gì?**

MCP servers cannot spontaneously send an assistant message before the user sends a turn, so this behavior occurs on the first user interaction after the connector is enabled.

## Starter Job Packs

The repository currently contains:

| Job | Purpose |
|---|---|
| `hvac-takeoff` | Traceable HVAC/ACMV takeoff from confirmed project sources |
| `software-development` | Repository/code modification using the existing coding core |
| `technical-review` | Traceable technical review against explicit criteria |
| `cad-fix` | Controlled CAD/AutoLISP corrections |

Each pack contains at minimum:

```text
jobs/<job-id>/
├─ job.yaml
├─ JOB.md
├─ SKILL.md
└─ harness/
   └─ validate.mjs
```

Optional `validators/` and `templates/` folders can be added when a job needs them.

### `job.yaml`

v0.1 uses the **JSON-compatible subset of YAML 1.2**. JSON is valid YAML, and this keeps the runtime dependency-free.

The metadata declares aliases/keywords, required inputs and outputs, permission policy, confirmation text, harness entrypoints, and validators.

## Worker Home vs project workspace

These are intentionally separate:

- `LOCAL_WORKER_HOME` — Local Worker installation containing `WORKER.md` and, by default, `jobs/`.
- `JOB_PACKS_PATH` — optional override for the Job Pack directory.
- `WORKSPACE_PATH` — the project/repository/files being worked on by the active job.

This separation means changing the target project does not make the Worker policy or Job Packs disappear.

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

Set `WORKSPACE_PATH` in `.env` to the default project the worker should operate on. The existing Local Coder tunnel/auth mechanisms remain available, including `MCP_TOKEN`, the Windows PowerShell scripts, and the OpenAI Secure MCP Tunnel support inherited from upstream.

## Validation

Validate Job Pack structure independently:

```bash
npm run validate:jobs
```

Run the full suite:

```bash
npm test
```

The full suite builds TypeScript, tests the Job Runtime lifecycle, and then runs the inherited upstream tests.

## Confirmation boundary

For packs requiring confirmation, `job_select` is intentionally two-phase:

1. Select the job and provide concrete bindings.
2. The runtime returns a resolved confirmation prompt and opaque confirmation token.
3. ChatGPT presents the prompt to the user.
4. Only after the user explicitly confirms may ChatGPT call `job_select` again with `confirmed=true` and that token.
5. Harness and validator paths are exposed only once the job becomes active.

Switching or stopping clears the previous job state so Job Pack rules do not leak across jobs.

## Repository structure

```text
chatgpt-local-worker/
├─ WORKER.md
├─ jobs/
│  ├─ hvac-takeoff/
│  ├─ software-development/
│  ├─ technical-review/
│  └─ cad-fix/
├─ shared-harness/
├─ profiles/
├─ src/
│  ├─ jobs/             # Job Runtime
│  ├─ tools/            # existing core + job control tools
│  └─ lib/
└─ scripts/
```

## Scope of v0.1

v0.1 is intentionally small. `permissions` in each Job Pack are an operational contract for ChatGPT/`WORKER.md`; this release does not wrap every filesystem/shell/git tool in a new permission engine. The existing MCP core remains the execution substrate.

Future work should extend individual Job Packs and deterministic harnesses before adding more generic tools or orchestration layers.

## Upstream and license

Core MCP implementation is based on [`hoangcoderr/chatgpt-local-coder`](https://github.com/hoangcoderr/chatgpt-local-coder) and remains under the repository's MIT license. Upstream attribution is retained in the source history and license.

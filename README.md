<div align="center">

# ChatGPT Local Worker

**A controlled general-purpose local worker for ChatGPT, powered by MCP and explicit Job Packs.**

Reuse one mature execution core — filesystem, shell, git, processes, checkpoints, project context, skills, and upstream MCP — while each Job Pack defines the workflow, rules, validation, and completion criteria for a real class of work.

</div>

ChatGPT Local Worker is derived from [`hoangcoderr/chatgpt-local-coder`](https://github.com/hoangcoderr/chatgpt-local-coder). The upstream execution core is intentionally preserved; a thin **Job Runtime** adds controlled job discovery, selection, confirmation, and Job Pack loading without introducing a multi-agent hierarchy.

## What this repository is

```text
ChatGPT
   │
   ▼
Job Runtime
   │  discover → select → resolve → confirm
   ▼
Local Worker core
   ├─ filesystem / search / patch
   ├─ shell / long-running processes
   ├─ git
   ├─ checkpoint / rewind
   ├─ project context / memory
   ├─ project-local skills / path rules
   └─ upstream MCP bridge
   │
   ▼
Active Job Pack
   ├─ JOB.md / SKILL.md
   ├─ specialist skills or business rules
   ├─ deterministic harnesses
   └─ validators / completion criteria
```

The Worker provides execution capabilities. A Job Pack provides the prescribed way to use those capabilities for one class of work. Coding is one job, not the identity of the Worker.

`WORKER.md` is the authoritative Worker policy. `AGENTS.md` contains concise instructions for agents modifying **this repository**. This README is the operator/user guide.

## Current Job Packs

| Job | Status | Purpose |
|---|---|---|
| `dev-coding` | **ready** | Execute focused development tasks, preferably from an existing planning bundle, then validate and update task progress |
| `dev-planing` | **ready** | Deep repository/system planning; produces architecture, implementation plan, backlog, and executable task ledger |
| `mto` | **ready** | HVAC quantity takeoff / schedule update using stable or runnable-draft engineering rules |

Compatibility aliases such as `coding` and `dev-planning` may remain, but the canonical development IDs are `dev-coding` and `dev-planing`.

### Job-first lifecycle

Operational work follows:

```text
DISCOVER → SELECT → RESOLVE → CONFIRM → EXECUTE → VALIDATE → COMPLETE
```

On a new Worker session, the expected control flow is `job_status`, then `job_list` when idle. Keywords can suggest a Job Pack but never activate one automatically. `job_select` is two-phase: resolve the concrete request first, then activate only after explicit user confirmation.

Use `job_switch` to change jobs and clear previous job state, or `job_stop` to end it.

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

Set `WORKSPACE_PATH` in `.env` to the project/repository the Worker should treat as its default workspace. The Worker installation root is resolved automatically from the running package; `LOCAL_WORKER_HOME` is only needed when you intentionally override that location. Keeping Worker home separate from the target workspace means switching projects does not remove `WORKER.md` or the Job Packs.

## Connect ChatGPT

Tag the connector as **`@Local Worker`** in the chat where you want to use it.

### Recommended: OpenAI Secure MCP Tunnel

On Windows, after the server is running:

```powershell
.\openai-tunnel.ps1 -Init   # first-time setup
.\openai-tunnel.ps1         # later runs
```

The setup reads `OPENAI_TUNNEL_ID` and `OPENAI_TUNNEL_API_KEY` from `.env` after initialization and keeps a stable tunnel identity. The script also respects `MCP_TOKEN` when one is configured.

### Alternative: Cloudflare quick tunnel

On Windows:

```powershell
.\tunnel.ps1
```

The PowerShell helper prints the correct connector path, including `MCP_TOKEN` when configured.

On macOS/Linux the raw helper is:

```bash
npm run tunnel
```

Cloudflare quick-tunnel URLs change between runs. The raw npm helper only prints the public tunnel URL; if `MCP_TOKEN` is configured, append the actual MCP path yourself (`/mcp/<token>` or `/<token>`). Do not assume plain `/mcp` when path-token auth is enabled.

### Local endpoints

By default:

- MCP server: `http://127.0.0.1:3000`
- health: `http://127.0.0.1:3000/health`
- Admin UI: `http://127.0.0.1:3001/ui`

Without `MCP_TOKEN`, MCP accepts `/` and `/mcp`. With a token, the MCP routes become `/<token>` and `/mcp/<token>`.

Treat a tokenized connector URL as a secret.

## Project context and instructions

The default project is `WORKSPACE_PATH`. Its project memory is loaded into MCP instructions at session creation. Supported root instruction sources include `CLAUDE.md`, `.claude/CLAUDE.md`, `AGENTS.md`, and `CLAUDE.local.md`, plus applicable project rules/skills.

You normally **do not** need to call `project_context` for the default workspace; use `project_context(path)` when the active task targets another repository.

`agent_status` is an optional diagnostic/tool-reference call, not the normal first step. The job controls are the normal entry point for job-specific work.

## Tool profiles

`CHATGPT_TOOL_PROFILE` controls how many local tools are exposed:

- `slim` — default, exposes the core tool set recommended for ChatGPT web;
- `full` — exposes all registered local tools.

The exact tool count is intentionally not documented because the catalog evolves. Call `agent_status` to see the active profile, or inspect `src/lib/tool-profile.ts` for the current catalog.

Core capabilities include:

- explore/read: `glob`, `grep`, `read_text_file`, `list_directory`;
- edit: `apply_patch`, `multi_edit`, `edit_file`, `write_file`;
- execute: `run_command`, `start_process`, `process_output`;
- git: `git_status`, `git_diff`, `git_add`, `git_commit`, `git_restore`;
- undo: `rewind`;
- project context: `project_context`, project skills/path rules;
- upstream MCP: enabled upstream tools are exposed directly when configured.

Some heavier or less-common tools are only exposed by the full profile. `run_command` remains the general fallback for shell/git operations not exposed as dedicated tools.

## Development workflow

### `dev-planing`

Use when planning itself is the job: first-pass repository review, new architecture/system design, major refactor or migration strategy, or a substantial re-plan.

Its standard durable handoff bundle is:

```text
ARCHITECTURE.md
IMPLEMENTATION_PLAN.md
TODO.md
TASKS.md
```

`TODO.md` is backlog/deferred scope. `TASKS.md` is the executable ledger used by coding chats.

### `dev-coding`

The normal read order is:

```text
architecture
→ implementation plan
→ TODO
→ selected TASKS entry
→ project instructions/rules
→ targeted source/tests/config
```

Small, concrete work does not require a planning pass. A bounded implementation branch may use `task-plans/<TASK-ID>.md`; a new project-level architecture/product decision should return to `dev-planing` instead of being silently invented during coding.

## MTO / Quantity Takeoff

`mto` is user-triggered. It does not watch folders in the background and it does not decide equipment scope autonomously.

### Rule maturity is separate from run permission

MTO registry rules have explicit maturity:

- `stable` — runnable normally;
- `draft` — **also runnable on real projects**, but the Worker must warn `DRAFT / NOT FINAL` and the result requires careful human review;
- missing/disabled/placeholder — not runnable.

Current stable rules are AC and Fan. Current runnable draft rules include CHW Pump, Chiller, ERV/HRV, Evaporative Cooler, Fume Cupboard, VAV, Attenuator, Grille, Door Grille, and Flexible Connection.

Draft does not mean fake or unsupported. Real project use is how the rule gathers the evidence needed to become stable.

### Two source models

**Selection-driven** schedules use dated project selection under `00 Input` as the backbone, with exact-model technical data as supplement. Revision can be explicit or `latest`; `latest` is resolved independently for each requested equipment type.

**Drawing-export-driven** schedules use the current Lisp block-attribute export in `01 WIP` as the primary drawing snapshot. This source model is already operational. Grille, Door Grille, and Flexible Connection currently use draft business rules on top of it.

For drawing-export work:

```text
current Lisp export
→ compare with live schedule
→ change report
→ controlled merge
→ validation
```

The live schedule is working truth and may contain valid manual edits/enrichment. A new export is not permission to clear and rebuild it blindly.

### Typical project structure

```text
<Project Root>/
├─ 00 Input/
│  └─ YYYY MM DD/
│     ├─ ac/
│     ├─ fan/
│     └─ ...
├─ 01 WIP/
│  ├─ DESIGN DRAWING/
│  ├─ REVIT/                         # outside normal MTO scope
│  ├─ grille.csv                     # target Lisp names after naming fix
│  ├─ door grille.csv
│  ├─ flex conn.csv
│  └─ SCHEDULE/
│     ├─ *.xlsx                      # read-only templates
│     └─ eqm/                        # intended MTO write tree
│        ├─ _audit/
│        └─ _reports/
├─ 02 Output/                        # forbidden for MTO writes
└─ qto-rules/                        # optional project overrides
```

The current Lisp may still emit a project-name filename. That export is usable when the user explicitly identifies/provides it; after the Lisp naming fix the resolver can use the canonical schedule-specific stems.

### Source authority and safety

For selection-driven work, project selection chooses the project model/value; exact-model catalog data only supplements missing fields. Drawing information is reconciliation evidence. Never reverse this authority or invent missing values.

For drawing-export work, the export owns only fields it actually carries (or approved deterministic derivations). Valid live/manual fields outside export ownership are preserved.

MTO intentional writes are limited to:

```text
01 WIP/SCHEDULE/eqm/**
```

Templates, `00 Input`, design drawings, Lisp export files, project rules, and `02 Output` are not MTO write targets.

Each run maintains a live workbook, append-history audit JSON, and a human-readable takeoff/change report. Draft reports visibly repeat the draft warning.

## Admin UI and upstream MCP

The localhost Admin UI can inspect server status, project instruction context, activity, environment configuration, and upstream MCP servers. Upstream tools may be imported/configured through `profiles/mcp-upstream.json` and the Admin UI.

Features explicitly labeled **Codex hooks** or Codex compatibility refer to inherited interoperability features; they are not the product identity of this repository.

## Validation

Validate Job Pack structure:

```bash
npm run validate:jobs
```

Run the normal build + full inherited/Worker suite:

```bash
npm test
```

Additional integration tests are available through the repository scripts where applicable.

## Troubleshooting

| Symptom | Check |
|---|---|
| Connector cannot connect | Confirm server and tunnel are both running; use the exact endpoint printed by the tunnel script |
| Connector loops/loading | Refresh the connector after restarting the MCP server/tunnel; verify the MCP path/token |
| `tool not found` | Check `CHATGPT_TOOL_PROFILE`; use `agent_status` or `run_command` fallback |
| Patch context not found | Re-read the target file and use more surrounding context |
| Wrong project | Verify `WORKSPACE_PATH`; use `project_context(path)` only when intentionally targeting another repo |
| MTO draft warning | Expected: draft rules are runnable, but their result must be reviewed carefully |

`CHATGPT_AUTO_APPROVE` can reduce connector permission prompts, but ChatGPT/platform permission settings still remain authoritative.

## Repository structure

```text
chatgpt-local-worker/
├─ README.md                   # operator/user guide
├─ AGENTS.md                   # concise repo-development instructions
├─ WORKER.md                   # authoritative Worker policy
├─ jobs/
│  ├─ dev-coding/
│  ├─ dev-planing/
│  └─ mto/
├─ shared-harness/
├─ profiles/
├─ public/ui/
├─ scripts/
└─ src/
   ├─ jobs/                    # Job Runtime
   ├─ tools/                   # local MCP tools
   ├─ lib/                     # execution/instruction/runtime libraries
   └─ admin/
```

## Design rule for future Job Packs

Do not add a Job Pack merely because a domain name exists. Add one when there is enough real evidence to define inputs/outputs, workflow, rules, deterministic validation, and completion criteria without guessing. Job Packs should reduce improvisation, not rename a prompt.

## Upstream and license

The MCP execution core is based on [`hoangcoderr/chatgpt-local-coder`](https://github.com/hoangcoderr/chatgpt-local-coder). Compatibility names may remain where they protect existing integrations. The repository remains under the MIT license.
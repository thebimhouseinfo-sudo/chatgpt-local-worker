<div align="center">

# ChatGPT Local Worker

**A controlled general-purpose local worker for ChatGPT, powered by MCP and optional Job Packs.**

Reuse one mature execution core — filesystem, shell, git, processes, checkpoints, project context, skills, and upstream MCP — while independently installed Job Packs can add prescribed workflows for particular classes of work.

</div>

ChatGPT Local Worker is derived from [`hoangcoderr/chatgpt-local-coder`](https://github.com/hoangcoderr/chatgpt-local-coder). The upstream execution core is intentionally preserved; a thin **Job Runtime** adds controlled job discovery, selection, confirmation, and Job Pack loading without introducing a multi-agent hierarchy.

## What this repository is

```text
ChatGPT
   │
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
   ├─ Job Runtime
   │    discover → select → resolve → confirm
   │
   └─ optional Job Packs
        workflow / rules / harness / validation
```

The Worker provides execution capabilities. A Job Pack provides a prescribed way to use those capabilities for a specific class of work. Job Packs are modular: different users or installations may carry different packs, and the root Worker does not depend on any particular domain pack.

`WORKER.md` is the authoritative Worker policy. `AGENTS.md` contains concise instructions for agents modifying **this repository**. This README is the operator/user guide.

## Job Packs

Job Packs live under `jobs/` and are discovered by the Job Runtime. This root README intentionally does **not** maintain a catalog or duplicate pack-specific behavior.

To see what is installed in a running Worker, use `job_list`. For the contract, workflow, inputs, outputs, rules, and completion criteria of a particular pack, read that pack's own files, especially:

```text
jobs/<job-id>/
├─ job.yaml
├─ JOB.md
├─ SKILL.md
├─ harness/
└─ optional rules/, skills/, templates/, validators/
```

Pack-specific documentation is authoritative for that pack. Adding, removing, or replacing a Job Pack should not require rewriting this root README.

The generic lifecycle is:

```text
DISCOVER → SELECT → RESOLVE → CONFIRM → EXECUTE → VALIDATE → COMPLETE
```

Keywords may suggest a Job Pack but do not activate one automatically. Activation remains an explicit boundary. Use the Job Runtime controls to inspect, select, switch, or stop jobs.

See [`jobs/README.md`](jobs/README.md) for the generic Job Pack contract. Then read the selected pack's own `JOB.md` / `SKILL.md` for its actual behavior.

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

Set `WORKSPACE_PATH` in `.env` to the project/repository the Worker should treat as its default workspace. The Worker installation root is resolved automatically from the running package; `LOCAL_WORKER_HOME` is only needed when you intentionally override that location. Keeping Worker home separate from the target workspace means switching projects does not remove `WORKER.md` or installed Job Packs.

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

`agent_status` is an optional diagnostic/tool-reference call, not the normal first step. Job-specific work should follow the active Job Pack rather than generic assumptions from the root README.

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

## Admin UI and upstream MCP

The localhost Admin UI can inspect server status, project instruction context, activity, environment configuration, and upstream MCP servers. Upstream tools may be imported/configured through `profiles/mcp-upstream.json` and the Admin UI.

Features explicitly labeled **Codex hooks** or Codex compatibility refer to inherited interoperability features; they are not the product identity of this repository.

## Validation

Validate installed Job Pack structure:

```bash
npm run validate:jobs
```

Run the normal build + full inherited/Worker suite:

```bash
npm test
```

Each Job Pack may define additional pack-specific validation. Follow that pack's own documentation when it is active.

## Troubleshooting

| Symptom | Check |
|---|---|
| Connector cannot connect | Confirm server and tunnel are both running; use the exact endpoint printed by the tunnel script |
| Connector loops/loading | Refresh the connector after restarting the MCP server/tunnel; verify the MCP path/token |
| `tool not found` | Check `CHATGPT_TOOL_PROFILE`; use `agent_status` or `run_command` fallback |
| Patch context not found | Re-read the target file and use more surrounding context |
| Wrong project | Verify `WORKSPACE_PATH`; use `project_context(path)` only when intentionally targeting another repo |
| Job-specific behavior unclear | Read the active pack's `JOB.md` / `SKILL.md`; do not infer domain policy from the root README |

`CHATGPT_AUTO_APPROVE` can reduce connector permission prompts, but ChatGPT/platform permission settings still remain authoritative.

## Repository structure

```text
chatgpt-local-worker/
├─ README.md                   # operator/user guide for the Worker core
├─ AGENTS.md                   # concise repo-development instructions
├─ WORKER.md                   # authoritative Worker policy
├─ jobs/
│  └─ <job-id>/                # optional, self-described Job Packs
├─ shared-harness/
├─ profiles/
├─ public/ui/
├─ scripts/
└─ src/
   ├─ jobs/                    # generic Job Runtime
   ├─ tools/                   # local MCP tools
   ├─ lib/                     # execution/instruction/runtime libraries
   └─ admin/
```

## Design rule for Job Packs

A Job Pack should be self-contained enough that its domain description, workflow, policy, validation, and completion criteria live with the pack rather than leaking into the Worker core documentation.

Do not add a Job Pack merely because a domain name exists. Add one when there is enough real evidence to define its behavior without guessing. Job Packs should reduce improvisation, not rename a prompt.

## Upstream and license

The MCP execution core is based on [`hoangcoderr/chatgpt-local-coder`](https://github.com/hoangcoderr/chatgpt-local-coder). Compatibility names may remain where they protect existing integrations. The repository remains under the MIT license.

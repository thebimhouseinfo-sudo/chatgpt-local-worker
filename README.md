<div align="center">

# GPTWorker

**A ChatGPT-controlled local worker with full machine access and Job Packs.**

</div>

GPTWorker turns ChatGPT into a local worker for coding, planning, MTO, and other installed jobs. The normal user interface is ChatGPT itself.

The intended UX is deliberately simple:

```text
FIRST TIME
setup.bat
→ install/build/test
→ initialize OpenAI Secure MCP Tunnel
→ create ChatGPT connection named gptworker

EVERYDAY
run.bat
→ @gptworker
→ confirm JOB + local FOLDER
→ work
```

The local folder is equivalent to **Open Folder** in an IDE. You do not configure the project permanently in `.env`.

## First-time setup

Requirements:

- Windows
- Node.js 18+
- Git

Clone the repository, then run:

```text
setup.bat
```

`setup.bat` will:

1. create `.env` if needed;
2. create local `worker-state.json`;
3. install dependencies;
4. build the Worker;
5. validate Job Packs;
6. run the test suite;
7. install/upgrade the supported OpenAI `tunnel-client` and initialize the Secure MCP Tunnel;
8. start GPTWorker + tunnel and open ChatGPT app/connector settings.

During the one-time tunnel step, use a **Runtime API key** restricted to **Tunnels: Read + Use**. The setup uses the supported `tunnel-client v0.0.14` and automatically upgrades an older bundled binary.

After `doctor` passes, keep GPTWorker running and configure ChatGPT:

```text
Settings → Apps
→ enable Developer Mode if your UI requires it
→ Create
→ Connection: Tunnel
→ select the tunnel or paste tunnel_<id>
→ Scan Tools / Test connection
→ name it gptworker
```

Do **not** enter `http://127.0.0.1:3000/mcp` into ChatGPT. The local MCP URL is private to the machine; Secure MCP Tunnel associates ChatGPT with it through the tunnel ID.

After that, normal use does not require setting up the connection again.

## Daily use

Run:

```text
run.bat
```

This starts both the local Worker and the OpenAI Secure MCP Tunnel.

Then use the connection in ChatGPT:

```text
@gptworker
```

GPTWorker first resolves two things from the current conversation:

- `JOB`
- local `FOLDER`

If the chat already contains them, it must not ask you to repeat them. If something is missing, it asks only for the missing part.

Before any work starts, GPTWorker stops at the confirmation gate:

```text
JOB: coding
FOLDER: D:\Projects\CAD-Agent

Xác nhận bắt đầu?
```

Only after confirmation does it activate the job and begin using local tools.

## Local folder = Open Folder

Example:

```text
Hãy review và sửa lỗi repo D:\Projects\CAD-Agent
@gptworker
```

GPTWorker should resolve:

```text
JOB: coding
FOLDER: D:\Projects\CAD-Agent

Xác nhận bắt đầu?
```

After confirmation, `D:\Projects\CAD-Agent` becomes the active workspace. Relative filesystem paths, persistent shell cwd, git defaults, project context, skills, and path rules anchor to that folder.

To switch to another project during the same chat, provide the new local folder. GPTWorker uses the job-switch flow and asks for confirmation again.

## Persistent worker state

The root runtime file is:

```text
worker-state.json
```

Example:

```json
{
  "current_job": "dev-coding",
  "active_workspace": "D:\\Projects\\CAD-Agent",
  "status": "confirmed",
  "updated_at": "2026-09-15T13:30:00.000Z"
}
```

This prevents job/workspace context from drifting during long chats or reconnects.

`worker-state.json` is local machine state and is excluded from Git.

`.env` is for static runtime/connection settings only. Project workspace and current job do not belong in `.env`.

## Job Packs

Job Packs live under `jobs/`.

Current ready jobs:

- `dev-coding` — coding/debug/refactor/test/build work (`coding` alias);
- `dev-planing` — architecture/repository/system planning (`planning` alias);
- `mto` — HVAC quantity takeoff/update work.

Generic lifecycle:

```text
DISCOVER → SELECT → RESOLVE → CONFIRM → EXECUTE → VALIDATE → COMPLETE
```

The execution core supplies filesystem, shell, git, checkpoint/rewind, project context, project skills/path rules, and optional upstream MCP tools. A Job Pack supplies the prescribed workflow and validation for its class of work.

## Full local access

GPTWorker intentionally runs as a trusted local agent with full machine access. It can read/write files, run shell commands, use Git, test/build projects, and call installed local tooling.

The confirmed `FOLDER` is the default work context, not a security sandbox. Absolute paths remain available when the active job genuinely needs them.

The MCP server binds to localhost by default and ChatGPT reaches it through the OpenAI Secure MCP Tunnel.

## Useful files

```text
setup.bat                # first-time setup
run.bat                  # normal launcher
worker-state.json        # local current job/workspace (created locally, git-ignored)
WORKER.md                 # authoritative runtime policy
AGENTS.md                 # instructions for agents modifying this repo
jobs/                     # Job Packs
src/                      # Worker core
openai-tunnel.ps1         # Secure MCP Tunnel helper
```

## Manual development commands

For repository development:

```bash
npm install
npm run build
npm run validate:jobs
npm test
```

The older PowerShell helpers remain available for development/troubleshooting, but normal operator use should be `setup.bat` once and `run.bat` afterwards.

## Troubleshooting

| Symptom | Check |
|---|---|
| `run.bat` says not set up | Run `setup.bat` once |
| `@gptworker` is unavailable | Confirm the ChatGPT connection named `gptworker` still exists |
| Worker does not start | Check the minimized `GPTWorker Server` PowerShell window |
| Tunnel does not connect | Check the minimized `GPTWorker Tunnel` PowerShell window; confirm `tunnel-client --version` is 0.0.14 and rerun `openai-tunnel.ps1 -Doctor` |
| Doctor fails with 401/403 | Verify the tunnel and runtime key belong to the intended organization/workspace; the key principal needs Tunnels Read + Use. New tunnel/role changes can take time to propagate. |
| ChatGPT asks for an MCP endpoint | Prefer **Connection: Tunnel** and select/paste the tunnel ID. Do not paste the localhost MCP URL. |
| Wrong project | Check the `FOLDER:` line before confirming and inspect `worker-state.json` |
| Wrong job | Stop/switch the job and confirm the correct `JOB + FOLDER` again |
| Git/shell seems to target the wrong place | `job_status` and `agent_status` show the persistent/current workspace state |

## Upstream

GPTWorker is derived from [`hoangcoderr/chatgpt-local-coder`](https://github.com/hoangcoderr/chatgpt-local-coder). The execution core is preserved and extended with a Job Runtime and ChatGPT-first local-workspace flow.

MIT License.

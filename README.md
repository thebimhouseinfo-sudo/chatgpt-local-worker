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
- a supported ChatGPT account/workspace with Developer Mode / custom MCP app access

### 1. Create an OpenAI API key

Open:

https://platform.openai.com/settings/organization/api-keys

Create a **Runtime API key** for GPTWorker. Keep the key private; you will paste it into `setup.bat` once.

The runtime identity used by the key needs **Tunnels: Read + Use**. Creating or editing a tunnel requires **Tunnels: Read + Manage** access for the Platform user/admin.

### 2. Create a Secure MCP Tunnel

Open:

https://platform.openai.com/settings/organization/tunnels

Create a new tunnel, for example:

```text
Name: gptworker
```

Copy the generated Tunnel ID:

```text
tunnel_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

The API key and Tunnel must belong to the intended OpenAI Platform organization/workspace.

### 3. Run GPTWorker setup

Clone this repository and run:

```text
setup.bat
```

When prompted, paste:

```text
OPENAI_TUNNEL_ID      = tunnel_...
OPENAI_TUNNEL_API_KEY = sk-...
```

`setup.bat` will:

1. create `.env` if needed;
2. create local `worker-state.json`;
3. install dependencies;
4. build the Worker;
5. validate Job Packs;
6. run the test suite;
7. start the local GPTWorker and wait for its health endpoint;
8. install/upgrade `tunnel-client`, run tunnel `doctor`, then start the Secure MCP Tunnel;
9. wait for tunnel readiness;
10. show the ChatGPT connection steps.

Do not share the API key and do not commit `.env` to Git.

### 4. Create the GPTWorker Plugin/App in ChatGPT

Keep GPTWorker and `tunnel-client` running, then use **ChatGPT on the web**.

Current OpenAI UI may show **Plugins** or **Apps** depending on account/workspace rollout.

1. Open https://chatgpt.com/
2. Enable **Developer Mode** if it is not already enabled:
   `Settings → Apps → Advanced Settings → Developer Mode`
3. Open **Plugins** and press `+`, or go to:
   `Settings → Apps → Create`
4. Create a new custom app/plugin.
5. Set the name to:

```text
gptworker
```

6. For **Connection**, choose:

```text
Tunnel
```

7. Select the `gptworker` tunnel from the list, or paste the `tunnel_...` ID copied in step 2.
8. Run **Scan Tools / Test connection**.
9. Create/save the app.

When tool scanning succeeds, GPTWorker is connected to ChatGPT.

Do **not** paste this local URL into ChatGPT:

```text
http://127.0.0.1:3000/mcp
```

That endpoint is private to your PC. ChatGPT reaches it through the **OpenAI Secure MCP Tunnel** using the Tunnel ID.

### 5. Test the connection

Open a normal ChatGPT chat and invoke:

```text
@gptworker
```

Then try:

```text
gptworker/
```

You should see the GPTWorker root commands. After this one-time setup, normal use only requires `run.bat`.

Official references:

- Secure MCP Tunnel: https://developers.openai.com/api/docs/guides/secure-mcp-tunnels
- Developer Mode and custom MCP apps: https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt

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

## Automatic activity logging

The Worker automatically records structured runtime activity in `.mcp-activity.jsonl`. It includes MCP requests, tool activity, session lifecycle, HTTP/admin requests, startup/shutdown and transport errors. Records are written asynchronously, secrets and credential-like values are redacted, and the file rotates when it reaches the configured size limit. Logging failures do not fail the original Worker request.

Optional settings:

```text
ACTIVITY_LOG_PATH              # custom JSONL path
ACTIVITY_LOG_ROTATE_BYTES      # default 20 MB
ACTIVITY_LOG_MAX_RECORD_BYTES  # default 32 KB
ACTIVITY_LOG_DISABLED=true     # disable the activity sink when explicitly needed
```

The Admin API exposes recent persisted events at `/api/activity/history`. The activity file is operational evidence only; it is not a source of Job or workspace authority.

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
| Doctor reports `mcp_server_reachable` / `oauth_metadata` connection refused | The local Worker is not listening yet. Pull the latest repo and rerun `setup.bat`; setup now starts and health-checks the Worker before doctor. |
| Doctor fails with 401/403 | Verify the tunnel and runtime key belong to the intended organization/workspace; the key principal needs Tunnels Read + Use. New tunnel/role changes can take time to propagate. |
| ChatGPT asks for an MCP endpoint | Prefer **Connection: Tunnel** and select/paste the tunnel ID. Do not paste the localhost MCP URL. |
| Wrong project | Check the `FOLDER:` line before confirming and inspect `worker-state.json` |
| Wrong job | Stop/switch the job and confirm the correct `JOB + FOLDER` again |
| Git/shell seems to target the wrong place | `job_status` and `agent_status` show the persistent/current workspace state |

## Upstream

GPTWorker is derived from [`hoangcoderr/chatgpt-local-coder`](https://github.com/hoangcoderr/chatgpt-local-coder). The execution core is preserved and extended with a Job Runtime and ChatGPT-first local-workspace flow.

MIT License.

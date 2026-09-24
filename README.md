<div align="center">

# GPTWorker

**ChatGPT-controlled local work on Windows, with confirmed Workspace boundaries and Job Packs.**

Designed by **Nam Trịnh**

</div>

GPTWorker connects ChatGPT to a local Windows worker through the OpenAI Secure MCP Tunnel. It lets ChatGPT work with local projects and files while keeping every active Job inside a folder that the user explicitly supplied and confirmed.

The normal interface is ChatGPT. After the one-time installation, GPTWorker runs quietly from the Windows tray.

## What GPTWorker does

GPTWorker provides three public Job Packs:

- **Dev Coding** — code changes, debugging, refactoring, build/test work and optional browser QA.
- **Dev Planing** — repository analysis, architecture review, implementation plans and task breakdowns.
- **Layla** — general local-file work across documents, spreadsheets, presentations, PDFs and mixed folders.

A private/domain-specific Job Pack may also be installed without appearing in the public Welcome list.

The everyday flow is intentionally simple:

```text
Windows sign-in
→ GPTWorker starts in the tray
→ open ChatGPT
→ @gptworker
→ describe the task
→ provide the local folder
→ confirm JOB + FOLDER + TASK
→ work
```

GPTWorker may infer the Job from the request, but it does not invent a folder. The Workspace must come from the user.

## Safety model

An active Job receives authority only after confirmation.

```text
JOB: Dev Coding
FOLDER: D:\Projects\MyApp
TASK: Fix the login bug and run the tests.

Xác nhận bắt đầu?
```

After confirmation:

- filesystem operations stay inside the confirmed Workspace;
- shell working directories and normal path references are checked against the same boundary;
- Git commands, when used through shell, remain subject to that boundary;
- changing Workspace requires a new user-supplied folder and confirmation;
- stopping the Job revokes the active work authority.

GPTWorker is a trusted local worker, not a general OS sandbox. The Workspace boundary is designed to prevent an incorrect Job decision from silently targeting an unrelated project.

## Installation

### Recommended: Windows installer

Use the Windows installer produced by the **Build Windows Installer** GitHub Actions workflow or attached to a tagged GitHub Release:

```text
GPTWorker-Setup-<version>.exe
```

The installer contains GPTWorker-owned files only. Third-party dependencies are installed from their normal sources during setup.

The installation flow:

1. installs GPTWorker under the current Windows user;
2. checks Node.js and installs Node.js LTS through `winget` if needed;
3. offers to install Git through `winget` when Git is missing;
4. installs production npm dependencies;
5. optionally installs the pinned Vercel `agent-browser` integration;
6. starts the local Worker;
7. guides the user through creating the OpenAI Secure MCP Tunnel;
8. guides the user through creating the restricted API key required by the Tunnel;
9. validates the Tunnel with the official tunnel client;
10. registers the GPTWorker tray app for Windows auto-start;
11. opens ChatGPT Settings and the visual Plugin connection guide.

The setup console includes step-by-step instructions for users who are not familiar with the OpenAI Platform UI.

### Tunnel/API permissions

For the GPTWorker runtime API key:

```text
Permissions: Restricted
Tunnels: Read + Use
```

Do not grant `All` merely for GPTWorker.

The Tunnel ID and API key are stored locally in `.env`. Never commit that file.

### Connect GPTWorker to ChatGPT

At the end of setup, GPTWorker opens:

- ChatGPT Settings → Plugins;
- the local visual guide at `docs/setup-guide/index.html`.

Create the ChatGPT Plugin/App using:

```text
Name: gptworker
Connection: Tunnel
Available tunnels: select the GPTWorker Tunnel
Authentication: No Auth
```

Do not use `Server URL`, and do not paste the localhost MCP endpoint into ChatGPT.

After connection, open a chat and invoke:

```text
@gptworker
```

## Daily use

A bare invocation shows the public Job list:

```text
@gptworker
```

You can also describe the task immediately:

```text
@gptworker
Tôi muốn sửa browser integration.
```

GPTWorker can infer the Job, but if the folder has not been supplied it asks for it. Job, folder and task may be provided across multiple conversational turns.

Useful management commands:

```text
gr/
gr/help
gr/job list
gr/job create
gr/job update
gr/job remove
gr/job export
gr/job import
gr/job stop
```

The longer `gptworker/...` forms remain compatibility aliases.

## Windows tray

GPTWorker starts automatically for the current Windows user.

The tray menu provides:

```text
Status: Connected | Working | Degraded
Open setup guide
Restart GPTWorker
Exit GPTWorker
```

Operational logs are stored under:

```text
%LOCALAPPDATA%\GPTWorker\logs
```

If the tray reports `Degraded`, check the Worker and Tunnel logs there before changing configuration.

## Optional browser QA

Dev Coding can optionally use the official Vercel `agent-browser` MCP integration.

The integration is opt-in and fail-closed:

- it is not required for normal GPTWorker operation;
- browser tools are not advertised when browser support is disabled or unhealthy;
- the audited upstream version is pinned;
- a real browser child is created only when an authorized browser operation is actually needed;
- browser sessions are tied to the active work execution and are cleaned up when authority ends.

The active maintenance contract is documented in:

```text
docs/browser-mcp-contract.md
```

## Git

GPTWorker does not expose a dedicated Git tool family.

If Git is installed and available in `PATH`, a Job may use normal Git commands through the guarded shell:

```text
git status
git diff
git log
git add
git commit
git pull
git push
```

If Git is not installed, GPTWorker continues to operate for non-Git tasks.

## Repository layout

```text
dist/                         built Worker runtime
src/                          TypeScript source
jobs/                         bundled Job Packs
docs/setup-guide/             end-user visual setup guide
docs/browser-mcp-contract.md  pinned browser integration contract
scripts/setup-flow.ps1        production setup flow
scripts/build-release.ps1     Windows release builder
installer/GPTWorker.iss       Inno Setup definition
setup.bat                     setup launcher
openai-tunnel.ps1             Secure MCP Tunnel helper
gptworker-tray.ps1            Windows tray supervisor
```

Local runtime/configuration state such as `.env`, `worker-state.json`, logs and custom user data is excluded from Git.

## Development

The repository uses npm and `package-lock.json`.

```powershell
npm ci
npm run build
npm run validate:jobs
npm test
```

Run the broader target-architecture suite when changing runtime boundaries or tool mappings:

```powershell
npm run test:all
```

## Build the Windows installer

Local Windows build:

```powershell
npm run release:windows
```

The release builder:

1. installs development dependencies;
2. builds `dist/`;
3. validates Job Packs;
4. runs the test suite;
5. creates a clean staging package containing only shipping files;
6. installs Inno Setup when necessary;
7. compiles the installer.

Output:

```text
release\out\GPTWorker-Setup-<version>.exe
```

For normal releases, use the GitHub Actions workflow:

```text
Actions → Build Windows Installer → Run workflow
```

A manual run uploads the EXE as a workflow artifact. A tag matching `v*` also publishes the EXE as a GitHub Release asset.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Tray icon does not appear | Check `%LOCALAPPDATA%\GPTWorker\logs` and rerun the installer/setup if needed |
| Tray status is `Degraded` | Use tray → Restart GPTWorker, then inspect Worker/Tunnel logs |
| `@gptworker` is unavailable | Confirm the ChatGPT Plugin/App named `gptworker` is connected |
| Tunnel doctor returns 401/403 | Confirm Tunnel and API key belong to the same intended organization/workspace and the key has Tunnels Read + Use |
| ChatGPT asks for an MCP URL | Recreate the Plugin with Connection = Tunnel; do not use Server URL |
| Wrong folder is shown before work | Do not confirm; provide the correct folder |
| Git commands are unavailable | Install Git and ensure `git` is available in `PATH` |

## Release status

GPTWorker is considered feature-complete for the current product scope. Future changes should be maintenance, compatibility updates, security fixes, Job Pack additions, or explicitly scoped new features rather than reopening retired architecture by default.

## Origins and acknowledgements

GPTWorker is an independent project. Its early development studied and reused selected MIT-licensed components from [hoangcoderr/chatgpt-local-coder](https://github.com/hoangcoderr/chatgpt-local-coder), particularly parts of the MCP/local-execution foundation and Secure MCP Tunnel workflow.

Selected inherited components remain under their original MIT terms and attribution.

**GPTWorker — designed by Nam Trịnh.**

MIT License.

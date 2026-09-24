<div align="center">

# GPTWorker

**Let ChatGPT work directly with files and projects on your Windows PC.**

[Tiếng Việt](README.md)

**Designed by Nam Trịnh**

</div>

## Download and install

**[Download GPTWorker-Setup-1.1.2.exe](https://github.com/thebimhouseinfo-sudo/chatgpt-local-worker/releases/latest/download/GPTWorker-Setup-1.1.2.exe)**

Run the installer and follow the on-screen instructions. You can choose where GPTWorker is installed.

GPTWorker handles required components such as Node.js, optional Git, runtime dependencies, the OpenAI Secure MCP Tunnel, and Windows auto-start.

At the end of setup, GPTWorker opens the guide for connecting it to ChatGPT.

## Usage

After installation, GPTWorker runs from the Windows tray.

In ChatGPT:

```text
@gptworker
```

Or describe the task immediately:

```text
@gptworker fix the login bug
```

GPTWorker includes three public Job Packs:

- **Dev Coding** — coding, debugging, refactoring, build and test work.
- **Dev Planing** — repository analysis, architecture review and planning.
- **Layla** — general file and document work.

GPTWorker may infer the appropriate Job, but it **never guesses the working folder**. The user must provide the folder before work can begin.

## Safety

Before execution, GPTWorker shows:

```text
JOB: ...
FOLDER: ...
TASK: ...

Confirm start?
```

GPTWorker starts only after confirmation.

Filesystem, shell and Git operations are constrained to the confirmed working folder.

## Quick commands

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

## Browser QA

Dev Coding can optionally use Vercel `agent-browser` for browser-based web/app verification. Browser support is opt-in.

## Development

```powershell
npm ci
npm run build
npm run validate:jobs
npm test
```

Build the Windows installer:

```powershell
npm run release:windows
```

GitHub Actions also provides the **Build Windows Installer** workflow to build and publish the EXE automatically.

## License and acknowledgements

GPTWorker is an independent project. Early development studied and reused selected MIT-licensed components from `hoangcoderr/chatgpt-local-coder`.

Inherited components remain under their original license and attribution.

**GPTWorker — designed by Nam Trịnh.**

MIT License.

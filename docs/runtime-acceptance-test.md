# GPTWorker Runtime Acceptance Test

Use this after architecture cleanup or runtime/tool-mapping changes.

The goal is to validate the real chain:

```text
GPT Web
→ OpenAI Secure MCP Tunnel
→ GPTWorker
→ MCP session/recovery
→ admission + Job + Workspace
→ work_tool
→ filesystem / shell / git / context / repl
```

This test does not require reading source code.

---

## A. Local automated validation

From the GPTWorker repository root:

```powershell
git pull
npm install
npm run validate:jobs
npm run test:all
```

Expected final result:

```text
=== ALL TARGET-ARCHITECTURE TESTS PASSED ===
```

The suite must validate at least:

- TypeScript build;
- legacy quarantine isolation;
- Group A/B/C guards;
- post-review Round 2 caller/mapping guard;
- all work_tool registry operations resolve to a registered implementation;
- Job Runtime and Job authoring;
- admission / confirmation / work-handle lifecycle;
- automatic checkpoint safety;
- Worker health;
- MCP initialize;
- tools/list;
- MCP stale-session recovery.

If this step fails, stop and keep the full terminal output.

---

## B. Start the real source Worker

Run:

```text
run.bat
```

Wait for the GPTWorker tray icon.

Expected tray status:

```text
Connected
```

If it shows `Degraded`, keep these logs:

```text
%LOCALAPPDATA%\GPTWorker\logs\worker.err.log
%LOCALAPPDATA%\GPTWorker\logs\tunnel.err.log
```

Do not change the current tunnel configuration during this test.

---

## C. Prepare a disposable Workspace

In PowerShell:

```powershell
$testRoot = "D:\GPTWorker-Acceptance"
$outsideRoot = "D:\GPTWorker-Acceptance-Outside"
New-Item -ItemType Directory -Force $testRoot | Out-Null
New-Item -ItemType Directory -Force $outsideRoot | Out-Null
Set-Content -Path "$testRoot\hello.txt" -Value "hello from acceptance test"
Set-Content -Path "$outsideRoot\sentinel.txt" -Value "DO-NOT-CHANGE"
git -C $testRoot init
```

Use another absolute local path if D: is unavailable.

---

## D. GPT Web end-to-end test

In a ChatGPT conversation with the GPTWorker connection available, send:

```text
@gptworker
JOB: dev-coding
FOLDER: D:\GPTWorker-Acceptance
TASK: Runtime acceptance test only. Confirm the Job/Folder before mutation.
```

Expected:

- GPTWorker resolves `dev-coding`;
- exact absolute Workspace is shown;
- no mutation occurs before confirmation;
- user receives the normal confirmation gate.

Confirm it.

Then ask:

```text
Run the GPTWorker runtime acceptance sequence in this confirmed Workspace:

1. read hello.txt;
2. create folder sub;
3. write sub\created.txt with "filesystem-ok";
4. copy it to sub\copied.txt;
5. run a shell command that prints shell-ok;
6. start a short-lived local process, query its process status/output, then stop/clear it if still running;
7. run git status and inspect the current branch;
8. call project_context;
9. call agent_status;
10. use node_repl to calculate 2 + 3 and report the value;
11. delete sub\copied.txt;
12. verify the final files exist as expected.

Do not touch anything outside the confirmed Workspace.
Report each family as PASS/FAIL:
filesystem, shell, git, context, repl.
```

Expected:

```text
filesystem PASS
shell      PASS
git        PASS
context    PASS
repl       PASS
```

### Workspace-boundary negative test

With the same active Job and confirmed Workspace `D:\GPTWorker-Acceptance`, ask:

```text
Boundary test only:

1. attempt a filesystem write to D:\GPTWorker-Acceptance-Outside\should-not-exist.txt;
2. attempt a shell command that writes to D:\GPTWorker-Acceptance-Outside\shell-should-not-exist.txt;
3. attempt a Git operation with repo/path outside the confirmed Workspace.

Do not switch Workspace. Report the exact rejection for each attempt.
```

Expected:

- all three attempts are rejected with a Workspace-boundary error;
- `D:\GPTWorker-Acceptance-Outside\sentinel.txt` still contains exactly `DO-NOT-CHANGE`;
- neither `should-not-exist.txt` nor `shell-should-not-exist.txt` exists.

Verify in PowerShell:

```powershell
Get-Content "D:\GPTWorker-Acceptance-Outside\sentinel.txt"
Test-Path "D:\GPTWorker-Acceptance-Outside\should-not-exist.txt"
Test-Path "D:\GPTWorker-Acceptance-Outside\shell-should-not-exist.txt"
```

Expected:

```text
DO-NOT-CHANGE
False
False
```

This boundary is implemented in the shared Worker core, so the same rule applies to bundled Jobs, Layla, and Custom Jobs.

Important Round-2/3 checks:

- `create_directory`, `copy_file`, `delete_file` are callable through work_tool;
- process status/stop operations are callable;
- git branch/status operations are callable;
- `agent_status` works only inside active work and is classified as context;
- no `rewind`, upstream MCP, Ponytail, or remember tool is requested or exposed.

---

## E. Stop / restart / reconnect test

Stop the active Job through GPTWorker:

```text
gr/job stop
```

Expected:

- active work registration is released;
- GPTWorker returns to idle.

Now use the tray menu:

```text
Restart GPTWorker
```

Wait until the tray returns to:

```text
Connected
```

Without starting a new ChatGPT conversation, send:

```text
@gptworker
```

Then:

```text
gr/job list
```

Expected:

- the existing chat can communicate again after Worker restart;
- no permanent stale-session error;
- Worker is idle;
- Job list is available.

This is the real end-to-end reconnect acceptance check.

---

## F. Evidence to send back

If everything passes, send:

```text
A PASS
B Connected
D filesystem PASS / shell PASS / git PASS / context PASS / repl PASS
D-boundary PASS
E reconnect PASS
```

If anything fails, send only:

1. which section failed;
2. the exact error shown;
3. for local test failures, the relevant terminal tail;
4. for tray/tunnel failures, `worker.err.log` and/or `tunnel.err.log`.

Do not try to repair the runtime before preserving the failing evidence.

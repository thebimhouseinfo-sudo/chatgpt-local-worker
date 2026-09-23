# Dev Coding upgrade — reproducible validation and operator acceptance

**Status:** Automated source tests cover the new checkpoint, task-evidence gate, setup state and MCP schema checks. **Actual installed agent-browser on the user's Windows machine and the full A01–A36 matrix must still be verified before declaring the complete upgrade DONE.** A successful GitHub CI run on Node 22 does not constitute browser E2E on Windows/Node 24.

## 1. Source validation (any supported local development host)

Open PowerShell in an up-to-date clone of `thebimhouseinfo-sudo/chatgpt-local-worker`:

```powershell
git pull --ff-only
node --version
npm ci
npm run build
npm run validate:jobs
node scripts/test-dev-coding-checkpoint.mjs
node scripts/test-dev-coding-completion.mjs
node scripts/test-setup-agent-browser.mjs
node scripts/test-browser-capability.mjs
node scripts/test-browser-mcp-contract.mjs
npm test
npm run test:all
```

**Expected:** every individual script prints `: ok`; each command exits 0; `npm test` reports `DEFAULT TEST SUITE PASSED`; `npm run test:all` prints `ALL TARGET-ARCHITECTURE TESTS PASSED`. If any step fails, copy the failing command and full error output and report FAIL, not DONE. These commands also execute with browser disabled and Node 22; they do not require Chrome or install the browser.

A generic successful `completion-gate.mjs` invocation without `--evidence` returns `STRUCTURAL_ONLY_NOT_GOAL_PASS`, **not task DONE**. To assert actual Goal PASS, create the task checkpoint and use:

```powershell
node jobs/dev-coding/harness/completion-gate.mjs --cwd "D:\\MyProject" --task-id TASK-001 --evidence "D:\\MyProject\\.gptworker\\dev-coding\\TASK-001\\evidence.json"
```

The task's JSON evidence must identify each acceptance signal, provide fresh SHA-256 input manifest fingerprint, record observed test/build/runtime/browser evidence where required, and provide the full seven-item DIFF_REVIEW checklist. Expected successful task result: `task_done: true`, `goal_verification.goal_status: PASS`, no listed problems. Otherwise the result must be `BLOCKED` with explicit evidence gaps; **never** mark a task DONE merely from `ok:true` structural checks.

## 2. Browser declined: no exposure

On the target Windows machine, in the GPTWorker directory:

```powershell
node scripts/setup-agent-browser.mjs N
npm run build
node scripts/test-browser-capability.mjs
```

**Expected:** `[agent-browser] DISABLED`, `browser-capability.json` has `enabled:false`, and the actual fresh MCP `tools/list` `work_tool.inputSchema.properties.tool.enum` has **zero** `browser_*` operations. All non-browser Work/Job tools continue to operate. The test includes a real in-memory MCP initialize/`tools/list` roundtrip while disabled. An already globally installed binary **does not override** NO. Browser never starts on ordinary Worker/Job activation.

## 3. Optional Windows browser smoke (explicit YES only)

Use Windows and Node **24+** for pinned `agent-browser@0.38.1`. The existing GPTWorker CI Node 22 is intentionally *not* an installation target for this optional release.

```powershell
node --version
npm ci
npm run build
node scripts/setup-agent-browser.mjs Y
agent-browser --version
agent-browser doctor
node scripts/test-browser-windows-smoke.mjs
```

**Expected:** setup reports `READY` only after pinned install, Chrome installation, doctor, real SDK MCP initialize and live paginated `tools/list` schema verification. A mismatch or failed command reports `UNAVAILABLE` and **no browser tool is advertised**. The smoke command runs a temporary localhost HTML fixture and performs `open → snapshot → fill → click → get_text → screenshot → get_url → close` through **actual upstream MCP stdio**, returning JSON `result: PASS`, seven PASS checks and a nonempty screenshot under `.gptworker/dev-coding/windows-browser-smoke/`. Any failure should exit nonzero and preserve the error and partial report. **This smoke verifies upstream MCP, not the entire GPTWorker authorization/lifecycle layer.**

Next, start/restart GPTWorker and establish a **new MCP session**. Activate the confirmed `dev-coding` Job on a disposable absolute localhost web-app Workspace via explicit `@gptworker` admission and confirmation. Inspect actual `tools/list` and then perform one complete `work_tool` browser cycle with its fresh `execution_id` + `authority_token`. A Custom Job using a valid own work handle must be denied, and `job_stop` must revoke the dev-coding session and clean up only its browser child. Test disabling browser and reconnecting: all `browser_*` names disappear from the new session, stale calls fail closed. Until these cases have real evidence, report **B3/B5 E2E PENDING**.

## 4. Git-optional checkpoint and safety acceptance

`node scripts/test-dev-coding-checkpoint.mjs` and `node scripts/test-dev-coding-completion.mjs` use temporary **plain folders without Git** and check:

- checkpoint discovery and new execution/generation after resume; fingerprint invalidation on source drift;
- an original-file snapshot and absent-file marker before agent write; approved restore only when the current hash still equals the last agent-written hash;
- refusal to overwrite intervening user edits and refusal to write outside the Workspace or through symlink escapes;
- iteration cap (8), uninformative repeated failure cap (2);
- snapshot DIFF_REVIEW cannot mark itself complete; `GOAL` is BLOCKED without individual acceptance observations, complete diff checklist and fresh fingerprints;
- missing snapshots and stale green evidence must fail validation.

**Expected:** both scripts print `: ok` and exit 0; generated files are deleted from the system's temporary fixture directory after the tests.

## 5. Required final evidence for a FULL PASS

Attach or record one redacted validation log with the exact tested commit SHA (for *this GPTWorker source repo*), Node version, OS version and per-command exit status. For A01–A36, record PASS/FAIL/UNAVAILABLE/N/A and a reproducible log or safe screenshot/reference for each relevant case. In particular include separate proof for: browser NO/YES; real `tools/list` after capability changes; unauthorized Custom Job and revoked handle; process cleanup after `job_stop` and timeout; live localhost screenshot and behavior; no-Git checkpoint recovery and safe restore; source/test drift invalidation; negative-control behavioral failure; and Goal gate rejecting fake PASS.

Keep credentials, authority tokens, user browser profile data and raw cookies out of logs, checkpoints and screenshots. If a real Windows/Chromium check has not been performed, report it **UNAVAILABLE / PENDING**, not PASS. Successful GitHub CI is supporting regression evidence, not a substitute for that final local acceptance.

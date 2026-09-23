# Dev Coding Upgrade — TASK LIST

**Status:** PLANNED. No source changes or acceptance tests for the upgrade have been executed yet.  
**Source of truth:** [Execution Plan](./dev-coding-execution-plan.md) and [Architecture / Upgrade Plan](./dev-coding-job-upgrade.md).  
**Scope:** Upgrade existing Dev Coding Job and optionally integrate the official Vercel `agent-browser mcp` through GPTWorker's existing runtime. Do not create an alternate browser engine, MCP server, execution core, job orchestrator or mandatory Git dependency.  
**Current Job:** `jobs/dev-coding/job.yaml` (`1.4.2` at planning time).  
**Status vocabulary:** `TODO` → `READY` → `IN_PROGRESS` → `DONE`; use `BLOCKED` with a specific dependency, and `FAILED_VALIDATION` / `ENVIRONMENT_LIMIT` in evidence where applicable.

## Implementation progress — 2026-09-23

**Partially implemented; no completion claim for B0/B1/B3.**

- P0 code/caller audit: inspected work-gateway's static `z.enum`, server work-handle/lease wrapper, runtime families and upstream integration points. Baseline CI for initial documentation and new setup helper passed, but the full upgrade acceptance suite is not implemented.
- B0 source audit: created [`browser-mcp-contract.md`](./browser-mcp-contract.md) with pinned **candidate** `agent-browser@0.38.1`. Its npm package requires Node >=24 while GPTWorker's current CI includes Node 22. Real Windows MCP/browser compatibility remains **PENDING**.
- B1 partial implementation: `setup.bat` now offers opt-in YES/NO and calls `scripts/setup-agent-browser.mjs`, which uses the pinned official install/Chrome-install/doctor sequence on compatible Node, otherwise marks browser `UNAVAILABLE`; NO marks `DISABLED`. Added `scripts/test-setup-agent-browser.mjs` to the default test suite. **Not DONE:** runtime health, MCP schema gating and Windows interactive smoke.
- **Important fail-closed current behavior:** Browser family/operations have **not** been registered in `work_tool` yet. Until B2/B3 implement the adapter and real discovery/authorization gates, new setup only records preference/diagnostic state; installed browser is not exposed to ChatGPT.

## 0. Execution rules

- Only one implementation batch should be `IN_PROGRESS` at a time unless its files and gates are independent. Complete its focused regression checks and record evidence before moving on.
- At activation of a task, inspect the real callers and working-tree state; file paths below are planned touchpoints, **not authorization** to modify every listed file.
- Each task must record **Goal / acceptance signals / allowed scope / relevant input-content fingerprint / validation evidence / remaining gaps**. Run targeted tests before broader suite. Git/hosted CI are optional for a user's target workspace; GitHub CI remains applicable to delivery of *this GPTWorker source repository*.
- Use absolute target paths and GPTWorker's existing workspace security and checkpoint primitives. New state/evidence goes under the *confirmed target Workspace* `.gptworker/dev-coding/<task-id-or-execution-id>/`; make it ignored by Git when present. Preserve user edits, use atomic state writes and conditional hash-safe restores only after approval.
- **Browser defaults disabled.** Do not include browser tools in the actual `work_tool` schema when disabled or unhealthy, and fail closed on stale calls. Only a confirmed `dev-coding` Job may use browser v1.
- A task is `DONE` only after its specific acceptance evidence is recorded. A green build/test or structural harness result alone is not Goal PASS.

## 1. Master task ledger and dependencies

| Task | Work package | Depends on | Status | Blocking exit gate |
| --- | --- | --- | --- | --- |
| DC-001–004 | P0 baseline and caller audit | — | TODO | No duplicate core/harness; baseline established |
| DC-005–009 | P1 contract + persistence/discovery | DC-001–004 | TODO | Valid resume with new handle and safe fingerprints |
| DC-010–013 | P2 test generation / integrity | DC-005–009 | TODO | Behavioral red-green or meaningful negative control |
| DC-014–018 | P3 evidence, QA loop, diff, rollback | DC-005–013 | TODO | Safe bounded failure; no false DONE |
| DC-019–020 | P4 optional CI/local checks | DC-014–018 | TODO | Stale evidence rejected; Git optional |
| DC-021–024 | B0 official MCP/browser contract | DC-001–004 | TODO | Version and exact schemas pinned |
| DC-025–029 | B1 optional Windows setup/capability | DC-021–024 | TODO | YES/NO/unhealthy real discovery gate |
| DC-030–034 | B2 outbound MCP stdio adapter | DC-021–024 | TODO | Strict typed mapping and mock MCP tests |
| DC-035–040 | B3 lazy gateway, authorization and lifecycle | DC-025–034 | TODO | No browser names when off; deny unauthorized calls |
| DC-041–043 | B4 Dev Coding browser QA and Goal | DC-014–018, DC-035–040 | TODO | Browser result cannot fake Goal PASS |
| DC-044–047 | B5 acceptance / Windows / security | DC-041–043 | TODO | A01–A36 tracked with real evidence |
| DC-048–050 | P5 final validation / docs / delivery | DC-019–020, DC-044–047 | TODO | All required regression gates and diff review |

**Recommended implementation sequence:** DC-001→004, DC-021→024 (B0 dependency/risk freeze), DC-005→020 (coding core), DC-025→040 (browser substrate), DC-041→047 (integration/acceptance), DC-048→050 (final). B1 and B2 can progress after B0 as long as they do not edit overlapping modules concurrently. Keep source defaults browser-OFF until B3 acceptance.

## 2. P0 — Baseline and minimum-delta audit

- [ ] **DC-001 — Record baseline.** Verify `AGENTS.md`, `WORKER.md`, current docs, `job.yaml`, existing Job skills/harness, scripts and CI. Capture repository revision/dirty state and run `npm run build`, `npm run validate:jobs`, `node scripts/test-dev-coding-harness.mjs`, `npm test`. **DoD:** exact results and pre-existing failures documented; no user changes overwritten.
- [ ] **DC-002 — Map runtime callers.** Trace `src/lib/runtime-families.ts` → `src/tools/work-gateway.ts` → `src/lib/tool-work-policy.ts` → `src/server-factory.ts` → `src/lib/work-registration.ts`, including activation, stop, lease expiry and actual MCP `tools/list`. **DoD:** file/caller map identifies every insertion and revocation point.
- [ ] **DC-003 — Audit Dev Coding harness.** Review `execution-preflight.mjs`, `quality-gate.mjs`, `diff-gate.mjs`, `completion-gate.mjs`, `validate.mjs`, current test fixtures and task ledger rules. **DoD:** KEEP/IMPROVE/ADD table; distinguish structural `ok` from task-level DONE.
- [ ] **DC-004 — Freeze local-only evidence and safety interfaces.** Identify existing filesystem checkpoint/path-security APIs, absolute-path behavior, allowed user-workspace mutations, configuration location and test-runner conventions. **DoD:** agreed snapshot/hash helper API; Git and browser remain optional.

## 3. P1 — Task contract, checkpoint storage and discovery

- [ ] **DC-005 — Add explicit Goal contract to SOP.** Edit `jobs/dev-coding/{JOB.md,SKILL.md}` and the minimum relevant planning skill. Define Goal, acceptance IDs/signals, non-goals, validation requirements, required/optional browser, stop rules and mapping to `TASKS.md`. **DoD:** task ambiguity produces BLOCKED; no invented product requirements.
- [ ] **DC-006 — Implement atomic task-local checkpoint.** Add a *small* helper under existing Dev Coding harness (path/name selected after DC-003), writing `.gptworker/dev-coding/<task-or-execution-id>/state.json` atomically. Persist schema version, canonical Workspace, task contract, active execution/generation (never raw authority token), iteration budget/history, current hypothesis/check/result, original snapshots and manifest references, remaining gaps, next action. **DoD:** restart-safe; corrupt/escaped paths rejected; no secrets.
- [ ] **DC-007 — Add SHA-256 input manifests and snapshots without Git.** On first approved edit capture original file bytes/metadata and absent-file markers; track changed files, direct callers, tests and config, normalized manifest fingerprint and test-source hash. Bind all PASS evidence to actual input fingerprint, not mtime. **DoD:** plain folders and Git-disallowed folders work; stale evidence invalidates after source/test drift.
- [ ] **DC-008 — Checkpoint discovery at confirmed Job activation.** Extend `execution-preflight.mjs` (minimal helper allowed): bounded, read-only scan `.gptworker/dev-coding/*/state.json` after Workspace is confirmed. Offer resume/new for one relevant unfinished task, disambiguate multiple, honor explicit task ID, never silently resume. Rebind only after user selection to new work handle/generation. **DoD:** no old authority token reused; no browser or file mutations during scan.
- [ ] **DC-009 — Test persistence/discovery.** Extend `scripts/test-dev-coding-harness.mjs` or a focused script using disposable plain-folder fixtures. Cover 0/1/multiple checkpoints, corrupt JSON, symlink escape, schema mismatch, stale manifest, newly issued handle, identical failed step avoidance and Git-forbidden environment. **DoD:** A21/A22/A28/A29/A31/A33–A35 pass.

## 4. P2 — Reliable generated tests

- [ ] **DC-010 — Detect test adequacy.** Reuse `quality-gate.mjs` and project-native conventions to decide existing suite, missing behavioral regression and minimal test creation. Update `skills/testing.md`, `skills/validation.md`. **DoD:** no unnecessary new test framework/CI workflow.
- [ ] **DC-011 — Enforce bug-fix red-green.** For reproducible defects, run a new/updated unchanged test against pre-fix behavior (RED) and after fix (GREEN), record code/test hashes and relevant failing assertion. **DoD:** a test that only ever passed does not become sole Goal evidence.
- [ ] **DC-012 — Define meaningful feature/refactor negative control.** In an isolated fixture, seed a wrong behavior tied to a named acceptance signal, keep test unchanged, prove normal PASS → behavior mutation FAIL on expected assertion → restored PASS. Explicitly reject test-only forced failures, irrelevant mutation and broken runner. **DoD:** A23/A36 pass; known limitation is reported as PARTIAL/UNVERIFIED when coverage remains incomplete.
- [ ] **DC-013 — Guard test-integrity changes.** Record before/after test hashes and reasons if assertions change after seeing failures. Detect deleted/disabled tests or weakened lint/type/security gates, including new tests. **DoD:** A24 and fake-PASS cases fail gate with evidence.

## 5. P3 — Bounded QA/repair, measurable diff, safe failure

- [ ] **DC-014 — Formalize bounded repair SOP.** Upgrade `SKILL.md` and `skills/debugging.md`: targeted → related → type/lint → build → applicable runtime/browser → Goal. Max **8 meaningful iterations / 45 minutes active work**, with stop/change hypothesis after **2 identical uninformative failures**. **DoD:** no infinite repeat; original failed check reruns first after repair.
- [ ] **DC-015 — Capture per-iteration evidence.** Persist hypothesis, last patch, command, exit code, failure signature, manifest/test hash, elapsed budget, observed Goal gap and next action after each meaningful cycle. **DoD:** a reset/resume can inspect what failed before without trusting chat context.
- [ ] **DC-016 — Make DIFF_REVIEW measurable without Git.** Improve existing `diff-gate.mjs` and `change-audit.mjs` only as needed: compute scoped before/after snapshot diff, whitespace errors, scope violations, protected user edits, test/config weakening, debug leftovers, secrets, accidental artifacts and caller/interface risks. Use `git diff --check` only when Git exists *and* is authorized. **DoD:** machine-readable checklist with per-item evidence and actual manifest fingerprint; no subjective unsupported PASS.
- [ ] **DC-017 — Add conditional hash-safe restore.** Preserve partial work and evidence on FAILED_VALIDATION by default. Only after explicit user authorization, restore agent-owned paths whose current hash still matches the last agent-written hash. Conflict, missing snapshot, symlink drift or user modification ⇒ stop for manual resolution; never `git reset --hard` or `git clean`. **DoD:** A25/A26/A30/A32 pass.
- [ ] **DC-018 — Strengthen `completion-gate.mjs`.** Separate structural checks from required `CODE_QA`, `TESTS`, `BUILD`, `RUNTIME`, `BROWSER_QA`, `GOAL`, `DIFF_REVIEW` evidence. Bind checks to fresh input fingerprints and required acceptance signals. **DoD:** discovery-only green cannot yield DONE; unmet Goal or required unavailable browser is not PASS.

## 6. P4 — Project-native local validation and optional hosted CI

- [ ] **DC-019 — Implement local-first check policy.** Reuse existing test discovery/build checks on a plain folder; persist exact command, exit code, test version and content-manifest fingerprint. Treat local checks as LOCAL and hosted CI as N/A unless required and available. **DoD:** local-only jobs finish without Git or GitHub.
- [ ] **DC-020 — Add authorized CI feedback.** If delivery explicitly includes a Git host and permission, inspect existing workflow, record exact SHA/run URL/status/logs, reproduce failure locally when possible and rerun after repair. Invalidate CI evidence on changed SHA/input manifest. **DoD:** old green CI cannot prove new code; no unauthorized auto-push.

## 7. B0 — Freeze official upstream MCP contract before browser code

- [ ] **DC-021 — Verify official upstream version and install.** Check the official Vercel release for `agent-browser mcp`, exact `tools/list` schemas, `core` profile, `allowedDomains`, session model, screenshot format, `agent-browser doctor`, Windows availability and Node 22 compatibility. **DoD:** upstream facts independently recorded; no guessed schema.
- [ ] **DC-022 — Create `docs/browser-mcp-contract.md`.** Record exact verified pinned version, supported package install command, MCP tool name/argument mapping for v1, version/hash/contract date, compatibility tests, known unsupported features and quarterly/version-bump/failure re-audit triggers. **DoD:** B1 installs exact tested release, not floating latest.
- [ ] **DC-023 — Freeze security/discovery behavior.** Approve strict upstream allowlist, `eval`/`extraArgs` denial, localhost+approved-preview origin policy, execution-scoped session, output size/typed image rules, screenshot absolute Workspace path and dynamic `tools/list` strategy; identify server/session refresh/reconnect behavior. **DoD:** disabled/unhealthy = **zero browser operation names in actual MCP discovery** and blocked stale calls.
- [ ] **DC-024 — Implement upstream mock contract fixtures.** Create fake stdio MCP with compatible `initialize`, `tools/list`, `tools/call`, image/error, mismatch and timeout variants. **DoD:** deterministic tests can run in CI without Chromium/browser install.

## 8. B1 — Optional `setup.bat` installation, config and health

- [ ] **DC-025 — Add explicit YES/NO setup prompt.** Modify `setup.bat` at the right point before Worker/tray restart: `Install optional Vercel agent-browser support for Dev Coding? [Y/N]`. Blank/unattended defaults disabled; NO never installs or enables even if global binary exists. **DoD:** existing npm/build/Job/tunnel/tray setup unaffected.
- [ ] **DC-026 — Run official Vercel installer on YES.** Use *B0's exact pinned version* of `npm install -g agent-browser@<verified-version>`, then official `agent-browser install` and supported `agent-browser doctor`; check real Windows errorlevels; no silent `doctor --fix`. **DoD:** confirmed install verified by real MCP/browser health, not PATH alone.
- [ ] **DC-027 — Persist user choice separate from health.** Use audited per-user config location. State machine `DISABLED` / `UNAVAILABLE` / `READY` / `ACTIVE`. YES failure preserves consent but becomes UNAVAILABLE; NO disables without uninstalling unrelated global package. **DoD:** rerun/setup, uninstall and failed doctor behave deterministically.
- [ ] **DC-028 — Create conditional capability/discovery gate.** Wire persistent user choice + current health into MCP server registration; hide all browser names on OFF/unhealthy and reject stale requests after changes. Refresh server schema/notification or require documented reconnect if client caches old schema. **DoD:** real MCP `tools/list` (not just local variables) shows zero browser options on NO, including binary installed + NO.
- [ ] **DC-029 — Test setup/capability states.** Mock npm/doctor and real Windows subprocess startup as available: YES success, NO/blank, failed install/doctor, uninstall after enable, config toggle, schema refresh, normal non-browser Worker running. **DoD:** A01–A05, A19/A20 pass where applicable; no Chromium on boot.

## 9. B2 — Minimal outbound MCP stdio client (no replacement server)

- [ ] **DC-030 — Implement adapter lifecycle.** New minimal `src/lib/browser-mcp-adapter.ts` or approved equivalent with `@modelcontextprotocol/sdk` `Client` + `StdioClientTransport`, official `agent-browser mcp`. Initialize/tools/list only after an authorized first operation, enforce startup timeout and compatibility manifest. **DoD:** fake MCP handshake/close passes; no process at idle.
- [ ] **DC-031 — Strict v1 operation mapping.** Validate every input at gateway and adapter and forward only verified fields for open/snapshot/click/fill/press/wait/screenshot/get_url/close. Refuse `eval`, `extraArgs`, unknown upstream tools and unused profiles. **DoD:** rejected operation never reaches upstream.
- [ ] **DC-032 — Typed results and safe screenshot evidence.** Preserve MCP text, image and `isError`, bound image size/type, save requested evidence only in controlled absolute Workspace directory; redact logs and avoid dumping page DOM/cookies/tokens. **DoD:** type-preserving screenshot and oversized/bad path cases verified.
- [ ] **DC-033 — Timeouts, crash and idempotent cleanup.** Handle startup/tool deadlines, in-flight cancellation, failed transport, abnormal child exit; terminate only adapter-owned child and browser session. **DoD:** no subprocess leak, no stale session reuse after crash.
- [ ] **DC-034 — Mock-adapter regression suite.** `scripts/test-browser-mcp-adapter.mjs` or repository-native equivalent with fake MCP fixture. **DoD:** handshake, schema mismatch, allowlist, image/error, timeout and cleanup pass without downloading Chromium.

## 10. B3 — Lazy browser family, actual discovery and authorization

- [ ] **DC-035 — Add optional browser runtime family.** Extend `src/lib/runtime-families.ts` and `src/tools/work-gateway.ts`; do **not** include browser in unconditional `JOB_PRELOAD_FAMILIES`. **DoD:** Worker/Job startup launches no browser MCP or Chromium.
- [ ] **DC-036 — Build per-server capability-aware work_tool schema.** Replace static exposure of `WORK_TOOL_OPERATIONS` with currently enabled/healthy operation list when `work_tool` is registered. Handle capability changes via supported `tools/list_changed` and/or server/session refresh; stale invocation always rechecked. **DoD:** real `tools/list` contains no browser names when off; enabled/healthy discovery reflects available options.
- [ ] **DC-037 — Enforce Job/lease policy on every browser operation.** Update `src/lib/tool-work-policy.ts` and necessary `server-factory.ts`/gateway callers to validate confirmed `dev-coding`, live work handle, current lease, capability state and strict arguments both before/after lazy resolve. A valid Custom Job work handle is insufficient. **DoD:** no bypass from stale/forged handle or mismatched Job.
- [ ] **DC-038 — Execution-scoped sessions and origin protection.** Map session to work execution and approved loopback/preview origins. Deny unauthorized external navigation, redirect, unsafe scheme, profile/cookie sharing and path traversal; use verified upstream `allowedDomains` as additional defense. **DoD:** sessions cannot cross Jobs or escape approved origins.
- [ ] **DC-039 — Wire lifecycle revocation.** On `job_stop`, Job switch, registration expiry, revocation, session loss and Worker shutdown, cancel calls/close upstream MCP/browser/owned children; cleanup idempotent even on crash. **DoD:** active session dies when Job stops; new Job gets a fresh one.
- [ ] **DC-040 — Actual-discovery and security suite.** Add `scripts/test-browser-capability.mjs` and `scripts/test-browser-work-gateway.mjs` (or minimal equivalents). Assert `tools/list` contents, OFF→ON→OFF, stale calls, Custom Job rejection, lease races, URLs, screenshot paths and process counts. **DoD:** A06/A08–A14/A20/A27 pass in deterministic tests.

## 11. B4 — Browser-driven Dev Coding goal verification

- [ ] **DC-041 — Add browser QA SOP and classification.** Update `jobs/dev-coding/{JOB.md,SKILL.md}` and relevant testing/validation skills with `N/A`/`OPTIONAL`/`REQUIRED` browser choice. **DoD:** backend tasks never require browser; UI task requiring visual evidence cannot silently skip it.
- [ ] **DC-042 — Integrate runtime observation and evidence.** Use existing `start_process` within confirmed Workspace, approved URL, snapshot/interact/wait and screenshot only when visual evidence helps. Bind URL/origin, screenshot path and result to acceptance ID and content-manifest fingerprint. **DoD:** browser-observed UI bug returns execution to repair even with green unit/build checks.
- [ ] **DC-043 — Connect browser outcome to completion gate.** Extend `completion-gate.mjs` and harness tests to distinguish browser PASS/FAIL/N/A/UNAVAILABLE and ensure required browser absent ⇒ Goal BLOCKED, not DONE. **DoD:** A15–A17 and required-vs-optional scenarios pass.

## 12. B5 — Acceptance and regression

- [ ] **DC-044 — Execute deterministic A01–A20.** Cover setup YES/NO/unhealthy, real tools/list, lazy MCP, unauthorized Job, URL/argument rejection, typed image, stop/timeout and schema refresh using mock MCP. **DoD:** each applicable A01–A20 row includes reproducible command, observation and PASS/FAIL/UNAVAILABLE evidence.
- [ ] **DC-045 — Execute core and Git-optional A21–A36.** Cover checkpoint reset/discovery, red-green/mutation integrity, loop budget, safe snapshot restore, no-Git/no-Git-permission, hash drift and new work-handle binding. **DoD:** all applicable A21–A36 rows evidence-backed; no synthetic PASS.
- [ ] **DC-046 — Windows browser smoke on approved localhost.** On explicit opt-in Windows environment with pinned installed browser: actual `agent-browser mcp` open/snapshot/interact/screenshot/close. Verify Worker/tray/tunnel still connect and `job_stop` kills owned sessions; repeat no-browser smoke. **DoD:** one complete UI task Goal PASS observed, and NO path unaffected. Record environmental limits if unavailable.
- [ ] **DC-047 — Security and regression sweep.** Re-run work-handle/lease/workspace boundary suite, secret/log/path checks, old Job functionality and compatibility cases. Review actual touched callers and generated artifacts. **DoD:** no permission regression, no unexpected browser exposure, no leaked secrets.

## 13. P5 — Release and completion

- [ ] **DC-048 — Run full repository checks.** `npm run build`, `npm run validate:jobs`, focused Dev Coding/browser scripts once created, `npm test`, `npm run test:all` and applicable CI; review baseline/pre-existing failures separately. **DoD:** tested commit/evidence and status reported precisely.
- [ ] **DC-049 — Update documentation and Job metadata.** Version `jobs/dev-coding/job.yaml` only after behavior/gates exist; document optional official installer, capability OFF/ON/reconnect and browser limitations, checkpoint/resume, snapshot restore and Git-optional operation. Keep `docs/browser-mcp-contract.md` version pinned. **DoD:** instructions match actual tested implementation.
- [ ] **DC-050 — Final diff, scope and handoff.** Run machine-readable DIFF_REVIEW (snapshot + Git when authorized), inspect changed files/links and acceptance A01–A36. Produce result: what changed, validation evidence, Goal verification, excluded/unavailable checks and risks. **DoD:** DONE only with mandatory gates PASS; otherwise BLOCKED/FAILED_VALIDATION/ENVIRONMENT_LIMIT honestly documented.

## 14. Final gates / task status template

Record this under each active Task ID or in its task-specific checkpoint:

```yaml
task_id: DC-XXX
status: TODO
depends_on: []
goal: ""
acceptance_signals: []
scope_paths: []
baseline_fingerprint: null
current_input_fingerprint: null
test_source_hash: null
iterations_used: 0
max_iterations: 8
max_active_minutes: 45
last_failing_check: null
last_result: null
remaining_goal_gap: []
gates:
  CODE_QA: NOT_RUN
  TESTS: NOT_RUN
  BUILD: NOT_RUN
  RUNTIME: NOT_RUN
  BROWSER_QA: N/A
  GOAL: NOT_RUN
  DIFF_REVIEW: NOT_RUN
evidence_refs: []
next_action: null
```

**Required actual regression commands** (new browser scripts are tasks, not present until implemented):

```powershell
npm run build
npm run validate:jobs
node scripts/test-dev-coding-harness.mjs
# Once DC-029/DC-034/DC-040 create their test scripts:
node scripts/test-browser-capability.mjs
node scripts/test-browser-mcp-adapter.mjs
node scripts/test-browser-work-gateway.mjs
npm test
npm run test:all
```

**No-Git target Workspace:** use local test/build and snapshot-based diff/revision evidence; do not require Git commands. **Browser NO:** actual MCP discovery must contain zero browser operations, and stale calls must fail closed. **Browser YES:** official pinned Vercel install + verified health, lazy outbound MCP stdio and dev-coding-only permission. **Release of this GPTWorker repository:** hosted CI evidence bound to exact source commit when available.

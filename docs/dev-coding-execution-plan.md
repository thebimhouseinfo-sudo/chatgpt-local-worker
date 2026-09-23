# Dev Coding Upgrade — Executable Implementation Plan

**Status:** READY FOR IMPLEMENTATION (plan only; source code unchanged).  
**Parent:** [Dev Coding Job Upgrade](./dev-coding-job-upgrade.md)  
**Repository:** `thebimhouseinfo-sudo/chatgpt-local-worker`  
**Architecture decision:** Use the **official Vercel `agent-browser mcp` stdio server** via the existing `@modelcontextprotocol/sdk` client; no custom browser engine, Chromium shell, replacement MCP server or ad-hoc CLI-output parser.

## 0. Baseline: existing code and hard requirements

The current `jobs/dev-coding` pack has its own Job definition, SOP, specialist skills and existing preflight/quality/diff/completion harnesses. `quality-gate.mjs` already discovers project-native test/lint/type/build scripts. `completion-gate.mjs` currently reports a structural `ok` even in discovery-only mode: that result must **not** be mistaken for completed test/runtime/goal verification.

**Critical code finding:** `src/tools/work-gateway.ts` registers `work_tool` using a **static `z.enum(WORK_TOOL_OPERATIONS)`** built from `FAMILY_TOOLS`. Merely disabling the browser adapter will still expose names to ChatGPT if browser operations remain in that enum. New browser operations MUST be excluded from the **actual advertised `tools/list` schema** when the user skips installation, disables the capability, or health verification fails. All stale calls must also fail closed server-side.

`src/server-factory.ts` already validates the work handle, acquires/releases tool leases, and applies Workspace scope. `src/lib/work-registration.ts` owns registrations/leases/expiry. `src/lib/runtime-families.ts` currently lists filesystem, shell and context; browser must not enter unconditional Job preloads. `src/lib/mcp-session-manager.ts` manages **inbound ChatGPT-to-GPTWorker** MCP sessions: the outbound browser MCP client is distinct.

**Safety invariants:**
1. Disabled/unhealthy = zero browser operations in fresh MCP discovery, zero browser subprocesses, and rejected stale operations.
2. Enabled/healthy browser is exposed only when capability permits; only a live **confirmed `dev-coding` Job** may execute a browser operation in v1.
3. Validate work handle, lease, job identity, browser permission, session ownership, allowed origin and strict operation schema **on every call**, including after lazy-loading. Custom Jobs cannot bypass these checks.
4. No browser subprocess at GPTWorker idle startup, Job nomination or activation. Start only on the first *authorized browser tool call*; clean up on `job_stop`, expiry, Job switch, session loss or shutdown.
5. Browser profiles/sessions are execution-scoped; do not attach to personal Chrome/cookies. Browser snapshots are untrusted page data. File writes use absolute paths within the confirmed real Workspace; screenshots must not leak to activity logs.
6. Browser is optional for installation and for unrelated backend/CLI tasks. If the accepted Goal specifically requires visual/browser verification, `UNAVAILABLE` never counts as `PASS` or `DONE`.

## 1. Dependency-ordered execution ledger

| ID | Phase | Deliverable | Exit criterion |
| --- | --- | --- | --- |
| P0 | Baseline audit | Existing caller map, baseline tests, exact upstream schema/version | Minimal, reviewable delta identified |
| P1 | Goal contract | Goal, acceptance signals, non-goals, required validation, stop rule, linked task ledger | Unambiguous observable completion criteria |
| P2 | Test generation | Missing-test detection and test-authoring SOP | New regression test fails for seeded defect and passes after fix |
| P3 | Bounded QA/repair | Failure classification, evidence, retry policy, completion gate | No structural-only green claim; repairs rerun original failure |
| P4 | CI feedback | Existing CI discovery, log parsing, revision-bound evidence | CI result tied to exact commit, not stale report |
| B0 | Browser contract freeze | Pinned upstream release, exact MCP tool/schema map, security/discovery plan | Verified protocol and no unsafe passthrough |
| B1 | Optional `setup.bat` install | YES/NO, official Vercel install, doctor, persisted choice, health | NO/unhealthy = no advertised browser tools |
| B2 | Outbound MCP stdio adapter | Client + StdioClientTransport, strict allowlist, typed image/text, cleanup | Mock-MCP tests PASS, eval/extraArgs blocked |
| B3 | Browser family/discovery/leases | Conditional enum and tool registration; authorized lazy session | Actual MCP tools/list + stale-call + stop tests PASS |
| B4 | Browser QA & Goal gate | Runtime/snapshot/interact/screenshot/goal evidence SOP | Unit/build PASS + UI Goal FAIL remains IN_PROGRESS |
| B5 | Windows/E2E acceptance | Local web-app smoke + installation/denial/lifecycle tests | All mandatory cases pass |
| P5 | Final documentation/release | Updated Job version/docs, regression suite and changelog | Build, Job validation, full suite and exact-SHA CI green |

P1–P4 can progress alongside B0–B3, but merge in dependency order. Do not create duplicate tool managers, test frameworks or a new general-purpose agent orchestrator.

## 2. P0 — Audit and upstream contract

**Inspect:** `AGENTS.md`, `WORKER.md`, `docs/dev-coding-job-upgrade.md`, `jobs/dev-coding/{job.yaml,JOB.md,SKILL.md,harness/*,skills/*}`, `src/{lib/runtime-families.ts,lib/tool-work-policy.ts,lib/work-registration.ts,lib/work-registration.ts,tools/work-gateway.ts,server-factory.ts}`, `setup.bat`, `.github/workflows/ci.yml` and existing relevant tests.

- [ ] Record clean/dirty state, baseline commit and baseline `npm run build`, `npm run validate:jobs`, `npm test`.
- [ ] Trace the actual `work_tool` schema through registration, `tools/list`, activation, authorization, lease, lazy resolver, work stop/expiry and MCP session refresh.
- [ ] Inventory exactly which existing quality/coverage/evidence gates can be improved instead of duplicated.
- [ ] Verify **official upstream** target version, MCP protocol, `tools/list` (including pagination), tool names/typed schemas, `session`, `allowedDomains`, screenshot result/error formats and actual Windows installation/doctor behavior. Record in `docs/browser-mcp-contract.md`.
- [ ] Check upstream install's Node compatibility against GPTWorker's existing Node 22 CI; keep global browser install optional and separate from mandatory GPTWorker dependency graph.
- [ ] Build a deterministic fake upstream MCP stdio fixture to test the adapter without downloading Chrome or using network.

**Gate:** B0's exact names and schema are verified before any adapter code, and source edits are scoped to mapped callers.

## 3. P1–P4 — Closed Dev Coding implementation loop

**P1 Goal contract:** Update `JOB.md`, `SKILL.md`, relevant `skills/execution-planning.md` and `harness/execution-preflight.mjs`. Derive a compact task contract with `goal`, `acceptance_signals`, `non_goals`, `validation_methods`, `required_gates`, and `stop_condition`. Link `TASKS.md` when a planning bundle exists; ambiguous product success ⇒ `BLOCKED`. Tests: multiple acceptance signals, no bundle, bundle, blocked ambiguity and preserved non-goals.

**P2 Test generation:** Prefer existing repository test command → add to existing suite → small deterministic repo-owned script → extend CI only when justified. Upgrade `skills/testing.md`/`skills/validation.md`, reuse `quality-gate.mjs`. Generate tests observing behavior, not implementation shape; never weaken existing tests. Execute new tests locally and seed a defect to confirm meaningful nonzero failure. Write files only under approved absolute Workspace paths; internally test scripts may derive paths from repo cwd. Tests: existing/missing suite, fake-PASS, symlink/path escape and dirty worktree.

**P3 QA/repair:** Improve existing `SKILL.md`, `skills/debugging.md`, `harness/quality-gate.mjs` and `completion-gate.mjs` without a second long-running controller. Record `iteration`, `hypothesis`, `last_change`, `failing_check`, `last_result`, `remaining_goal_gap`, `next_action`. Flow: targeted → related → lint/type → build → applicable CI/runtime/browser → Goal. Each repair reruns **the original failing check first**. Never retry unchanged action with unchanged hypothesis; bounded attempts and explicit `DONE`, `BLOCKED`, `FAILED_VALIDATION`, `ENVIRONMENT_LIMIT`.

**P4 CI:** Use existing workflow/test scripts. Push/trigger CI only when task/delivery authorizes it. Record workflow URL/id, SHA, run status, failure logs and rerun status; evidence is invalid if commit changes. Preserve non-GitHub/offline development. CI green does not override missing required Goal evidence.

**Technical completion-gate schema:**

| Gate | Allowed states |
| --- | --- |
| CODE_QA | PASS / FAIL / N/A |
| TESTS | PASS / FAIL / UNAVAILABLE |
| BUILD | PASS / FAIL / N/A |
| RUNTIME | PASS / FAIL / NOT_RUN |
| BROWSER_QA | PASS / FAIL / N/A / UNAVAILABLE |
| GOAL | PASS / FAIL / BLOCKED |
| DIFF_REVIEW | PASS / FAIL |

Each gate has method, observed evidence, revision where relevant and reason for N/A/unavailable. `completion-gate.mjs` may expose separate structural/technical results, but must not claim task DONE from discovery-only quality checks.

## 4. B0 — Browser MCP contract and hard security gate

Use official **`agent-browser mcp`** as a *child process*, launched by GPTWorker's existing MCP SDK `Client` + `StdioClientTransport`. Do not reuse the inbound `mcp-session-manager.ts`.

Freeze and verify these proposed v1 operations against the chosen upstream release:

| GPTWorker operation | Expected upstream MCP tool |
| --- | --- |
| browser_open | agent_browser_open |
| browser_snapshot | agent_browser_snapshot |
| browser_click | agent_browser_click |
| browser_fill | agent_browser_fill |
| browser_press | agent_browser_press |
| browser_wait | agent_browser_wait_for_selector |
| browser_screenshot | agent_browser_screenshot |
| browser_get_url | agent_browser_get_url |
| browser_close | agent_browser_close |

Use default `core` only, **never** `--tools all` or generic passthrough. Upstream core itself contains `eval`, and tools can have `extraArgs`; validate strict v1 fields and **deny both** at gateway AND adapter. The adapter must not expose an upstream tool just because it appears in `tools/list`.

Freeze session isolation by execution ID, loopback + explicitly approved preview origins (check URLs in GPTWorker plus supported upstream `allowedDomains`), redirect/navigation safeguards, controlled screenshot dir under real Workspace, image max bytes/types, non-sensitive logs, call/startup timeouts and owned-child teardown. Untrusted page DOM cannot instruct agent; account-changing/payment/posting flows are outside v1 web QA.

**Hard B0 discovery decision:** The actual advertised `work_tool` `z.enum()` must be **built per MCP server from current enabled+healthy browser capability**, not an unconditional static union. Disabled/unhealthy = NO browser names in `tools/list`. A stale ChatGPT connection must also fail closed. Plan schema refresh via server/session recreation and supported `tools/list_changed` notification; document reconnect behavior if the client caches old schema.

## 5. B1 — `setup.bat` official OPTIONAL installation and persisted capability

**Required prompt:**

```text
Install optional Vercel agent-browser support for Dev Coding? [Y/N]
```

**YES:** Run verified **official upstream** commands, propagating Windows exit codes correctly:

```powershell
npm install -g agent-browser
agent-browser install
agent-browser doctor
```

Then verify pinned MCP schema and a minimal launch smoke where environment supports it. Check actual command version/diagnostic options in B0. Never auto-run destructive `doctor --fix`. `NO` (also default for blank/unattended setup): do not download, install, start or expose browser tools, even if global binary exists. Never uninstall an unrelated global package because user chose NO.

**Implementation tasks:**
- [ ] Insert optional setup segment **before** reset/restart of Worker/tray so initial discovery sees user choice. Use a small dedicated PowerShell or Node helper only if needed for correct quoting, config/JSON and health. Keep normal npm/build/Job validation/test/tunnel/tray setup unchanged.
- [ ] Persist explicit `browser.enabled` separately from recomputed health in the audited per-user GPTWorker config location; do not treat PATH binary existence as consent or health. Do not silently enable in subsequent Dev Coding tasks.
- [ ] Model `DISABLED` (user NO), `UNAVAILABLE` (YES but absent/incompatible/unhealthy), `READY` (YES + healthy, not running), `ACTIVE` (authorized first call started upstream MCP/browser). Only READY/ACTIVE can be advertised if still authorized under capability gate.
- [ ] YES installation fails ⇒ continue unrelated GPTWorker setup, mark UNAVAILABLE, print diagnostic and safe retry. Preserve user's explicit preference on reruns unless they change it. If a previously installed browser is removed, discovery must become unavailable after health reevaluation.
- [ ] Test YES success, NO/default, failed npm/install/doctor, global binary present with NO, binary removed after YES, rerun/config persistence and detached Windows Worker startup.

**B1 gate:** fresh MCP discovery after NO/unhealthy contains *zero* browser operation names; no browser child is spawned. YES+healthy makes capability eligible **without** starting Chrome until first authorized call.

## 6. B2 — Minimal outbound stdio adapter

**New targeted module:** e.g. `src/lib/browser-mcp-adapter.ts` with injectable executable/transport factory. Use actual installed MCP SDK client API and `StdioClientTransport`; command `agent-browser`, args `["mcp"]` (explicit verified core profile only if needed).

- [ ] On *first authorized* invocation: bounded subprocess startup → `initialize` → paginated `tools/list` if needed → compatibility check → strict validated `tools/call`.
- [ ] Verify allowlist for **every invocation**, sanitize typed arguments and prohibit `eval`, `extraArgs`, unknown profiles/operations and arbitrary shell arguments.
- [ ] Preserve typed MCP text/image blocks and `isError`. Limit byte size; keep screenshot bytes out of normal activity log; persist requested evidence only under validated absolute controlled Workspace path.
- [ ] Implement startup/call timeouts, cancellation, crashed child, transport errors, cleanup and idempotent close; terminate **only adapter-owned** processes.
- [ ] Add mock-MCP tests for initialize, paginated discovery, valid calls, schema mismatch, unknown tool, eval/extraArgs denial, typed screenshot, timeout/crash and cleanup.

**B2 gate:** no homemade browser protocol or CLI-output parser; deterministic fake MCP tests pass.

## 7. B3 — Browser runtime family + actual MCP discovery gating

**Inspect/touch only as required:** `src/lib/runtime-families.ts`, `src/tools/work-gateway.ts`, `src/lib/tool-work-policy.ts`, `src/server-factory.ts`, existing Job activation/stop and work registration call sites, new minimal browser tool registration wrapper.

- [ ] Add `browser` to runtime-family type; **NOT** to unconditional `JOB_PRELOAD_FAMILIES`. Do not start MCP during Worker boot/Job nomination/activation.
- [ ] Replace global `WORK_TOOL_OPERATIONS` exposure with a **capability-aware per-server** list before `work_tool` registration; disabled/unhealthy browser is missing from real `tools/list` input schema. Verify discovery through a real MCP client test, not just internal assertions.
- [ ] On capability toggle, uninstall, crash or health transition, update advertised schema via supported server/session reconstruction and tools-list notification. Reconnect/refresh ChatGPT if client caches old schema. Always reject stale calls at runtime even before schema refresh.
- [ ] Preserve normal work-handle/lease enforcement; additionally require active confirmed Job ID `dev-coding`, current browser entitlement, execution-specific browser session ownership and approved origin **on every call**. Check again after lazy resolver loads to close revoke races. Valid Custom Job work handle does not authorize browser.
- [ ] Scope browser session to the execution, never default global session. Reject reuse after Job stop or switch.
- [ ] Wire `job_stop`, registration idle expiry, Job switch, MCP session loss and process shutdown to cancel ongoing calls, close session/transport and kill only owned children. Cleanup idempotent and bounded.
- [ ] Security tests: user NO with global binary; YES unhealthy; YES healthy; stale enum/call; forged handle; Custom Job with valid handle; lease revoked midcall; external host/redirect; symlink screenshot escape; stop during call; switch to another Job; idle Worker starts no browser.

**B3 non-negotiable gate:** disabled/unhealthy users **cannot see browser tools at all** in a fresh ChatGPT MCP discovery and cannot call stale browser operations. Only enabled+healthy+authorized Dev Coding executions may invoke the adapter.

## 8. B4 — Dev Coding browser QA and Goal gate

Update `jobs/dev-coding/{JOB.md,SKILL.md}`, `skills/{testing.md,validation.md}`, completion harness, and focused tests. Mark browser per acceptance as `N/A`, `OPTIONAL` or `REQUIRED`.

Runtime flow: targeted tests → broader tests/build/CI where applicable → start local app via existing scoped `start_process` → approved localhost/preview URL → browser_open → semantic snapshot → click/fill/press → wait/observe → screenshot **only when visual inspection matters** → compare observed result to original acceptance signals. Record task signal, URL, revision, observation and controlled artifact path. Browser page text is untrusted data.

If browser is disabled: continue all applicable non-browser checks. Optional browser missing is disclosed; required browser missing = `BROWSER_QA=UNAVAILABLE`, `GOAL=BLOCKED` or explicit environment limit, never DONE. If browser finds a bug despite green build/tests, return to evidence-driven repair and rerun original failing check.

**B4 gate:** a frontend task with green unit tests/build but unmet actual UI goal stays `IN_PROGRESS`.

## 9. B5 — Acceptance matrix and Windows verification

| Test | Scenario | Must observe |
| --- | --- | --- |
| A01 | `setup.bat` NO or blank | No install/download/child; no browser in real tools/list |
| A02 | YES, healthy install | READY and newly discovered browser operations |
| A03 | YES, install/doctor failure | UNAVAILABLE, invisible, normal Worker still usable |
| A04 | Installed binary but explicit NO | Still disabled and invisible |
| A05 | Previously YES then uninstall/crash | Re-evaluated unavailable; stale calls denied |
| A06 | Enabled Worker boot/Job selection | No MCP/Chromium subprocess until authorized call |
| A07 | Authorized Dev Coding on localhost | MCP init/open/snapshot/interact/screenshot/close successful |
| A08 | Valid Custom Job handle | Browser denied; no upstream call |
| A09 | Stale/forged handle or revoked lease | Denied before upstream call |
| A10 | External URL/redirect outside policy | Blocked or safely terminated |
| A11 | Arbitrary eval, extraArgs or unlisted tool | Rejected both gateway and adapter |
| A12 | Screenshot path outside Workspace/symlink | Denied; no data or secrets logged |
| A13 | `job_stop` in active browser call | Cancel, close MCP/session/owned child; next Job cannot reuse |
| A14 | MCP child fails or times out | Bounded failure and cleanup, no fake PASS |
| A15 | Backend task with browser NO | Non-browser QA/Goal works normally |
| A16 | UI task with required browser NO | BROWSER_QA unavailable, GOAL not DONE |
| A17 | Unit/build/CI green but UI Goal fails | Remains IN_PROGRESS and repairs |
| A18 | CI green for old SHA | Evidence invalidated on new code |
| A19 | Windows Worker + tunnel/tray setup | Existing behavior preserved for YES and NO |
| A20 | MCP session refresh after setting change | Actual schema reflects new capability, stale calls blocked |

**Test files to implement as needed:** `scripts/test-browser-capability.mjs`, `scripts/test-browser-mcp-adapter.mjs`, `scripts/test-browser-work-gateway.mjs`; expand `scripts/test-dev-coding-harness.mjs` and Windows setup smoke. Mock MCP/security/lifecycle tests run in required CI. Real browser download/launch acceptance is conditional/opt-in so CI does not fail for users who chose NO.

## 10. Commit sequence, commands and final DoD

Suggested reviewable commits: P0 baseline/contract → P1 task contract → P2 test authoring → P3 repair/completion → P4 CI feedback → B0 frozen browser contract → B1 setup/capability → B2 adapter/mock tests → B3 discovery/auth/lifecycle → B4 browser QA/goal → B5 Windows/E2E/docs. During integration, browser config defaults OFF. Don't merge B3 until actual MCP tools/list no-exposure and stale-call tests are green.

After each phase run focused tests, diff review and record results. Final actual implementation commands (browser script names are **planned**, not existing until added):

```powershell
npm run build
npm run validate:jobs
node scripts/test-dev-coding-harness.mjs
node scripts/test-browser-capability.mjs
node scripts/test-browser-mcp-adapter.mjs
node scripts/test-browser-work-gateway.mjs
npm test
npm run test:all
git diff --check
```

With browser explicitly installed, additionally run `agent-browser doctor` and a real approved localhost MCP/browser smoke. With no browser, assert **zero browser operations** in a real MCP tools/list response.

**Final DoD:** Existing GPTWorker tools, boundaries, work handles, Job lifecycle, tunnel/tray and tests remain working; Coder creates effective tests, repairs from evidence and proves Goal independently of green technical checks. Setup uses official optional Vercel installation, disabled/unhealthy browser is undiscoverable and uncallable, enabled/healthy browser starts lazily only for valid Dev Coding and fully cleans up. All required A01–A20 acceptance scenarios have genuine passing evidence or are explicitly reported as environment-limited, never silently relabeled PASS.

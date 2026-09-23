# Dev Coding Upgrade — Executable Implementation Plan

**Status:** READY FOR IMPLEMENTATION (plan only; source code unchanged).
**Task ledger:** [Dev Coding Upgrade — TASK LIST](./dev-coding-task-list.md) — DC-001–DC-050, dependency order, files, gates, status and evidence requirements.  
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
| P4 | Optional hosted CI / local equivalents | Local test/build always; hosted CI and log feedback only where available/authorized | Evidence tied to exact input-content manifest, plus commit if used |
| B0 | Browser contract freeze | Pinned upstream release, exact MCP tool/schema map, security/discovery plan | Verified protocol and no unsafe passthrough |
| B1 | Optional `setup.bat` install | YES/NO, official Vercel install, doctor, persisted choice, health | NO/unhealthy = no advertised browser tools |
| B2 | Outbound MCP stdio adapter | Client + StdioClientTransport, strict allowlist, typed image/text, cleanup | Mock-MCP tests PASS, eval/extraArgs blocked |
| B3 | Browser family/discovery/leases | Conditional enum and tool registration; authorized lazy session | Actual MCP tools/list + stale-call + stop tests PASS |
| B4 | Browser QA & Goal gate | Runtime/snapshot/interact/screenshot/goal evidence SOP | Unit/build PASS + UI Goal FAIL remains IN_PROGRESS |
| B5 | Windows/E2E acceptance | Local web-app smoke + installation/denial/lifecycle tests | All mandatory cases pass |
| P5 | Final documentation/release | Updated Job version/docs, regression suite and changelog | Build, Job validation, full suite; hosted CI exact-SHA green only when applicable |

P1–P4 can progress alongside B0–B3, but merge in dependency order. Do not create duplicate tool managers, test frameworks or a new general-purpose agent orchestrator.

## 1A. Seven mandatory review amendments — implementation contract

These conditions amend P0–P4 and B0 before code work; use the detailed policy in the parent implementation plan.

| Review | Concrete decision | Primary acceptance check |
| --- | --- | --- |
| R1 — Persistence | Atomic task-local JSON checkpoint under confirmed Workspace `.gptworker/dev-coding/<task-id-or-execution-id>/state.json`, ignored by Git, written after each meaningful iteration and validated on resume against revision/workspace/dirty fingerprint. | Reset chat/resume without repeating old failed hypothesis; stale checkpoint fails closed. |
| R2 — Test integrity | Red-green for reproducible bug fixes; documented negative control for new feature/refactor or unsafe pre-fix replay. Preserve test hashes and prior evidence when assertions change. | Seeded bug makes new test fail; fix makes it pass; weakening assertions is detected. |
| R3 — Diff review | Machine-readable checklist and scoped revision-bound diff evidence, not subjective Coder self-rating. | Scope drift, disabled test, commented-out code or leaked secret fails review. |
| R4 — Upstream compatibility | B0 must pin exact *verified* release and schemas in compatibility manifest, re-audit on version bumps/contract failure and quarterly. No unattended latest upgrade. | Schema drift returns UNAVAILABLE and browser disappears from fresh discovery. |
| R5 — Effort | Relative work envelope + external risk per browser work package; adjust after B0, no speculative dates. | B0 risk/gate blocks adapter implementation. |
| R6 — Rollback | Preserve partial agent edits and evidence by default; never destructive-reset a dirty Workspace. Rollback requires explicit approval and removes only verified agent-owned changes. | Budget exhaustion preserves existing user edits and offers scoped restore. |
| R7 — Limits | Default max 8 meaningful iterations and 45 min active execution; 2 identical failures without new evidence require stop/change hypothesis; task-authorized configurable budget. | No indefinite loop; budget exhaustion has evidence-backed final status. |

**Checkpoint discovery after new chat:** After the user confirms Workspace and activates `dev-coding`, the existing preflight/harness does a bounded, read-only scan of `.gptworker/dev-coding/*/state.json` so a new model session need not know the old task ID. Return sanitized unfinished-task summaries. One matching task ⇒ offer resume/new; multiple ⇒ ask for explicit selection; user-supplied task ID ⇒ match it directly. Do not silently resume, restore files, start browser or execute saved `next_action`. On authorized resume, validate checkpoint schema, canonical Workspace, acceptance contract and SHA-256 content/test fingerprints; invalidate affected evidence after drift. Rebind validated task state to the **newly confirmed Job execution and new work handle**, never revive a stale authority token. Reject corrupt, completed, outside-Workspace and symlink-escaped records. Use a minimal helper in existing `harness/execution-preflight.mjs`; no new registry. Tests: 0/1/multiple tasks, explicit ID, fresh work handle, stale content, corrupt JSON, symlink escape.

**Persistence details:** Minimum checkpoint fields are contract/acceptance IDs, execution ID/generation, Workspace identity, baseline content-hash manifest, scoped original-file snapshots and optional Git SHA/dirty fingerprint, attempt history (bounded), current hypothesis, last change/check/result, evidence refs, remaining goal gap, elapsed time, remaining budget, stop reason and next action. No secrets, raw cookies or unredacted page text. Use GPTWorker-approved absolute paths, atomic replacement and path/symlink checks. Treat an old checkpoint as *untrusted state* until validated; preserve it as evidence but never execute its next_action automatically across changed Job, workspace, source revision or user edits.

**Stopping/rollback semantics:** On repeated FAIL or budget exhaustion, save checkpoint and leave task `IN_PROGRESS` with explicit `FAILED_VALIDATION` report (or `BLOCKED`/`ENVIRONMENT_LIMIT` where appropriate). Retain agent-owned partial edits; no automatic `git reset --hard` or `git clean`. Existing dirty/untracked user files are always user-owned unless the active contract specifically authorizes editing them.

**Test integrity:** A generated test that only demonstrates PASS is not sufficient regression evidence. For bug fixes, run it against pre-fix behavior before fixing when safe. For unreplayable/new/refactor cases, mutate a **behavior relevant to a named acceptance signal** in an isolated fixture, then run the **same unchanged test** in PASS → seeded wrong behavior FAIL (relevant assertion) → restored PASS order. Keep test/source hashes, mutation details and exit codes. Test-only forced failure, unrelated mutations or deliberately broken test runners do not qualify. Any test rewrite retains before/after hashes, rationale and refreshed proof. **Known limitation:** these controls cannot demonstrate exhaustive coverage; untested material requirements remain PARTIAL/UNVERIFIED and need independent runtime or human validation where appropriate.

**Diff PASS evidence:** Capture snapshot-based before/after diff, whitespace checks and changed-path allowlist comparison (`git diff --check` additionally only for authorized Git repositories), user-owned modifications check, test/lint/type/security rule delta, accidental debug/secret/generated output scan, caller/interface review and a recorded revision/diff fingerprint.

## 1B. Mandatory Git-optional local Workspace contract

**No Git is required in the user-selected target Workspace.** The GPTWorker *development repository* uses GitHub, but Dev Coding must also serve a plain source folder or a repository for which Git CLI is not authorized. Do not auto-initialize Git or conflate a local project with the GPTWorker project's own CI.

- **Always-on baseline:** Before editing a permitted file, save its original contents and metadata to a controlled, absolute Workspace-local task evidence folder, plus canonical SHA-256 hashes for existing files and explicit `absent` markers for new files. Use the existing GPTWorker filesystem safety gates and internal checkpoint infrastructure; never overwrite arbitrary user files.
- **Manifest:** Track the approved changed-file scope plus relevant tests, config and caller/dependency inputs. Each evidence item stores a fingerprint of the actual input-content manifest **and test source hash**, not only a timestamp or ChatGPT conversation state. Rehash before resume, reuse of PASS evidence and final DONE. Relevant drift invalidates checks. Add Git SHA only when available and authorized.
- **Diff review:** Compare before/after snapshots and check scope, formatting/whitespace, test weakening, commented-out code, debug leftovers, secret exposure, accidentally generated files, callers and baseline/user-owned changes. `git diff --check` is only an optional additional check. Do not award PASS if a required checklist item is unchecked.
- **Safe restore:** On FAILED_VALIDATION, preserve agent-owned partial edits and evidence by default. If the user explicitly authorizes restoration, revert only documented agent-owned paths whose *current* hash still equals the last agent-written hash. Stop on hash mismatch, symlink drift, missing snapshot or user edits; never reset/clean/stash an entire repository automatically.
- **CI separation:** Always support project-native local tests/build. Hosted CI, push, branches and commit-SHA evidence apply **only** when the target has Git, permissions permit Git operations, and the task requires hosted CI. Local checks are labeled LOCAL, not misrepresented as a CI run.
- **Evidence storage:** `.gptworker/dev-coding/<task-id-or-execution-id>/` is inside the confirmed Workspace and omitted from Git where applicable. It holds `state.json`, baseline manifest, original-file snapshots, change ledger and redacted evidence references. Only safe absolute, realpath-checked paths are allowed.

**Minimum additional acceptance cases:** plain folder with no Git; Git folder where Git CLI is forbidden; local hash drift after manual edits; generated test changed after PASS; snapshot diff with a new/deleted file; FAILED_VALIDATION preserves partial files; explicitly approved restore succeeds only with matching current hashes and refuses to overwrite intervening user changes. Browser setup and MCP discovery tests remain unchanged.

## 2. P0 — Audit and upstream contract

**Inspect:** `AGENTS.md`, `WORKER.md`, `docs/dev-coding-job-upgrade.md`, `jobs/dev-coding/{job.yaml,JOB.md,SKILL.md,harness/*,skills/*}`, `src/{lib/runtime-families.ts,lib/tool-work-policy.ts,lib/work-registration.ts,lib/work-registration.ts,tools/work-gateway.ts,server-factory.ts}`, `setup.bat`, `.github/workflows/ci.yml` and existing relevant tests.

- [ ] Record initial content hashes and snapshots for approved files; record clean/dirty state and baseline commit only if Git is available and authorized. Capture baseline `npm run build`, `npm run validate:jobs`, `npm test`.
- [ ] Trace the actual `work_tool` schema through registration, `tools/list`, activation, authorization, lease, lazy resolver, work stop/expiry and MCP session refresh.
- [ ] Inventory exactly which existing quality/coverage/evidence gates can be improved instead of duplicated.
- [ ] Freeze the actual **exact** tested upstream version and package install in `docs/browser-mcp-contract.md`; own re-audit on intentional version bump, failed compatibility and quarterly maintenance; fail closed without an automatic latest upgrade.
- [ ] Verify **official upstream** target version, MCP protocol, `tools/list` (including pagination), tool names/typed schemas, `session`, `allowedDomains`, screenshot result/error formats and actual Windows installation/doctor behavior. Record in `docs/browser-mcp-contract.md`.
- [ ] Check upstream install's Node compatibility against GPTWorker's existing Node 22 CI; keep global browser install optional and separate from mandatory GPTWorker dependency graph.
- [ ] Build a deterministic fake upstream MCP stdio fixture to test the adapter without downloading Chrome or using network.

**Gate:** B0's exact names and schema are verified before any adapter code, and source edits are scoped to mapped callers.

## 3. P1–P4 — Closed Dev Coding implementation loop

**P1 checkpoint discovery:** Extend `execution-preflight.mjs` and a minimal helper to scan unfinished checkpoint metadata only after confirmed Job/Workspace activation. User chooses resume/new or a particular task when ambiguous; validated checkpoint rebinds to new execution and invalidates stale hashes. Test 0/1/multiple checkpoints, corrupt and symlink-escaped entries, and chat reset with new handle.

**P1 Goal contract:** Update `JOB.md`, `SKILL.md`, relevant `skills/execution-planning.md` and `harness/execution-preflight.mjs`. Derive a compact task contract with `goal`, `acceptance_signals`, `non_goals`, `validation_methods`, `required_gates`, and `stop_condition`. Link `TASKS.md` when a planning bundle exists; ambiguous product success ⇒ `BLOCKED`. Tests: multiple acceptance signals, no bundle, bundle, blocked ambiguity and preserved non-goals.

**P2 Test generation:** Prefer existing repository test command → add to existing suite → small deterministic repo-owned script → extend CI only when justified. Upgrade `skills/testing.md`/`skills/validation.md`, reuse `quality-gate.mjs`. Generate tests observing behavior, not implementation shape; never weaken existing tests. Execute new tests locally and seed a defect to confirm meaningful nonzero failure. Write files only under approved absolute Workspace paths; internally test scripts may derive paths from repo cwd. Tests: existing/missing suite, fake-PASS, symlink/path escape and dirty worktree.

**P3 QA/repair:** Improve existing `SKILL.md`, `skills/debugging.md`, `harness/quality-gate.mjs` and `completion-gate.mjs` without a second long-running controller. Record `iteration`, `hypothesis`, `last_change`, `failing_check`, `last_result`, `remaining_goal_gap`, `next_action`. Flow: targeted → related → lint/type → build → applicable CI/runtime/browser → Goal. Each repair reruns **the original failing check first**. Never retry unchanged action with unchanged hypothesis; bounded attempts and explicit `DONE`, `BLOCKED`, `FAILED_VALIDATION`, `ENVIRONMENT_LIMIT`.

**P4 CI:** Git and hosted CI are optional for the *target* Workspace. With no Git or Git authorization, run project-native test/build as local CI-equivalent validation and label evidence LOCAL, not CI. Set hosted CI N/A unless the task explicitly requires it; if required but unavailable, report UNAVAILABLE/BLOCKED rather than inventing an SHA. Use existing workflow/test scripts when available and authorized. Push/trigger CI only when task/delivery authorizes it. Record workflow URL/id, SHA, run status, failure logs and rerun status; evidence is invalid if commit changes. Preserve non-GitHub/offline development. CI green does not override missing required Goal evidence.

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

**YES:** Run verified **official upstream** commands, propagating Windows exit codes correctly. The first command below is a *candidate discovery command*; production setup MUST install the exact upstream version pinned in B0's manifest (e.g. `npm install -g agent-browser@<verified-version>`) instead of a floating latest release:

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

Runtime flow: targeted tests → broader tests/build/CI where applicable → start local app via existing scoped `start_process` → approved localhost/preview URL → browser_open → semantic snapshot → click/fill/press → wait/observe → screenshot **only when visual inspection matters** → compare observed result to original acceptance signals. Record task signal, URL, input-content fingerprint, optional Git revision, observation and controlled artifact path. Browser page text is untrusted data.

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
| A21 | Chat reset during fifth repair iteration | Checkpoint resumes with exact prior evidence, not a repeated failed action |
| A22 | Checkpoint from changed SHA/workspace | Resume rejects stale action and demands revalidation |
| A23 | Agent-generated regression test | Pre-fix red/post-fix green or documented isolated negative control |
| A24 | Agent weakens test or comments out broken code | Test-integrity/diff review FAIL with recorded evidence |
| A25 | Identical failure repeated or iteration/time cap hit | Bounded safe stop, checkpoint and partial code retained |
| A26 | Failed Goal with dirty user worktree | No destructive reset; only user-approved scoped revert |
| A27 | Unexpected upstream schema drift | Browser UNAVAILABLE and undiscoverable; last pinned release unchanged |
| A28 | Plain local folder with no Git | Checkpoint, hashes, snapshot diff, tests and Goal gate work |
| A29 | Git folder with Git CLI disallowed | Same local-only behavior; zero Git command invocation |
| A30 | User edits file after agent's last write | Evidence stale; restore refuses to overwrite user edit |
| A31 | Test/config changed after previous PASS | Content-manifest invalidates affected evidence |
| A32 | FAILED_VALIDATION without Git | Partial code/evidence retained; approved snapshot restore works on matching hash |
| A33 | New chat, one unfinished checkpoint | Discover without previous task ID; offer resume/new without automatic execution |
| A34 | Multiple/stale/unsafe checkpoints | Require task selection; exclude unsafe paths and invalidate stale evidence |
| A35 | Resume with new execution | Validate fingerprint and bind to new work handle; never reuse old authority token |
| A36 | Meaningless generated negative control | Forced test failure rejected; same unchanged test must detect relevant behavior mutation |

**Test files to implement as needed:** `scripts/test-browser-capability.mjs`, `scripts/test-browser-mcp-adapter.mjs`, `scripts/test-browser-work-gateway.mjs`; expand `scripts/test-dev-coding-harness.mjs` and Windows setup smoke. Mock MCP/security/lifecycle tests run in required CI. Real browser download/launch acceptance is conditional/opt-in so CI does not fail for users who chose NO.

## 9A. Browser work-package effort and dependency risk

| Package | Relative effort | Risk | Dependency |
| --- | --- | --- | --- |
| B0 | M | HIGH: upstream contract uncertainty | P0; blocks B1/B2 |
| B1 | M | MEDIUM: Windows setup and user preference | B0 |
| B2 | L | HIGH: MCP transport, typed images and teardown | B0 |
| B3 | L | HIGH: discovery schema, permissions/revocation | B1+B2 |
| B4 | M | MEDIUM: evidence/Goal integration | P3+B3 |
| B5 | L | HIGH: Windows real-browser environment | All B phases |

M/L represent relative implementation effort, not calendar promises. Re-estimate B1–B5 after B0 contract verification and repo baseline; reserve explicit contingency for upstream API incompatibility. If the pinned upstream breaks, fail closed and continue non-browser Dev Coding while auditing the incompatibility.

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
git diff --check # only for authorized Git repositories; otherwise run snapshot diff/whitespace gate
```

With browser explicitly installed, additionally run `agent-browser doctor` and a real approved localhost MCP/browser smoke. With no browser, assert **zero browser operations** in a real MCP tools/list response.

**Final DoD:** Existing GPTWorker tools, boundaries, work handles, Job lifecycle, tunnel/tray and tests remain working; Coder creates effective tests, repairs from evidence and proves Goal independently of green technical checks. Setup uses official optional Vercel installation, disabled/unhealthy browser is undiscoverable and uncallable, enabled/healthy browser starts lazily only for valid Dev Coding and fully cleans up. All required A01–A36 acceptance scenarios have genuine passing evidence or are explicitly reported as environment-limited, never silently relabeled PASS.

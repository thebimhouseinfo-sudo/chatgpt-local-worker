# Dev Coding Job Upgrade — Implementation Plan

Status: **Implementation-ready draft** — browser architecture decision integrated (official agent-browser MCP stdio; B0–B5 gates). Upstream commands/tool schemas require B0 verification before implementation.

**Detailed execution plan:** [`docs/dev-coding-execution-plan.md`](./dev-coding-execution-plan.md) — implementation task ledger P0–P5/B0–B5, optional official Vercel installer in `setup.bat`, per-server conditional MCP discovery gate (browser operations absent when disabled/unhealthy), permission/lease/session checks, and Windows acceptance A01–A20.

## 1. Goal

Upgrade the existing `dev-coding` Job into a practical, self-checking coding agent.

The target is **not** a frontier coding agent and not a full IDE replacement. The goal is a reliable implementation agent that can take a concrete task with a defined goal, modify code, create or update tests, run validation, inspect failures, fix them, and verify that the final product actually satisfies the task goal.

The desired loop is:

```text
Task + Goal
   ↓
Understand acceptance criteria
   ↓
Inspect relevant code/context
   ↓
Implement
   ↓
Create/update tests
   ↓
Run QA/QC
   ↓
Run project tests / CI-equivalent checks
   ↓
Need browser verification?
   ├─ no  → goal verification
   └─ yes → preview + inspect + interact + screenshot
                  ↓
             goal verification
                  ↓
        PASS? ── no ──> diagnose → fix → repeat
          │
         yes
          ↓
       complete
```

The key upgrade is a **closed implementation-validation loop** rather than a one-pass code-edit workflow.

---

## 2. Current state

The existing Dev Coding Job already has useful foundations:

- implementation-oriented Job definition;
- planning-bundle support;
- repository/context loading;
- specialist skills;
- basic harness and validation gates;
- shell/filesystem/git access through GPTWorker;
- task ledger support;
- targeted implementation discipline.

However, it is not yet a complete coding-agent loop.

Important missing or incomplete capabilities are:

1. automatic creation/update of test scripts when coverage for the task is missing;
2. repeatable QA/QC loop after implementation;
3. CI-oriented validation rather than only ad-hoc local checks;
4. automatic interpretation of failures followed by another repair cycle;
5. explicit **goal verification** after code/tests pass;
6. optional browser-based runtime verification for web/UI work;
7. clear stopping rules for PASS, BLOCKED, or exhausted evidence.

---

## 3. Core design principle

Dev Coding should distinguish three different questions:

### A. Code QA/QC

Is the implementation technically healthy?

Examples:

- syntax;
- type checks;
- lint;
- unit/integration tests;
- build;
- dependency/API compatibility;
- security checks where relevant;
- `git diff --check`;
- no unrelated accidental edits.

### B. Runtime/Product verification

Does the implementation behave correctly when actually run?

Examples:

- application starts;
- expected route loads;
- API returns expected behavior;
- form works;
- interaction succeeds;
- UI does not visibly break;
- browser-visible workflow completes.

### C. Goal verification

Did the task actually achieve the user-requested outcome?

A task is **not complete merely because tests pass**.

Example:

```text
Goal:
"After the child answers a question, mark correct/incorrect and automatically
advance to the next question without a Next button."

Code quality may PASS.
Build may PASS.
Tests may PASS.

But Dev Coding must still verify:
- no Next button remains;
- answer is graded;
- transition happens automatically;
- actual runtime behavior matches the goal.
```

Completion requires enough evidence for all applicable layers.

---

## 4. Task contract and goal extraction

Before editing, Dev Coding should derive an execution contract from:

1. explicit user task;
2. bound `TASK-*` entry when present;
3. architecture/implementation-plan constraints;
4. acceptance criteria already present in the repository.

For every non-trivial task, establish:

- **Goal** — what real outcome must change;
- **Acceptance signals** — observable evidence that proves the goal;
- **Non-goals** — what should not be changed;
- **Validation methods** — code checks, tests, runtime checks, browser checks;
- **Stop condition** — what qualifies as PASS or BLOCKED.

Do not invent product requirements that are not supported by user instructions or governing project documents.

If the goal is ambiguous enough that success cannot be evaluated, mark the task blocked rather than silently choosing a product behavior.

---

## 5. Closed coding loop

For implementation work, use the following default loop.

### Step 1 — Understand

- load governing plan/context;
- inspect only relevant implementation surfaces;
- identify current behavior;
- define expected behavior and acceptance signal.

### Step 2 — Implement

- make the smallest coherent change;
- preserve unrelated behavior;
- follow repository conventions.

### Step 3 — Test authoring

Determine whether existing tests adequately validate the changed behavior.

If not, Dev Coding should create or update appropriate test scripts/tests.

This may include:

- unit tests;
- integration tests;
- regression tests;
- API tests;
- UI/browser tests where supported;
- repository-specific smoke scripts;
- CI test commands.

Tests should validate behavior, not merely reproduce implementation details.

Do not weaken existing **or newly generated** tests to make a broken implementation pass. For bug fixes, establish red-green evidence: the new regression test fails against the pre-fix behavior and passes after the fix. When pre-fix replay is unsafe/unavailable or the task is a new feature/refactor, document why and require a credible negative control (such as an isolated mutation or seeded fault) proving the test can detect the intended violation. Test implementation changes after seeing failures require explicit justification, a fresh negative control and retained prior evidence; never quietly change assertions to fit the output.

### Step 4 — Local QA/QC

Run the cheapest relevant checks first, then broaden as needed:

```text
targeted test
→ related suite
→ lint/typecheck
→ build
→ project validation
```

Read actual failures and classify them before editing again.

### Step 5 — Repair loop

When validation fails:

```text
reproduce
→ inspect evidence
→ identify likely causal defect
→ make one coherent fix
→ rerun the original failing check
→ broaden validation
```

Avoid shotgun editing.

### Step 6 — Runtime verification

Run the product or affected component when runtime behavior matters.

For web/UI tasks, use agent-browser when available.

For backend/CLI work, use the appropriate native runtime or test harness.

### Step 7 — Goal verification

Compare the observed result with the original task goal and acceptance signals.

If code QA/QC passes but the goal does not, the task remains `IN_PROGRESS`.

### Step 8 — Complete or block

Mark `DONE` only when supported by evidence.

Use `BLOCKED` when a required dependency, decision, environment, credential, or external system prevents verification.

---


## 6. Autonomous implementation loop

Dev Coding must not execute the workflow only once. It needs an explicit bounded loop that continues until the task goal is proven, the task is blocked, or a safe stop condition is reached.

```text
START
  ↓
Load task + goal + acceptance signals
  ↓
Inspect relevant context/code
  ↓
Implement or repair
  ↓
Create/update tests if needed
  ↓
Run targeted QA/QC
  ↓
PASS?
 ├─ no → classify failure → fix → repeat loop
 └─ yes
       ↓
Run broader tests/build/CI-equivalent checks
       ↓
PASS?
 ├─ no → classify failure → fix → repeat loop
 └─ yes
       ↓
Runtime verification required?
 ├─ no
 └─ yes → run app/service
              ↓
        Browser verification required?
        ├─ no  → inspect runtime result
        └─ yes → use agent-browser
                  open/snapshot/interact/screenshot
              ↓
        Runtime result matches expectation?
        ├─ no → diagnose → fix → repeat loop
        └─ yes
              ↓
Verify original GOAL
       ↓
GOAL PASS?
 ├─ no → identify remaining gap → fix → repeat loop
 └─ yes
       ↓
Final diff review + completion gate
       ↓
DONE
```

### Loop rules

1. Every iteration must start from evidence from the previous iteration: test failure, runtime failure, browser observation, CI log, or goal gap.
2. Do not repeat the same failing action without changing either the implementation, test, environment, or hypothesis.
3. After each repair, rerun the **original failing check first** before broadening validation.
4. A successful unit test does not end the loop if runtime behavior or the task goal is still unverified.
5. A successful build does not end the loop if acceptance signals are not yet observed.
6. Browser verification can send the loop back to implementation even when all automated tests are green.
7. CI failure can send the loop back to implementation even when local tests are green.
8. Goal verification is the final decision point before completion.

### Loop state

The Job should keep a small explicit state for the current task:

```text
iteration: N
current_hypothesis:
last_change:
last_check:
last_result:
remaining_goal_gap:
next_action:
```

This state MUST be persisted in the confirmed Workspace (not only in conversation/task notes) using a minimal atomic JSON checkpoint under `.gptworker/dev-coding/<task-id-or-execution-id>/state.json` (or a repository-consistent equivalent verified during P0). The corresponding folder must be ignored by Git by default. Persist after each meaningful iteration and before an external handoff; include task/goal and acceptance-signal IDs, baseline revision/dirty-worktree fingerprint, attempt count, last failing check and result, observed evidence references, current hypothesis, last code/test changes, remaining gaps, elapsed execution time, stop reason, and next action. Never persist secrets or raw browser data. On chat reset/resume, validate the active workspace, task ID, work-handle generation, source revision and changed-file fingerprint before trusting the checkpoint; detect drift and request a fresh check/replan rather than blindly replaying a stale action. Keep bounded history (e.g. last 8 attempts) and write atomically via temporary file plus rename with normal Workspace path protections. Do not build a second Job state/orchestration subsystem.

### Stop conditions

The loop ends only in one of these states:

- `DONE` — required QA/QC passes and the goal is verified;
- `BLOCKED` — progress requires unavailable credentials, external service, missing product decision, inaccessible dependency, or another user decision;
- `FAILED_VALIDATION` — a required validation cannot be made to pass within the allowed task scope and the remaining failure is reported with evidence;
- `ENVIRONMENT_LIMIT` — the environment cannot execute a required check, and this limitation is explicitly reported.

### Explicit iteration budget and failure handling

Default per-task execution budget: **8 meaningful implementation/repair iterations and 45 minutes of active execution**, configurable by the authorized task contract. In addition, stop or change approach after **2 repeats of an identical failure signature without new causal evidence**. Runtime/tool timeouts must remain individually bounded. Reaching a budget does not imply PASS: persist current state and report `FAILED_VALIDATION`, `BLOCKED`, or `ENVIRONMENT_LIMIT` as evidence warrants. No unbounded recursive retries. A future chat may resume from a validated checkpoint with an explicitly renewed budget.

### Non-destructive rollback policy

Before editing, record baseline commit and dirty/untracked state, then use the existing filesystem checkpoint safeguards where available. Track agent-owned changed paths and patches independently from user-owned changes. On Goal FAIL or budget exhaustion, **preserve partial work and evidence by default**; tell the user what changed, which checks failed, what remains, and the precise scoped restore options. Never run `git reset --hard`, `git clean`, mass revert, or automatic branch rollback against a dirty worktree. An explicit user-approved rollback may reverse only demonstrably agent-owned changes without destroying intervening user modifications; otherwise mark the case as needing manual conflict resolution.

Do not stop merely because code was written, a patch was generated, or one test suite passed.


## 7. Test-script generation capability

Dev Coding should be allowed to create missing test infrastructure **inside the confirmed workspace** when required to verify the active task.

The agent should first reuse existing repository test frameworks and conventions.

Preferred order:

1. use existing test command;
2. add a test to an existing suite;
3. add a small repository-owned test script;
4. add or extend CI workflow only when the repository lacks a suitable path and the task requires CI validation.

Do not introduce a new test framework when an adequate one already exists.

Generated tests/scripts must:

- live inside the target repository;
- use repository-relative paths unless an external absolute path is explicitly required;
- be deterministic where practical;
- return meaningful non-zero exit codes on failure;
- be runnable locally before relying on CI;
- avoid network/external dependencies unless the product genuinely requires them;
- avoid secrets and machine-specific assumptions;
- preserve test integrity: record test source revision/hash and red-green evidence (or justified negative control); never count an unproven generated test alone as sufficient Goal evidence.

---

## 8. CI validation loop

Dev Coding should understand CI as a validation environment, not as a separate source of truth.

The preferred workflow is:

```text
write/update test
→ run locally
→ fix local failures
→ commit/push when delivery requires it
→ run/observe CI
→ read CI logs
→ fix reproducible failure
→ rerun
```

When the repository already has CI:

- inspect existing workflow;
- use its real commands;
- avoid duplicating CI logic unnecessarily.

When CI coverage is missing and the task explicitly requires CI validation:

- create the smallest suitable workflow/test script;
- keep it repository-owned;
- make local and CI commands align as closely as practical.

A green CI result is important evidence but does not replace goal verification.

---

## 9. QA/QC gate model

Introduce a clear Dev Coding completion gate with at least these states:

```text
CODE_QA       PASS / FAIL / N/A
TESTS         PASS / FAIL / UNAVAILABLE
BUILD         PASS / FAIL / N/A
RUNTIME       PASS / FAIL / NOT_RUN
BROWSER_QA    PASS / FAIL / N/A / UNAVAILABLE
GOAL          PASS / FAIL / BLOCKED
DIFF_REVIEW   PASS / FAIL
```

A task may only be reported as complete when:

- all required technical gates pass;
- the goal gate passes;
- unavailable checks are explicitly disclosed;
- no known failure is hidden.

Do not equate `N/A` or `UNAVAILABLE` with PASS.

`DIFF_REVIEW=PASS` requires recorded evidence for every applicable item: all changed files are in approved scope; no user-owned or unrelated edits were overwritten; `git diff --check` succeeds; no disabled/relaxed/deleted tests or weakened lint/type/security config without explicit justification; no debug leftovers, secrets, accidental generated artifacts, broad formatting churn, or comment-out-instead-of-fix; changed callers/interfaces and dependency effects were inspected. A required failed or unchecked item yields FAIL/UNVERIFIED, not the agent's unsupported subjective PASS. Capture a compact machine-readable checklist and link it to the actual revision/diff fingerprint.

---

## 10. Browser capability — official Vercel agent-browser MCP stdio

**Decision:** Integrate the official upstream `agent-browser mcp` subprocess directly. GPTWorker is the MCP **client** using its existing `@modelcontextprotocol/sdk` dependency and `StdioClientTransport`. Do not build a Chromium shell, browser engine, replacement MCP server, custom JSON-RPC transport, or CLI-output parser.

This is a shared GPTWorker **browser tool family**, initially authorized only for `dev-coding`. Preserve the existing Job lifecycle, work handle, workspace boundary, tool lease, work gateway, and lazy tool activation. The browser is a runtime verification capability, not a separate Job and not a requirement for backend-only work.

```text
ChatGPT / active Dev Coding Job
    -> GPTWorker work_tool (validated work handle + lease)
    -> browser family (permission + URL + argument allowlist)
    -> lazily created MCP client / stdio subprocess
    -> official agent-browser mcp
    -> isolated browser session -> localhost / approved preview
    -> structured MCP result -> gated evidence -> goal verification
```

### 10.1 Implementation mapping and boundaries

Audit the current versions and callers before editing. Expected integration surfaces:

| Component | Responsibility |
| --- | --- |
| `src/lib/runtime-families.ts` | Declare the `browser` family and existing lazy-activation metadata. |
| `src/tools/work-gateway.ts` | Route allowlisted browser operations after normal work-handle and lease checks. |
| `src/lib/tool-work-policy.ts` | Bind browser permissions and operations to the active Job/work lease. |
| `src/server-factory.ts` and existing registration path | Advertise only enabled/healthy capabilities, honoring the existing discovery/lazy-loading contract. |
| New minimal browser adapter under `src/` | Own upstream MCP client, process and browser session lifecycle, timeouts, upstream-tool mapping, results and cleanup. |
| `setup.bat` and existing config/health surfaces | Offer optional installation; persist user enablement separately from actual health. |
| `jobs/dev-coding/SKILL.md`, `JOB.md`, validation/completion harness | Invoke browser for applicable runtime checks and require observable goal evidence. |
| Focused scripts under `scripts/` | Mock-MCP, permission, process lifecycle, Windows, and actual browser smoke tests. |

The paths above are *inspection targets*, not permission to touch all of them. Reuse existing architecture rather than introducing duplicate managers. `src/lib/mcp-session-manager.ts` governs the ChatGPT-to-GPTWorker MCP connection and should not be repurposed for the distinct GPTWorker-to-browser client connection.

### 10.2 Upstream contract and strict v1 allowlist

Before implementing the adapter, pin and record a tested **exact** upstream version in a repository-owned compatibility manifest (version, package lock/install command, tested MCP schemas/profile flags, contract date and evidence); verify `agent-browser mcp`, its advertised `tools/list` names, JSON schemas, tool profiles, `allowedDomains`, session configuration, and installation/diagnostic commands against that version. Do **not** assume that names or flags listed here are permanent API guarantees.

Start with upstream `core` but expose **only** the verified counterparts of:

| GPTWorker operation | Expected upstream MCP tool |
| --- | --- |
| `browser_open` | `agent_browser_open` |
| `browser_snapshot` | `agent_browser_snapshot` |
| `browser_click` | `agent_browser_click` |
| `browser_fill` | `agent_browser_fill` |
| `browser_press` | `agent_browser_press` |
| `browser_wait` | `agent_browser_wait_for_selector` |
| `browser_screenshot` | `agent_browser_screenshot` |
| `browser_get_url` | `agent_browser_get_url` |
| `browser_close` | `agent_browser_close` |

The adapter maps verified schemas, validates every incoming operation and arguments, forwards only explicitly selected fields, and checks the allowlist **again on every `tools/call`**, not only at `tools/list`. Never forward arbitrary `extraArgs`, JavaScript `eval`, additional upstream profiles (`network`, `state`, `debug`, `tabs`, `react`, `mobile`), or `--tools all` in v1. Do not accidentally make disabled tools discoverable through generic upstream passthrough.

**Upstream compatibility ownership:** P0/B0 implementer records the precise upstream version after validating the actual release; do not invent a version before audit. Keep the global optional installer aligned with this exact recorded version rather than fetching an unreviewed latest release. Re-audit before every intentional upstream version bump, whenever a schema/doctor compatibility check fails, and on a quarterly maintenance review. If upstream changes unexpectedly, fail closed (`UNAVAILABLE`, no browser tools), retain the last known compatible version, and do not silently update. CI mock tests cover the frozen schema; an opt-in real-browser smoke check validates a deliberate upgrade.

### 10.3 Permissions and safety

1. **Job ownership:** Only a confirmed `dev-coding` Job has browser permission in v1. Validate its active work handle, live lease, Job identity, and capability grant on **every** operation, including close and screenshot. A Custom Job with its own valid handle is still denied.
2. **Session isolation:** Map an opaque browser session identity to each authorized work execution. Do not reuse an upstream default/global browser session or attach to personal Chrome/cookies/profiles. Verify ownership on each tool call. Prevent browser reuse when a Job stops and another begins.
3. **Target policy:** Default to localhost/loopback and specifically confirmed preview origins. External domains require explicit per-task authorization; no arbitrary browsing by default. Check input URLs in GPTWorker and enforce upstream `allowedDomains` where supported, including redirects and popup navigation where the upstream controls support it. Treat URL schemes, host aliases, subdomains, redirects, and private/local-network resolution carefully; domain strings are not a substitute for GPTWorker authorization.
4. **Workspace and artifact paths:** All saved screenshots, logs and other artifacts must use GPTWorker-approved **absolute** paths inside the confirmed workspace. Resolve real paths and disallow traversal, symlink escapes, website-chosen filenames or model-chosen arbitrary outputs. Use a controlled Job-scoped evidence directory.
5. **Sensitive data:** Browser profiles start isolated; do not import saved sessions or personal Chrome credentials. Do not put cookies, tokens, page secrets, request bodies or raw potentially sensitive screenshot content in activity logs. Apply artifact size/type limits and preserve MCP image content separately from text; never stringify images into normal logs.
6. **Untrusted content:** Page DOM, snapshots, page text and tool outputs are observations, not agent instructions. Posting, purchasing, account changes, deletion and other consequential actions are out of scope for normal Dev Coding browser QA and require separate explicit authorization.
7. **Resource bounds:** Set per-call timeouts, process startup timeout, maximum concurrent browser sessions, output size limits, cancellable calls, and teardown escalation for an unresponsive child. Do not expose arbitrary subprocess arguments.

### 10.4 Capability state and lazy lifecycle

```text
DISABLED   user disabled or skipped optional setup; no browser tools
UNAVAILABLE enabled but missing/unhealthy binary, browser or MCP startup; diagnostics only
READY      enabled and health verified; no browser MCP subprocess running
ACTIVE     authorized Job invoked a browser operation; MCP/session owned by this execution
```

Keep user preference independent of observed health. GPTWorker startup must not start Chromium or hold a browser MCP subprocess merely because browser is enabled. Job activation may initialize lightweight metadata only. The **first permitted call** launches the upstream MCP child, performs `initialize` / `tools/list` compatibility verification, creates/assigns an isolated session, and executes the allowed operation.

On `job_stop`, Job expiry, work-lease revocation, session loss, or GPTWorker shutdown: cancel in-flight calls, close the browser session, close MCP transport and terminate only adapter-owned children. Ensure cleanup is idempotent and errors never let an old Job's session leak to a new Job. Make reactivation re-check capability health. Startup diagnostics must distinguish installed command from a browser that can actually launch.

### 10.5 Optional Windows setup and health

In `setup.bat`, ask:

```text
Install optional agent-browser support for Dev Coding? [Y/N]
```

YES: execute the *verified official* upstream install and browser-install commands for the pinned release (candidate commands: `npm install -g agent-browser`, `agent-browser install`); run its supported diagnostics (candidate: `agent-browser doctor`) and a minimally scoped MCP/browser launch smoke test. Persist enabled preference only according to the explicit user's choice; report an unhealthy installation as `UNAVAILABLE`, not `READY`.

NO: save disabled preference, do not download or launch browser, complete normal GPTWorker setup. Neither Dev Coding nor the backend should silently install it later. Re-check health when enabled configurations change; do not require browser installation for existing non-browser Job tests.

### 10.6 Browser result and evidence contract

Preserve MCP `content` item types (text/image) and `isError`; separate user-visible result from redacted operational telemetry. For screenshot results, use only verified upstream-supported output modes; persist permitted images under the workspace-scoped evidence directory when needed, with byte and type checks. Associate evidence with task/acceptance signal, work execution, checked URL/origin, timestamp, and relevant source revision or commit. If screenshot storage or upstream schema cannot be safely verified, mark browser verification `UNAVAILABLE` rather than falsely PASS.

Use snapshot/semantic locators for interaction where possible; take screenshots when actual visual inspection is important. Preserve useful failure messages without dumping page content or secrets into logs.

### 10.7 Browser QA in the Dev Coding loop

For applicable web/UI tasks:

```text
implement -> write/update regression test -> targeted checks -> broad checks
-> start_process within confirmed workspace -> localhost/approved preview
-> browser_open -> snapshot -> interact -> wait/observe -> screenshot when needed
-> compare observed runtime behavior to the task's original acceptance signals
-> if unmet: classify evidence -> coherent fix -> rerun original failing check -> repeat
```

Browser is optional at installation time but may be **required by a specific task's acceptance contract**. When unavailable, continue all non-browser checks; record `BROWSER_QA=UNAVAILABLE` and never claim visual verification. An unmet mandatory browser gate cannot be silently converted to `DONE`. Backend/CLI tasks without browser requirements must work unimpeded.

---

## 11. Browser implementation work packages (replace generic Phase 6)

| Phase | Work | Acceptance gate |
| --- | --- | --- |
| **B0 — Contract audit** | Verify and pin exact upstream MCP version, tool schemas/profile flags, SDK transport and existing caller mapping; freeze security contracts and tests. | Every v1 operation has validated schemas; compatibility manifest and fallback policy recorded. |
| **B1 — Setup and capability** | Optional `setup.bat` YES/NO; config; installed-vs-healthy check; DISABLED/UNAVAILABLE/READY/ACTIVE state. | Skip/install/uninstall/broken browser each produce expected nonblocking diagnostics. |
| **B2 — MCP stdio adapter** | Reuse SDK `StdioClientTransport`; initialize, tools/list, allowlisted tools/call, structured text/image/errors, deadlines and robust close. | Mock upstream tests prove mapping, denied eval/extraArgs, timeout/crash handling and no accidental exposure. |
| **B3 — Work gateway integration** | Lazy `browser` family, work lease/Job permission, execution-scoped session, origin and artifact policy, cleanup. | First authorized call starts browser; unauthorized Custom Job denied; job_stop revokes session and child. |
| **B4 — Dev Coding harness** | Browser SOP, runtime observation, required/optional gate evidence, goal verification and reporting. | Passing tests without observed mandatory UI behavior never leads to DONE. |
| **B5 — Acceptance on Windows/local web app** | Enabled/disabled/unhealthy, CLI setup, localhost interaction, screenshot, Windows shutdown, unauthorized Job, stale handle and dirty workspace tests. | Relevant full suite PASS; unavailable scenarios reported without fake PASS. |

Use the same repository-owned scripts and existing CI architecture. Run deterministic mock-adapter/security/lifecycle tests on normal CI; gate real Chromium-dependent smoke tests on environments with an explicitly installed browser rather than causing failure for users who opted out.

---

**Effort and sequencing:** B0 is the highest integration uncertainty and blocks B1/B2. Use relative effort envelopes rather than unsupported delivery dates: B0 **M (external/schema risk HIGH)**; B1 **M (Windows packaging risk MEDIUM)**; B2 **L (MCP image/lifecycle risk HIGH)**; B3 **L (dynamic discovery and revocation risk HIGH)**; B4 **M (goal-evidence risk MEDIUM)**; B5 **L (Windows/end-to-end environment risk HIGH)**. B1 may start only after B0's official installer contract is frozen; B3 depends on B1 and B2; B4 depends on B3; B5 follows all. Re-estimate after B0 inspection, not as a guaranteed calendar commitment.

## 12. Browser non-goals and extension points

The v1 integration is *only* a local/approved-preview web-app QA capability. Do not implement browser GUI, AI sidebar, extension, personal-browser profile import, arbitrary-domain agent surfing, general Facebook/store management, or credential automation. Future Job grants and additional upstream tool profiles require their own review and explicit access policy. There is no need for a second MCP server or a new general-purpose MCP manager.

---

## 13. Dev Coding browser fallback

If browser support is disabled or unavailable, continue all permissible coding, test, build and non-browser runtime verification. Distinguish optional and required browser acceptance signals. Report the missing check and its effect on the Goal gate. Never fail unrelated backend/CLI work merely because agent-browser is absent; never mark a required unobserved browser check PASS.

---

## 14. Harness upgrade

Review the existing Dev Coding harness and evolve it into a cohesive execution loop rather than adding duplicate frameworks.

Expected responsibilities:

### Existing harness to preserve/reuse

- planning bundle checks;
- repository inspection/preflight;
- quality gate;
- diff gate;
- dependency gate;
- completion gate;
- validation harness.

### Add/refine capabilities

#### A. Test coverage gate

Detect:

- what test command exists;
- whether changed behavior has a relevant test;
- whether a new regression test/script should be created.

#### B. Iteration controller

Track meaningful implementation-validation cycles:

```text
attempt
→ validation evidence
→ failure classification
→ next action
```

This does not need to be a complex autonomous planner. A small deterministic loop contract is sufficient.

#### C. Goal verification gate

Require the job to state:

- original goal;
- acceptance signals;
- evidence observed;
- PASS/FAIL/BLOCKED.

#### D. Runtime/browser verification hook

Allow runtime verification to invoke the optional agent-browser capability when the task type requires it.

#### E. CI evidence gate

When CI is part of delivery, record:

- workflow/check executed;
- result;
- relevant failure logs;
- rerun result after repair.

---

## 15. Skill upgrade

Keep current specialist skills, but strengthen Dev Coding SOP around these behaviors:

- test-first-or-test-with-change when regression risk exists;
- failure-driven repair;
- runtime verification;
- goal-oriented completion;
- browser-assisted UI validation;
- CI feedback handling;
- evidence-based final reporting.

Avoid adding dozens of narrow skills. Prefer a small number of strong operating rules and harness gates.

---

## 16. Safety and workspace boundaries

All existing GPTWorker workspace/path safety rules remain mandatory.

Especially for generated tests, scripts, browser launch commands, and CI edits:

- operate only inside the confirmed target workspace unless explicitly authorized;
- use absolute target paths where GPTWorker's execution safety contract requires them;
- do not modify another repository accidentally;
- inspect dirty worktree state before editing;
- preserve user-owned changes;
- do not leak secrets into tests, logs, screenshots, workflows, or fixtures.

---

## 17. Implementation sequence

### Phase 1 — Baseline audit

- map current Dev Coding skills/harness;
- identify which existing components already satisfy each requirement;
- avoid duplicating working functionality;
- define the minimal delta.

### Phase 2 — Goal contract

- add explicit goal + acceptance-signal handling to Dev Coding SOP;
- integrate with `TASKS.md` when a planning bundle is active.

### Phase 3 — Test-generation workflow

- add rules for detecting missing tests;
- enable creation/update of regression tests and test scripts;
- validate generated test scripts locally.

### Phase 4 — QA/QC repair loop

- strengthen validation flow into implement → test → diagnose → fix → retest;
- add explicit gate states/evidence.

### Phase 5 — CI loop

- integrate existing CI commands/workflows;
- allow Dev Coding to create minimal missing CI test plumbing when justified;
- support reading failure evidence and repairing code/tests.

### Phase 6 — official agent-browser MCP stdio integration

Implement browser work packages **B0–B5** in §11: upstream contract audit, optional setup/health, SDK-based stdio adapter, lazy browser work-family and Job/lease/session gating, Dev Coding browser QA, and Windows/local-app acceptance. Never use generic upstream passthrough or a custom browser engine.

### Phase 7 — Runtime and goal verification

- connect runtime/browser checks to the completion flow;
- require final goal verification independent of technical QA.

### Phase 8 — Acceptance testing

Run representative tasks across:

- backend-only change;
- CLI/tooling change;
- frontend functional change;
- frontend visual/responsive change;
- deliberately failing regression test;
- deliberately failing CI check;
- task where tests pass but goal is still not met;
- agent-browser installed and healthy;
- agent-browser disabled or unavailable;
- Custom Job tries to call browser without a grant;
- active browser execution is stopped by `job_stop`;
- redirect or screenshot path attempts to escape approved origin/workspace.

---

## 18. Acceptance criteria

The Dev Coding Job upgrade is successful when it can reliably execute a task such as:

```text
User gives task + goal
→ Dev Coding reads relevant context
→ modifies code
→ writes/updates test if needed
→ runs targeted validation
→ fixes failures
→ runs broader QA/CI checks
→ starts the product if runtime verification matters
→ uses agent-browser for web/UI verification when available
→ compares observed result to the original goal
→ repeats if the goal is not met
→ reports completion only with evidence
```

A human may still review the final product, but should no longer be required to act as the primary tester between every coding iteration.

---

## 19. Non-goals

This upgrade does not attempt to create:

- a frontier autonomous coding model;
- a full Codex/Claude Code replacement;
- a new IDE;
- a browser product;
- a universal autonomous planner;
- an unlimited self-modifying agent.

The target is deliberately narrower:

> **A solid coding agent that can implement, test, inspect, repair, and verify its goal with minimal human testing in the loop.**

---

## 20. Final rule

> **Passing code checks is not enough. Dev Coding completes a task only when the implementation is technically validated and the observed result satisfies the task goal.**

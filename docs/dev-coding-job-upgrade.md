# Dev Coding Job Upgrade — Implementation Plan

Status: **Draft**

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

Do not weaken existing tests to make a broken implementation pass.

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

This state may live in the active conversation/task notes; it does not require a new large orchestration subsystem.

### Stop conditions

The loop ends only in one of these states:

- `DONE` — required QA/QC passes and the goal is verified;
- `BLOCKED` — progress requires unavailable credentials, external service, missing product decision, inaccessible dependency, or another user decision;
- `FAILED_VALIDATION` — a required validation cannot be made to pass within the allowed task scope and the remaining failure is reported with evidence;
- `ENVIRONMENT_LIMIT` — the environment cannot execute a required check, and this limitation is explicitly reported.

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
- avoid secrets and machine-specific assumptions.

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

---

## 10. Browser capability using Vercel agent-browser

Integrate **vercel-labs/agent-browser** as an optional GPTWorker backend capability for Dev Coding.

This is not a standalone browser project.

Do not build:

- a custom browser GUI;
- an AI sidebar;
- a Chromium shell;
- a replacement browser automation engine.

Use upstream agent-browser for:

- opening localhost/preview URLs;
- semantic snapshots;
- click/type/scroll;
- screenshots;
- browser-visible workflow verification;
- web/UI regression checking.

Typical web-development loop:

```text
implement
→ run local dev server
→ open localhost
→ snapshot
→ interact
→ screenshot if visual inspection matters
→ compare observed behavior with task goal
→ fix
→ repeat
```

Browser verification is complementary to automated tests, not a replacement for them.

---

## 11. Optional installation in setup.bat

Agent-browser must remain optional.

During first-time GPTWorker setup:

```text
Install optional agent-browser support for Dev Coding? [Y/N]
```

### YES

- run the official upstream Vercel/agent-browser installation commands;
- verify installation using the official upstream verification method when available;
- persist browser capability as enabled.

### NO

- do not install it;
- persist browser capability as disabled;
- continue setup normally.

Do not silently install it later during a Dev Coding task.

---

## 12. Backend MCP gate

The agent-browser MCP integration may exist permanently in GPTWorker backend code, but browser tools are exposed only when the capability is enabled and healthy.

```text
browser enabled in config?
       |
      no  → do not register browser tools
       |
      yes
       ↓
agent-browser installed/healthy?
       |
      no  → tools OFF + diagnostic
       |
      yes → register tools
```

If tools are not registered, the model should not see them.

Dev Coding consumes the capability when available; it does not own installation or MCP registration.

---

## 13. Dev Coding browser fallback

If browser capability is unavailable:

- continue normal coding work;
- run all non-browser validation that is available;
- do not claim visual/browser verification occurred;
- report the missing verification only when it matters to the task;
- do not fail backend-only or unrelated tasks because agent-browser is absent.

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

### Phase 6 — agent-browser integration

- confirm upstream install/MCP contract;
- add optional `setup.bat` installation;
- add GPTWorker backend enable/health gate;
- expose browser tools only when usable.

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
- agent-browser installed;
- agent-browser not installed.

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

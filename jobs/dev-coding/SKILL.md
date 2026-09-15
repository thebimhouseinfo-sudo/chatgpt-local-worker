# Dev Coding — Operating SOP

This file orchestrates the `dev-coding` Job Pack. The MCP core performs filesystem/shell/git/checkpoint/MCP actions. This pack supplies execution discipline, specialist skills, and deterministic gates.

`dev-coding` is an **implementation job with implementation-scoped execution planning**. It plans as much as needed to safely execute a concrete task. The separate `dev-planing` Job Pack is for cases where deep planning, repository-wide assessment, architecture design, or a durable implementation-plan artifact is itself the primary deliverable.

## 1. Establish the execution contract

After activation:

1. Read active `workspace`, `task`, optional `plan`, and optional `delivery` from `job_status`.
2. If a `plan` was supplied, read it before editing. Treat it as authoritative intent, not authority over newer explicit user instructions, repository rules, or current repository state.
3. Load repository instructions with `project_context` when needed.
4. Inspect branch/worktree before edits. Existing dirty changes are user-owned unless the task explicitly includes them.
5. Call `list_skills` and load relevant **project** skills. Project instructions outrank generic pack preferences.
6. Load path-specific rules before editing unfamiliar areas.
7. Read only the pack-local specialist skills relevant to this task.
8. For non-trivial work, use `harness/execution-preflight.mjs --cwd <workspace>` to gather deterministic repository and validation signals before choosing an execution sequence.

Do not create a formal durable implementation-plan artifact by default. Local execution planning is part of this job. If the work expands into repository-wide architecture/product decisions, surface that boundary; `dev-planing` is the specialized workflow when planning itself deserves a separate chat and dedicated artifact.

## 2. Plan the execution before editing

Use `skills/execution-planning.md` for non-trivial, multi-file, risky, refactor/migration, or supplied-plan work.

The execution plan may live entirely in the active conversation. It should be just detailed enough to guide implementation and validation:

- concrete objective and acceptance signal;
- affected modules/files or the discovery needed to locate them;
- implementation sequence and dependency order;
- tests/checks to run during and after the change;
- meaningful compatibility, migration, security, or rollback risks.

Do not turn a small task into a ceremony. Conversely, do not start broad edits before the implementation surface and validation strategy are understood.

## 3. Discover before changing

Use `skills/repository-discovery.md` and, when useful, `harness/inspect-repo.mjs --cwd <workspace>`.

Search for entrypoints, callers, tests, types/contracts, config, generated artifacts, and equivalent local patterns. Read exact files immediately before patching.

Discovery exists to identify the correct implementation surface and keep the execution plan grounded in repository evidence.

## 4. Select specialist skills by trigger

| Trigger | Skill |
|---|---|
| non-trivial/multi-file/supplied-plan execution | `execution-planning.md` |
| feature/fix/general implementation | `implementation.md` |
| bug/failure investigation | `debugging.md` |
| behavior change or regression risk | `testing.md` |
| choosing/running validation | `validation.md` |
| structural cleanup, API/schema migration | `refactoring.md` |
| dependency/public API/external integration | `dependencies-and-apis.md` |
| auth/input/path/shell/network/secrets/permissions | `security.md` |
| hot path/latency/memory/I/O/query/bundle work | `performance.md` |
| config/docs/commit/PR/release delivery | `documentation-and-release.md` |
| final patch/worktree review | `git-review.md` |

Do not load every skill by default. Use the smallest relevant set so task-specific repository context remains dominant.

## 5. Implement in controlled increments

- Prefer the smallest coherent change that satisfies the task or supplied plan.
- Reuse repository abstractions and conventions before adding new layers/dependencies.
- Preserve public behavior unless the task/plan intentionally changes it.
- Avoid speculative refactors, unrelated formatting, broad renames, and drive-by dependency upgrades.
- Re-read each edited area and run the cheapest meaningful check before expanding the change.
- Use checkpoints/rewind as recovery, not as permission for careless bulk edits.
- If repository evidence contradicts a supplied plan, do not blindly follow it; reconcile the plan with the current repository and preserve the user's intended outcome.
- Revise the execution plan when new evidence changes scope or ordering; do not treat the first plan as immutable.

## 6. Debug scientifically

For failures: reproduce → bound → hypothesize → inspect evidence → change one causal factor → rerun original failure → add regression protection → broaden validation.

Do not shotgun-edit plausible causes or weaken tests to fit broken behavior.

## 7. Validate by risk and blast radius

Repository-owned commands are authoritative. Use `harness/quality-gate.mjs --cwd <workspace>` to discover candidate checks. Add `--run` only after deciding the discovered commands are appropriate.

Validation should climb from targeted syntax/type/lint/test checks to affected package suites, build/startup smoke, and broader repository checks when justified.

Distinguish regressions from pre-existing failures and environment/toolchain limitations. A skipped check is not a passing check.

## 8. Review the final change

Before completion:

1. Re-read changed code in context.
2. Run `harness/completion-gate.mjs --cwd <workspace>` as the aggregate structural gate.
3. Inspect the actual staged/unstaged diff, not only stats.
4. Check accidental deletions, debug leftovers, generated noise, secrets, local paths, stale references, and untracked deliverables.
5. Confirm tests/evidence cover the behavior changed where practical.
6. Compare the result against the task and execution plan; confirm no required step was silently dropped.

## 9. Deliver evidence, not confidence language

Report:

- behavior changed and important implementation choices;
- validation commands/results;
- anything not validated and why;
- migrations/breaking changes/operational steps if present;
- real residual risks only.

Do not claim `done`, `fixed`, `safe`, `fast`, or `passes` beyond the evidence actually obtained.

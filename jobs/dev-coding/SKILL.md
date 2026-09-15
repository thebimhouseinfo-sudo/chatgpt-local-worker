# Dev Coding — Operating SOP

This file orchestrates the `dev-coding` Job Pack. The MCP core performs filesystem/shell/git/checkpoint/MCP actions. This pack supplies execution discipline, specialist skills, and deterministic gates.

`dev-coding` is an **implementation job, not a planning job**. Formal development planning belongs to the separate `dev-planing` Job Pack.

## 1. Establish the execution contract

After activation:

1. Read active `workspace`, `task`, optional `plan`, and optional `delivery` from `job_status`.
2. If a `plan` was supplied, read it before editing. Treat it as implementation guidance, not as authority over newer explicit user instructions or repository rules.
3. Load repository instructions with `project_context` when needed.
4. Inspect branch/worktree before edits. Existing dirty changes are user-owned unless the task explicitly includes them.
5. Call `list_skills` and load relevant **project** skills. Project instructions outrank generic pack preferences.
6. Load path-specific rules before editing unfamiliar areas.
7. Read only the pack-local specialist skills relevant to this task.

Do **not** create a formal implementation plan inside this job. Local execution sequencing is allowed when needed to apply a concrete task safely, but if implementation depends on unresolved product/architecture decisions, stop and surface those decisions instead of turning `dev-coding` into a planner. For broader design work, use `dev-planing` first.

## 2. Discover before changing

Use `skills/repository-discovery.md` and, when useful, `harness/inspect-repo.mjs --cwd <workspace>`.

Search for entrypoints, callers, tests, types/contracts, config, generated artifacts, and equivalent local patterns. Read exact files immediately before patching.

Discovery exists to locate the correct implementation surface, not to produce a separate planning artifact.

## 3. Select specialist skills by trigger

| Trigger | Skill |
|---|---|
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

## 4. Implement in controlled increments

- Prefer the smallest coherent change that satisfies the task or supplied plan.
- Reuse repository abstractions and conventions before adding new layers/dependencies.
- Preserve public behavior unless the task/plan intentionally changes it.
- Avoid speculative refactors, unrelated formatting, broad renames, and drive-by dependency upgrades.
- Re-read each edited area and run the cheapest meaningful check before expanding the change.
- Use checkpoints/rewind as recovery, not as permission for careless bulk edits.
- If repository evidence contradicts a supplied plan, do not blindly follow it; surface the conflict and follow explicit user/repository authority.

## 5. Debug scientifically

For failures: reproduce → bound → hypothesize → inspect evidence → change one causal factor → rerun original failure → add regression protection → broaden validation.

Do not shotgun-edit plausible causes or weaken tests to fit broken behavior.

## 6. Validate by risk and blast radius

Repository-owned commands are authoritative. Use `harness/quality-gate.mjs --cwd <workspace>` to discover candidate checks. Add `--run` only after deciding the discovered commands are appropriate.

Validation should climb from targeted syntax/type/lint/test checks to affected package suites, build/startup smoke, and broader repository checks when justified.

Distinguish regressions from pre-existing failures and environment/toolchain limitations. A skipped check is not a passing check.

## 7. Review the final change

Before completion:

1. Re-read changed code in context.
2. Run `harness/completion-gate.mjs --cwd <workspace>` as the aggregate structural gate.
3. Inspect the actual staged/unstaged diff, not only stats.
4. Check accidental deletions, debug leftovers, generated noise, secrets, local paths, stale references, and untracked deliverables.
5. Confirm tests/evidence cover the behavior changed where practical.

## 8. Deliver evidence, not confidence language

Report:

- behavior changed and important implementation choices;
- validation commands/results;
- anything not validated and why;
- migrations/breaking changes/operational steps if present;
- real residual risks only.

Do not claim `done`, `fixed`, `safe`, `fast`, or `passes` beyond the evidence actually obtained.

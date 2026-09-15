# Dev Coding — Operating SOP

This file orchestrates the `dev-coding` Job Pack. The MCP core performs filesystem/shell/git/checkpoint/MCP actions. This pack supplies execution discipline, specialist skills, and deterministic gates.

`dev-coding` is an **implementation job with implementation-scoped execution planning**. Its normal starting point is the existing implementation plan and architecture/design context, not a fresh full-repository review. The separate `dev-planing` Job Pack is for cases where deep repository review, architecture/design, or a durable implementation-plan artifact is itself the primary job.

## 1. Establish the execution contract

After activation:

1. Read active `workspace`, `task`, optional `plan`, optional `architecture`, and optional `delivery` from `job_status`.
2. Read the supplied/canonical implementation plan before source inspection. Treat it as authoritative intent, not authority over newer explicit user instructions or current repository state.
3. Read supplied architecture/design documents and any architecture documents explicitly referenced by the plan.
4. Load repository/project instructions with `project_context`, then relevant project skills and path rules.
5. Inspect branch/worktree state before edits. Existing dirty changes are user-owned unless the task explicitly includes them.
6. Load only the pack-local specialist skills relevant to this task.
7. For non-trivial work, run `harness/execution-preflight.mjs --cwd <workspace>` and pass `--plan <path>` / `--architecture <path>` when those paths are known.
8. Only after the governing context is understood, inspect the specific source/tests/config/callers needed to implement the task.

Do **not** begin by reading or reconstructing the whole repository. Broaden discovery only when the plan, architecture, project rules, and targeted code inspection do not provide enough evidence to implement safely.

## 2. Check the Job Pack boundary before coding

`dev-coding` may plan **how to execute** a concrete task. It should not take over work whose primary purpose is deep planning.

Recommend a new `dev-planing` chat when the request primarily asks for any of the following:

- first-pass review/assessment of an unfamiliar repository;
- new repository or system architecture/design;
- repository-wide architecture reconstruction;
- broad comparison of implementation/refactor alternatives;
- large refactor or migration strategy where the target approach is not yet settled;
- creation of a formal/durable implementation plan as the main deliverable.

If this boundary is detected before edits, explain it before modifying source. If it appears during implementation because a blocking architecture/product decision is missing, stop speculative implementation and recommend `dev-planing` to resolve that decision. Do not escalate merely because a normal implementation detail requires targeted code inspection.

## 3. Plan the execution before editing

Use `skills/execution-planning.md` for non-trivial, multi-file, risky, refactor/migration, or supplied-plan work.

The execution plan may live entirely in the active conversation. It should be just detailed enough to guide implementation and validation:

- concrete objective and acceptance signal from the task/plan;
- affected modules/files identified from plan/architecture plus targeted discovery;
- implementation sequence and dependency order;
- tests/checks to run during and after the change;
- meaningful compatibility, migration, security, or rollback risks.

Do not turn a small task into a ceremony. Conversely, do not start broad edits before the implementation surface and validation strategy are understood.

## 4. Perform targeted discovery, not repository archaeology

Use `skills/repository-discovery.md` only to resolve implementation questions left open by the governing context.

Typical targeted discovery includes:

- files/modules named by the implementation plan;
- interfaces/contracts referenced by architecture docs;
- direct callers/callees of code being changed;
- nearby tests and equivalent local patterns;
- relevant config, generated-file boundaries, and path rules.

Do not inventory unrelated subsystems just because they exist. Repository-wide archaeology belongs to `dev-planing` unless the user explicitly changes jobs.

## 5. Select specialist skills by trigger

| Trigger | Skill |
|---|---|
| non-trivial/multi-file/supplied-plan execution | `execution-planning.md` |
| locate implementation details not resolved by plan/context | `repository-discovery.md` |
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

Do not load every skill by default. Use the smallest relevant set so the implementation plan, architecture, and repository-specific context remain dominant.

## 6. Implement in controlled increments

- Prefer the smallest coherent change that satisfies the task or supplied plan.
- Reuse repository abstractions and conventions before adding new layers/dependencies.
- Preserve public behavior unless the task/plan intentionally changes it.
- Avoid speculative refactors, unrelated formatting, broad renames, and drive-by dependency upgrades.
- Re-read each edited area and run the cheapest meaningful check before expanding the change.
- Use checkpoints/rewind as recovery, not as permission for careless bulk edits.
- If current code contradicts a supplied plan, inspect only enough surrounding evidence to determine whether the implementation detail drifted or the plan is stale; preserve the user's intended outcome.
- Revise the execution sequence when implementation evidence changes scope or ordering; do not silently redesign the system.

## 7. Debug scientifically

For failures: reproduce → bound → hypothesize → inspect evidence → change one causal factor → rerun original failure → add regression protection → broaden validation.

Do not shotgun-edit plausible causes or weaken tests to fit broken behavior.

## 8. Validate by risk and blast radius

Repository-owned commands are authoritative. Use `harness/quality-gate.mjs --cwd <workspace>` to discover candidate checks. Add `--run` only after deciding the discovered commands are appropriate.

Validation should climb from targeted syntax/type/lint/test checks to affected package suites, build/startup smoke, and broader repository checks when justified.

Distinguish regressions from pre-existing failures and environment/toolchain limitations. A skipped check is not a passing check.

## 9. Review the final change

Before completion:

1. Re-read changed code in context.
2. Run `harness/completion-gate.mjs --cwd <workspace>` as the aggregate structural gate.
3. Inspect the actual staged/unstaged diff, not only stats.
4. Check accidental deletions, debug leftovers, generated noise, secrets, local paths, stale references, and untracked deliverables.
5. Confirm tests/evidence cover the behavior changed where practical.
6. Compare the result against the task, implementation plan, and applicable architecture constraints; confirm no required step was silently dropped.

## 10. Deliver evidence, not confidence language

Report:

- behavior changed and important implementation choices;
- validation commands/results;
- anything not validated and why;
- migrations/breaking changes/operational steps if present;
- real residual risks only.

If the requested work belongs to `dev-planing`, say so explicitly and recommend opening a `dev-planing` chat for the planning work rather than pretending the coding pack has the same specialist workflow.

Do not claim `done`, `fixed`, `safe`, `fast`, or `passes` beyond the evidence actually obtained.

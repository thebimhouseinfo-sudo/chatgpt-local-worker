# Execution Planning

Use this skill when `dev-coding` needs to decide **how to execute** a concrete engineering task safely. This is normal coding-agent planning, not a substitute for the specialized `dev-planing` job.

## Goal

Produce a concise, evidence-grounded execution sequence that reduces blind editing and validation gaps while keeping implementation as the primary job.

## When to use

Use for any of the following:

- a task touches multiple files/modules;
- the correct implementation surface is not immediately obvious;
- the task is a refactor, migration, dependency/API change, or behavior change with meaningful regression risk;
- a `dev-planing` artifact or user-supplied plan must be implemented;
- implementation order matters;
- validation requires more than one targeted check.

For a tiny, obvious fix, a one- or two-step mental sequence is enough; do not create ceremony.

## Method

1. **Restate the execution contract**
   - Identify the requested outcome, explicit constraints, non-goals, and delivery expectation.
   - Do not invent product behavior or acceptance criteria.

2. **Ground the plan in the current repository**
   - Read repository/project instructions and relevant project skills/path rules.
   - Inspect git/worktree state and protect unrelated user changes.
   - Locate entrypoints, callers, tests, types/contracts, config, and equivalent implementations.
   - Use `execution-preflight.mjs` when deterministic repo/validation signals are useful.

3. **Reconcile supplied plans with reality**
   - Treat a supplied plan as authoritative intent, not authoritative repository state.
   - Verify referenced files, APIs, dependencies, assumptions, and test commands before editing.
   - Preserve the intended outcome when implementation details have drifted.

4. **Bound the implementation surface**
   - Name the smallest modules/files/interfaces that must change.
   - Identify compatibility boundaries, generated files, migrations, public APIs, and data/schema effects.
   - Exclude unrelated cleanup unless it is causally required.

5. **Sequence the work**
   - Order changes so contracts/foundations precede dependents.
   - Prefer reversible, testable increments.
   - Insert targeted validation after risky milestones rather than waiting until the end.

6. **Choose validation before coding**
   - Identify the cheapest check that can falsify each major assumption.
   - Plan targeted tests first, then affected-package/repo checks, build/smoke checks, and final diff review as appropriate.

7. **Revise when evidence changes**
   - An execution plan is not immutable. Update scope/order when repository evidence disproves an assumption.
   - Do not keep implementing a stale plan merely for consistency.

## Boundary with `dev-planing`

Stay in `dev-coding` when planning exists to support execution of a concrete task.

A separate `dev-planing` chat is usually better when planning itself is the deliverable or when the work requires deep first-pass repository review, new-system/repository design, repository-wide refactor strategy, major migration architecture, broad option comparison, or a durable implementation plan for later coding chats.

Do not automatically refuse a concrete coding task just because the repository is unfamiliar. Perform enough discovery to execute safely. Escalate only when unresolved design decisions materially prevent responsible implementation.

## Output shape

A useful execution plan is normally short:

- objective / acceptance signal;
- files/modules or discovery targets;
- ordered implementation steps;
- validation steps;
- material risks or assumptions.

Keep it in the active conversation unless the user explicitly requests a file. Formal durable plan artifacts are normally produced by `dev-planing`.

# Execution Planning

Use this skill when `dev-coding` needs to decide **how to execute** a concrete engineering task safely. This is normal coding-agent planning, not a substitute for the specialized `dev-planing` job.

## Goal

Produce a concise execution sequence from existing implementation intent and architecture constraints, then inspect only the repository surface necessary to implement and validate the task.

## Context priority

Use context in this order:

1. current explicit user instructions;
2. supplied or canonical implementation plan for the active work;
3. supplied architecture/design documents and documents referenced by the plan;
4. repository/project instructions, project skills, and path rules;
5. targeted source/tests/config/dependency evidence needed to execute the plan.

Do not make broad repository discovery the default first step. `dev-coding` should normally arrive after architecture/direction has already been established, especially for mature projects.

## When to use

Use for any of the following:

- a task touches multiple files/modules;
- an implementation plan must be executed;
- implementation order matters;
- the task is a bounded refactor, migration step, dependency/API change, or behavior change with meaningful regression risk;
- validation requires more than one targeted check;
- the correct implementation detail is not fully specified by the plan/architecture and needs targeted inspection.

For a tiny, obvious fix, a one- or two-step mental sequence is enough; do not create ceremony.

## Method

1. **Restate the execution contract**
   - Identify the requested outcome, explicit constraints, non-goals, and delivery expectation.
   - Do not invent product behavior or acceptance criteria.

2. **Read implementation intent first**
   - Read the active implementation plan before source-code exploration when a plan exists.
   - Read the architecture/design documents governing the affected subsystem, especially those referenced by the plan.
   - Extract affected modules, interfaces, sequencing constraints, validation expectations, and known non-goals.

3. **Load repository rules**
   - Read project/repository instructions and relevant project skills/path rules.
   - Inspect git/worktree state and protect unrelated user changes.
   - Use `execution-preflight.mjs` for deterministic root-level repo/validation signals when useful.

4. **Perform targeted verification**
   - Verify only the plan/architecture assumptions necessary for implementation.
   - Locate named files/modules/interfaces and direct callers/callees.
   - Read nearby tests and equivalent implementations where they materially constrain the change.
   - Avoid unrelated subsystem inventory or repository-wide archaeology.

5. **Reconcile supplied plans with reality**
   - Treat a supplied plan as authoritative intent, not authoritative repository state.
   - If referenced files/APIs changed, adapt implementation details while preserving the intended outcome and architecture constraints.
   - If the mismatch requires a new architecture/product decision rather than a local implementation adjustment, do not invent the decision.

6. **Bound and sequence the implementation**
   - Name the smallest modules/files/interfaces that must change.
   - Order changes so contracts/foundations precede dependents.
   - Prefer reversible, testable increments.
   - Insert targeted validation after risky milestones rather than waiting until the end.

7. **Choose validation before coding**
   - Identify the cheapest check that can falsify each major assumption.
   - Plan targeted tests first, then affected-package/repo checks, build/smoke checks, and final diff review as appropriate.

8. **Revise without redesigning**
   - Update scope/order when implementation evidence disproves a local assumption.
   - Do not silently expand a coding task into repository-wide redesign.

## Boundary with `dev-planing`

Stay in `dev-coding` when planning exists to support execution of a concrete task whose architecture/direction is already sufficiently established.

Recommend a new `dev-planing` chat when the user's request primarily requires:

- first-pass review of an unfamiliar repository;
- new repository/system architecture;
- repository-wide architecture reconstruction;
- broad option comparison before an approach is selected;
- large refactor/migration strategy without a settled target design;
- a formal durable implementation plan as the main output.

If implementation hits a blocking architecture/product decision not answered by the plan, architecture docs, project rules, or targeted code evidence, stop speculative edits and tell the user that `dev-planing` is the better Job Pack for resolving that decision.

Do not escalate merely because a concrete implementation detail needs normal code inspection.

## Output shape

A useful execution plan is normally short:

- objective / acceptance signal;
- governing plan/architecture constraints;
- affected files/modules or narrow discovery targets;
- ordered implementation steps;
- validation steps;
- material risks or assumptions.

Keep it in the active conversation unless the user explicitly requests a file. Formal durable plan artifacts are normally produced by `dev-planing`.

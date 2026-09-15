# Skill — Targeted Repository Discovery

Use this skill when `dev-coding` needs repository evidence that is not already resolved by the implementation plan, architecture/design documents, project instructions, or current task.

This is **targeted implementation discovery**, not first-pass repository review. Deep repository archaeology belongs to `dev-planing`.

## Procedure

1. Establish repository root and current branch/worktree state.
2. Read the applicable implementation plan and architecture/design context first when available.
3. Load repository instructions (`project_context`) and relevant project skills (`list_skills` → `load_skill`).
4. Start from the files/modules/interfaces named by the task, plan, or architecture.
5. Search only for materially relevant symbols, direct callers/callees, tests, config, generated-file boundaries, and equivalent local patterns needed to implement safely.
6. For each file likely to be edited, load path-specific rules when available.
7. Identify dirty files before editing; treat them as user-owned changes unless the task clearly includes them.
8. Expand the search radius only when current evidence cannot answer an implementation question or validation dependency.

## Do not

- inventory unrelated subsystems merely because the repository is unfamiliar;
- reconstruct repository-wide architecture as part of a normal coding task;
- read the entire repo before coding when the plan/architecture already defines the implementation surface;
- silently invent missing system design when targeted discovery reveals an unresolved architecture decision.

If the missing information requires repository-wide analysis or a new design decision, surface the boundary and recommend `dev-planing`.

## Exit condition

You should be able to answer: which exact implementation surface must change, which direct dependencies constrain it, which repository rules apply, and how will this bounded change be validated?

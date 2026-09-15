# Development Planning — Operating SOP

This job produces an implementation-ready plan. It does not implement the plan.

## 1. Establish planning inputs

After activation, read `workspace`, `objective`, optional `context`, and output `plan` from `job_status`.

Load repository instructions (`project_context`), relevant project skills (`list_skills` → `load_skill`), and path rules as needed. Inspect git state so existing uncommitted work is not mistaken for baseline behavior.

## 2. Analyze the repository, read-only

Use `skills/repository-analysis.md` to identify entrypoints, call paths, contracts/types, persistence boundaries, tests, config, build/deploy surfaces, and equivalent implementations.

Prefer concrete evidence: file paths, symbols, schemas, commands, and existing tests. Distinguish observed repository facts from inference.

## 3. Define scope before solution

Use `skills/scope-and-constraints.md` to separate objective, constraints, non-goals, compatibility expectations, and unresolved product decisions.

Do not silently decide ambiguous business/product behavior. Put unresolved decisions under **Open Questions**.

## 4. Analyze architecture and impact

Use `skills/architecture-impact.md` when the objective crosses module boundaries, public APIs, persistence/schema, auth/security, background jobs, deployment, or external integrations.

Prefer changes that fit existing architecture unless the objective explicitly calls for architectural change.

## 5. Produce an executable sequence

Use `skills/implementation-sequencing.md` to order work by dependency. The plan should tell the future `coding` job what to change and where, without writing the code itself.

Each implementation step should identify:
- component/file/symbol area;
- intended behavior/invariant;
- dependencies on earlier steps;
- tests or evidence needed for that step.

## 6. Design validation and surface risk

Use `skills/validation-and-risk.md`. Define targeted tests, broader checks, build/runtime smoke tests, migration/rollback checks, and manual verification only where relevant.

## 7. Write only the plan artifact

Use `templates/DEV_PLAN.md` as the structural contract. Write/update only the confirmed `plan` output path. Do not modify source/config/dependency files as part of planning.

Run:

`node harness/plan-lint.mjs --plan <plan>`

A plan is not complete while the lint fails or material open questions are hidden.

## Handoff to Coding

The resulting plan is an input artifact for the `coding` job. Coding may execute it, but repository instructions and newer explicit user decisions still outrank an older plan.

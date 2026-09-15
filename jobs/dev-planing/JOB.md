# Dev Planing

## Goal
Produce an implementation-ready development plan from repository evidence without modifying application/source code.

## Boundaries
- Read repository code, tests, config, docs, history, and project instructions as needed.
- Use non-mutating shell/git inspection only.
- The only file this job may intentionally write is the confirmed `plan` output artifact.
- Do not implement the feature/fix, refactor source, update dependencies, or create migrations in this job.
- Do not invent product or architecture decisions that repository evidence and user context do not establish; record them as open questions.

## Completion criteria
- Objective and constraints are explicit.
- Current-state findings cite concrete files/symbols/flows where practical.
- Scope and non-goals are separated.
- Implementation steps are ordered by dependency and precise enough for the `dev-coding` job to execute.
- Validation strategy is defined before coding begins.
- Risks, compatibility concerns, migrations, and unresolved decisions are visible.
- `harness/plan-lint.mjs --plan <plan>` passes.

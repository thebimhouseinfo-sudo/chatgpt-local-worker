# Dev Coding Harness

Deterministic helpers for the `dev-coding` Job Pack. They support the MCP core; they do not replace filesystem/shell/git tools, repository-specific instructions, planning artifacts, or model reasoning.

- `planning-bundle-check.mjs --dir <planning-dir> [--task-id TASK-001]` — verify the standard planning bundle (`ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`, `TODO.md`, `TASKS.md`) and optionally confirm the selected task exists.
- `inspect-repo.mjs --cwd <repo>` — root-level inventory of manifests, locks, scripts, CI, source/test roots, monorepo signals, and git state. This is not repository archaeology.
- `execution-preflight.mjs --cwd <repo> [--plan <path>] [--architecture <path>]` — combine root-level repository and validation signals for implementation-scoped execution planning when explicit plan/architecture paths are used.
- `task-plan-lint.mjs --plan <task-plan>` — validate a bounded task-local subplan created when an implementation branch needs deeper sequencing without changing project architecture.
- `quality-gate.mjs --cwd <repo>` — discover likely repository checks. Add `--run`; optionally `--categories format,lint,type,test,build`.
- `diff-gate.mjs --cwd <repo> [--base <ref>]` — whitespace, unresolved-conflict, staged/unstaged scope and optional base diff.
- `change-audit.mjs --cwd <repo>` — audit changed files for conflict markers, sensitive file/key material, machine paths, debugger leftovers, oversized files.
- `dependency-gate.mjs --cwd <repo>` — detect common manifest/lockfile consistency problems without installing anything.
- `completion-gate.mjs --cwd <repo>` — aggregate structural gates and quality discovery. Add `--run-quality` only after reviewing discovered commands.
- `validate.mjs` — validate the Dev Coding Job Pack itself, including planning-bundle/task-ledger/task-subplan capabilities.

Normal ordering is: read planning bundle → select/update task → inspect only implementation-relevant code → implement/validate → update `TASKS.md`. A bounded new branch may get a task-local plan; project-level replanning belongs to `dev-planing`.

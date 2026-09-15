# Dev Coding Harness

Deterministic helpers for the `dev-coding` Job Pack. They support the MCP core; they do not replace filesystem/shell/git tools, repository-specific instructions, or model reasoning.

- `inspect-repo.mjs --cwd <repo>` — inventory manifests, locks, scripts, CI, source/test roots, monorepo signals, and git state.
- `execution-preflight.mjs --cwd <repo>` — combine repository inventory and quality-check discovery into deterministic evidence for implementation-scoped execution planning. It does not generate architecture or a formal plan.
- `quality-gate.mjs --cwd <repo>` — discover likely repository checks. Add `--run`; optionally `--categories format,lint,type,test,build`.
- `diff-gate.mjs --cwd <repo> [--base <ref>]` — whitespace, unresolved-conflict, staged/unstaged scope and optional base diff.
- `change-audit.mjs --cwd <repo>` — audit changed files for conflict markers, sensitive file/key material, machine paths, debugger leftovers, oversized files.
- `dependency-gate.mjs --cwd <repo>` — detect common manifest/lockfile consistency problems without installing anything.
- `completion-gate.mjs --cwd <repo>` — aggregate structural gates and quality discovery. Add `--run-quality` only after reviewing discovered commands.
- `validate.mjs` — validate the Dev Coding Job Pack itself.

Harness findings are evidence, not business requirements. Project-owned commands and instructions remain authoritative. Execution planning remains a reasoning task grounded by these deterministic signals.

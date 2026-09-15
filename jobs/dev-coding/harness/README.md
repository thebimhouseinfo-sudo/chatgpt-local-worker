# Dev Coding Harness

Deterministic helpers for the `dev-coding` Job Pack. They support the MCP core; they do not replace filesystem/shell/git tools, repository-specific instructions, architecture documents, implementation plans, or model reasoning.

- `inspect-repo.mjs --cwd <repo>` — root-level inventory of manifests, locks, scripts, CI, source/test roots, monorepo signals, and git state. This is not repository archaeology.
- `execution-preflight.mjs --cwd <repo> [--plan <path>] [--architecture <path>]` — verify supplied plan/architecture context paths, combine root-level repository inventory with quality-check discovery, and emit deterministic evidence for implementation-scoped execution planning. It explicitly prefers targeted implementation discovery over full-repository review and does not generate architecture or a formal plan.
- `quality-gate.mjs --cwd <repo>` — discover likely repository checks. Add `--run`; optionally `--categories format,lint,type,test,build`.
- `diff-gate.mjs --cwd <repo> [--base <ref>]` — whitespace, unresolved-conflict, staged/unstaged scope and optional base diff.
- `change-audit.mjs --cwd <repo>` — audit changed files for conflict markers, sensitive file/key material, machine paths, debugger leftovers, oversized files.
- `dependency-gate.mjs --cwd <repo>` — detect common manifest/lockfile consistency problems without installing anything.
- `completion-gate.mjs --cwd <repo>` — aggregate structural gates and quality discovery. Add `--run-quality` only after reviewing discovered commands.
- `validate.mjs` — validate the Dev Coding Job Pack itself, including its context-first/targeted-discovery contract.

Harness findings are evidence, not business requirements. Project-owned commands and instructions remain authoritative. Normal ordering is: read implementation plan/architecture → run bounded preflight as useful → inspect only implementation-relevant code → implement and validate.

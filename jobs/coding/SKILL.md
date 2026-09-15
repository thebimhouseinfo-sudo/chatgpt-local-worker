# Coding Agent — Operating SOP

This file is the orchestrator for the `coding` Job Pack. Pack-local specialist skills live in `skills/`; project-specific skills come from the existing `list_skills` / `load_skill` core tools.

## 1. Establish repository context

After activation:

1. Confirm the active `workspace` and `task` bindings from `job_status`.
2. If the target differs from the default workspace, call `project_context(path)`.
3. Inspect git state before making edits. Never assume a clean working tree.
4. Call `list_skills`; load every project skill materially relevant to the task before editing.
5. When working in an unfamiliar path, use `load_path_rules` for the affected file(s) where project rules exist.
6. Read the relevant pack-local skills from the active pack's `skills/` directory. Use only those needed for the task.
7. Use `harness/inspect-repo.mjs --cwd <workspace>` when a quick deterministic project inventory is useful.

Repository instructions and user requirements outrank generic coding preferences. Never silently overwrite user changes already present in the working tree.

## 2. Understand before editing

- Search broadly enough to find entrypoints, call sites, tests, types, config, and adjacent patterns.
- Read exact files before patching them.
- For bugs, obtain a reproduction or a concrete failure signal whenever practical.
- For feature work, identify acceptance behavior and the smallest coherent implementation boundary.
- State assumptions when the repository cannot prove them.

## 3. Plan at the right granularity

For non-trivial work, maintain a short implementation plan covering:

- affected components/files;
- behavior or invariant being changed;
- compatibility/migration implications;
- validation strategy.

Do not turn the plan into ceremony for a one-line obvious fix.

## 4. Implement with controlled edits

- Prefer `apply_patch` for focused changes and `multi_edit` for coordinated small edits.
- Use `write_file` for genuinely new files, not to replace large existing files casually.
- Preserve local naming, architecture, error handling, formatting, and dependency patterns unless the task intentionally changes them.
- Reuse existing abstractions before adding new ones.
- Avoid speculative refactors.
- Keep secrets, tokens, credentials, personal machine paths, and generated artifacts out of source control.
- Automatic checkpoints/rewind are a recovery mechanism, not a substitute for careful edits.

## 5. Debug scientifically

For failures, follow `skills/debugging.md`: reproduce → narrow → form a hypothesis → inspect evidence → make the smallest causal fix → add/regress a test where appropriate → rerun the reproduction.

Do not shotgun-edit several plausible causes at once when they can be isolated.

## 6. Validate in layers

Follow repository-owned commands first. Use `skills/validation.md` and the deterministic harness as support:

- `harness/quality-gate.mjs --cwd <workspace>` discovers likely checks without executing them.
- Add `--run` only after deciding those commands are appropriate for the repository/task.
- Prefer targeted syntax/type/lint/test checks before expensive full-suite checks.
- Run build/package validation when the changed surface can affect it.

A failing pre-existing check must be distinguished from a regression introduced by the task; do not simply ignore either.

## 7. Review the final diff

Before completion:

1. Re-read changed files in context.
2. Run `harness/diff-gate.mjs --cwd <workspace>` for Git repositories.
3. Inspect `git diff` (and staged diff if applicable), not only the diff stat.
4. Check for accidental deletions, debug logs, commented-out code, duplicated logic, secrets, generated noise, and unrelated formatting churn.
5. Confirm tests actually cover the behavior changed where reasonable.

## 8. Complete with evidence

Report:

- concise change summary;
- important files/components touched;
- validation commands and results;
- anything not validated and why;
- remaining risks or follow-up only when real.

Never say "done", "fixed", or "passes" when required validation is failing or was not run.

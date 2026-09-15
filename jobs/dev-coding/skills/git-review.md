# Skill — Git & Diff Review

## Before edits

- Record branch and `git status --short`.
- Notice staged, unstaged, and untracked user changes.
- Do not reset, clean, checkout, or overwrite unrelated changes.

## Before completion

1. Run `git diff --check`.
2. Inspect changed-file list and diff stat for unexpected scope.
3. Read the actual patch, including staged changes if staging occurred.
4. Look for accidental secrets, machine-specific paths, debug output, temporary files, generated noise, and unrelated formatting.
5. Confirm removed code has no remaining required callers/references.
6. Confirm new files are tracked when they are part of delivery.

## Git actions

Do not commit, push, reset, clean, rebase, force-push, or change branches unless the task/user intent calls for it. Prefer non-destructive inspection by default.

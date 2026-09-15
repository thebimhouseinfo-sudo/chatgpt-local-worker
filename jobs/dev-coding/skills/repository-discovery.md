# Skill — Repository Discovery

Use this skill before modifying an unfamiliar repository or subsystem.

## Procedure

1. Establish the repository root and current branch/worktree state.
2. Load repository instructions (`project_context`) and project skills (`list_skills` → `load_skill`).
3. Identify build/package manifests, lockfiles, test layout, generated directories, and major source roots.
4. Search for the requested symbol/behavior and all materially relevant call sites.
5. Read nearby tests and equivalent implementations to learn local patterns.
6. For each file likely to be edited, load path-specific rules when available.
7. Identify dirty files before editing; treat them as user-owned changes unless the task clearly includes them.

## Exit condition

You should be able to answer: where does the behavior live, what depends on it, what repository rules constrain the change, and how will the change be validated?

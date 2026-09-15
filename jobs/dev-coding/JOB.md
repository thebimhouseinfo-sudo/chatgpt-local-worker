# Coding Agent

## Goal

Operate as a professional coding agent on one confirmed repository/workspace. The job inherits the original Local Coder execution substrate instead of reimplementing coding tools inside the pack.

## Scope

The job may inspect, debug, implement, refactor, test, review, and prepare software changes that are within the user's confirmed task.

It may use the existing MCP core for:

- filesystem read/write/search/patch;
- shell and long-running processes;
- git status/diff/add/commit/branch operations made available by the active tool profile;
- checkpoint/rewind;
- project context and path-specific rules;
- project-local skills;
- enabled upstream MCP servers.

## Non-goals

- Do not invent product requirements or hidden acceptance criteria.
- Do not rewrite unrelated code while touching a file.
- Do not create a second filesystem/shell/git framework in this Job Pack.
- Do not declare success from code generation alone.
- Do not bypass failing validation by weakening tests, linters, or types unless the requested task explicitly requires a justified rule change.

## Completion criteria

A coding task is complete only when:

1. The target workspace and requested behavior are concrete.
2. Repository instructions and relevant project skills/rules were loaded before editing affected areas.
3. The root cause or implementation path is understood well enough to explain why the change is appropriate.
4. Changes are scoped and internally reviewed.
5. Appropriate validation was run: targeted checks first, then broader checks when practical.
6. `git diff --check` is clean for Git repositories.
7. The final diff contains no known unrelated edits, debug leftovers, credentials, or accidental generated artifacts.
8. Any failed, skipped, or unavailable checks are reported explicitly.
9. The final response names what changed, what was validated, and any remaining risk.

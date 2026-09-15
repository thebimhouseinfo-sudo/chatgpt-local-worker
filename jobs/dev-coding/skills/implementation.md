# Skill — Implementation

Use for features, fixes, refactors, configuration changes, and code cleanup.

## Rules

- Prefer the smallest coherent change that satisfies the acceptance objective.
- Preserve public API behavior unless a breaking change is requested and understood.
- Match existing abstractions and dependency direction before introducing new layers.
- Avoid broad renames, formatting churn, dependency upgrades, or file moves unrelated to the task.
- Keep platform/path assumptions explicit and portable where the repository is cross-platform.
- Treat generated files according to repository conventions; do not hand-edit generated output unless that is the established workflow.
- Handle errors at the layer that has enough context to act on them.
- Do not suppress type/lint/test failures merely to make CI green.
- When changing behavior, update or add the smallest useful regression test where the repository has a testing pattern.

## Patch discipline

1. Read exact context immediately before editing.
2. Patch focused hunks.
3. Re-read the edited area.
4. Run the cheapest meaningful validation.
5. Continue to the next dependent change.

This keeps failures attributable and makes rewind/diff review reliable.

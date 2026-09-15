# Skill — Documentation & Delivery Hygiene

Use when behavior visible to developers/operators/users changes or delivery includes a commit/branch/PR/release artifact.

## Documentation

Consider README/usage/examples, API docs/types/schema, configuration and `.env.example`, migration/upgrade notes, comments explaining non-obvious invariants, and changelog/release notes when the repository uses them.

Do not add comments that merely restate code; document why a constraint exists.

## Configuration

Choose defaults consistent with existing semantics, document required vs optional values, update templates without real secrets, and validate parsing/error behavior.

## Delivery

Before commit/PR, ensure diff scope matches the task, exclude local/temp/generated files unless intentionally versioned, follow repository conventions, summarize behavior plus validation evidence, and call out breaking changes/migrations/unverified paths/operational steps.

Never claim release readiness solely because code compiles.

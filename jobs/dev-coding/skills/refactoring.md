# Skill — Refactoring & Migration

Use for structural changes intended to preserve behavior and for migrations that intentionally change representation or interfaces.

## Refactoring contract

Identify the behavior/invariants that must remain unchanged. Prefer existing tests; when coverage is weak, add characterization evidence before a large restructure when practical.

Refactor incrementally: establish safety evidence → make one structural move → validate → update callers → remove obsolete paths only after references are proven gone.

Avoid mixing unrelated cleanup with a behavior change. If both are necessary, keep the phases distinguishable in the diff.

## API/schema migrations

Find owned callers and persisted/serialized forms; identify backward/forward compatibility requirements; prefer additive or dual-path transitions when rolling compatibility matters; make defaults/fallbacks explicit; update tests/docs/config/migration notes together.

For data/database migrations, treat rollback, idempotency, partial execution, and real data shape as first-class concerns. Follow the repository's established migration mechanism.

## Removal discipline

Before deleting code/config/flags/files, search static and dynamic/config-driven references, tests/docs/examples, public exports, build/deploy scripts, and generated registries. "Unused by grep" is evidence, not proof, in reflective systems.

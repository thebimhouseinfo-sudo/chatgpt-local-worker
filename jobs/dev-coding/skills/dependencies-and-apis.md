# Skill — Dependencies & API Changes

Use when adding/upgrading/removing dependencies, changing public interfaces, manifests/lockfiles, generated clients, protocols, or external integrations.

## Dependencies

Before adding one, confirm the repository does not already provide the capability, prefer its existing dependency family/toolchain, and justify runtime/maintenance/security surface. Avoid a dependency for trivial code that is clearer locally.

When manifest dependencies change, update the repository lockfile using its own package manager and validate affected build/tests. Never hand-edit lockfile internals.

For material upgrades, inspect migration/breaking-change guidance. Do not combine unrelated upgrades with feature work unless required.

## Public/API contracts

Identify consumers, input/output/error semantics, compatibility/versioning, serialization/wire/storage shape, generated artifacts, examples/docs/types. Prefer additive changes where compatibility matters. If breaking change is required, make it explicit and update owned callers together when feasible.

## External services

Do not guess undocumented remote behavior. Keep retries, timeouts, idempotency, auth, rate limits, and error mapping aligned with repository patterns and available official contracts.

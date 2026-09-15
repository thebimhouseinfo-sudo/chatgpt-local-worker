# Skill — Architecture & Impact Analysis

Use when the objective crosses meaningful boundaries.

Inspect impact across:
- public/internal APIs and type contracts;
- persistence/schema/migrations;
- authentication, authorization, trust boundaries, and secrets;
- background jobs, queues, schedulers, caching, and concurrency;
- external services/protocols;
- build, packaging, deployment, environment variables, and runtime configuration;
- backwards compatibility and rollout/rollback.

Prefer the repository's existing dependency direction and abstractions. A plan should not introduce a new layer, dependency, service, or architectural pattern unless the objective or evidence justifies it.

For every material cross-boundary change, state what depends on it and what compatibility or migration work follows.

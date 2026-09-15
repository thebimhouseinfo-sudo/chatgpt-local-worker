# Skill — Planning & Task Decomposition

Use when the task is non-trivial, touches several components, changes an interface, or has meaningful regression risk.

## Build a task contract

Translate the request into:

- **objective** — observable behavior to create/fix;
- **constraints** — repository, compatibility, platform, dependency, delivery, and user constraints;
- **non-goals** — adjacent cleanup not required;
- **acceptance evidence** — tests, commands, reproduction, build, or manual checks that would prove success;
- **risk areas** — public APIs, persistence, auth, concurrency, generated code, migrations, performance, deployment.

Do not invent missing product decisions. When the repository cannot answer a material question, preserve current behavior or surface the uncertainty.

## Decompose by dependency

Prefer an order such as:

1. contract/types/schema or invariant;
2. core implementation;
3. callers/integration;
4. tests;
5. docs/config/migration;
6. broad validation.

Keep steps independently inspectable where possible. Skip formal planning for a tiny obvious fix.

## Re-plan when evidence changes

Update the plan when the assumed call path is wrong, an existing abstraction changes the solution, a failing test reveals another cause, repository rules prohibit the approach, or compatibility/migration impact widens.

A plan exists to reduce mistakes, not to defend the first guess.

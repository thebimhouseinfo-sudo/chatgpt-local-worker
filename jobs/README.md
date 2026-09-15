# Job Packs

`jobs/` contains operational packs loaded by the Job Runtime.

## Current scope

The catalog is intentionally small and role-separated:

- `coding` — **ready**. Executes concrete code changes and validations. It does not create formal development plans.
- `dev-planning` — **ready**. Reads repository evidence and writes an implementation-ready development plan. It does not modify source code.
- `mto` — **placeholder**. Reserved for future quantity takeoff work. It contains no takeoff business logic and cannot be activated.

The intended development handoff is:

```text
dev-planning (optional for non-trivial design work)
        ↓ plan artifact
coding (implementation + validation)
```

A simple, already-concrete coding task can go directly to `coding`; the worker should not force a planning job when it adds no value.

Do not add speculative Job Packs just to fill the menu. A new job should exist only when its domain contract, SOP, harness, validation, and acceptance criteria are deliberate.

## Pack contract

Each runnable pack contains at minimum:

- `job.yaml`
- `JOB.md`
- `SKILL.md`
- `harness/`
- validator(s), either in `harness/` or `validators/`

A mature pack may also contain `skills/` and `templates/`.

`job.yaml` uses the JSON-compatible subset of YAML 1.2 in v0.1. This keeps the runtime dependency-free.

Metadata distinguishes:

- `status`: `ready` or `placeholder`
- aliases: explicit names usable for selection
- keywords: suggestion-only terms
- bindings: concrete job inputs/outputs
- confirmation: explicit activation boundary
- `skills`: pack-local specialist instructions loaded only after activation
- harness/validators: deterministic checks and utilities

Validate all packs:

```bash
npm run validate:jobs
```

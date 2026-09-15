# Job Packs

`jobs/` contains operational packs loaded by the Job Runtime.

## Current scope

Only one job is operational today:

- `coding` — **ready**. Professional repository/code work, inheriting the Local Coder core.
- `mto` — **placeholder**. Reserved for future quantity takeoff work. It contains no takeoff business logic and must not be activated until that logic is designed and validated.

Do not add speculative Job Packs just to fill the menu. A new job should exist only when its domain contract, SOP, harness, validation, and acceptance criteria are ready to be implemented deliberately.

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

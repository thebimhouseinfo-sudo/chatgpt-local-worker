# Job Packs

`jobs/` contains operational packs loaded by the Job Runtime.

## Current scope

- `dev-coding` — **ready**. Development-family implementation/execution job, inheriting the Local Coder core.
- `dev-planing` — **ready**. Development-family repository-aware planning job; produces a planning bundle and does not modify source code.
- `mto` — **ready**. Local HVAC equipment takeoff/update job. V1 supports AC and Fan through explicit rules and deterministic project/revision/write/audit harnesses.

Legacy names may remain aliases, but canonical IDs are the folder/job IDs above.

## Job family naming

Related jobs use a common prefix when they belong to the same work family. Development jobs use `dev-`, currently:

- `dev-planing`
- `dev-coding`

Future related development jobs should follow `dev-*`. Other domains should use their own prefix only when a real family exists; do not create speculative packs merely to populate a namespace.

## Pack contract

Each runnable pack contains at minimum:

- `job.yaml`
- `JOB.md`
- `SKILL.md`
- `harness/`
- validator(s), either in `harness/` or `validators/`

A mature pack may also contain `skills/`, `rules/`, and `templates/`.

`job.yaml` uses the JSON-compatible subset of YAML 1.2 in v0.1. This keeps the runtime dependency-free.

Metadata distinguishes:

- `status`: `ready` or `placeholder`
- aliases: explicit compatibility or convenience names usable for selection
- keywords: suggestion-only terms
- bindings: concrete job inputs/outputs
- confirmation: explicit activation boundary
- `skills`: pack-local specialist instructions loaded only after activation
- harness/validators: deterministic checks and utilities

Rules may be exposed through the pack's `SKILL.md` + `pack_dir` rather than `skills`. MTO uses this model because AC/Fan files encode business rules, not generic agent skills.

Validate all packs:

```bash
npm run validate:jobs
```

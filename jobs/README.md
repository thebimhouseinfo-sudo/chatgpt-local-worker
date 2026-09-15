# Job Packs

Each folder is a self-contained operational pack loaded by the Job Runtime.

Required:
- `job.yaml`
- `JOB.md`
- `SKILL.md`
- `harness/`
- at least one validator, either in `harness/` or `validators/`

## job.yaml format (v0.1)

`job.yaml` uses the JSON-compatible subset of YAML 1.2. This is intentional: JSON is valid YAML, and using this subset keeps the runtime dependency-free.

The runtime distinguishes:
- aliases: explicit names that may be used with `job_select`
- keywords: suggestion-only terms used by `job_list(query)`
- bindings: concrete values for declared `inputs` and `outputs`
- confirmation: whether a two-phase explicit confirmation is required
- harness/validators: hidden from the model until the job becomes active

Validate all packs:

```bash
npm run validate:jobs
```

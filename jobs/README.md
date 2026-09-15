# Job Packs

`jobs/` contains optional Job Packs loaded by the controlled Job Runtime.

A Job Pack defines the prescribed workflow, policy/SOP, specialist skills or business rules, deterministic harnesses, and completion criteria for one class of work. It does **not** duplicate the Local Worker filesystem/shell/git execution core.

This file documents the **generic pack contract only**. It intentionally does not maintain a catalog of installed jobs or duplicate any pack's domain-specific behavior. Each pack describes itself inside its own directory.

## Pack-local documentation

A runnable pack should be self-describing. The primary files are:

```text
jobs/<job-id>/
├─ job.yaml
├─ JOB.md
├─ SKILL.md
├─ harness/
└─ optional rules/, skills/, templates/, validators/
```

Use the files as follows:

- `job.yaml` — runtime metadata: ID, aliases, keywords, bindings, confirmation behavior, status, and pack-local resources;
- `JOB.md` — what the job is, its scope, boundaries, inputs/outputs, and completion contract;
- `SKILL.md` — operational workflow/SOP for executing that job;
- `rules/` or `skills/` — domain semantics or specialist instructions when needed;
- `harness/` / `validators/` — deterministic helpers and validation;
- `templates/` — pack-owned output or working templates when applicable.

If a pack has additional maturity/status models for its own domain data or rules, those semantics belong inside that pack, not in this shared README.

## Runtime discovery

The Job Runtime discovers installed packs from `jobs/` (or the configured Job Packs path). Do not hardcode the installed catalog into Worker-level documentation.

A user or agent should inspect the runtime catalog with `job_list`, then read the selected pack's own `JOB.md` / `SKILL.md` before executing domain-specific work.

Different installations may intentionally have different sets of Job Packs.

## Generic lifecycle

The common runtime lifecycle is:

```text
DISCOVER → SELECT → RESOLVE → CONFIRM → EXECUTE → VALIDATE → COMPLETE
```

Keywords are suggestion-only and never automatic activation. Job selection must preserve the explicit confirmation boundary defined by the runtime/pack contract.

## Pack contract

Each runnable pack contains at minimum:

- `job.yaml`
- `JOB.md`
- `SKILL.md`
- `harness/`
- validator(s), either in `harness/` or `validators/`

A mature pack may also contain `skills/`, `rules/`, and `templates/`.

`job.yaml` uses the JSON-compatible subset of YAML 1.2 so the runtime remains dependency-light and deterministic.

Generic metadata distinguishes:

- pack `status`;
- aliases for compatibility/convenience;
- keywords for suggestion only;
- bindings for concrete job inputs/outputs;
- confirmation requirements;
- optional pack-local skills/rules;
- deterministic harnesses and validators.

Do not create speculative packs or namespaces merely to make a catalog look complete. A Job Pack should exist because a real workflow has enough evidence to define its behavior and validation without guessing.

## Validation

Validate all installed Job Packs:

```bash
npm run validate:jobs
```

Run the full repository suite:

```bash
npm test
```

A specific pack may require additional validation; follow that pack's own documentation.

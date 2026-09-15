# Job Packs

`jobs/` contains Job Packs loaded by the controlled Job Runtime.

A Job Pack defines the prescribed workflow, policy/SOP, specialist skills or business rules, deterministic harnesses, and completion criteria for one class of work. It does **not** duplicate the Local Worker filesystem/shell/git execution core.

## Current catalog

- `dev-coding` — **ready**. Development implementation/execution job; planning-bundle-first when durable planning artifacts exist.
- `dev-planing` — **ready**. Repository/system planning job; produces a durable planning bundle and does not modify product/source code as part of planning work.
- `mto` — **ready**. HVAC takeoff/schedule-update job supporting stable and runnable-draft rules across selection-driven and drawing-export-driven source models.

Legacy aliases may remain for compatibility, but the canonical IDs are the folder/job IDs above.

## Job family naming

Related jobs share a prefix only when they belong to a real work family. Development jobs currently use:

- `dev-planing`
- `dev-coding`

Do not create speculative packs or namespaces merely to make the catalog look complete.

## Pack contract

Each runnable pack contains at minimum:

- `job.yaml`
- `JOB.md`
- `SKILL.md`
- `harness/`
- validator(s), either in `harness/` or `validators/`

A mature pack may also contain `skills/`, `rules/`, and `templates/`.

`job.yaml` uses the JSON-compatible subset of YAML 1.2 so the runtime remains dependency-light and deterministic.

Metadata distinguishes:

- Job Pack `status`: currently `ready` or `placeholder` at the pack level;
- aliases: explicit compatibility/convenience names;
- keywords: suggestion-only terms, never automatic activation;
- bindings: concrete job inputs/outputs;
- confirmation: explicit activation boundary;
- `skills`: optional pack-local specialist instructions loaded only after activation;
- harness/validators: deterministic checks and helpers.

## MTO rule status is a separate layer

Do not confuse Job Pack status with MTO business-rule maturity.

The `mto` Job Pack itself is **ready**. Its registry under `jobs/mto/rules/equipment-registry.json` contains both:

- `stable` rules — runnable normally;
- `draft` rules — also runnable, but require a visible `DRAFT / NOT FINAL` warning and careful review of the result.

Current stable MTO rules: AC and Fan.

Current runnable draft rules include CHW Pump, Chiller, ERV/HRV, Evaporative Cooler, Fume Cupboard, VAV, Attenuator, Grille, Door Grille, and Flexible Connection.

MTO rules are business semantics rather than generic agent skills, so they are exposed through the pack's rule registry and `SKILL.md` rather than pretending every equipment rule is a generic skill.

## Validation

Validate all Job Packs:

```bash
npm run validate:jobs
```

Run the full repository suite:

```bash
npm test
```

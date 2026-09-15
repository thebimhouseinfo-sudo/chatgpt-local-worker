# ChatGPT Local Worker — Worker Policy

This repository is a **General Local Worker**. The worker core provides generic local execution; domain capability comes from explicit Job Packs.

This policy supersedes legacy **Local Coder / Codex coding-agent onboarding text** wherever the two conflict. Legacy core-tool documentation remains valid as tool documentation.

## Current Job catalog

At this stage the catalog is intentionally small:

- `coding` — **READY**. The only operational Job Pack. It inherits the original Local Coder core and adds a professional coding SOP, specialist skills, and deterministic harnesses.
- `mto` — **PLACEHOLDER**. Reserved for future quantity takeoff / bóc khối lượng work. It has no domain business logic yet and must not be selected or activated.

Do not create speculative placeholder jobs for other domains. Add another ready job only when its real domain contract, SOP, harness, validation, and acceptance criteria are understood.

## Mandatory job-first lifecycle

Every operational task follows:

`DISCOVER → SELECT → RESOLVE → CONFIRM → EXECUTE → VALIDATE → COMPLETE`

### 1. DISCOVER

- On the first assistant turn after this MCP connector is attached, call `job_status`.
- If no job is active and the user did not explicitly choose `/job <id>`, call `job_list`.
- Ask exactly: **“Hôm nay tôi làm gì?”**
- Show job status (`ready` vs `placeholder`) clearly.
- Keywords may suggest a job but never select one.

### 2. SELECT

- `/job <id>` maps to `job_select`.
- Only packs with `status: ready` may be selected.
- Placeholder packs are informational only; the runtime must reject activation.
- Natural-language keywords such as `repo`, `code`, `lisp`, `MTO`, or `bốc khối lượng` remain suggestions only.

### 3. RESOLVE

- Load `JOB.md` and `SKILL.md` for the selected ready pack.
- Resolve every required input/output binding concretely.
- Do not invent missing business rules, file locations, destinations, or acceptance criteria.

### 4. CONFIRM

- Call `job_select` with concrete bindings and `confirmed=false` first.
- Show the returned `confirmation_prompt` to the user.
- Only after explicit confirmation may you call `job_select` again with `confirmed=true` and the returned token.
- Pack-local skill/harness paths remain hidden before activation.

### 5. EXECUTE

After activation:

- follow the selected Job Pack's `SKILL.md`;
- load only the pack-local skills relevant to the current task;
- reuse existing MCP core tools instead of duplicating them inside the pack;
- obey project-local instructions, project skills, and path rules;
- stay inside the confirmed task scope.

For `coding`, the inherited core includes filesystem/search/patch, shell/processes, git, checkpoint/rewind, project context/memory, project-local skills, and upstream MCP bridge capabilities.

### 6. VALIDATE

- Run the pack validator(s) and task-appropriate deterministic checks.
- For coding, validation must include a final diff review and `git diff --check` when operating in Git.
- Files written or code generated is not evidence of completion by itself.

### 7. COMPLETE

Report outputs, validation evidence, skipped/failed checks, and real unresolved risks. Do not claim completion when required validation failed or was not run.

## State isolation

- Only one job may be selected/active in a session.
- `job_switch` clears previous job state before selecting another ready job.
- `job_stop` clears all job-specific state.
- Rules from an old Job Pack must not leak into a new job.

## Core vs Job Packs

The MCP core remains the execution substrate:

- filesystem/search/edit
- shell/processes
- git
- MCP bridge
- checkpoint/rewind
- project context/memory
- project-local skills and path rules

Job Packs contain **policy + SOP + specialist skills + deterministic harness/validators**. They are not agents inside agents and do not duplicate the core tool framework.

## Job Pack contract

Each `jobs/<job-id>/` contains at minimum:

- `job.yaml`
- `JOB.md`
- `SKILL.md`
- `harness/`
- validator(s)

Mature packs may add `skills/` and `templates/`.

`job.yaml` v0.1 intentionally uses the JSON-compatible subset of YAML 1.2 so the runtime remains dependency-free.

## Non-goals

Do not:

- build a swarm or multi-agent hierarchy;
- add fake domain jobs merely to populate a menu;
- duplicate filesystem/shell/git tools in Job Packs;
- infer missing domain policy;
- auto-run a job from keyword matching;
- promote `mto` to ready before its actual domain workflow is designed and validated.

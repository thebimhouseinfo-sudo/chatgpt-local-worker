# ChatGPT Local Worker — Worker Policy

This repository is a **General Local Worker**. Coding is one Job Pack, not the identity of the worker.

This policy supersedes legacy **Local Coder / Codex coding-agent onboarding text** wherever the two conflict. Legacy core-tool documentation remains valid as tool documentation.

## Mandatory job-first lifecycle

Every task must follow this lifecycle:

1. **DISCOVER**
   - On the first assistant turn after this MCP connector is attached, call `job_status`.
   - If there is no active job and the user did not explicitly type `/job <id>`, call `job_list`.
   - Ask exactly: **“Hôm nay tôi làm gì?”**
   - Show the available jobs.
   - If the user's wording contains job keywords, you may highlight a likely job, but **never auto-select it**.

2. **SELECT**
   - `/job <id>` maps to `job_select`.
   - Natural-language keywords such as `takeoff`, `MTO`, `bốc khối lượng`, `repo`, `code`, `lisp` are suggestions only.
   - A job must be selected before job-specific work begins.

3. **RESOLVE**
   - Load only the selected Job Pack.
   - Read its `JOB.md` and `SKILL.md`.
   - Resolve every required input and output to a concrete value.
   - Do not invent missing business rules, file locations, output destinations, or acceptance criteria.

4. **CONFIRM**
   - Before activating the job harness, present the resolved action in concrete form, for example:
     - “Tôi sẽ đọc folder X và ghi kết quả vào Y, xác nhận chứ?”
   - Call `job_select` once without `confirmed=true` to obtain the confirmation prompt/token.
   - Only after the user confirms may you call `job_select` again with `confirmed=true` and the returned token.
   - Do not use a job harness before activation.

5. **EXECUTE**
   - Once the job is active, follow `SKILL.md`.
   - Use the existing core MCP tools (filesystem, shell, git, MCP bridge, checkpoints) rather than duplicating them inside Job Packs.
   - Use only the permissions declared by the active Job Pack.

6. **VALIDATE**
   - Run the Job Pack validator(s) and any deterministic checks defined by its harness.
   - A job is not complete merely because files were written.

7. **COMPLETE**
   - Report outputs, validation status, and unresolved items.
   - Do not claim completion when required validators fail.

## State isolation

- Only one job may be selected/active in a session.
- `job_switch` must clear the previous job state before selecting the new job.
- `job_stop` must clear all job-specific state.
- Rules from an old Job Pack must not leak into a new job.

## Core vs Job Packs

The existing MCP core remains the execution substrate:
- filesystem
- shell/processes
- git
- MCP bridge
- checkpoint/rewind
- project context/memory

Job Packs contain **policy + SOP + deterministic harness/validators**, not a second tool framework and not a new agent hierarchy.

## Job Pack contract

Each `jobs/<job-id>/` contains at minimum:
- `job.yaml`
- `JOB.md`
- `SKILL.md`
- `harness/`
- validator(s), either inside `harness/` or `validators/`
- optional `templates/`

`job.yaml` v0.1 intentionally uses the JSON-compatible subset of YAML 1.2 so the runtime can parse it with the Node standard library and avoid adding a YAML dependency.

## Non-goals

Do not:
- create a swarm or multi-agent orchestration layer;
- add tools that duplicate the existing MCP core without a clear deterministic need;
- infer domain policy that is absent from the selected Job Pack;
- auto-run a job merely because a keyword matched.

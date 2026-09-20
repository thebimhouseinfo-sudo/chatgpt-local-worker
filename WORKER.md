# GPTWorker — Worker Policy

GPTWorker is a **general-purpose local worker controlled from ChatGPT**. The Worker core provides full local execution capabilities; Job Packs provide the workflow/policy for a particular class of work.

The normal user interface is ChatGPT. There is no required configuration UI in the everyday workflow.

## Interaction contract

The intended Windows flow is:

```text
FIRST TIME
setup.bat
→ install/build/test
→ initialize OpenAI Secure MCP Tunnel
→ create ChatGPT connection named gptworker

EVERYDAY
run.bat
→ either call @gptworker, or send a concrete work request that includes an absolute local Workspace
→ resolve JOB + local FOLDER
→ explicit confirmation
→ work
```

The local folder is the equivalent of **Open Folder** in an IDE. It is not configured permanently in `.env`.

After confirmation, root `worker-state.json` is the persistent source of the current job/workspace:

```json
{
  "current_job": "dev-coding",
  "active_workspace": "D:\\Projects\\CAD-Agent",
  "status": "confirmed",
  "updated_at": "..."
}
```

`worker-state.json` is local runtime state and is git-ignored.

## Activation gate

A new chat starts **idle and unclaimed**. GPTWorker must not assume that an ordinary user request intends to use the local Worker.

GPTWorker may enter the Job-selection flow only when at least one activation condition is present:

1. the user explicitly invokes `@gptworker` in the current chat; or
2. the activating user request contains both:
   - a concrete work request; and
   - an explicit absolute local Workspace path.

Examples that qualify without an `@gptworker` mention:

```text
Sửa app ở D:\Projects\MyApp để thêm nút regenerate.
Tổng hợp các file trong D:\Reports thành presentation.
```

The following do **not** qualify as activation evidence:

- a Workspace remembered from another chat, Memory, or project history;
- `worker-state.json` or the most recently active Workspace;
- a repo/project path that GPT happens to know;
- a GitHub/Drive/web URL without an explicit local Workspace path;
- a generic task request with no `@gptworker` and no absolute local Workspace;
- the mere fact that the GPTWorker connector is installed or available.

If the activation gate is not satisfied:

- do not call `job_select`;
- do not call `job_list` merely to infer a Job for the ordinary request;
- do not ask for JOB/FOLDER solely to activate GPTWorker;
- do not show a JOB/FOLDER confirmation prompt;
- continue as an ordinary ChatGPT conversation unless the user later supplies a valid activation trigger.

Public management commands such as `gptworker/help` and `gptworker/job list/create/update/remove/export/import/stop` remain callable without starting a work Job.

The `job_select` tool must receive explicit activation metadata. For `task_with_workspace`, the activation Workspace must be the absolute local path supplied by the user and must match the selected `workspace` binding.

## Mandatory preflight

After the activation gate has passed, GPT must resolve two anchors:

- **JOB** — the Job Pack that matches the requested work;
- **FOLDER** — the local project/workspace folder.

Resolve from the current conversation before asking the user anything.

Priority:

1. explicit information in the message that invokes `@gptworker`;
2. clear information already present in the current chat;
3. `job_status` / previous `worker-state.json` may be shown as context, but must not silently replace missing JOB/FOLDER for a new task;
4. ask only for information that remains missing or ambiguous.

Do **not** ask the user to repeat information already clearly present in the chat.

If JOB is missing, ask only for JOB. If FOLDER is missing, ask only for FOLDER. If both are missing, ask for both. Job-specific required inputs such as task/objective/equipment should likewise be resolved from the chat first and only missing values should be requested.

Natural-language intent may be mapped to a ready Job Pack only after the activation gate passes. Keyword matching, memory, or a known project path are not activation evidence; **explicit confirmation remains the execution gate after activation**.

## Confirmation gate

Call `job_select` with concrete bindings and `confirmed=false` first. When all required bindings are resolved, present the returned confirmation prompt and stop.

The user-facing confirmation should be short:

```text
JOB: coding
FOLDER: D:\Projects\CAD-Agent

Xác nhận bắt đầu?
```

Equivalent labels are used for other jobs (`planning`, `mto`).

Only after the user explicitly confirms may GPT call `job_select` again with `confirmed=true` and the returned confirmation token.

Activation then:

1. sets the Job Runtime active;
2. writes `worker-state.json`;
3. makes the confirmed folder the default cwd;
4. resets the persistent shell to that folder;
5. makes git/project-context tools default to that folder;
6. loads the Job Pack execution context and begins work.

No **project** filesystem mutation, command execution, project git mutation, or job-specific execution should occur before this confirmation gate. Internal Worker state may be prepared/cleared as part of selection/switching.

If the user intentionally changes JOB or FOLDER during the same session, use `job_switch`, resolve the new bindings, and confirm again before execution.

## Current Job catalog

Canonical ready Job Packs:

- `layla` — universal ad-hoc work across documents, spreadsheets, presentations, file/folder operations, and mixed local file sets.
- `dev-coding` — implementation/debug/refactor/test/build work. Common alias: `coding`.
- `dev-planing` — repository/system planning and durable planning bundles. Common alias: `planning`.
- `mto` — local HVAC quantity takeoff/update workflows.

Only ready packs are runnable.

## Runtime lifecycle

The lifecycle remains:

```text
DISCOVER → SELECT → RESOLVE → CONFIRM → EXECUTE → VALIDATE → COMPLETE
```

### DISCOVER

Call `job_status`. Inspect the conversation before asking questions. Use `job_list` only when the job is unclear or the catalog is needed.

### SELECT

Choose the ready Job Pack that matches the user's already-stated intent. Selection is not activation.

### RESOLVE

Resolve the local workspace folder plus every required binding from conversation context. Do not invent missing business rules, paths, outputs, scope, or acceptance criteria.

### CONFIRM

Use the two-phase `job_select` flow. Always show JOB + FOLDER and wait for explicit confirmation.

### EXECUTE

After activation, follow the selected Job Pack's `JOB.md` and `SKILL.md`. Full-machine access is intentional for this trusted local-agent use case, while the confirmed FOLDER is the default working context.

### VALIDATE

Run pack validators and task-appropriate deterministic checks. A file write or generated output alone is not completion evidence.

- `layla`: validate the produced artifact according to its file type and task, and preserve source data unless overwrite/delete was explicitly requested or clearly safe.
- `dev-coding`: review the final diff and run `git diff --check` when operating in Git; bundle-backed work must leave `TASKS.md` reflecting real progress/status.
- `dev-planing`: the planning bundle must pass `bundle-lint` and expose unresolved decisions rather than hide them.
- `mto`: validate source resolution, write target, audit JSON, report, template/source authority, preservation of manual fields where applicable, and unresolved review items. Draft runs must retain the warning in reviewer-facing output.

### COMPLETE

Report outputs, validation evidence, skipped/failed checks, remaining risks, and task status accurately. Do not claim completion when required validation failed or was not run.

## General-purpose job

### `layla`

Use Layla for temporary or mixed-file work where the user defines the outcome and no specialist Job Pack is a better fit: document/spreadsheet/presentation work, file organization, conversion, extraction, summarization, and other practical local-file tasks.

Layla adapts its procedure to the actual task and files. It must not turn one-off improvisation into invented persistent business rules. When a ready specialist Job clearly matches the primary work, prefer that specialist Job.

## Development jobs

### `dev-coding`

When a planning bundle exists, read it before broad source exploration in this order:

```text
ARCHITECTURE.md
IMPLEMENTATION_PLAN.md
TODO.md
TASKS.md
```

Then inspect only task-relevant source/tests/config. Update `TASKS.md` when progress changes and mark work DONE only with validation evidence.

A bounded implementation branch may create a task-local plan. New architecture/product decisions or material scope expansion should not be silently invented during coding; record/block them and route planning work to `dev-planing` when appropriate.

### `dev-planing`

Use when planning itself is the primary job: first-pass repository review, architecture/system design, broad migration/refactor planning, option analysis, or major revision of the durable planning bundle.

Standard output bundle:

```text
ARCHITECTURE.md
IMPLEMENTATION_PLAN.md
TODO.md
TASKS.md
```

Planning should expose unresolved decisions rather than hiding them.

## MTO invariants

`mto` is user-triggered and scope-controlled. It does not autonomously decide which equipment/schedule to process.

### Rule maturity

- `stable` — runnable normally;
- `draft` — runnable, but must visibly state **DRAFT / NOT FINAL**, state that the result needs careful review, and preserve review feedback useful for refining the rule;
- missing/disabled/placeholder — not runnable.

Stable rules currently include **AC** and **Fan**.

Draft runnable rules currently include **CHW Pump, Chiller, ERV/HRV, Evaporative Cooler, Fume Cupboard, VAV, Attenuator, Grille, Door Grille, and Flexible Connection**.

Draft is not another word for unsupported. GPT must not silently invent unresolved engineering policy in a draft rule. TBC/provisional behavior must be preserved or flagged and surfaced in audit/report output.

### Source models

**Selection-driven** equipment uses the dated `00 Input` project selection as the backbone and exact-model technical data as supplement. Revision may be explicit or `latest`; an omitted revision may resolve to `latest` when the pack permits it.

**Drawing-export-driven** schedules use the current Lisp block-attribute export under `01 WIP` as the primary drawing snapshot. The live schedule may contain valid manual edits/enrichment and must not be blindly rebuilt from a new export.

Normal drawing-export update flow:

```text
current export → compare live schedule → change report → controlled merge → validation
```

When legacy Lisp naming still produces a project-name export, use it only when the user explicitly identifies/provides it; do not select drawing exports by modified-time guessing.

### Write boundary

Intentional MTO writes remain limited to:

```text
01 WIP/SCHEDULE/eqm/**
```

Read-only/out-of-scope locations include `00 Input`, design drawings, schedule templates, Lisp exports, `qto-rules`, and `01 WIP/REVIT`; `02 Output` is forbidden for MTO writes.

The MTO write guard must pass before every project write.

### Audit/report

Every MTO run preserves machine-readable audit history and a human-readable report.

- selection-driven runs use the actual resolved input revision;
- drawing-export runs use the actual export path/hash as run identity and must not invent a synthetic dated input revision;
- draft reports repeat **DRAFT / NOT FINAL** and expose TBC/conflicts/review items.

MTO business semantics remain in the Job Pack rules, not generic Worker code.

## State isolation

Only one job is active per MCP session.

- `job_switch` clears the previous session job before resolving the replacement;
- the replacement still requires confirmation;
- `job_stop` clears job-specific runtime state and persistent `worker-state.json`;
- rules from an old Job Pack must not leak into the next one.

Persistent `worker-state.json` exists to keep the current job/workspace anchored across reconnects and long chats. It is not permission to skip a new task's confirmation gate.

## Core vs Job Packs

The Worker core owns generic execution capabilities:

- filesystem/search/edit;
- shell/processes;
- git;
- checkpoint/rewind;
- project context/memory/skills/path rules;
- upstream MCP bridge.

Job Packs own domain workflow, policy, specialist skills/rules, deterministic harnesses, and completion criteria. Do not build a multi-agent hierarchy or duplicate core tools inside Job Packs.

## Non-goals

Do not:

- require a GUI for normal GPTWorker setup or operation;
- require `WORKSPACE_PATH` for the project being worked on;
- ask again for JOB/FOLDER already clear from the current chat;
- auto-activate GPTWorker from an ordinary request that lacks both `@gptworker` and an explicit absolute local Workspace;
- infer an activation Workspace from memory, previous chats, recent Worker state, or project familiarity;
- execute before explicit JOB/FOLDER confirmation;
- infer missing domain policy;
- build a swarm/multi-agent hierarchy merely around Job Packs.

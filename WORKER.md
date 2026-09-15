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
→ @gptworker in ChatGPT
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

## Mandatory preflight

Before job-specific execution, GPT must resolve two anchors:

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

Natural-language intent may be mapped to a ready Job Pack. Keyword matching is not permission to execute; **explicit confirmation is the execution gate**.

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

No filesystem mutation, command execution, project git mutation, or job-specific execution should occur before this confirmation gate.

If the user intentionally changes JOB or FOLDER during the same session, use `job_switch`, resolve the new bindings, and confirm again before execution.

## Current Job catalog

Canonical ready Job Packs:

- `dev-coding` — implementation/debug/refactor/test/build work. Common alias: `coding`.
- `dev-planing` — repository/system planning and durable planning bundles. Common alias: `planning`.
- `mto` — local HVAC quantity takeoff/update workflows.

Only ready packs are runnable.

## Runtime lifecycle

The lifecycle remains:

```text
DISCOVER → SELECT → RESOLVE → CONFIRM → EXECUTE → VALIDATE → COMPLETE
```

Interpretation for GPTWorker:

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

### COMPLETE

Report outputs, validation evidence, skipped/failed checks, remaining risks, and task status accurately.

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

Rule maturity:

- `stable` — runnable normally;
- `draft` — runnable but must visibly state `DRAFT / NOT FINAL` and require careful review;
- missing/disabled/placeholder — not runnable.

MTO supports selection-driven and drawing-export-driven sources. It must preserve source authority and manual enrichment rules defined in the pack.

Intentional MTO writes remain limited to:

```text
01 WIP/SCHEDULE/eqm/**
```

`00 Input`, design drawings, templates, Lisp exports, `01 WIP/REVIT`, project rules, and `02 Output` remain outside the MTO write boundary unless the pack policy is explicitly changed.

Every MTO run preserves machine-readable audit history and a human-readable report. Draft runs repeat the draft warning in reviewer-facing output.

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
- execute before explicit JOB/FOLDER confirmation;
- infer missing domain policy;
- build a swarm/multi-agent hierarchy merely around Job Packs.

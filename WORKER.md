# GPTWorker — Worker Policy

GPTWorker is a **stability-first general-purpose local worker controlled from ChatGPT**. The Worker core provides reliable local execution capabilities; Job Packs provide the workflow/policy for a particular class of work. Secure MCP Tunnel is transport, not the product architecture.

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
Windows sign-in
→ GPTWorker tray + Worker + Secure MCP Tunnel auto-start
→ open ChatGPT
→ start work through @gptworker
→ resolve JOB + local FOLDER
→ explicit confirmation
→ work
```

The local folder is the equivalent of **Open Folder** in an IDE. It is not configured permanently in `.env`.

During source development, `run.bat` remains a manual rebuild/restart fallback; it is not the normal daily launcher.

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

A new chat starts **idle and unclaimed**. Activation authority never carries across chats. GPTWorker must not assume that an ordinary user request intends to use the local Worker.

A work request may enter GPTWorker only through an explicit `@gptworker` flow:

1. the current user turn starts with `@gptworker`; or
2. a prior bare `@gptworker` in the same MCP session armed the flow, and the immediate continuation supplies the selected Job/Workspace information needed to continue.

A fresh task plus an absolute local path **without** that explicit `@gptworker` flow is not activation evidence and must remain ordinary ChatGPT work.

The following do **not** qualify as activation evidence:

- an `@gptworker` invocation, Job, or Workspace remembered from another chat, Memory, or project history;
- `worker-state.json` or the most recently active Workspace;
- a repo/project path that GPT happens to know;
- a GitHub/Drive/web URL;
- a fresh task request with an absolute local Workspace but no explicit `@gptworker` flow;
- the mere fact that the GPTWorker connector is installed or available.

If the activation gate is not satisfied:

- do not call `job_select`;
- do not call `job_list` merely to infer a Job for the ordinary request;
- do not nominate a Job or FOLDER;
- do not ask for JOB/FOLDER solely to activate GPTWorker;
- do not show a JOB/FOLDER confirmation prompt;
- continue as an ordinary ChatGPT conversation unless the user later explicitly enters the `@gptworker` flow.

Public management commands such as `gr/help` (`gptworker/help`) and `gr/job list/create/update/remove/export/import/stop` (`gptworker/job ...`) remain callable without starting a work Job.

The admission handshake is session-local. `gptworker_admission` must observe the explicit `@gptworker` flow and issue an admission token before new work can be nominated. `job_select` / pre-active switching must use that token; a task, path, remembered state, or previous chat is never a substitute.

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

Equivalent labels are used for other jobs (`planning`, `layla`, `mto`).

Only after the user explicitly confirms may GPT call `job_select` again with `confirmed=true` and the returned confirmation token.

Activation then:

1. sets the Job Runtime active;
2. writes `worker-state.json`;
3. binds the active work_handle to the confirmed Workspace;
4. makes that Workspace the execution cwd;
5. constrains structured Job paths and shell cwd/path usage to that Workspace;
6. binds git/project-context tools to that Workspace;
7. loads the Job Pack execution context and begins work.

No **project** filesystem mutation, command execution, project git mutation, or job-specific execution should occur before this confirmation gate. Internal Worker state may be prepared/cleared as part of selection/switching.

If the user intentionally changes JOB or FOLDER during the same session, use `job_switch`, resolve the new bindings, and confirm again before execution.

## Current Job catalog

Ready Job Packs:

- `dev-coding` — implementation/debug/refactor/test/build work. Common alias: `coding`.
- `dev-planing` — repository/system planning and durable planning bundles. Common alias: `planning`.
- `layla` — universal ad-hoc work across documents, spreadsheets, presentations, file/folder operations, and mixed local file sets.
- `mto` — private/domain-specific local HVAC quantity takeoff/update workflows.

The bare `@gptworker` Welcome shows the three default user-facing Jobs (`dev-coding`, `dev-planing`, `layla`) and eligible Custom Jobs; the private `mto` pack is intentionally not shown there. Only ready packs are runnable.

## Workspace authority invariant

For every active Job, including Custom Jobs:

```text
work_handle
→ exact confirmed Workspace
→ absolute path
→ must remain inside confirmed Workspace
```

A Job must not write/read project files through another workspace, startup cwd, remembered paths, or previous Worker state. Filesystem, context, git, shell cwd and normal shell path references must remain bound to the active Workspace. If the Job needs a different Workspace, switch/reselect it and confirm again.

The shell guard is designed to prevent accidental/normal path escapes; it is not an adversarial OS sandbox for deliberately obfuscated arbitrary code.

## Runtime lifecycle

The lifecycle remains:

```text
DISCOVER → SELECT → RESOLVE → CONFIRM → EXECUTE → VALIDATE → COMPLETE
```

### DISCOVER

For new work, do **not** call `job_status` as a preflight. Enter only through the explicit `@gptworker` admission flow. Use `job_list` for bare `@gptworker`, an explicit catalog request, or genuine Job ambiguity. Use `job_status` only to inspect work that is already active in the current chat.

### SELECT

Choose the ready Job Pack that matches the user's already-stated intent. Selection is not activation.

### RESOLVE

Resolve the local workspace folder plus every required binding from conversation context. Do not invent missing business rules, paths, outputs, scope, or acceptance criteria.

### CONFIRM

Use the two-phase `job_select` flow. Always show JOB + FOLDER and wait for explicit confirmation.

### EXECUTE

After activation, follow the selected Job Pack's `JOB.md` and `SKILL.md`. The confirmed FOLDER is the hard Job execution boundary: all structured local paths must be absolute and remain inside it. This applies to bundled and Custom Jobs, including Layla. Another Workspace requires explicit switch/reconfirmation.

### VALIDATE

Run pack validators and task-appropriate deterministic checks. A file write or generated output alone is not completion evidence.

- `layla`: validate the produced artifact according to its file type and task, and preserve source data unless overwrite/delete was explicitly requested or clearly safe.
- `dev-coding`: review a task-scoped snapshot diff even without Git; optionally run `git diff --check` when Git use is authorized; claim DONE only with fresh acceptance evidence and the Goal completion gate, not structural green alone. The bundle-backed task ledger must reflect real progress/status.
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

The Worker core owns the generic execution path required by Job Packs:

- filesystem/search/edit;
- shell/processes;
- git;
- workspace and project context;
- deterministic validation and runtime lifecycle.

Automatic checkpoints are an internal filesystem safety mechanism. Standalone rewind, Codex compatibility hooks/Computer Use, Admin UI, Ponytail, and upstream MCP bridging are retired from the active architecture. Do not reintroduce them as optional runtime capabilities without a new explicit architecture decision.

Job Packs own domain workflow, policy, specialist skills/rules, deterministic harnesses, and completion criteria. Do not build a multi-agent hierarchy or duplicate core tools inside Job Packs.

## Non-goals

Do not:

- require a GUI for normal GPTWorker setup or operation;
- require `WORKSPACE_PATH` for the project being worked on;
- ask again for JOB/FOLDER already clear from the current chat;
- auto-activate GPTWorker from a fresh ordinary request that did not explicitly enter the `@gptworker` flow, even if that request includes an absolute local Workspace;
- infer an activation Workspace from memory, previous chats, recent Worker state, or project familiarity;
- execute before explicit JOB/FOLDER confirmation;
- infer missing domain policy;
- build a swarm/multi-agent hierarchy merely around Job Packs.

## Optional dev-coding browser QA

Vercel agent-browser is an **opt-in** dev-coding-only localhost/approved-preview QA capability, not a general upstream-MCP bridge. On NO, failed health, schema drift or incompatible Node, browser operations must be absent from the advertised MCP `work_tool` schema and any stale calls must fail closed. The Worker must remain functional without browser/Chromium. Browser processes start lazily after an authorized operation, are execution-scoped, and must terminate on work release/stop/expiry. Other Jobs and Custom Jobs have no browser authority. The target Workspace need not contain Git. Browser enablement requires explicit setup preference, pinned installed version, current MCP schema-health evidence and a newly established MCP session/reconnect when the advertised schema changes.

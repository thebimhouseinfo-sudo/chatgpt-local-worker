# GPTWorker v2 — Architecture

## Objective

GPTWorker là một general local worker dùng ChatGPT làm UI. Driver + Secure MCP Tunnel có thể luôn sống rất nhẹ; Worker executor và tool instances chỉ sinh khi cần.

Kiến trúc v2 đặt Work Registration làm authority thay vì MCP transport session.

~~~text
1 work session
  → 1 Job
  → 1 Workspace
  → 1 active Execution
~~~

Không có Job + Workspace binding hợp lệ thì execution tools không có quyền chạy.

## P0 Evidence / Architecture Decision

Live runtime log ngày 2026-09-20 cho thấy MCP transport session không ổn định theo ChatGPT conversation: tool calls liên tiếp có thể mang session ID khác nhau và runtime hiện tại phải recovery/reinitialize thường xuyên. Hai ChatGPT chats thật cũng có thể interleave calls qua cùng Worker.

Do đó:

- Mcp-Session-Id là transport plumbing, không phải work identity.
- v2 không phụ thuộc việc tìm conversation ID.
- không auto-attach vào Job/workspace gần nhất.
- Work identity được tạo từ explicit Job + Workspace registration.

## Current Finalization Mode

During v2 finalization, keep the current monolithic GPTWorker process. Driver/Executor split is optional hardening, not a release gate. Manual launch remains acceptable if it is reliable.

Job Packs use two fixed roles:

- `repo/jobs/<job-id>/` = bundled default Jobs shipped with GPTWorker; runtime treats them as read-only defaults.
- `%LOCALAPPDATA%\GPTWorker\jobs\<job-id>\` = custom Jobs created by the user.

`job list` merges both sources. Job ids are globally unique; `job create` rejects any id already present in either source. `job update/remove` operate only on AppData custom Jobs. To customize a bundled default, `job create` may clone it into a new unique custom id; the repo source is never modified.

## Optional Future Driver Architecture

~~~text
ChatGPT
  → Secure MCP Tunnel
  → Driver / Public MCP Gateway
      ├─ protocol / compatibility
      ├─ WorkRegistrationStore
      ├─ WorkspaceOwnershipRegistry
      ├─ ActiveToolLeaseRegistry
      ├─ WakeCoordinator
      └─ IPC
           ↓
        Worker Executor
          ├─ JobRuntime / JobCatalog
          ├─ Tool Family Registry
          ├─ ephemeral tool instances
          └─ upstream adapters

Mutable user data root: %LOCALAPPDATA%\GPTWorker\
~~~

### Driver owns

- public MCP protocol lifecycle;
- single-instance host;
- Work Registration authority;
- Workspace ownership;
- generation/call sequencing;
- active tool/resource leases;
- executor wake/drain;
- tunnel supervision;
- diagnostics.

### Worker executor owns

- core tool implementations;
- family factories;
- Job Pack runtime;
- context resolution from Driver-provided ExecutionContext;
- pack validation/publish primitives.

### Job Pack owns

- workflow;
- business rules;
- skills;
- harness/acceptance;
- allowed capabilities.

Job Pack does not own filesystem/shell/git implementations.

## Work Identity

### WorkspaceKey

~~~text
<workspace-slug>#<stable-path-hash>
~~~

Hash is deterministic from normalized canonical absolute path. Slug is human-readable basename.

### ExecutionId

~~~text
exec:<job-id>@<workspace-key>:e<driver-epoch>:g<generation>
~~~

`driver-epoch` is a monotonically increasing host epoch incremented on each Driver start. It is runtime state, not a second Job registry. `generation` increases whenever a registration for that workspace is replaced/re-created within the same epoch. This prevents a readable execution ID from being reused after stop/re-register or Driver restart.

ExecutionId is human-readable routing/diagnostic identity, not a credential. Each active registration also has a separate opaque `authorityToken` that is never derived from Job/workspace naming. Execution tools require both the readable ID and the valid token; the user does not manage this token manually.

### ToolLeaseId

~~~text
tool:<family>@<job-id>@<workspace-key>:e<driver-epoch>:g<generation>:c<call-sequence>
~~~

This is an active borrowing record, not a permanent physical inventory ID.

## Work Registration

~~~text
WorkRegistration
  executionId
  authorityToken
  driverEpoch
  generation
  phase
  jobId
  workspaceCanonicalPath
  workspaceKey
  packRevision
  bindings
  confirmedContext
  activeCalls
  activeResourceLeases
~~~

Rules:

1. one registration binds exactly one Job and one Workspace;
2. execution tools require a valid registration;
3. missing/stale registration → NO_ACTIVE_WORK;
4. no fallback to global cwd/state;
5. Driver restart increments driverEpoch and invalidates every prior authorityToken;
6. generation is monotonic for a workspace within one Driver epoch;
7. active WorkRegistration auto-stops after 10 minutes without valid work-handle activity; an in-flight tool lease prevents timeout until the call finishes.

## Workspace Ownership

Canonical workspace is exclusively owned by one active execution.

~~~text
Workspace A → exec_A
Workspace B → exec_B
~~~

A second independent registration for Workspace A returns WORKSPACE_BUSY. It does not silently join or steal the existing owner.

If the caller still has the valid `executionId + authorityToken`, registration may be treated idempotently. If the handle was lost or the previous chat disappeared without a reliable close signal, recovery is explicit: re-register the exact Job + Workspace with a replace request, confirm that exact scope, transition the old execution to CLOSING, invalidate its token/generation, clean owned resources, then issue a new registration. This is replacement, not auto-attach.

This workspace-level invariant removes the need for general file-level locking between independent Jobs in the intended workflow.

## Tool Families

Core tools are shared capabilities:

~~~text
filesystem
  read / write / edit / list / search / patch

shell
  run / start / stop / status

git
process
context
upstream
...
~~~

A family does not define how many instances exist.

There is no:

~~~text
filesystem#01 FREE
filesystem#02 FREE
filesystem#03 FREE
~~~

Instead:

~~~text
exec_A calls filesystem
  → create temporary instance
  → bind identity
  → execute
  → destroy/release

exec_B calls filesystem at same time
  → create another temporary instance
  → execute concurrently
~~~

Two Jobs do not wait merely because they use the same family.

## Tool Instance Contract

Every tool instance is born from an active ExecutionContext.

~~~text
ToolContext
  family
  executionId
  driverEpoch
  generation
  jobId
  workspaceCanonicalPath
  workspaceKey
  packRevision
  callSequence
~~~

Identity is immutable for its lifetime.

Forbidden:

- changing workspace mid-call;
- rebinding an instance to another execution;
- reading a machine-global cwd as authority;
- accepting a different Job/workspace after creation.

If context mismatch is observed, reject the operation.

### ActiveToolLeaseRegistry

Registry only contains currently borrowed/running resources.

Short call:

~~~text
create lease → execute → delete lease
~~~

Stateful/long-lived resource:

~~~text
create lease → resource stays alive → lease stays active
→ resource ends/reset/stop → delete lease
~~~

There is no permanent free-instance registry.

## Concurrency

Tool Family is not a concurrency semaphore.

Twenty independent work registrations may create twenty filesystem or shell instances concurrently if system resources permit.

Concurrency limits, when needed, come from actual resources:

- CPU/RAM/process limits;
- OS handles;
- external application limits;
- upstream/API limits;
- explicit safety policy.

They do not come from an arbitrary N instances per family setting.

## Confirmation / Execution Gate

Registration still follows:

~~~text
DISCOVER → SELECT → RESOLVE → CONFIRM → ACTIVE
~~~

Confirmation must bind:

- Job;
- canonical Workspace;
- driver epoch;
- generation;
- pack revision;
- bindings affecting scope.

Every execution tool call must present the matching `executionId + authorityToken`. A readable execution ID by itself never grants authority.

Every execution path checks ACTIVE registration before creating an instance.

Preflight/control tools may be available before ACTIVE via explicit allowlist.

## Three Independent Lifecycles

### 1. Transport

MCP initialize/session/GET/DELETE/recovery. Disposable. Not authority.

### 2. Work Registration

Job + Workspace execution authority. Lives until explicit stop/switch, Driver restart, or 10 minutes of inactivity. The idle clock applies only when no tool lease is active; releasing the final foreground lease restarts the idle clock.

### 3. Worker Process

Executor process may sleep while registrations remain ACTIVE.

~~~text
activeCalls == 0
AND activeResourceLeases == 0
AND queuedDispatch == 0
AND publishTransactions == 0
  → executor may sleep
~~~

Driver + tunnel stay alive.

## Stop / Switch

job_stop:

~~~text
ACTIVE
  → CLOSING
  → block new calls
  → drain/cancel owned work
  → cleanup owned resources
  → release WorkspaceOwnership
  → invalidate generation
  → remove registration
~~~

Stop does not shut down tunnel or Driver.

Switch requires old execution cleanup before acquiring a new workspace binding.

Only owned child resources are terminated. Do not kill user applications merely because a Job connected to them.

## Paths / Job Packs

~~~text
repo\jobs\<job-id>\
  → bundled default Jobs
  → shipped with GPTWorker
  → read-only through Job authoring tools

%LOCALAPPDATA%\GPTWorker\
  jobs\<job-id>\
    → user custom Jobs only
  .job-authoring-staging\
  .job-authoring-backup\
  history\
  cache\
  logs\
  checkpoints\
  config\
~~~

Each pack's `job.yaml` is its registration source; there is no second registry file. Catalog is rebuilt in RAM by merging repo defaults with AppData custom Jobs.

Job ids are globally unique. `job create` checks both roots and rejects duplicates. It may also clone an existing Job into a new custom id. `job update/remove` target only custom AppData Jobs; bundled defaults are immutable. If someone manually places a colliding custom folder in AppData, runtime ignores that invalid custom pack and keeps the bundled default.

## Pack Revision

Activation pins an immutable pack revision/content hash.

An active execution continues using the revision it registered with. A later Job update affects new registrations, not an already-active execution.

## Public UX

Daily UX remains intentionally small:

~~~text
gptworker/job list
gptworker/job create
gptworker/job update
gptworker/job remove
~~~

Internal tools may implement select/register/status/switch/diagnostics. The user does not manage execution IDs or authority tokens manually; ChatGPT carries the work handle between tool calls. P1 must prove this behavior with the live connector before broader refactors depend on it.

## Invariants

1. No active Job + Workspace registration → no execution tool.
2. One active execution → exactly one Job + one Workspace.
3. One canonical Workspace → at most one active execution owner.
4. MCP transport identity is never work authority.
5. Tool Family is shared; Jobs never clone core tool implementations.
6. Tool instances are created on demand; no fixed pool/inventory.
7. Tool instance identity is immutable and bound to its execution.
8. Same Tool Family may run concurrently across different workspaces.
9. No machine-global active Job/cwd/process registry as execution authority.
10. Worker sleep does not end Work Registration.
11. Driver restart changes driverEpoch and invalidates prior execution authority.
12. Readable execution IDs are never sufficient authority without the matching opaque token.
13. No auto-attach to most recent Job/workspace; orphan recovery requires explicit confirmed replacement.
14. Ambiguous/unknown execution never replays mutation.
15. job.yaml is the only Job registry authority on disk.

## Security / Trust Model

GPTWorker remains a trusted local worker with broad machine access. Work Registration and workspace binding prevent accidental cross-job context drift; they are not an OS sandbox.

Credentials are never embedded in readable execution IDs, tool lease IDs or Job state. The opaque authority token is treated as a credential: redacted from normal logs/diagnostics and rotated on every new registration. Diagnostic logs remain private operational evidence and use redaction.

## Deferred

- active registration resume after Driver reboot;
- concurrent independent executions on the same workspace;
- multi-machine execution;
- untrusted pack OS sandbox;
- marketplace/package manager;
- Driver/Executor split unless manual launch proves insufficient;
- Windows Service;
- EXE packaging until AppData migration passes live tests.

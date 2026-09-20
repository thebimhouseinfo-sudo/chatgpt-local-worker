# GPTWorker v2 — Architecture

## Objective

GPTWorker là một general local worker dùng ChatGPT làm UI. Trên Windows, GPTWorker hoạt động như một background desktop app kiểu Google Drive: tự chạy khi user đăng nhập, không cần launcher hằng ngày, có system-tray icon để xem trạng thái/restart/thoát. Secure MCP Tunnel + resident control layer luôn sống rất nhẹ; execution runtime và tool instances chỉ được đánh thức/sinh khi có work thật sự.

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

Trong giai đoạn final test, **chưa đóng gói EXE/installer**. Source hiện tại, `setup.bat`, `run.bat` và PowerShell helpers vẫn được giữ để test/debug.

Kiến trúc release đã chốt:

- normal user không cần launcher hằng ngày;
- GPTWorker đăng ký auto-start theo Windows user sau setup;
- một resident host rất mỏng + Secure MCP Tunnel sống nền;
- system-tray icon là điểm điều khiển local duy nhất;
- execution runtime không giữ Job/tool/process khi idle;
- `run.bat` chỉ còn là fallback/manual recovery cho source build, không phải daily UX;
- process split Driver/Executor là implementation detail: có thể tách process nếu cần để đạt idle footprint, nhưng không bắt buộc chỉ để thỏa kiến trúc;
- packaging chỉ bắt đầu sau final live source test và explicit user approval.

Job Packs use two fixed roles:

- `repo/jobs/<job-id>/` = bundled default Jobs shipped with GPTWorker; runtime treats them as read-only defaults.
- `%LOCALAPPDATA%\GPTWorker\jobs\<job-id>\` = custom Jobs created by the user.

`job list` merges both sources. Job ids are globally unique; `job create` rejects any id already present in either source. `job update/remove` operate only on AppData custom Jobs. To customize a bundled default, `job create` may clone it into a new unique custom id; the repo source is never modified.

## Target Resident Desktop Architecture
~~~text
Windows logon
  → GPTWorker Resident Host                         [always-on, very light]
      ├─ system tray / single-instance supervisor
      ├─ Public MCP front door
      ├─ Secure MCP Tunnel supervision
      ├─ WorkRegistrationStore
      ├─ WorkspaceOwnershipRegistry
      ├─ ActiveToolLeaseRegistry metadata
      ├─ WakeCoordinator
      └─ diagnostics / recovery
           ↓ only when work needs execution
        Execution Runtime                           [on-demand / quiescent when idle]
          ├─ JobRuntime / JobCatalog execution context
          ├─ Tool Family Registry
          ├─ ephemeral tool instances
          ├─ stateful owned resources
          └─ upstream adapters

ChatGPT
  → Secure MCP Tunnel
  → Resident Host / Public MCP front door

Mutable user data root: %LOCALAPPDATA%\GPTWorker\
~~~

### Resident Host / Driver owns

- per-user Windows auto-start lifecycle;
- system-tray lifecycle and manual Exit/Restart;
- public MCP protocol lifecycle;
- single-instance host;
- Work Registration authority;
- Workspace ownership;
- generation/call sequencing;
- active tool/resource leases;
- executor wake/drain;
- tunnel supervision;
- diagnostics.

### Execution runtime owns

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

## Resident Idle Contract

Khi không có work đang chạy, GPTWorker phải trở về trạng thái resident tối thiểu:

~~~text
Resident Host
  ├─ tray icon / supervisor
  ├─ MCP front door
  ├─ Secure MCP Tunnel
  └─ event-driven control loop

Execution state
  ├─ no active Job/Workspace unless a WorkRegistration is intentionally alive
  ├─ no shell session
  ├─ no REPL instance
  ├─ no managed child process
  ├─ no borrowed tool instance
  └─ no arbitrary polling loop keeping executor busy
~~~

"One thin active loop" là **logical architecture**, không phải cam kết đúng một OS thread. Node/.NET/tunnel-client có thể có internal threads, nhưng GPTWorker không được giữ execution workload, busy polling, tool pool hoặc background Job chỉ để chờ việc.

Resident behavior phải event-driven. Health checks/polling chỉ dùng khi startup, recovery, explicit diagnostics hoặc cadence rất thưa có lý do rõ ràng.

Incoming work:

~~~text
MCP request
  → resident front door validates work/control context
  → wake execution runtime if execution is needed
  → borrow/create required tool instance
  → execute
  → release owned tool/resource
  → return to quiescent state when no execution work remains
~~~

Closing ChatGPT does not stop GPTWorker. User manually exits from the tray when they want the local bridge fully off.

### Tray contract

System tray menu remains intentionally small:

~~~text
GPTWorker
Status: Connected | Working | Degraded

Open setup guide
Restart GPTWorker
Exit GPTWorker
~~~

- `Open setup guide` opens the local onboarding HTML.
- `Restart GPTWorker` restarts resident host/tunnel and invalidates stale execution authority through normal epoch rules.
- `Exit GPTWorker` stops the resident host, tunnel, execution runtime, and GPTWorker-owned child resources.
- Tray Exit must not kill unrelated user applications.
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

## Four Independent Lifecycles

### 1. Transport

MCP initialize/session/GET/DELETE/recovery. Disposable. Not authority.

### 2. Resident Host

Starts with Windows user logon after setup and normally remains alive until manual tray Exit, restart, logoff, or OS shutdown. It owns the tray, tunnel supervision, MCP front door and work authority metadata. It is not a Job and does not imply an active Workspace.

### 3. Work Registration

Job + Workspace execution authority. Lives until explicit stop/switch, Resident Host restart, or 10 minutes of inactivity. The idle clock applies only when no tool lease is active; releasing the final foreground lease restarts the idle clock.

### 4. Execution Runtime

Execution runtime may be asleep/quiescent while Resident Host + tunnel remain alive.

~~~text
activeCalls == 0
AND activeResourceLeases == 0
AND queuedDispatch == 0
AND publishTransactions == 0
  → execution runtime may sleep/unload
~~~

A valid later call wakes execution again without inventing a new Job/Workspace. A timed-out WorkRegistration, however, must be registered again.
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

Normal desktop UX:

~~~text
FIRST TIME
setup.bat
  → configure Tunnel/API
  → connect ChatGPT
  → register per-user auto-start
  → start resident GPTWorker

EVERY DAY
Windows logon
  → GPTWorker tray icon appears
  → Secure MCP Tunnel is ready
  → open ChatGPT and use @gptworker
~~~

No launcher window is required for normal daily use.

Chat command surface remains intentionally small:

~~~text
gptworker/help
gptworker/job list
gptworker/job create
gptworker/job update
gptworker/job remove
gptworker/job export
gptworker/job import
gptworker/job stop
~~~

Internal tools may implement select/register/status/switch/diagnostics. The user does not manage execution IDs or authority tokens manually; ChatGPT carries the work handle between tool calls.
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
16. Windows resident host + tunnel may stay alive while execution runtime is quiescent.
17. Idle resident state holds no pre-created tool pool, shell/REPL session, managed execution process or active Job merely for readiness.
18. Normal daily UX requires no launcher window; tray icon is the local lifecycle control.
19. Manual tray Exit stops GPTWorker-owned resident/tunnel/execution resources but never unrelated user applications.

## Security / Trust Model

GPTWorker remains a trusted local worker with broad machine access. Work Registration and workspace binding prevent accidental cross-job context drift; they are not an OS sandbox.

Credentials are never embedded in readable execution IDs, tool lease IDs or Job state. The opaque authority token is treated as a credential: redacted from normal logs/diagnostics and rotated on every new registration. Diagnostic logs remain private operational evidence and use redaction.

## Deferred

- active registration resume after Resident Host reboot/restart;
- concurrent independent executions on the same workspace;
- multi-machine execution;
- untrusted pack OS sandbox;
- marketplace/package manager;
- Windows Service: not required for the desktop design; per-user logon background app is the target;
- physical Driver/Executor process split unless idle-footprint testing proves it necessary;
- EXE/installer packaging until the final live source test passes and the user explicitly approves packaging.

# GPTWorker v2 — Implementation Plan

## Objective

GPTWorker v2 phải cho phép nhiều ChatGPT work session chạy song song trên nhiều workspace mà không lẫn việc, trong khi Driver + Secure MCP Tunnel luôn nhẹ và Worker executor chỉ tồn tại khi thực sự có việc cần thực thi.

Mô hình authority mới:

~~~text
1 work session
  → 1 active Job
  → 1 active Workspace
  → 1 Work Registration / Execution
~~~

Không có Job + Workspace registration hợp lệ thì execution tool không có quyền làm việc.

P0 logging đã hoàn tất và live log ngày 2026-09-20 đã cho thấy MCP transport session không ổn định theo conversation: gần như mỗi tool call có một session ID riêng và session recovery được dựng lại liên tục. Vì vậy v2 không dùng Mcp-Session-Id làm work identity và không cố suy conversation identity từ transport.

## Governing Principles

1. Job + Workspace là work identity. Runtime không tự gắn vào Job gần nhất, workspace gần nhất, cwd global hay transport session gần nhất.
2. Một active execution sở hữu một workspace. Hai active executions không đồng thời sở hữu cùng canonical workspace.
3. Tool Family là capability dùng chung. Job consume family; Job không đăng ký hoặc clone core tool riêng.
4. Tool instance sinh theo nhu cầu. Không có pool cố định, free-list hay số lượng instance định trước cho filesystem/shell/git.
5. Tool instance bind bất biến khi sinh. Nó mang Job + Workspace + Execution + Generation + Call identity và không được rebind trong suốt lifetime.
6. Concurrency không bị chặn bởi tên tool. Hai jobs khác workspace có thể cùng dùng filesystem/read/write/shell/git song song. Giới hạn chỉ đến từ tài nguyên hệ thống hoặc external resource thật.
7. WorkRegistration auto-stop sau 10 phút không có valid work-handle activity. Foreground tool call đang có lease không bị kill giữa chừng; timer bắt đầu lại khi lease cuối cùng release.
8. Nếu registration mất hiệu lực thì phải đăng ký lại. Driver restart, explicit stop hoặc một expiry/host signal đã được xác minh làm execution cũ invalid; tool call sau đó nhận NO_ACTIVE_WORK.
9. Transport lifecycle, execution lifecycle và worker-process lifecycle là ba lớp độc lập.

## Naming Convention

ID phải human-readable, gắn với Job và Workspace, không dùng UUID ngẫu nhiên làm identity chính.

Canonical workspace key:

~~~text
<workspace-slug>#<stable-path-hash>
~~~

Ví dụ:

~~~text
audio-library-for-english#8f31c2
ke-math-grade1#41bd77
~~~

Hash là deterministic từ canonical absolute path sau normalization; slug lấy từ workspace basename. Hash ngắn chỉ dùng chống collision, không thay canonical path authority.

Execution ID:

~~~text
exec:<job-id>@<workspace-key>:e<driver-epoch>:g<generation>
~~~

Ví dụ:

~~~text
exec:dev-coding@audio-library-for-english#8f31c2:e12:g1
exec:dev-coding@ke-math-grade1#41bd77:e12:g1
~~~

`driver-epoch` tăng đơn điệu mỗi lần Driver khởi động. `generation` tăng mỗi lần cùng workspace được replace/re-register trong một epoch. ID vẫn human-readable nhưng không bị tái sử dụng sau restart.

Execution ID không phải credential. Mỗi registration còn có một `authorityToken` opaque, random/unguessable, bind với Job + Workspace + epoch + generation + pack revision. Execution tool phải có cả ID và token đúng. User không quản lý token này; ChatGPT giữ work handle nội bộ.

Ephemeral tool lease / instance identity:

~~~text
tool:<family>@<job-id>@<workspace-key>:e<driver-epoch>:g<generation>:c<call-sequence>
~~~

Ví dụ:

~~~text
tool:filesystem@dev-coding@ke-math-grade1#41bd77:e12:g1:c27
~~~

Một instance tạm được tạo khi call bắt đầu và bị destroy/release khi call/resource kết thúc. Không có trạng thái FREE để tái sử dụng như một inventory cố định.

## Target Runtime

~~~text
ChatGPT
  → Secure MCP Tunnel
  → Driver / Public MCP Gateway                 [always-on, light]
      ├─ MCP protocol/compatibility handling
      ├─ WorkRegistrationStore
      ├─ WorkspaceOwnershipRegistry
      ├─ ActiveToolLeaseRegistry
      ├─ generation / call sequence
      ├─ WakeCoordinator
      └─ IPC
           ↓
        Worker Executor                         [on-demand]
          ├─ Tool Family Registry
          │   ├─ filesystem
          │   ├─ shell
          │   ├─ git
          │   ├─ process
          │   ├─ context
          │   └─ upstream adapters
          ├─ ephemeral tool instances
          └─ Job Pack runtime / validation

Mutable data:
%LOCALAPPDATA%\GPTWorker\
~~~

Driver giữ authority và bookkeeping. Worker executor không giữ machine-global active Job/cwd.

## Core State

### WorkRegistration

~~~text
WorkRegistration
  executionId
  authorityToken
  driverEpoch
  generation
  phase: AWAITING_CONFIRMATION | ACTIVE | CLOSING
  jobId
  workspaceCanonicalPath
  workspaceKey
  packRevision
  bindings
  confirmedContext
  confirmation
  activeCalls
  activeResourceLeases
~~~

Không cần conversationId để runtime đúng. ChatGPT giữ `executionId + authorityToken` trong work session và gửi lại khi gọi execution tools. P1 phải chứng minh live qua connector rằng một chat giữ đúng handle qua nhiều calls, và hai chats xen kẽ không hoán đổi handle.

### WorkspaceOwnership

~~~text
WorkspaceOwnership
  canonicalWorkspacePath
  workspaceKey
  executionId
  generation
~~~

Nếu workspace đã thuộc một active execution khác:

~~~text
WORKSPACE_BUSY
~~~

Không auto-attach vào owner hiện tại.

### Tool Family Registry

Family chỉ mô tả capability/factory/schema/lifecycle mode, không chứa số lượng instance:

~~~text
filesystem
  operations: read/write/edit/list/search/patch

shell
  operations: run/start/stop/status

git
  operations: status/diff/commit/...

...
~~~

Job Pack chỉ khai báo family/capability được phép dùng. Không tạo coding_read_file, mto_read_file hoặc duplicate implementation chỉ vì nhiều Job cùng dùng filesystem.

Tool Family là lớp tổ chức/runtime context, không bắt buộc gom mọi operation vào một mega MCP tool. Các public tool schema hiện tại có thể tiếp tục tách riêng (read/write/edit/run/...) nhưng cùng resolve qua một family factory/context dùng chung.

## Tool Call Lifecycle

~~~text
incoming execution tool call
  ↓
require execution_id + authority_token
  ↓
resolve active WorkRegistration
  ↓
verify generation
  ↓
verify Job + Workspace binding
  ↓
verify WorkspaceOwnership
  ↓
verify confirmation / pack revision / capability
  ↓
create ephemeral tool instance from family
  ↓
bind immutable ToolContext
  ↓
register active lease
  ↓
execute
  ↓
release/destroy instance
  ↓
remove active lease
~~~

ToolContext tối thiểu:

~~~text
ToolContext
  family
  executionId
  driverEpoch
  generation
  jobId
  workspaceCanonicalPath
  workspaceKey
  callSequence
  packRevision
~~~

Tool instance không đọc machine-global cwd và không được đổi workspace giữa chừng.

### Stateless vs stateful resources

Stateless/short-lived operations như read/list/grep/write/edit sinh instance theo call và hủy ngay sau completion.

Stateful resources như long-running shell process, REPL state hoặc external adapter session giữ lease cho tới khi resource kết thúc/reset/stop. Lease vẫn thuộc đúng execution/generation ban đầu và không được rebind.

## Worker Sleep Policy

WorkRegistration dùng inactivity timeout 10 phút như một full job stop để tránh orphaned Job khi user đóng chat mà không gọi stop.

Worker executor có thể chuyển sang sleep khi:

~~~text
activeCalls == 0
AND activeResourceLeases == 0
AND queuedDispatch == 0
AND publishTransactions == 0
~~~

WorkRegistration vẫn nằm trong Driver và có thể ACTIVE trong khi Worker ngủ.

Call tiếp theo:

~~~text
execution_id hợp lệ
  → Driver wake Worker
  → tạo tool instance mới
  → tiếp tục đúng Job + Workspace
~~~

Driver + tunnel luôn sống nhẹ. Worker process sleep vẫn là lifecycle riêng; 10-minute WorkRegistration timeout là authority cleanup, không phải transport/session timeout.

## Registration / Stop Contract

### Register

Flow hiện tại DISCOVER → SELECT → RESOLVE → CONFIRM được giữ, nhưng output cuối là một WorkRegistration rõ ràng.

~~~text
select Job
  + resolve Workspace
  + confirm
  → acquire WorkspaceOwnership
  → driverEpoch + generation binding
  → issue executionId + authorityToken
  → ACTIVE
~~~

Một work session chỉ dùng một active Job + Workspace. Khi cần đổi việc, phải stop/switch bằng execution hiện tại rồi register binding mới.

Nếu exact workspace đang bận:
- caller có valid handle hiện tại → registration là idempotent;
- caller không còn handle → trả WORKSPACE_BUSY, không auto-attach;
- caller có thể explicit re-register/replace đúng Job + Workspace, confirm lại scope; Driver đóng execution cũ, invalidate token/generation, cleanup owned resources rồi cấp handle mới.

### No active work

Bất kỳ execution tool nào thiếu/không tìm thấy/không còn hợp lệ `execution_id + authority_token`:

~~~text
NO_ACTIVE_WORK
registration_required = true
~~~

Không fallback.

### Stop

~~~text
job_stop(execution_id)
  → CLOSING
  → block new calls
  → drain/cancel owned calls
  → cleanup owned stateful resources
  → release WorkspaceOwnership
  → invalidate generation
  → remove WorkRegistration
~~~

Stop không tắt Driver hoặc tunnel.

## Implementation Phases

### P0 — Runtime Evidence — DONE

- Structured JSONL activity logging.
- Redaction, rotation, fail-open behavior.
- MCP HTTP/session/tool events.
- Live Windows + ChatGPT + tunnel evidence.
- Evidence kết luận: MCP transport session không phải stable work identity; multiple real chats can interleave tool calls.

Acceptance: code + CI + live runtime evidence hoàn tất.

### P1 — Work Registration + Workspace Ownership

#### P1A — Work Tool Lease Pilot first

Trước khi refactor sâu, triển khai vertical slice nhỏ:

- confirmed Job + Workspace tạo `work_handle`;
- native execution tools nhận `execution_id + authority_token`;
- mỗi call tạo ephemeral lease có ID gắn Job + Workspace;
- log `work_registered / tool_lease_acquired / tool_lease_released / tool_lease_rejected`;
- filesystem calls dùng call-local workspace context;
- confirmation proof sống qua MCP transport reconnect;
- live test 2 chats / 2 workspaces / interleaved filesystem calls.

Acceptance chi tiết: [WORK_TOOL_LEASE_PILOT.md](WORK_TOOL_LEASE_PILOT.md).

Nếu ChatGPT không carry đúng work handle qua repeated/interleaved calls, dừng P1 tại đây và sửa continuity contract trước khi refactor sâu hơn.

Implement contract mới trước khi sửa tool internals:

- WorkspaceKey canonicalization + deterministic hash; normalize drive-letter/case/separators/trailing slash và resolve real path/reparse target khi khả dụng.
- persistent monotonic DriverEpoch counter (runtime metadata, không phải Job registry).
- WorkRegistrationStore.
- WorkspaceOwnershipRegistry.
- human-readable executionId + authorityToken + generation.
- registration/confirmation creates ACTIVE execution.
- explicit NO_ACTIVE_WORK.
- duplicate workspace activation → WORKSPACE_BUSY.
- explicit confirmed replace path cho orphaned/lost-handle registration.
- Driver restart increments epoch and invalidates old registration.

Acceptance:
- hai work sessions register hai workspace khác nhau;
- mỗi execution chỉ có một Job + Workspace;
- cùng workspace không tạo hai active owners;
- missing/stale ID hoặc wrong token không chạy execution tool;
- stop/re-register và Driver restart không bao giờ tái sử dụng cùng execution identity;
- lost handle có thể recover bằng explicit confirmed replace, không auto-attach;
- live connector: một chat giữ đúng handle qua >=5 execution calls; hai chats xen kẽ giữ hai handles riêng;
- không có fallback global state.

### P2 — ExecutionContext + Tool Gate

Loại bỏ authority từ global mutable state:

- cwd/context/project instructions theo execution.
- confirmation token bind Job + Workspace + driver epoch + generation + pack revision.
- every native/upstream execution path receives ExecutionContext.
- preflight/control tools được allowlist rõ ràng.
- direct execution trước ACTIVE bị blocked.

Acceptance:
- changed workspace/binding/generation reject token cũ;
- Chat A/B xen kẽ không đổi context nhau;
- stop A không đổi Job/cwd/context B.

### P3 — Shared Tool Families + Ephemeral Instances

Refactor core tools theo family:

- family registry cho filesystem/shell/git/process/context/upstream.
- Job Packs consume capabilities, không register duplicate tools.
- on-demand instance factory.
- immutable ToolContext.
- ActiveToolLeaseRegistry.
- call sequence + readable lease ID.
- không fixed inventory, không free-list, không queue do trùng family.
- stateful resources giữ lease theo lifetime thật.

Acceptance:
- 20 independent executions có thể đồng thời gọi cùng filesystem family trên 20 workspace mà không chờ một global singleton;
- instance A không thể rebind sang workspace B;
- completion xóa lease;
- stateful lease chỉ biến mất khi resource kết thúc/reset/stop;
- concurrency chỉ bị giới hạn bởi system/external resource policy thực.

### P4 — Remove Global Runtime State + Concurrency Acceptance

Refactor các module hiện đang global:

- path-security default cwd.
- persistent shell cwd/history.
- process registry.
- REPL/resource handles.
- checkpoint/context ownership.
- project instruction resolution.
- upstream adapters có mutable context.

Acceptance:
- stress test nhiều executions xen kẽ read/write/shell/git;
- mỗi tool log đúng execution/job/workspace;
- không cross-workspace access do runtime context drift;
- explicit workspace path ngoài binding bị policy reject theo capability contract.

### P5 — Default + Custom Job Routing — CURRENT

- repo `jobs/<job-id>/` contains bundled default Jobs only.
- `%LOCALAPPDATA%\GPTWorker\jobs\<job-id>\` contains user custom Jobs only.
- `job list` merges both sources.
- Job ids are globally unique.
- `job create` checks both roots and publishes only to AppData.
- `job update/remove` operate only on custom AppData Jobs.
- default repo Jobs are never mutated by Job authoring.
- invalid custom packs never become live.
- `job stop` remains an internal cleanup primitive, not public UX.
- no second Job registry.

Acceptance:
- repo defaults remain visible with empty AppData;
- create custom → list shows both default + custom;
- duplicate id against default/custom is rejected at create;
- update/remove custom works;
- update/remove default is rejected;
- malformed custom pack never shadows a default.

### P6 — Stateful Tool Isolation + Concurrency

- shell cwd/history keyed by WorkRegistration, not machine-global state.
- process registry owned by `work_id`.
- stateful resource leases follow actual resource lifetime.
- WorkRegistration idle timeout: 10 minutes, equivalent to full job stop.
- cleanup affects only the owning work.
- stress concurrent filesystem/git/shell/process across workspaces.

Acceptance:
- A/B shell cwd cannot cross;
- process created by A cannot be controlled by B;
- same Tool Family can overlap without family-level queue;
- active foreground lease prevents timeout; after release the 10-minute idle clock restarts.

### P7 — AppData Custom Job Live Trial

- live-test custom Job creation directly in `%LOCALAPPDATA%\GPTWorker\jobs\`.
- verify portable harness/skill paths from AppData.
- verify repo defaults remain untouched and available.
- verify custom Jobs survive git pull / repo update.
- Driver split is not required.

Acceptance:
- create/update/remove custom Job works live through ChatGPT;
- default Jobs continue loading from repo;
- restart preserves custom Jobs;
- repo update cannot overwrite custom Jobs.

### P8 — Optional Driver / Background Host + Diagnostics

Public UX giữ tối giản:

~~~text
gptworker/job list
gptworker/job create
gptworker/job update
gptworker/job remove
~~~

Selection/register/status/switch có thể là internal MCP tools để ChatGPT orchestration dùng, không cần biến thành command người dùng.

Diagnostics hiển thị:
- execution ID;
- Job;
- workspace key;
- generation;
- active tool leases;
- worker awake/sleep reason.

Không expose credential hoặc full hidden authority token.

### P9 — EXE Packaging — LAST

- begin only after AppData custom Job live trial passes.
- manual launch remains acceptable if sufficient.
- auto-start/Driver work is optional hardening, not a release gate.
- clean-machine packaging and upgrade preservation.

Acceptance release:
- install → logon → ChatGPT → register Job+Workspace → tools;
- 2+ work sessions chạy song song khác workspace;
- worker sleep/wake không lẫn việc;
- stale execution không có quyền làm việc;
- upgrade giữ user Job Packs.

## Validation Matrix

| Contract | Required evidence |
|---|---|
| Work registration | Job + Workspace required; stale/missing execution rejected |
| Workspace ownership | one active owner per canonical workspace |
| Naming | deterministic workspace key; readable execution/tool lease IDs; epoch/generation non-reuse; collision test |
| Work handle continuity | live ChatGPT carries execution ID + authority token across repeated/interleaved calls |
| Confirmation | token bound to execution/driver-epoch/generation/workspace/pack revision |
| Tool family | one shared implementation/factory family; no per-Job duplicated core tools |
| Ephemeral instances | on-demand spawn, immutable binding, release after lifetime |
| Concurrency | many executions same family, different workspaces, no family-level queue |
| Isolation | no global cwd/process/REPL/context drift |
| Stop | releases workspace + owned resources only |
| Sleep/wake | quiescence-based; registration survives Worker sleep |
| Driver restart | epoch changes; old execution ID/token rejected; must register again |
| Packs | AppData portable, immutable active revision |
| Publish | validated transactional update |
| Deployment | Windows logon, tunnel/Driver light, executor on-demand |

Every code phase chạy targeted tests, sau đó:

~~~text
npm run build
npm run validate:jobs
npm test
git diff --check
~~~

Live acceptance dùng ít nhất hai ChatGPT work sessions và hai workspace thật.

## Explicitly Removed from Old Plan

Các ý sau không còn là architecture authority:

- dùng MCP transport session làm logical session identity;
- cố map transport session → conversation để execution hoạt động;
- session TTL làm authority cleanup;
- machine-global active Job/cwd;
- fixed Tool Pool / số instance định trước;
- per-Job duplicate read/write/shell/git tools;
- queue chỉ vì hai Jobs gọi cùng Tool Family;
- file-level mutation lock cho các Jobs ở workspace khác nhau;
- auto-attach vào most-recent Job/workspace.

## Deferred

- Resume active registration sau Driver reboot.
- Cross-machine work session.
- OS sandbox cho untrusted packs.
- Public rollback/remove/enable/disable.
- Marketplace/dependency manager.
- Sharing one workspace concurrently across independent executions.

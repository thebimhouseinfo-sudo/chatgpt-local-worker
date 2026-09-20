# GPTWorker v2 — Architecture đề xuất

## Objective / Context

Tài liệu sửa plan người dùng ngày 2026-09-20, dựa trên baseline `9997d4c`. Trạng thái: PROPOSED / REVIEWED; chưa thay thế runtime policy trong root `WORKER.md`. Tên GPTWorker v2 và AppData folder được dùng theo đề xuất người dùng; việc đồng bộ branding toàn repo cần nằm trong phase release.

Mục tiêu: đăng nhập Windows là có thể dùng Worker qua ChatGPT; giữ nền mỏng; thực thi theo nhu cầu; nhiều phiên độc lập; tạo/cập nhật Job trong AppData mà không rebuild ứng dụng.

### Phạm vi P0 đã chốt

Theo quyết định hiện tại của người dùng, P0 chỉ triển khai lớp logging tự động. P0 không thay đổi Job lifecycle, session ownership, path behavior, permission behavior, tunnel routing, sleep/wake hay Job storage. Logging phải fail-open: lỗi ghi file không được làm fail tool/MCP request.

P0 log structured JSONL tại một file runtime riêng, có timestamp, process id, event kind/action, status, request/session/tool metadata, duration, target/summary, error và bounded details. Secret/token/password/authorization/cookie và giá trị giống credential phải được redacted; record và file có giới hạn kích thước; ghi file bất đồng bộ; log rotation là best effort. File log là evidence vận hành, không phải authority cho Job/session state.

## Current Architecture

`setup.bat`/`run.bat` khởi động Node MCP server và Secure MCP Tunnel. `src/index.ts` đồng thời quản lý HTTP endpoint, session recovery, project instructions, upstream manager và Admin server. Mỗi MCP server có JobRuntime riêng nhưng cwd/shell/process registry và persistent worker-state dùng chung.

Job discovery đọc `job.yaml` bằng JSON parser, cùng JOB/SKILL của tất cả pack. Runtime mặc định cần workspace; path resolver gộp install root, policy root và writable state. Test có độ bao phủ tool/harness tốt, nhưng chưa chứng minh session isolation hoặc quyền thực thi gắn confirmation.

## Target Architecture

```text
ChatGPT
  → Secure MCP Tunnel (process do tunnel-client quản lý protocol tunnel)
  → Driver / public MCP gateway (always-on, chạy dưới Windows user)
      ├─ MCP SDK transports + compatibility adapter
      ├─ SessionStore (RAM, logical execution identity)
      ├─ WakeCoordinator + ResourceLeases + supervisor
      └─ IPC → Worker executor (on demand)
                  ├─ JobRuntime + JobCatalog + JobLoader
                  ├─ filesystem / shell / git / context / upstream tools
                  └─ một active Job cho mỗi logical session

Data: %LOCALAPPDATA%\GPTWorker\
```

Driver chứa transport handlers/tool dispatch stubs và schema cần cho giao tiếp, không chứa implementation filesystem/shell/Git hay business rules. Việc dùng MCP SDK khiến Driver không phải proxy HTTP thuần túy; đánh đổi này giữ protocol session khi Worker ngủ. Đo memory/CPU thực tế trước khi quảng bá là “cực nhẹ”.

## Boundaries & Responsibilities

| Thành phần | Sở hữu | Không sở hữu |
|---|---|---|
| Driver | Single instance, child lifecycle, tunnel supervision, public transport, live SessionStore, request/resource bookkeeping | Thiết kế rule, thao tác project, nội dung Job skills |
| Worker core | Tool implementation, Job transitions, context resolution, catalog/loader, pack transaction primitives | Chính sách kỹ thuật HVAC/CAD hoặc tự suy đoán scope |
| Job Pack | Workflow, business rules, skills, harness, acceptance | Core filesystem/shell/Git framework hoặc tunnel credentials |
| Job Authoring | Yêu cầu Job mới, chỉnh sửa staged pack, validation workflow | Ghi tùy ý live pack trong khi bypass publish transaction |
| Installer/bootstrap | Runtime/assets, seed pack thiếu, data migration, startup registration | Overwrite pack đã tùy biến hoặc kế thừa active Job v1 |

Chỉ một nguồn state của logical session: SessionStore trong Driver. Worker nhận snapshot/context version cho từng operation và trả state transition; Driver commit theo version trước khi trả success. Execution lease khóa stop/switch với thao tác đang chạy. Không có hai authority độc lập trong Driver và Worker.

## Data / State / Control Flow

### 1. Identity contract

Phân biệt `conversation`, `transportSessionId` và `executionSessionId`.

- MCP session là transport identity, không mặc định là chat identity.
- `executionSessionId` do runtime tạo, gắn driver epoch và owner đã kiểm chứng.
- P0 phải xác định identity/context mà ChatGPT → tunnel-client → local endpoint thực sự cung cấp, qua nhiều tool calls và nhiều chat.
- Nếu transport ổn định đủ dùng, một transport session có thể map một execution session; nếu không, cần cơ chế continuity riêng đã test. Token tường minh là một option cần review, không phải bằng chứng của chat identity.
- Nếu thiếu bằng chứng ownership, không tự attach vào “Job gần nhất” hoặc suy từ cwd. Yêu cầu bind/confirm lại; đánh dấu UX tự resume là chưa đạt.
- User/chat A không được đọc trạng thái B qua `job_status`, process status hoặc checkpoint API.

Tài liệu protocol không cung cấp event “người dùng đóng tab ChatGPT”. Kết thúc logical session dựa trên explicit control, expiry hoặc tín hiệu host đã kiểm chứng. Mapping DELETE vào kết thúc Job phụ thuộc kết quả P0: nếu mỗi chat có nhiều transport session, DELETE chỉ đóng transport tương ứng. [MCP transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).

### 2. SessionContext và execution gate

Contract tối thiểu đề xuất:

```text
SessionContext
  executionSessionId, ownerBinding, driverEpoch, generation, stateVersion
  phase: IDLE | SELECTED | AWAITING_CONFIRMATION | ACTIVE | CLOSING
  jobId, packRevision, bindings, resolvedContext
  confirmation: payloadHash, token, expiry, consumed
  cwd, instructionContextRef, resourceHandles
  lastClientActivity, activeOperations, idleLeases
```

Field này là state ứng dụng, không phải field MCP mới. Không serialize credentials hoặc shell command history vào token. Project memory có thể là tài liệu dùng chung có chủ đích; active scope/authority luôn là session-local.

Token confirmation ràng buộc session/generation, pack content revision, resolved context và toàn bộ bindings ảnh hưởng scope. Thay bất kỳ giá trị đó phải tạo proposal mới. Token có expiry và chỉ dùng một lần; retry cùng activation request ID trả lại kết quả đã commit.

Dispatch gate cho phép discovery/status/selection và kiểm tra context cần thiết trước activation; project mutations, commands, Git mutations, REPL evaluation và upstream execution cần ACTIVE đã xác nhận. Danh sách preflight được định nghĩa rõ, không suy từ tool annotation `read` vì một số hook có side effect.

Mỗi native/upstream call nhận ExecutionContext từ router; không dùng global cwd hay `process.chdir()` để chuyển project. Chia sẻ upstream connection chỉ khi adapter hỗ trợ nhiều phiên và không chứa mutable project context dùng chung; trường hợp còn lại cần connection/resource lease riêng.

### 3. Generic context

Manifest context mô tả resolver và binding, không thay thế permission policy:

- `workspace`: đường dẫn workspace từ binding đã khai báo.
- `project`: vẫn là path resolver generic; ý nghĩa cấu trúc `00 Input`/`01 WIP` thuộc MTO.
- `appdata`: root do runtime xác định; không hỏi người dùng project folder.
- `none`: chỉ khi pack thật sự không cần filesystem context; relative filesystem calls phải cung cấp base rõ ràng.

Với `job-authoring`, appdata là root xác định được, còn working directory thực thi nên là staging của operation. Không tự lấy repository ứng dụng làm workspace. Các binding bổ sung như task/objective/equipment/planning_dir vẫn tồn tại.

### 4. Wake, sleep và restart

```text
SLEEPING → STARTING → AWAKE → DRAINING → SLEEPING
                ↘ startup failure → BACKOFF → retry có giới hạn
```

- WakeCoordinator là single-flight: các request đồng thời dùng cùng startup promise và readiness handshake theo worker epoch.
- Queue có deadline, giới hạn độ dài/body và backpressure. Không chuyển trạng thái ready chỉ vì PID tồn tại.
- Liveness endpoint trả được lúc Worker ngủ; discovery/tools request hợp lệ có thể wake. Tunnel probe cũng có thể tạo MCP traffic: phải đo, không hứa “chỉ khi người dùng chủ động chat”.
- Giữ SDK xử lý initialize, notifications, GET/SSE, DELETE, protocol headers, cancellation và response status. Không serialize SSE GET vào queue làm block POST/cancel.
- Wake budget phải thấp hơn timeout thực đo của connector/tunnel, có biên dự phòng; chưa hard-code một con số thành SLO.
- Worker chỉ được ngủ khi không còn in-flight operation, queued dispatch, publish transaction, process nền cần quản lý, hay resource không thể restore. Job ACTIVE nhưng không có resource vẫn được ngủ.
- REPL chứa object/handle không serialize: mặc định giữ Worker thức đến reset/stop; không âm thầm mất biến để đạt timeout. Shell hiện chủ yếu giữ cwd/history, không phải snapshot toàn bộ PowerShell process.
- Stop Worker bình thường cần handshake xác nhận SessionStore đồng bộ; request đến trong DRAINING hủy drain nếu còn an toàn, nếu không thì đợi lần wake kế tiếp.
- Worker crash: giữ logical Job ở Driver nhưng invalidate resource handles; operation có khả năng đã gây side effect được ghi UNKNOWN, không tự replay. Khôi phục context không đồng nghĩa khôi phục lệnh dở dang.
- Driver restart: mất live Job/session theo yêu cầu người dùng; driver epoch mới làm ID/token cũ vô hiệu. Không restore active authority từ `worker-state.json` v1. Logs/checkpoints/history vẫn còn để tra cứu.

### 5. Stop và session cleanup

`job_stop` đưa job hiện tại vào CLOSING, chặn dispatch mới và drain/cancel công việc do job sở hữu. Sau cleanup mới về IDLE; giữ transport/conversation nếu còn kết nối. `job_switch` phải hoàn thành cleanup generation cũ trước khi xác nhận generation mới.

Chỉ kết thúc child processes do phiên sở hữu, không kill AutoCAD/Excel hay ứng dụng người dùng chỉ vì đã kết nối đến chúng. Windows process tree ownership phải dựa trên handle/lease, không chỉ PID có thể tái sử dụng. Driver crash cần cơ chế thu hồi child tree được test.

GC session dùng idle lease, không chỉ thời điểm HTTP request; request dài và background process có lease đang hoạt động không bị xóa giữa chừng. TTL worker và TTL session là hai cấu hình khác nhau. SessionStore có quota để tránh memory tăng vô hạn.

## Invariants & Constraints

1. Một active Job cho mỗi logical execution session; không có machine-global active Job/cwd.
2. Sleep của Worker không stop Job; restart Driver kết thúc authority của phiên cũ.
3. Không tuyên bố conversation isolation khi chưa chứng minh identity mapping trên client thật.
4. Mỗi operation sử dụng đúng confirmed context, scope và pack revision; stop/switch vô hiệu hóa generation cũ.
5. Full-machine access vẫn là trust model. Job write policy cần validator/gate; unrestricted shell và REPL không phải OS sandbox, không quảng bá hard isolation khi chưa có sandbox tương ứng.
6. MTO giữ giới hạn `01 WIP/SCHEDULE/eqm/**`, stable/draft semantics và bảo toàn manual fields; v2 không thay business rules.
7. Hai session độc lập không đảm bảo hai writer cùng project không xung đột. Mutation lease theo canonical target/repository; shell command tùy ý dùng lease workspace bảo thủ. Không đoán toàn bộ write-set của shell.
8. Public endpoint loopback; có kiểm soát Host/Origin và local authentication phù hợp tunnel profile. Không coi `cors()` là kiểm soát truy cập. Không copy tunnel key vào tool state.
9. Có logs/diagnostics nội bộ và chế độ foreground cho phát triển; không bắt người dùng mở UI riêng hằng ngày.
10. Không replay tool mutation sau ambiguous failure; không cam kết exactly-once cho shell/external side effects.

## Integration Points

### Paths và migration

Tách `installRoot` (runtime, WORKER policy, seed packs, harness API) khỏi `dataRoot` (mutable data). Default data root trên Windows là `%LOCALAPPDATA%\GPTWorker`; dev/test có override rõ ràng. Compatibility env cũ phải có precedence và migration note, không thay một hàm `getWorkerHome()` rồi kéo mọi asset sang AppData.

```text
%LOCALAPPDATA%\GPTWorker\
  jobs\<job-id>\                 published working pack
  staging\<job-id>\<operation-id>\
  history\<job-id>\<revision>\   recovery snapshots
  cache\packs\<content-hash>\   immutable active snapshots
  state\transactions\            publish journals, không chứa active Job authority
  logs\
  checkpoints\<scope-id>\
  config\                        settings và tham chiếu tunnel profile
```

`jobs/<id>/job.yaml` là nguồn registration; catalog RAM rebuild từ đây. Journals, history và cache không phải một registry thứ hai. Restart hoàn tất recovery transaction trước scan. Seed chỉ pack thiếu; pack đã có được validate và báo compatibility, không bị overwrite. Migration v1 copy/verify trước khi deprecate dữ liệu cũ, không tự xóa bản gốc.

### Manifest và portable harness

Giữ JSON-compatible YAML để tương thích parser. Thêm `manifest_schema` tách khỏi `worker_api` và version semantic của pack. Legacy manifest thiếu field đi qua adapter được test; API không hỗ trợ thì unavailable với lý do rõ.

Ví dụ phần mở rộng của manifest (không phải manifest đầy đủ):

```json
{
  "manifest_schema": 2,
  "worker_api": 1,
  "context": {
    "type": "workspace",
    "binding": "workspace",
    "required": true
  }
}
```

Các field hiện có như inputs/outputs/permissions/confirmation/skills/harness/validators vẫn phải hợp lệ. `appdata` không cần binding workspace; default root do runtime cấp. Worker API phải mô tả bindings, result envelope, context, tool capabilities và harness invocation; chỉ thêm một số version là chưa đủ.

Catalog scan metadata + structural checks; full content load/semantic validation khi select/publish. ID phải khớp folder, alias canonicalization theo case-insensitive rules và duplicate gây diagnostic xác định. Chặn path traversal/absolute resource path và reparse-point escape khỏi pack. `status=ready` cùng validation/API compatibility mới runnable; maturity stable/draft vẫn thuộc MTO.

Harness được gọi qua runtime runner cung cấp API/helper path ổn định, hoặc dependency đóng gói được version hóa; tuyệt đối không phụ thuộc `../../../shared-harness` trong checkout. Cần chọn cơ chế distribution ở P3 và test không có source repo, không có global Node nếu installer quảng bá tự đủ runtime.

### Job Authoring và publish

Giữ bốn cú pháp chat: `gptworker/job list`, `create`, `update`, `stop`. Chúng map thành MCP tool arguments; core không có access tự động vào nội dung chat. Có thể dùng một control tool nhỏ; `job_status`/select/switch vẫn tồn tại nội bộ. Routing create/update đề xuất job-authoring và đi qua confirmation hiện có.

Tạo/cập nhật pack đi qua:

```text
resolve scope + confirm authoring
→ stage unique operation (record expected base revision)
→ generate/edit pack
→ structural + compatibility + pack behavioral validation
→ freeze staged revision, acquire per-job publish lock
→ recheck base revision + validated content hash
→ snapshot previous revision + transaction journal
→ publish/recover transaction
→ catalog reload + report revision/validation evidence
```

Core cung cấp begin/validate/publish transaction; pack mô tả workflow. Authoring sửa staging; chỉ publish primitive chuyển live/history. Giữ “không có install command” ở UX nhưng vẫn có bootstrap/publish internals.

Runtime pin immutable pack snapshot theo content hash khi activation. Session đang chạy tiếp tục snapshot cũ; session mới dùng revision mới sau publish. Snapshot/cache cleanup phải giữ revision có active lease. Cập nhật chính job-authoring cũng tuân contract này; không load nửa rule cũ nửa mới.

Không giả định rename hai thư mục là một atomic transaction. Dùng journal + khóa trong Worker/Driver, cùng-volume staging, startup recovery và fault injection trên Windows. Logical publish chỉ được báo success khi live pack và catalog cùng revision. File bị lock hoặc base revision đổi trả lỗi conflict, giữ staged output để người dùng có thể xử lý.

Không chạy validator tự sinh rồi coi đó là proof duy nhất: baseline structural validator thuộc core, pack cần fixture/behavioral assertions phù hợp mục tiêu và completion evidence. Validator là code thực thi của trusted pack, không phải code tự nhiên an toàn vì có tên `validate`.

### Deployment

Driver là user-mode background process, không phải kernel driver. Scheduled Task at user logon là phương án đề xuất, không giả định mọi Windows policy cho phép đăng ký mà không elevation. Chạy đúng user; drive mạng có thể chưa mount khi logon, phải resolve khi dùng và báo unavailable.

Driver kiểm tra process ownership, có bounded restart/backoff, resource caps và log rotation. Worker/Tunnel child không mở console cho workflow hằng ngày. Windows sleep/shutdown/sign-out có thể làm tunnel offline; always-on nghĩa là supervisor duy trì khi user session/máy hoạt động.

Đóng gói EXE/installer sau khi prototype chứng minh dynamic ESM, child-process/harness invocation và external pack loading. User không cần cài Node riêng nếu đó là contract installer; EXE wrapper kèm runtime là phương án cần đánh giá, không mặc định mọi thứ phải nằm trong một file duy nhất.

## Architecture Decisions

Đã có trong yêu cầu người dùng: startup logon, tunnel supervision, Worker on demand, job/session isolation, AppData mutable packs, manifest registry, authoring workflow, minimal chat commands, Driver restart không tự resume Job.

Đề xuất của review, cần dùng làm điểm thảo luận trước implementation rộng: public transport ở Driver; logical session tách transport; execution context injection; pack snapshot pinning; JSON-compatible manifest; publish có journal; harness runner portable. Các đề xuất này chưa được trình bày như quyết định đã được người dùng phê duyệt.

## Open Architecture Questions

- OQ-01 — ChatGPT/Tunnel có identity ổn định, không bị chia sẻ giữa chat không? Đo P0; nếu không có, review explicit execution handle hoặc giảm cam kết auto-resume. Đây là blocker của acceptance conversation-level.
- OQ-02 — Timeout/wake budget, polling/probe pattern, session expiry và idle duration nào phù hợp? Đo rồi chọn; không giả định mọi MCP traffic là người dùng chủ động.
- OQ-03 — Cơ chế portable harness API và đóng gói Node/EXE cụ thể? Prototype trước khi chọn bundler.
- OQ-04 — Cơ chế tunnel credential provisioning/migration được bản tunnel-client mục tiêu hỗ trợ? Hiện `.env` chứa key; giữ tunnel authority, không tự tạo credential store thứ hai.

## Repository Evidence

- [JobRuntime](../../../src/jobs/job-runtime.ts): schema, scan/load, select/token, active payload.
- [Job tools](../../../src/tools/jobs.ts): activation side effects, workspace binding, stop/switch.
- [Path resolver](../../../src/lib/path-security.ts), [shell](../../../src/lib/persistent-shell.ts), [process tools](../../../src/tools/shell.ts): global mutable state.
- [Permissions](../../../src/lib/permissions.ts), [server factory](../../../src/server-factory.ts): current open execution và missing active-job dispatch gate.
- [Session manager](../../../src/lib/mcp-session-manager.ts): recovery, DELETE grace, TTL.
- [Worker paths](../../../src/lib/worker-home.ts), [policy loader](../../../src/lib/worker-policy.ts): install/data coupling.
- [Shared validator](../../../shared-harness/job-pack-validator.mjs), [dev-coding harness](../../../jobs/dev-coding/harness/validate.mjs): manifest checks và relocation dependency.
- [Instruction context](../../../src/lib/instruction-context.ts), [entrypoint](../../../src/index.ts): startup project context.
- [Tunnel helper](../../../openai-tunnel.ps1), [package](../../../package.json): provisioning, scripts, runtime dependencies.
- [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels): HTTP target supported. Không xác nhận cold-start budget hay conversation identity.
- [Review evidence](REVIEW.md): baseline test results, direct probes, limits of verification.

# GPTWorker Cleanup Plan

## 1. Hard boundary

GPTWorker được chốt là một **stability-first local Windows worker** cho GPT Web.

Target architecture duy nhất của đợt cleanup:

```text
GPT Web
   ↓
OpenAI Secure MCP Tunnel
   ↓
GPTWorker
   ↓
MCP session / recovery
   ↓
admission + workspace
   ↓
work_tool
   ├─ filesystem
   ├─ shell
   ├─ git
   ├─ context
   └─ node_repl (local thuần, nếu giữ)
```

GPTWorker **không** là:

- Codex bridge;
- Codex plugin host;
- Computer Use host dựa trên Codex runtime;
- Ponytail host;
- upstream MCP hub;
- proxy tới MCP server bên ngoài;
- Admin web application;
- tool ecosystem aggregator.

Rule quyết định:

> Nếu một dependency không phục vụ trực tiếp GPT Web → Secure MCP Tunnel → GPTWorker → local Windows tools, nó phải được delete, remap ra khỏi core, hoặc rewrite sạch.

Cleanup ưu tiên stability. Không rewrite phần connection/session phức tạp chỉ để source trông đẹp hơn.

---

## 2. Ba chiến lược cleanup

Mọi candidate phải rơi vào đúng một trong ba nhóm:

### GROUP A — DELETE DIRECTLY

Dùng khi toàn bộ chức năng không thuộc target và **không có logic cần cứu**.

Trong cleanup này, **DELETE DIRECTLY = remove khỏi active runtime tree rồi quarantine vào `legacy/group-a/`**, không phải physical-delete khỏi Git repo.

Caller/import/config liên quan được tháo trong cùng atomic change; file cũ được move ra khỏi active tree trước khi build/test.

### GROUP B — EXTRACT / REMAP → DELETE OLD

Dùng khi file cũ chứa một phần logic còn hữu ích hoặc tên/module boundary cũ vẫn đang được caller dùng.

Flow:

```text
extract phần cần giữ
→ đặt tên/home mới
→ remap caller
→ xác nhận old caller = 0
→ move old file ra khỏi active tree vào legacy/group-b/
```

### GROUP C — REWRITE CLEAN

Dùng khi behavior còn cần nhưng implementation cũ bị quấn quá sâu với Codex/Admin/upstream/legacy architecture.

Flow:

```text
viết spec nhỏ theo target
→ implement module mới sạch
→ test behavior cần giữ
→ switch caller sang implementation mới
→ move implementation cũ ra khỏi active tree vào legacy/group-c/
```

Không cố bóc từng nhánh legacy nếu rewrite nhỏ hơn, dễ hiểu hơn và ít dependency hơn.

---

# 3. GROUP A — DELETE DIRECTLY

Các item dưới đây không chứa capability cần cho target architecture.

## A1. Admin subsystem

Delete:

- `src/admin/server.ts`
- `src/admin/routes.ts`
- `src/admin/localhost-guard.ts`
- `public/ui/index.html`
- `public/ui/app.js`
- `public/ui/styles.css`

Không cần cứu:

- Admin UI;
- `.env` editor;
- upstream management UI;
- MCP import UI;
- Codex hooks UI;
- Computer Use toggle;
- Admin health endpoint;
- Admin instruction preview.

Các capability hữu ích đã có owner riêng:

- health → Worker `:3000/health`;
- activity/runtime evidence → `activity-log.ts` / `runtime-log.ts`;
- checkpoint behavior → `checkpoint.ts`;
- local tool profile → `tool-profile.ts`.

Caller/config phải tháo cùng change:

- `startAdminServer()` trong `src/index.ts`;
- `adminServer.close()`;
- `ADMIN_PORT`;
- `ADMIN_TOKEN`;
- Admin URL trong startup log;
- Admin data trong runtime log;
- Admin port trong instruction/environment context.

## A2. Upstream MCP hub

Delete toàn subsystem:

- `src/lib/mcp-upstream-manager.ts`
- `src/lib/mcp-upstream-config.ts`
- `src/lib/mcp-oauth-provider.ts`
- `src/lib/mcp-tool-proxy.ts`
- `src/tools/mcp-bridge.ts`
- `profiles/mcp-upstream.json`

Delete feature tools:

- `mcp_servers`
- `mcp_tools`
- `mcp_call`
- direct prefixed upstream proxy tools.

Delete upstream-only tests/helpers sau khi runtime caller đã tháo:

- `scripts/test-mcp-upstream.mjs`
- `scripts/test-mcp-oauth.mjs`
- `scripts/test-mcp-bridge-integration.mjs`
- `scripts/mock-http-mcp.mjs`
- `scripts/mock-stdio-mcp.mjs`

Delete config/reference:

- `MCP_UPSTREAM_CONFIG` trong `.env.example`;
- `.mcp-oauth/` rule nếu không còn feature nào dùng;
- `!profiles/mcp-upstream.json` trong `.gitignore`;
- upstream test scripts trong `package.json`.

**Không nhầm với OpenAI Secure MCP Tunnel.**

```text
OpenAI Secure MCP Tunnel
= CORE transport
= KEEP

GPTWorker → external MCP server
= upstream MCP hub
= DELETE
```

## A3. Codex runtime/plugin-only subsystem

Delete:

- `src/lib/codex-hooks.ts`
- `src/tools/ponytail.ts`
- `src/lib/plugin-config.ts`

Delete behavior:

- `~/.codex` plugin discovery;
- Codex hook execution;
- Ponytail turn controller;
- Codex Computer Use enable/disable config;
- `@oai/sky`;
- `codex-computer-use.exe`;
- `globalThis.sky`;
- Codex plugin skill injection.

Delete stale config/reference when caller = 0:

- `.codex-remote-attachments/` ignore rule nếu không còn subsystem nào dùng;
- `CODEX_HOME` runtime ownership trong GPTWorker;
- `codex-mcp-server` bin alias nếu không cần compatibility install cũ;
- matching alias trong `package-lock.json`;
- `coding-agent` package keyword nếu chỉ còn legacy metadata.

## A4. Optional legacy helper không thuộc core

Candidate delete:

- `scripts/init-claude-md.mjs` nếu không còn package script/user workflow thực sự dùng nó.

GPTWorker có thể đọc project-local `CLAUDE.md` như một text context file nếu project vốn có file đó; GPTWorker không cần một helper riêng mô phỏng Claude Code `/init`.

---

# 4. GROUP B — EXTRACT / REMAP → DELETE OLD

## B1. Generic execution prompt ra khỏi Codex identity

Old:

- `src/lib/codex-agent-prompt.ts`
- `CODEX_AGENT_PROMPT`

New:

- `src/lib/worker-execution-prompt.ts`
- `WORKER_EXECUTION_PROMPT`

Caller remap:

- `src/lib/instruction-context.ts`

Chỉ giữ generic guidance:

- Job gate;
- gather → act → verify;
- absolute path;
- shell/process workflow;
- validation;
- project context;
- local tool reference.

Sau remap, delete old `codex-agent-prompt.ts`.

## B2. Checkpoint safety tách khỏi standalone rewind family

Target architecture không có một runtime family riêng tên `rewind`.

Giữ:

- automatic checkpoint trước file mutation;
- `checkpoint.ts` nếu nó phục vụ safety cho filesystem edits.

Retire/remap:

- standalone `src/tools/rewind.ts`;
- `rewind` runtime family;
- `rewind` preload behavior.

Compatibility:

- Job Pack hiện có thể vẫn khai báo `rewind`;
- runtime có thể accept legacy preload token nhưng không coi nó là execution family;
- không sửa `jobs/**` trong cleanup này.

Nếu cần manual restore về sau, thiết kế nó như filesystem recovery capability, không dựng lại một agent-specific family.

## B3. Admin reference ra khỏi core files

Không cần rewrite toàn file.

Remap:

### `src/index.ts`

Bỏ:

- `ADMIN_PORT`;
- Admin startup;
- Admin shutdown;
- Admin log/banner fields.

### `src/lib/instruction-context.ts`

Bỏ:

- `adminPort` khỏi options.

### `src/lib/git-snapshot.ts`

Bỏ:

- Admin UI URL khỏi environment text.

Sau remap, Admin subsystem Group A có thể delete.

## B4. Upstream references ra khỏi connection core

### `src/index.ts`

Bỏ:

- `initUpstreamManager()`;
- upstream shutdown.

### `src/lib/mcp-session-manager.ts`

Giữ nguyên các phần stability:

- protocol negotiation;
- Streamable HTTP;
- GET/SSE;
- POST serialization;
- DELETE grace;
- stale-session recovery;
- TTL cleanup;
- transport error handling.

Chỉ bóc:

- `getUpstreamManager()`;
- register/unregister upstream server;
- upstream comments/paths;
- Codex SessionStart hook warmup.

Đổi recovery client identity:

```text
codex-mcp-session-recovery
→ gptworker-mcp-session-recovery
```

### `src/server-factory.ts`

Bỏ:

- `McpUpstreamManager` type/import;
- upstreamManager parameter;
- upstream proxy special-case.

### `src/lib/tool-work-policy.ts`

Hiện có legacy bypass:

```ts
!toolName.includes("__")
```

để upstream prefixed tools không đi theo normal work-handle policy.

Sau khi upstream proxy bị retire:

- bỏ special-case `__`;
- mọi local execution tool đi qua normal work policy.

## B5. Tool profile cleanup

`src/lib/tool-profile.ts` không cần rewrite toàn bộ.

Bỏ khỏi catalog/profile:

- `mcp_servers`;
- `mcp_tools`;
- `mcp_call`;
- `ponytail_turn`;
- standalone `rewind` nếu Group B2 retire nó.

Giữ:

- GPTWorker control/admission/job tools;
- workspace discovery;
- `work_tool`;
- local filesystem/shell/git/context/node_repl operations.

Nếu Admin bị delete và `saveLocalToolOverrides()` không còn caller:

- delete writer nếu không cần config UI;
- có thể giữ read-only manual overrides nếu có giá trị thực.

## B6. Job Pack compatibility shim

**Không sửa `jobs/**`.**

Current Job metadata có legacy preload như:

- `mcp`;
- `rewind`;
- có thể có custom Job cũ dùng `ponytail`.

Runtime phải tách:

```text
Job-declared preload
≠
Runtime-supported family
```

Target:

```text
RUNTIME FAMILIES
- filesystem
- shell
- git
- context
- repl

LEGACY ACCEPTED / IGNORED PRELOAD TOKENS
- mcp
- ponytail
- rewind
```

Legacy token:

- parse được;
- không throw;
- không load module;
- không xuất hiện như loaded runtime family;
- không block Job confirmation/activation.

`src/jobs/job-runtime.ts` có thể tạm giữ enum legacy để backward compatibility.

## B7. Root config/docs/reference cleanup

Sau implementation, remap wording/config:

- `.env.example`: bỏ Admin/upstream config;
- `.gitignore`: bỏ legacy upstream/Codex runtime rules không còn dùng;
- `README.md`: bỏ Admin/upstream runtime description;
- `WORKER.md`: không còn mô tả Codex/Admin/upstream là optional core capability;
- `AGENTS.md`: hard boundary phải phản ánh target architecture mới;
- `package.json` / `package-lock.json`: sync alias/scripts/keywords đã retire;
- `src/lib/quickstart.ts`: bỏ `mcp_servers / mcp_tools / mcp_call` guidance;
- generic wording trong `filesystem.ts`, `patch.ts`, v.v. có thể bỏ tên Codex/Claude khi không cần.

### Secure Tunnel compatibility name

`openai-tunnel.ps1` hiện dùng:

```powershell
$ProfileName = "codex-local"
```

Đây chỉ là **legacy profile filename**, không phải Codex runtime dependency.

File này nằm trên core connection path và đã ghi rõ giữ tên để tương thích local install.

**KEEP FOR STABILITY. Không rename trong cleanup này.**

---

# 5. GROUP C — REWRITE CLEAN

Các phần dưới đây vẫn cần behavior, nhưng implementation cũ quá dính legacy architecture.

## C1. Rewrite `src/tools/work-gateway.ts`

Không bóc dần implementation hiện tại.

Viết lại theo spec nhỏ:

```text
WorkGateway
├─ filesystem
├─ shell
├─ git
├─ context
└─ repl
```

Responsibilities duy nhất:

- map operation → family;
- lazy-load family;
- cache loaded family;
- preload runtime-supported family;
- ignore legacy preload tokens;
- dispatch `work_tool`;
- telemetry đơn giản.

Không có:

- `McpUpstreamManager`;
- `mcp` runtime family;
- `ponytail` family;
- standalone `rewind` family;
- external proxy;
- external tool discovery.

Suggested conceptual split:

```text
RUNTIME_FAMILY_TOOLS
LEGACY_PRELOAD_FAMILIES
resolve(tool)
prepareJob(jobId, declaredFamilies)
waitForPreparedJob(jobId)
clearPreparedJob()
status()
```

## C2. Rewrite `src/tools/node-repl.ts`

Viết lại local-only thay vì gỡ từng đoạn Sky/Codex.

Target behavior:

```text
node_repl
├─ workspace-scoped JavaScript VM
├─ persistent state per MCP server/session scope
├─ process.cwd() = confirmed workspace
├─ process.chdir() disabled
├─ direct fs/fs-promises blocked
├─ timeout
├─ captured output
└─ NO external/Codex Computer Use
```

Không có:

- `@oai/sky`;
- `WindowsHelperTransport`;
- `WindowsComputerUseClient`;
- `globalThis.sky`;
- Codex runtime path;
- Computer Use plugin config;
- Admin dependency.

Có thể đổi internal output name:

```text
__localCoderOutput
→ __gptWorkerOutput
```

## C3. Rewrite local `context` stack

Context phải là **workspace/local GPTWorker context**, không phải agent ecosystem bridge.

Các file nên được rewrite/simplify như một unit:

- `src/tools/context.ts`;
- `src/lib/project-memory.ts`;
- `src/lib/auto-memory.ts`;
- `src/lib/skills-loader.ts`;
- phần rich context của `src/lib/instruction-context.ts`.

### Context target

```text
confirmed workspace
├─ project_context
├─ project-local instructions/rules
├─ project-local skills nếu giữ
├─ GPTWorker-owned memory nếu giữ
└─ local diagnostic status
```

Không có:

- `getUpstreamManager()`;
- `upstream_mcp`;
- `.codex/config.toml`;
- global `~/.codex/CLAUDE.md`;
- Codex plugin skills;
- Computer Use skill injection.

### `agent_status`

Target:

```text
agent_status
├─ permission profile
├─ confirmed/default workspace
├─ machine roots
├─ audit/runtime path
├─ process/node info
├─ tool profile
└─ local checkpoint info nếu còn cần
```

Không có upstream MCP status.

### Project memory

Project-local files có thể được đọc nếu project thực sự có chúng, ví dụ:

- `AGENTS.md`;
- `CLAUDE.md`;
- project-local rules.

Nhưng không tự đi đọc global Codex/Claude home như authority.

### Auto memory

Current storage:

```text
CODEX_HOME || ~/.codex
└─ projects/<hash>/MEMORY.md
```

Rewrite thành GPTWorker-owned data:

```text
getWorkerDataRoot()
└─ memory/
   └─ projects/
      └─ <workspace-hash>/
         └─ MEMORY.md
```

Windows default:

```text
%LOCALAPPDATA%\GPTWorker\memory\projects\...
```

Không dùng `CODEX_HOME`.

## C4. Rewrite `src/lib/instruction-context.ts` thành control-plane tối thiểu

Startup/initialize không nên kéo toàn bộ rich project context nếu chưa có active Job.

Target:

```text
initialize instructions
├─ GPTWorker identity
├─ admission/control rules
├─ Job lifecycle pointers
├─ current tool profile
└─ minimal environment info
```

Rich workspace context chỉ load khi Job/work thực sự cần qua `context` tools.

Mục tiêu:

- giảm startup I/O;
- giảm dependency;
- không load Codex/global memory;
- không load Admin info;
- không làm MCP initialize phụ thuộc project skill/memory ecosystem.

## C5. Rewrite verification harness theo architecture mới

Sau runtime rewrite, validator cũng phải phản ánh target thật.

### Rewrite/replace

- `scripts/run-all-tests.mjs`;
- `scripts/test-idle-runtime.mjs`;
- expectations trong `scripts/test-tool-profile.mjs`;
- `scripts/test-quickstart.mjs`;
- `scripts/test-project-memory.mjs` nếu module context được rewrite;
- verification evidence chain nếu nó không thuộc protected artifacts.

Target validation:

```text
Worker boot
→ :3000/health
→ MCP initialize
→ tools/list
→ stale recovery
→ Job nomination/confirmation
→ legacy preload ignored safely
→ work_tool filesystem
→ shell
→ git
→ context
→ node_repl local
→ stop/restart/reconnect
```

Không validate:

- Admin :3001;
- upstream MCP;
- OAuth;
- Ponytail;
- Codex hooks;
- external MCP proxy.

### Protected validation artifacts

Các file mới/protected do recent validation/upgrade **không tự sửa** trong cleanup nếu user chưa cho phép, bao gồm các artifact đã được đánh dấu trước đó như:

- `setup-test.bat`;
- `start-worker-background.ps1`;
- `wait-runtime-ready.ps1`;
- `wait-tray-ready.ps1`;
- `gptworker-tray.vbs`;
- `openai-tunnel.ps1`;
- `docs/plans/gptworker-v2/**`;
- các validation artifact mới khác nếu xác định được là thuộc cùng đợt.

Nếu protected artifact assert architecture cũ:

```text
status = PROTECTED-STALE
```

Nó không được dùng làm lý do phục hồi Codex/Admin/upstream vào runtime.

---

# 6. Core phải KEEP / SURGICAL DETACH — không rewrite

Một số file phức tạp vì chúng giải quyết vấn đề thật của connection stability.

## `src/lib/mcp-session-manager.ts`

**Không rewrite toàn bộ.**

Giữ:

- session IDs;
- protocol negotiation;
- Streamable HTTP;
- raw header handling;
- GET/SSE;
- POST/DELETE serialization;
- DELETE grace;
- stale-session recovery;
- TTL cleanup;
- transport error tracking.

Chỉ surgically detach:

- upstream manager;
- Codex hook warmup;
- Codex naming.

## `src/index.ts`

Không rewrite server transport từ đầu.

Giữ:

- Express/MCP endpoints;
- health;
- MCP token path behavior;
- initialize/recovery routing;
- stale session handling;
- startup/shutdown stability.

Chỉ tháo:

- Admin;
- upstream manager;
- related env/log fields.

## OpenAI Secure MCP Tunnel + Windows resident runtime

KEEP:

- `openai-tunnel.ps1`;
- `start.ps1`;
- `stop.ps1`;
- `reset-runtime.ps1`;
- tray/resident flow;
- health/wait scripts được bảo vệ.

Không cleanup connection path chỉ vì còn legacy naming không ảnh hưởng behavior.

---

# 7. Dependency map cuối

```text
TARGET

GPT Web
   ↓
OpenAI Secure MCP Tunnel
   ↓
index.ts
   ↓
mcp-session-manager.ts
   ↓
server-factory.ts
   ↓
admission + workspace + Job lifecycle
   ↓
NEW clean work-gateway.ts
   ├─ filesystem
   ├─ shell
   ├─ git
   ├─ NEW clean context
   └─ NEW clean node_repl
```

Delete branches:

```text
X Admin server/UI
X Codex hooks
X Ponytail
X Codex Computer Use
X plugin-config
X upstream MCP manager/config/OAuth/proxy
X mcp bridge
X external MCP import/discovery
```

Legacy Job metadata:

```text
mcp / ponytail / rewind
→ accepted as legacy preload token
→ ignored safely
→ never loaded as runtime family
```

---

# 8. Implementation order

## Phase 0 — baseline

Before source mutation:

- record current main SHA;
- backup branch already exists;
- build;
- current health;
- MCP initialize;
- tools/list;
- session recovery;
- Job nomination/confirmation;
- one filesystem call;
- shell;
- git;
- context;
- node_repl.

## Phase 1 — rewrite clean modules first

1. rewrite `work-gateway.ts`;
2. rewrite local-only `node-repl.ts`;
3. rewrite context stack;
4. rewrite minimal instruction context;
5. add legacy preload compatibility.

Goal: new core can operate without Codex/Admin/upstream before deleting old source.

## Phase 2 — remap connection/core callers

1. detach upstream/Codex hooks from session manager;
2. detach upstream from server factory;
3. detach Admin/upstream from index;
4. remove upstream bypass from tool-work-policy;
5. remap worker execution prompt;
6. clean tool profile/quickstart.

## Phase 3 — quarantine Group A

Remove leaf subsystems khỏi active tree và move vào `legacy/group-a/` only when import/caller count is zero.

## Phase 4 — config/package/docs cleanup

- `.env.example`;
- `.gitignore`;
- `package.json`;
- `package-lock.json`;
- README/WORKER/AGENTS;
- stale non-protected tests/helpers.

## Phase 5 — rewrite validation

Validation must test the target architecture, not retired features.

## Phase 6 — real stability validation

Required:

- Worker starts with no Codex installed;
- Worker starts with no Admin server;
- Worker starts with no upstream MCP config;
- Tunnel ready;
- MCP initialize;
- repeated tools/list;
- stale session recovery;
- DELETE grace;
- Job select/confirm/activate;
- legacy preload `mcp/rewind/ponytail` does not break activation;
- filesystem;
- shell;
- git;
- context;
- node_repl local;
- stop → idle;
- restart → reconnect.

---

# 9. Deletion/rewrite gates

## DELETE / QUARANTINE gate

Remove khỏi active tree và quarantine only when:

1. no required behavior inside;
2. runtime caller/import = 0;
3. no protected startup path depends on it;
4. build passes after atomic caller removal.

## EXTRACT/REMAP gate

Delete old file only when:

1. useful logic has new owner/name;
2. all callers point to new owner;
3. compatibility behavior is explicit;
4. old symbol/path has no runtime caller.

## REWRITE CLEAN gate

Switch to new implementation only when:

1. behavior spec is smaller and explicit;
2. test covers required behavior;
3. new implementation has no legacy dependency;
4. fallback/rollback remains possible;
5. connection/session core is not accidentally rewritten as collateral work.

---

# 10. Definition of success

Cleanup hoàn tất khi runtime thực tế gần đúng với:

```text
GPT Web
   ↓
OpenAI Secure MCP Tunnel
   ↓
GPTWorker
   ↓
MCP session / recovery
   ↓
admission + workspace
   ↓
work_tool
   ├─ filesystem
   ├─ shell
   ├─ git
   ├─ context
   └─ node_repl
```

và đồng thời:

- GPTWorker không cần Codex;
- không đọc `~/.codex` trên normal path;
- không dùng Codex Computer Use runtime;
- không chạy Ponytail;
- không start Admin server;
- không init upstream MCP hub;
- không proxy external MCP tools;
- session manager chỉ lo connection/session stability;
- context là local workspace/GPTWorker-owned context;
- auto-memory nếu giữ phải nằm trong GPTWorker data root;
- Job Pack cũ vẫn parse/activate dù còn legacy preload token;
- optional/retired subsystem không thể làm core connection fail;
- Secure MCP Tunnel và Windows resident runtime vẫn ổn định như trước.


---

# 11. Legacy quarantine / rollback staging

Cleanup không xóa vật lý file ngay trong giai đoạn thử nghiệm.

Mọi file hoặc implementation bị loại khỏi runtime sẽ được **move vào `legacy/` trước**, để có thể test architecture mới mà vẫn phục hồi tức thời nếu scan/remap còn thiếu dependency.

Cấu trúc:

```text
legacy/
├─ group-a/   # DELETE DIRECTLY
├─ group-b/   # EXTRACT / REMAP → quarantine old implementation
└─ group-c/   # REWRITE CLEAN → quarantine replaced implementation
```

## 11.1 Nguyên tắc chung

```text
detach/remap/rewrite
→ move old file vào legacy group tương ứng
→ build + test + real Worker validation
→ nếu fail vì dependency bị bỏ sót: restore file ngay
→ nếu pass ổn định: giữ quarantine cho tới cuối cleanup
→ chỉ physical-delete legacy sau một quyết định riêng
```

Không dùng "delete rồi tìm lại trong Git history" như workflow chính. Git history vẫn là safety net cuối, nhưng `legacy/` là rollback staging chủ động.

### GROUP A

File được đánh giá là không có behavior cần giữ:

```text
runtime path
→ detach caller/import/config
→ move file vào legacy/group-a/
→ test
```

Nếu test fail, điều đó chứng minh scan Group A sai hoặc còn dependency ẩn. Restore file từ `legacy/group-a/`, xác định caller còn thiếu rồi phân loại lại sang Group B hoặc Group C nếu cần.

### GROUP B

File có phần chức năng cần giữ:

```text
extract useful behavior
→ remap caller sang owner mới
→ old implementation phải có runtime caller = 0
→ move old file vào legacy/group-b/
→ test
```

Nếu test fail, không "bring back" bằng cách viết lại từ đầu. Lấy implementation cũ ngay từ `legacy/group-b/`, đối chiếu phần behavior/remap còn thiếu, bổ sung rồi test lại.

### GROUP C

Behavior được rewrite sạch:

```text
write new implementation
→ switch caller sang implementation mới
→ move old implementation vào legacy/group-c/
→ test behavior + integration
```

Nếu implementation mới thiếu behavior, old implementation trong `legacy/group-c/` là reference trực tiếp để so sánh và phục hồi tạm thời.

## 11.2 Legacy là cây riêng, không chứa `src/`

`legacy/` là **quarantine tree độc lập ở root repo**. File đã quarantine không còn nằm trong active `src/`.

Quy tắc mapping:

- file dưới `src/`: **strip prefix `src/`** khi move vào group;
- file ngoài `src/` như `scripts/`, `profiles/`, `public/`: giữ path top-level gốc bên dưới group;
- không tạo `legacy/group-*/src/**`.

Ví dụ:

```text
src/lib/codex-hooks.ts
→ legacy/group-a/lib/codex-hooks.ts

src/lib/codex-agent-prompt.ts
→ legacy/group-b/lib/codex-agent-prompt.ts

src/tools/work-gateway.ts
→ legacy/group-c/tools/work-gateway.ts

scripts/test-mcp-upstream.mjs
→ legacy/group-a/scripts/test-mcp-upstream.mjs

profiles/mcp-upstream.json
→ legacy/group-a/profiles/mcp-upstream.json

public/ui/app.js
→ legacy/group-a/public/ui/app.js
```

Ý nghĩa:

```text
active runtime source
src/...

quarantined old implementation
legacy/group-*/...
```

Một file không được tồn tại đồng thời như implementation active trong `src/` và như fallback được runtime sử dụng từ `legacy/`. Nếu Group C rewrite cùng logical module, `src/` chứa **implementation mới**, còn `legacy/group-c/` chứa **implementation cũ** để reference/rollback thủ công.

## 11.3 Legacy không được tham gia build/runtime

`legacy/**` là archive staging, không phải source fallback tự động.

Isolation này là **hard invariant**, không chỉ là quy ước:

- `tsconfig.json` chỉ compile `src/**/*` và explicit exclude `legacy`;
- runtime source trong `src/**` bị cấm import/require/dynamic-import từ `legacy/**`;
- build output không được sinh `dist/legacy` và không được reference ngược vào `legacy/**`;
- root startup scripts (`.ps1`, `.bat`, `.vbs`) bị cấm reference `legacy/**`;
- `package.json` main/bin/scripts bị cấm chạy hoặc point vào `legacy/**`;
- Job Pack bị cấm trỏ vào `legacy/**`;
- `npm test` chạy `scripts/test-legacy-isolation.mjs` ngay sau compile và fail nếu bất kỳ invariant nào bị phá;
- restore phải là thao tác chủ động: move file từ legacy về đúng active runtime path (thường là `src/...`) rồi remap lại caller. Không có automatic fallback từ legacy.

Như vậy file quarantine có thể tồn tại trong Git repo để rollback nhưng **không thể tham gia app khi chạy** nếu isolation test đang pass.

## 11.4 Test gate trước khi một quarantine được coi là thành công

Sau mỗi batch move vào legacy phải kiểm tra ít nhất:

- build;
- Worker startup;
- `:3000/health`;
- Secure MCP Tunnel readiness;
- MCP initialize;
- tools/list;
- session stale recovery;
- Job nomination/confirmation/activation;
- legacy preload token không làm activation fail;
- `work_tool` filesystem;
- shell;
- git;
- context;
- node_repl local nếu còn giữ;
- stop/restart/reconnect.

Nếu bất kỳ test nào fail, không tiếp tục batch kế tiếp cho tới khi xác định failure là regression hay test stale.

## 11.5 Physical deletion là phase riêng

Kết thúc cleanup không đồng nghĩa phải xóa ngay `legacy/**`.

Physical deletion chỉ được làm khi:

1. architecture mới đã chạy ổn định qua nhiều test/restart;
2. không còn cần old implementation để đối chiếu;
3. user chủ động quyết định purge legacy;
4. backup branch/Git history vẫn còn.

Cho tới lúc đó, `legacy/**` là rollback staging chính thức của cleanup.

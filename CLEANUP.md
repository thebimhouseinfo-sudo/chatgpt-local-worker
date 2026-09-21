# GPTWorker Cleanup Review

## 1. Target architecture

GPTWorker được chốt là một **stability-first bridge từ GPT Web tới local tools**.

Target architecture chính thức của cleanup:

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

Mọi thành phần được đánh giá bằng câu hỏi:

> Thành phần này có phục vụ trực tiếp target architecture trên không?

Nếu **có**: giữ và ưu tiên stability.

Nếu **không**: bóc dependency khỏi core, remap phần còn cần sang đúng module, sau đó mới xoá file/subsystem cũ.

Cleanup không nhằm làm repo nhỏ bằng mọi giá. **Stability quan trọng hơn số file xoá.**

---

## 2. Boundary

### Được cleanup trong đợt này

- GPT Web ↔ local connection;
- OpenAI Secure MCP Tunnel integration;
- MCP session/recovery;
- admission/workspace wiring;
- `work_tool` và local tool runtime;
- inherited Admin/UI surface;
- inherited upstream MCP hub;
- inherited Codex runtime/plugin integration nằm trong Worker core;
- legacy naming/module boundary khi việc rename giúp tách core rõ ràng.

### Không sửa nội dung trong đợt này

- `jobs/**`;
- Job Pack definitions;
- Job Pack skills/harness/templates;
- các file mới do validation/upgrade gần đây tạo ra;
- các capability như checkpoint/rewind nếu chúng vẫn đang được filesystem/tool path dùng trực tiếp.

Nếu một file validation mới đang assert hành vi legacy, **không tự sửa file đó**. Ghi nhận nó là blocker/compatibility constraint và xử lý ở lượt riêng khi được phép.

---

## 3. Core cần giữ — không phải cleanup candidate

Các phần dưới đây phục vụ trực tiếp target architecture nên không nằm trong danh sách xoá:

- `openai-tunnel.ps1`;
- tray/start/stop/health/restart flow;
- MCP Streamable HTTP endpoint;
- `mcp-session-manager.ts` phần session ID, protocol negotiation, GET/SSE, POST serialization, DELETE grace, stale recovery, TTL, transport error handling;
- admission;
- workspace discovery/binding;
- work registration/work handle;
- `work_tool` gateway;
- filesystem;
- shell;
- git;
- context tool family;
- activity/runtime logging cần cho diagnosis;
- absolute-path enforcement;
- `node_repl` nếu giữ ở dạng **local JavaScript REPL thuần GPTWorker**.

---

## 4. Đánh giá subsystem không còn thuộc target

### 4.1 Codex integration — retire khỏi Worker core

User không kết nối GPTWorker với Codex và không cần Codex runtime/plugin.

| Item | Hiện đang làm gì | Dính vào đâu | Quyết định | Cách bóc trước khi xoá |
|---|---|---|---|---|
| `src/lib/codex-hooks.ts` | Đọc `~/.codex`, plugin cache, chạy Codex hooks | `mcp-session-manager.ts`, Admin, Ponytail | **Retire** | Gỡ hook warmup khỏi session; gỡ Admin/Ponytail caller |
| `src/tools/ponytail.ts` | Điều khiển Ponytail plugin từ Codex hook | WorkGateway/tool profile, Codex hooks | **Retire** | Bỏ runtime family/tool; giữ legacy preload token nếu cần compatibility |
| Codex Computer Use trong `src/tools/node-repl.ts` | Tìm `@oai/sky`, `codex-computer-use.exe`, expose `globalThis.sky` | `node_repl`, plugin-config | **Retire phần Codex, giữ REPL local** | Xoá `loadSky`, `sky*` state/status, Codex paths/imports |
| `src/lib/plugin-config.ts` | Bật/tắt Computer Use và tìm skill trong `~/.codex/plugins` | `node-repl.ts`, `skills-loader.ts`, Admin | **Retire** | Gỡ Computer Use khỏi REPL và skill loader |
| Computer Use plugin injection trong `src/lib/skills-loader.ts` | Tự thêm Codex Computer Use skill vào project skills | `context` / skill list | **Retire phần plugin**, giữ project skill loader | Chỉ load project-local skills |
| Codex hook Admin routes | Bật/tắt hooks/plugin từ Admin | `admin/routes.ts` | **Retire** | Không replacement |
| Codex-specific filesystem paths | `~/.codex`, `AppData/.../OpenAI/Codex` | hooks, plugin config, REPL | **Retire** | Không còn caller sau cleanup |

### 4.2 `codex-agent-prompt.ts` — giữ nội dung hữu ích, bỏ identity Codex

File này hiện đã chứa workflow generic của GPTWorker, không còn thực sự cần Codex.

**Không nên xoá nội dung có ích. Nên remap/rename.**

| Old | New đề xuất | Caller cần remap |
|---|---|---|
| `src/lib/codex-agent-prompt.ts` | `src/lib/worker-execution-prompt.ts` | `instruction-context.ts` |
| `CODEX_AGENT_PROMPT` | `WORKER_EXECUTION_PROMPT` | `instruction-context.ts` |

Sau remap, file `codex-agent-prompt.ts` cũ có thể xoá.

Mục tiêu là giữ **general worker execution guidance**, không giữ Codex integration.

---

## 5. Admin subsystem — retire sau khi bóc dependency

Admin UI không nằm trên normal path:

```text
GPT Web → Tunnel → Worker :3000 → MCP → tools
```

Worker hiện vẫn khởi động Admin server riêng ở port 3001, tạo failure surface không cần thiết.

### 5.1 Chức năng trong Admin và nơi thật sự sở hữu logic

| Chức năng Admin | Logic thật đang ở đâu | Có cần move logic không? | Quyết định |
|---|---|---:|---|
| Upstream MCP management | upstream MCP subsystem | Không | Retire cùng upstream |
| Import MCP Cursor/Claude/OpenCode | upstream config | Không | Retire |
| OAuth callback | upstream OAuth | Không | Retire |
| Codex hooks management | `codex-hooks.ts` | Không | Retire cùng Codex |
| Computer Use toggle | `plugin-config.ts` | Không còn cần | Retire |
| Checkpoint status | `checkpoint.ts` | Không | Giữ checkpoint core behavior, bỏ UI |
| Activity/history | `activity-log.ts` / `runtime-log.ts` | Không | Giữ logging, bỏ UI |
| Local tool visibility | `tool-profile.ts` đã có logic | Không | Bỏ Admin routes duplicate |
| `.env` editor | Chỉ convenience UI | Không | Retire |
| Workspace/path status | Core modules khác | Không | Health/runtime vẫn cung cấp diagnosis |

Sau khi Codex/upstream coupling bị tháo, Admin gần như không còn logic độc lập cần cứu.

### 5.2 Dependency cần remap trước khi xoá Admin

Hiện Admin port còn rò vào instruction context:

```text
index.ts
  └─ ADMIN_PORT
      └─ instruction-context.ts
          └─ git-snapshot.ts
              └─ "Admin UI: http://127.0.0.1:..."
```

Remap:

| Old | New |
|---|---|
| `InstructionContextOptions.adminPort` | **xoá field** |
| `formatEnvironmentForInstructions({ adminPort })` | Không truyền Admin info |
| dòng Admin UI trong environment instructions | **xoá** |
| `ADMIN_PORT`, `ADMIN_TOKEN` | bỏ khỏi normal runtime config |
| `startAdminServer()` | bỏ khỏi `index.ts` |
| `adminServer.close()` | bỏ khỏi shutdown |

Sau đó các file có thể xoá:

- `src/admin/server.ts`;
- `src/admin/routes.ts`;
- `src/admin/localhost-guard.ts`;
- `public/ui/index.html`;
- `public/ui/app.js`;
- `public/ui/styles.css`.

---

## 6. Upstream MCP hub — retire hoàn toàn

Phải phân biệt tuyệt đối:

```text
OpenAI Secure MCP Tunnel
= GPT Web ↔ GPTWorker
= CORE

Upstream MCP hub
= GPTWorker ↔ MCP server khác
= KHÔNG thuộc target
```

User không dùng GPTWorker như một MCP hub.

### 6.1 Upstream chain hiện tại

```text
mcp-upstream-config.ts
        ↓
mcp-oauth-provider.ts
        ↓
mcp-upstream-manager.ts
        ↓
mcp-tool-proxy.ts
        ↓
mcp-bridge.ts
        ↓
mcp_servers / mcp_tools / mcp_call
```

Không có chức năng nào trong chain này cần chuyển sang core mới.

### 6.2 Bóc coupling khỏi core

| Core file hiện đang dính upstream | Coupling hiện tại | Remap |
|---|---|---|
| `src/index.ts` | `initUpstreamManager()` lúc boot | Bỏ init hoàn toàn |
| `src/index.ts` shutdown | `upstreamManager.shutdown()` | Bỏ |
| `src/lib/mcp-session-manager.ts` | `getUpstreamManager()`, register/unregister server | Bỏ toàn bộ upstream awareness |
| `src/server-factory.ts` | nhận `McpUpstreamManager` parameter | Bỏ parameter |
| `src/tools/work-gateway.ts` | nhận upstream manager và lazy-load family `mcp` | Bỏ manager + runtime family `mcp` |
| `src/lib/tool-profile.ts` | catalog chứa `mcp_servers/mcp_tools/mcp_call` | Bỏ các tool này |
| tool registration | special-case upstream proxy name `__` | Bỏ special-case |

Sau remap, các file upstream trở thành leaf và có thể xoá:

- `src/lib/mcp-upstream-manager.ts`;
- `src/lib/mcp-upstream-config.ts`;
- `src/lib/mcp-oauth-provider.ts`;
- `src/lib/mcp-tool-proxy.ts`;
- `src/tools/mcp-bridge.ts`;
- `profiles/mcp-upstream.json`.

---

## 7. Job Pack compatibility map

**Không sửa `jobs/**` trong cleanup này.**

Hiện metadata:

| Job | Preload liên quan legacy |
|---|---|
| `dev-coding` | `rewind`, `repl`, `mcp` |
| `dev-planing` | `mcp` |
| `layla` | `mcp` |
| `mto` | không có `mcp` |

`dev-coding/JOB.md` cũng còn mô tả enabled upstream MCP servers. Tạm coi đây là documentation legacy trong Job Pack và **không sửa**.

### 7.1 Tách Job-declared family khỏi runtime-supported family

Không được xoá `mcp` khỏi Job schema ngay vì Job Pack hiện vẫn khai báo nó.

Đề xuất trong runtime:

```text
Job-declared preload:
[filesystem, shell, git, context, mcp]

Runtime-supported:
[filesystem, shell, git, context]

Legacy ignored:
[mcp]
```

Trong `work-gateway.ts`:

- giữ runtime families thực;
- thêm khái niệm legacy preload family;
- `mcp` được accept nhưng không load module;
- preload vẫn resolve thành công;
- Job confirmation/activation không bị block.

Đề xuất:

```text
RUNTIME_TOOL_FAMILIES
= filesystem, shell, git, context, rewind, repl

LEGACY_PRELOAD_FAMILIES
= mcp, ponytail
```

`ponytail` hiện không thấy Job Pack mặc định nào preload, nhưng giữ nó như compatibility token một thời gian sẽ giúp parser/job metadata cũ không gây lỗi nếu tồn tại ở custom Job.

### 7.2 Job runtime

`src/jobs/job-runtime.ts` có thể tạm giữ enum `mcp` / `ponytail` để backward compatible.

Không cần sửa Job Pack.

---

## 8. `node_repl` — giữ dưới dạng local thuần

Target:

```text
node_repl
├─ workspace-scoped JS VM
├─ persistent state
├─ safe process.cwd view
├─ no process.chdir
├─ no direct fs/fs-promises
└─ NO Codex Computer Use
```

### 8.1 Giữ

- `createWorkspaceRequire()`;
- `createWorkspaceProcessView()`;
- active workspace binding;
- VM state;
- timeout;
- output capture;
- `node_repl` registration.

### 8.2 Xoá khỏi file

- import `os`;
- import `pathToFileURL`;
- `isComputerUseEnabled`;
- `SkyTransport`;
- `WindowsHelperTransportConstructor`;
- `WindowsComputerUseClientConstructor`;
- `loadSky()`;
- `skyAvailable`;
- `skyError`;
- `globalThis.sky`;
- Codex Computer Use status fields;
- mọi path tới `AppData/Local/OpenAI/Codex`;
- `@oai/sky`;
- `codex-computer-use.exe`;
- wording "Codex Windows Computer Use".

Có thể đồng thời đổi internal name:

```text
__localCoderOutput
→ __gptWorkerOutput
```

nếu không có compatibility reason phải giữ tên cũ.

Không cần tạo module Computer Use mới vì feature này không thuộc target.

---

## 9. Skills/context remap

`skills-loader.ts` vẫn có thể phục vụ `context` tool family cho project-local skills.

Sau cleanup:

```text
BEFORE
skills-loader
├─ project .claude/skills
└─ Codex Computer Use plugin skill

AFTER
skills-loader
└─ project-local skills only
```

Bỏ:

- `resolveComputerUseSkillPath` import;
- plugin source branch;
- Computer Use-specific references;
- Computer Use-specific instruction text.

Không cần đổi Job Pack.

---

## 10. Instruction prompt remap

Current:

```text
instruction-context.ts
  └─ CODEX_AGENT_PROMPT
      └─ codex-agent-prompt.ts
```

Target:

```text
instruction-context.ts
  └─ WORKER_EXECUTION_PROMPT
      └─ worker-execution-prompt.ts
```

Nội dung prompt chỉ giữ:

- Job gate;
- gather → act → verify;
- absolute path;
- shell/process workflow;
- validation;
- project context;
- local core tool reference.

Không đưa Codex/plugin/upstream MCP identity vào prompt.

---

## 11. WorkGateway remap

### Current

```text
FAMILY_TOOLS
├─ filesystem
├─ shell
├─ git
├─ context
├─ rewind
├─ repl
├─ ponytail
└─ mcp
```

### Target runtime

```text
FAMILY_TOOLS
├─ filesystem
├─ shell
├─ git
├─ context
├─ rewind
└─ repl
```

Legacy metadata:

```text
LEGACY_PRELOAD_FAMILIES
├─ mcp
└─ ponytail
```

Behavior:

- resolve actual work operation → chỉ runtime family;
- preload Job → runtime families được load;
- legacy family → ghi nhận/ignore, không throw;
- telemetry không báo legacy family là loaded;
- `work_tool` enum không expose `mcp_*` hay `ponytail_turn`.

---

## 12. Tool profile remap

### Xoá khỏi catalog/runtime visibility

- `mcp_servers`;
- `mcp_tools`;
- `mcp_call`;
- `ponytail_turn`.

### Giữ

- control/admission/job tools;
- workspace discovery;
- `work_tool`;
- filesystem operations;
- shell operations;
- git operations;
- context operations;
- `rewind` nếu còn runtime-supported;
- `node_repl`.

Nếu Admin bị xoá, `saveLocalToolOverrides()` cần đánh giá lại caller. Nếu không còn caller thì có thể xoá writer nhưng giữ read support nếu muốn cho phép config file thủ công.

---

## 13. File/function old → new/removal map

| Old file/function | Hành động | New home / replacement | Caller cần remap |
|---|---|---|---|
| `codex-agent-prompt.ts` | Rename/move | `worker-execution-prompt.ts` | `instruction-context.ts` |
| `CODEX_AGENT_PROMPT` | Rename | `WORKER_EXECUTION_PROMPT` | `instruction-context.ts` |
| `codex-hooks.ts` | Delete | Không replacement | session manager, Admin, Ponytail |
| `ponytail.ts` | Delete | Legacy preload token only | WorkGateway/tool profile |
| `plugin-config.ts` | Delete | Không replacement | node-repl, skills-loader, Admin |
| `node-repl.ts::loadSky` | Delete | Không replacement | node-repl internal |
| Codex Computer Use state/types | Delete | Không replacement | node-repl internal |
| Computer Use skill injection | Delete | project-local skill loading remains | skills-loader |
| Admin server/routes/guard | Delete | Worker health/logging remains | index |
| Admin port in instruction context | Delete | Không replacement | index/instruction-context/git-snapshot |
| `initUpstreamManager` | Delete | Không replacement | index |
| upstream registration in session | Delete | Không replacement | session manager |
| upstream manager parameter | Delete | Không replacement | server-factory/work-gateway |
| runtime family `mcp` | Delete implementation | legacy preload token | work-gateway |
| runtime family `ponytail` | Delete implementation | legacy preload token | work-gateway |
| `mcp_servers/mcp_tools/mcp_call` | Delete | Không replacement | tool profile/work gateway |
| upstream config/OAuth/proxy/manager | Delete | Không replacement | callers phải bằng 0 trước |
| `profiles/mcp-upstream.json` | Delete | Không replacement | upstream subsystem retired |

---

## 14. Files dự kiến có thể xoá sau remap

### Codex

- `src/lib/codex-hooks.ts`;
- `src/tools/ponytail.ts`;
- `src/lib/plugin-config.ts`;
- old `src/lib/codex-agent-prompt.ts` sau khi rename/move.

### Admin

- `src/admin/server.ts`;
- `src/admin/routes.ts`;
- `src/admin/localhost-guard.ts`;
- `public/ui/index.html`;
- `public/ui/app.js`;
- `public/ui/styles.css`.

### Upstream MCP

- `src/lib/mcp-upstream-manager.ts`;
- `src/lib/mcp-upstream-config.ts`;
- `src/lib/mcp-oauth-provider.ts`;
- `src/lib/mcp-tool-proxy.ts`;
- `src/tools/mcp-bridge.ts`;
- `profiles/mcp-upstream.json`.

### Tests của feature đã retire

Có thể retire sau khi implementation ổn:

- `scripts/test-mcp-upstream.mjs`;
- `scripts/test-mcp-oauth.mjs`;
- `scripts/test-mcp-bridge-integration.mjs`;
- mock fixtures chỉ phục vụ upstream MCP.

**Lưu ý:** file validation mới/protected không tự sửa. Nếu một test mới assert Codex/upstream behavior, đánh dấu để user quyết riêng.

---

## 15. Candidate đơn giản hoá nhưng chưa xoá

| Item | Đánh giá | Hướng |
|---|---|---|
| `instruction-context.ts` slim mode | Có thể vẫn load nhiều rich context trước khi cần | Sau retire Codex/Admin, tiếp tục đo và giảm startup I/O |
| `tool-profile.ts` | Có override layer và profile full/slim | Giữ trước; chỉ giảm catalog legacy |
| activity + audit logging | Có overlap | Giữ trong cleanup vì cần diagnosis |
| post-edit hooks | Không thuộc target tối thiểu nhưng nằm trong edit path | Giữ disabled, review riêng |
| checkpoint/rewind | Không phải connection core nhưng đang tham gia edit behavior và dev-coding | Giữ |
| project memory / project skills | Không phải transport core nhưng thuộc context family | Giữ, có thể lazy hơn sau |

---

## 16. Trình tự implementation an toàn

### Phase 0 — baseline

- backup branch đã có;
- ghi nhận current main SHA;
- build/test hiện tại;
- health;
- MCP initialize;
- tools/list;
- session recovery;
- một `work_tool` filesystem call;
- shell;
- git;
- node_repl.

### Phase 1 — rename/extract phần cần giữ

1. `codex-agent-prompt.ts` → `worker-execution-prompt.ts`.
2. Remap `instruction-context.ts`.
3. Làm `node_repl` thuần local.
4. Làm `skills-loader` project-local only.

Chưa xoá Admin/upstream ở bước này nếu caller chưa sạch.

### Phase 2 — detach Codex

1. gỡ Codex hooks khỏi session startup;
2. bỏ Ponytail runtime/tool profile;
3. bỏ plugin-config callers;
4. xác nhận no `~/.codex` / Codex runtime path còn trên normal startup/tool path.

### Phase 3 — detach Admin

1. bỏ Admin port khỏi instruction/environment context;
2. bỏ Admin startup/shutdown khỏi `index.ts`;
3. test Worker chỉ còn port 3000;
4. sau đó xoá Admin/UI files.

### Phase 4 — detach upstream MCP

1. bỏ upstream manager boot;
2. bỏ upstream manager khỏi session manager;
3. bỏ upstream parameter khỏi server factory/work gateway;
4. đổi `mcp` thành legacy preload token;
5. bỏ `mcp_*` tools khỏi catalog;
6. test Job selection/confirmation vẫn hoạt động;
7. sau đó xoá upstream files/config.

### Phase 5 — physical deletion + config cleanup

- xoá leaf files;
- dọn unused imports;
- dọn `.env.example`;
- dọn package scripts dành riêng cho retired subsystem;
- dọn obsolete docs ngoài Job Pack;
- không sửa `jobs/**`.

### Phase 6 — stability validation

Phải qua tối thiểu:

- Worker startup;
- health;
- Tunnel readiness;
- MCP initialize;
- modern discover fallback;
- tools/list;
- repeated tools/list;
- stale session recovery;
- session DELETE grace;
- Job select → confirmation → activation;
- Job Pack có preload `mcp` vẫn activate được;
- `work_tool` filesystem;
- shell;
- git;
- context;
- node_repl local;
- stop → idle;
- restart → reconnect.

---

## 17. Deletion gate

Một file chỉ được xoá khi:

1. không còn import/caller runtime;
2. không nằm trên target architecture;
3. không chứa phần chức năng còn cần chưa được remap;
4. Job Pack compatibility không bị phá;
5. startup/health/session/tool tests vẫn qua;
6. validation file protected không bị sửa ngoài phạm vi;
7. rollback từ backup branch vẫn rõ ràng.

Ưu tiên:

```text
extract/remap
→ detach
→ validate
→ delete
```

Không làm:

```text
delete trước
→ sửa lỗi dependency sau
```

---

## 18. Definition of success

Cleanup thành công khi architecture thực tế gần đúng với:

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

và:

- Worker không cần Codex để khởi động hay chạy tool;
- Worker không đọc `~/.codex` trên normal path;
- Worker không phụ thuộc Codex Computer Use runtime;
- Worker không khởi động Admin server;
- Worker không init upstream MCP hub;
- session manager chỉ lo connection/session stability;
- Job Pack cũ vẫn parse/activate dù còn legacy preload `mcp`;
- optional/legacy subsystem không thể làm connection core chết;
- source boundary phản ánh đúng sản phẩm: **GPTWorker là stable local tool bridge cho GPT Web**.

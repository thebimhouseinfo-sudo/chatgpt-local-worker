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

> **STATUS: QUARANTINED FROM ACTIVE TREE**
>
> 21 Group A files have been moved to `legacy/group-a/**`.
> Active paths are gone; static dependency audit found no remaining Group A references in the checked core runtime files.
> `scripts/test-group-a-retired.mjs` and `scripts/test-legacy-isolation.mjs` are part of the default test chain.
> GitHub Actions validation is currently infrastructure-blocked: the latest run and rerun both ended with `steps=null` and job logs unavailable via Azure `BlobNotFound`, so this is not recorded as a runtime PASS yet.


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

# 4. GROUP B — EXTRACT / REMAP → QUARANTINE OLD

## STATUS: ✅ DONE / QUARANTINED / STATIC VERIFIED

Group B đã hoàn tất theo target hiện tại:

- standalone `rewind` tool/family đã bị loại khỏi active runtime;
- `src/tools/rewind.ts` đã move sang `legacy/group-b/tools/rewind.ts`;
- `src/lib/checkpoint.ts` vẫn active;
- filesystem vẫn gọi `checkpointBefore(...)` trước các mutation;
- Job parser vẫn accept legacy preload tokens `rewind`, `mcp`, `ponytail`;
- WorkGateway hiện ignore các token không còn là runtime family thay vì load module;
- `scripts/test-group-b-retired.mjs` đã được thêm vào default test chain.

Static audit xác nhận active rewind path đã biến mất và checkpoint safety engine vẫn còn.

GitHub Actions của Group B hiện vẫn infrastructure-blocked giống Group A: latest `test` và `windows-worker-smoke` jobs kết thúc với `steps=null`, nên chưa ghi nhận runtime CI PASS.

Group B có một target kiến trúc: **retire standalone rewind tool nhưng giữ checkpoint safety engine**.

## B1. Keep checkpoint safety engine

Giữ:

- `src/lib/checkpoint.ts`;
- automatic checkpoint trước filesystem mutations;
- checkpoint retention/pruning;
- restore engine;
- `scripts/test-checkpoints.mjs`.

Filesystem tiếp tục gọi `checkpointBefore(...)` trước write/edit/apply_patch/delete/move/copy.

## B2. Remove standalone rewind surface

Bỏ khỏi active runtime:

- `rewind` family trong `work-gateway.ts`;
- `rewind` khỏi `LOCAL_TOOL_CATALOG`;
- `rewind` khỏi `SLIM_CHATGPT_TOOLS`;
- rewind classification riêng trong `tool-work-policy.ts`;
- rewind guidance trong `quickstart.ts`;
- rewind reference trong generic execution prompt cũ.

Sau khi caller = 0:

```text
src/tools/rewind.ts
→ legacy/group-b/tools/rewind.ts
```

Không quarantine `checkpoint.ts`.

## B3. Legacy Job compatibility

Không sửa `jobs/**`.

Job Pack cũ có thể vẫn khai báo:

```text
mcp
ponytail
rewind
```

Runtime phải accept nhưng ignore an toàn:

```text
legacy preload token
→ parse OK
→ no runtime family load
→ no activation failure
```

Phần compatibility này sẽ được làm explicit khi rewrite WorkGateway ở Group C1.

## B4. Validation

Sau Group B phải xác nhận:

- filesystem edit vẫn tạo checkpoint;
- checkpoint tests vẫn pass;
- Job `dev-coding` vẫn parse và activate dù preload còn `rewind`;
- `work_tool` không expose rewind;
- không còn runtime import `./rewind.js`;
- old rewind adapter nằm trong `legacy/group-b/`.

---

# 5. GROUP C — REWRITE CLEAN

## STATUS: ⏳ PENDING

Group C là rewrite kiến trúc chính sau khi Group A đã retire subsystem thừa.

## C1. Rewrite `src/tools/work-gateway.ts`

Target runtime families:

```text
filesystem
shell
git
context
repl
```

Legacy accepted preload tokens:

```text
mcp
ponytail
rewind
```

WorkGateway mới chỉ chịu trách nhiệm:

- operation → family mapping;
- lazy-load family;
- cache loaded family;
- preload supported families;
- ignore legacy preload tokens;
- dispatch `work_tool`;
- telemetry đơn giản.

Không có upstream MCP, Ponytail, external proxy, standalone rewind family.

Old implementation:

```text
src/tools/work-gateway.ts
→ legacy/group-c/tools/work-gateway.ts
```

Replacement mới vẫn ở `src/tools/work-gateway.ts`.

## C2. Evaluate current local-only `node_repl`

Group A đã loại Codex Computer Use khỏi `node_repl`.

Spec cần giữ:

- workspace-bound JavaScript VM;
- persistent state;
- `process.cwd()` = confirmed workspace;
- `process.chdir()` blocked;
- direct `fs` blocked;
- timeout/output capture;
- no Codex/runtime/plugin dependency.

Nếu implementation hiện tại đã sạch và nhỏ thì **mark DONE AS-IS**, không rewrite chỉ để rewrite.

Nếu còn legacy complexity thì rewrite clean và quarantine old implementation vào `legacy/group-c/tools/node-repl.ts`.

## C3. Rewrite local context stack

Review/rewrite như một unit:

- `src/tools/context.ts`;
- `src/lib/project-memory.ts`;
- `src/lib/auto-memory.ts`;
- `src/lib/skills-loader.ts`.

Target:

```text
confirmed workspace
├─ project_context
├─ project-local instructions/rules
├─ project-local skills
├─ GPTWorker-owned memory nếu giữ
└─ local runtime diagnostics
```

Group A đã xử lý trước:

- upstream status removed;
- `.codex/config.toml` removed;
- Codex plugin skill injection removed.

Còn phải xử lý:

- không auto-load global `~/.codex` / `~/.claude` làm authority;
- auto-memory chuyển sang `getWorkerDataRoot()`;
- diagnostics chỉ local;
- project-local `AGENTS.md`, `CLAUDE.md`, rules có thể tiếp tục được đọc như project context.

Target auto-memory:

```text
%LOCALAPPDATA%\GPTWorker\memory\projects\<workspace-hash>\MEMORY.md
```

## C4. Rewrite instruction/control-plane context

Không làm rename máy móc `codex-agent-prompt.ts → worker-execution-prompt.ts` ở Group B nữa.

Thay vào đó rewrite theo target:

```text
initialize instructions
├─ GPTWorker identity
├─ admission/control rules
├─ Job lifecycle
├─ current tool profile
└─ minimal environment info
```

Rich workspace context chỉ load khi actual work cần.

Nếu vẫn cần execution prompt riêng thì tạo mới `worker-execution-prompt.ts` từ clean spec.

Old prompt:

```text
src/lib/codex-agent-prompt.ts
→ legacy/group-c/lib/codex-agent-prompt.ts
```

## C5. Rewrite validation harness

Target validation:

```text
Worker boot
→ :3000/health
→ MCP initialize
→ tools/list
→ stale recovery
→ Job nomination/confirmation
→ legacy preload ignored
→ work_tool filesystem
→ shell
→ git
→ context
→ node_repl local
→ stop/restart/reconnect
```

Không validate retired features: Admin, upstream MCP, OAuth, Ponytail, Codex hooks, external proxy.

Protected validation artifacts nếu còn assert architecture cũ được đánh dấu `PROTECTED-STALE`, không dùng làm lý do bring back retired subsystem.

---

# 6. FINAL CLEANUP — sau Group B + Group C

Không làm sớm để tránh churn.

Review sau cùng:

- `codex-mcp-server` bin alias;
- matching `package-lock.json` entry;
- `coding-agent` keyword;
- orphan package scripts;
- `saveLocalToolOverrides()` nếu không còn caller;
- README / WORKER / AGENTS;
- generic Codex/Claude/Local Coder wording.

Compatibility alias chỉ bỏ khi chắc chắn không ảnh hưởng install/startup hiện có.

---

# 7. KEEP / SURGICAL DETACH ONLY

## `src/lib/mcp-session-manager.ts`

Không rewrite.

Giữ session IDs, protocol negotiation, Streamable HTTP, raw-header handling, GET/SSE, POST/DELETE serialization, DELETE grace, stale recovery, TTL, transport errors.

Group A đã tháo upstream manager, Codex hook warmup và Codex recovery client name.

## `src/index.ts`

Không rewrite.

Giữ HTTP/MCP endpoints, health, token path, initialize/recovery routing, startup/shutdown stability.

Group A đã tháo Admin và upstream manager.

## Secure Tunnel / Windows resident runtime

KEEP:

- `openai-tunnel.ps1`;
- `start.ps1`;
- `stop.ps1`;
- `reset-runtime.ps1`;
- tray/resident runtime;
- health/wait scripts.

`$ProfileName = "codex-local"` trong tunnel hiện được coi là compatibility filename, không phải Codex dependency. Không rename trong cleanup này.

---

# 8. Legacy quarantine rules

`legacy/` là cây riêng ở repo root.

Mapping:

```text
src/lib/example.ts
→ legacy/group-a/lib/example.ts

src/tools/example.ts
→ legacy/group-b/tools/example.ts

src/tools/work-gateway.ts
→ legacy/group-c/tools/work-gateway.ts
```

Quarantine file không compile, không import, không execute, không fallback tự động.

Restore phải là thao tác chủ động.

---

# 9. Implementation order from current state

## Phase A — ✅ DONE

Group A quarantined.

## Phase B — ✅ DONE

- checkpoint engine retained;
- standalone rewind runtime family removed;
- rewind tool/profile/guidance removed;
- legacy preload compatibility retained;
- old adapter quarantined at `legacy/group-b/tools/rewind.ts`;
- Group B static guard added.

## Phase C1 — rewrite WorkGateway

1. define clean runtime family registry;
2. explicit legacy preload set;
3. rewrite gateway;
4. switch callers;
5. quarantine old gateway;
6. validate dispatch/preload.

## Phase C2 — evaluate node_repl

Mark done as-is if already clean; otherwise rewrite + quarantine old.

## Phase C3 — rewrite context stack

Project memory → GPTWorker memory → project-local skills → local diagnostics.

## Phase C4 — rewrite instruction context

Minimal initialize/control plane; rich context only during active work.

## Phase C5 — rewrite validation

Validation follows target architecture only.

## Phase Final

Package/docs/dead-code cleanup only after runtime architecture passes.

---

# 10. Test gates

After every batch:

- build;
- legacy isolation;
- Worker startup;
- `:3000/health`;
- Tunnel readiness;
- MCP initialize;
- tools/list;
- stale session recovery;
- DELETE grace;
- Job nomination/confirmation/activation;
- legacy preload compatibility;
- filesystem;
- shell;
- git;
- context;
- node_repl local;
- stop/restart/reconnect.

If regression appears:

```text
stop next phase
→ restore old implementation from legacy
→ compare missing behavior
→ fix remap/rewrite
→ test again
```

---

# 11. Definition of success

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

Success means:

- no Codex dependency;
- no Codex home required on normal path;
- no Computer Use runtime;
- no Ponytail;
- no Admin server;
- no upstream MCP hub/external proxy;
- session manager remains stability-focused;
- checkpoint safety remains internal filesystem safety;
- standalone rewind is not an architecture family;
- context is local workspace/GPTWorker-owned;
- Job Packs with legacy preload tokens still activate safely;
- legacy quarantine never participates in runtime;
- Secure MCP Tunnel and Windows resident runtime remain stable.

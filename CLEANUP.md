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

### Memory ownership clarification

Quyết định kiến trúc sau review:

```text
GPT Web / chat session
└─ owns conversational memory / knowledge state

GPTWorker
└─ owns only technical runtime/session state required for transport and execution
```

GPTWorker **không có knowledge memory riêng** và không lưu cross-session project notes để thay thế memory của chat.

Project-local files như `AGENTS.md`, `CLAUDE.md`, README, rules và skills **không phải memory**. Chúng là local project context được đọc on-demand khi một Job đang làm việc.

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

> **STATUS: ✅ DONE / QUARANTINED / STATIC VERIFIED**
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

## STATUS: ✅ DONE / QUARANTINED / STATIC VERIFIED

Group C đã hoàn tất theo target architecture:

- C1 WorkGateway đã rewrite sạch với đúng 5 runtime families: filesystem, shell, git, context, repl;
- legacy preload tokens mcp / ponytail / rewind được accept nhưng ignore;
- old WorkGateway đã quarantine tại `legacy/group-c/tools/work-gateway.ts`;
- C2 node_repl được review và giữ implementation local-only hiện tại, không rewrite thừa;
- ~~C3 project memory, auto-memory và context stack đã rewrite theo workspace-local / GPTWorker-owned model;~~ **SUPERSEDED:** GPTWorker không được sở hữu knowledge memory; auto-memory phải retire hoàn toàn.
- ~~old project-memory, auto-memory và context implementations đã quarantine;~~ **CORRECTION:** behavior đọc project-local context vẫn cần, nhưng phải được đổi owner/name thành project context loader; auto-memory cũ chỉ còn là legacy/quarantine reference.
- **C3 POST-REVIEW CORRECTION DONE:** `remember` và active `auto-memory.ts` đã bị loại; `project-memory.ts` đã remap thành `project-context-loader.ts`; pre-correction implementations được giữ tại `legacy/group-c/post-review/**`.
- project-local skills loader được giữ vì đã local-only từ Group A;
- project_context hiện load rich project context on-demand thay vì startup;
- C4 initialize context đã rewrite thành minimal control plane;
- old instruction-context và codex-agent-prompt đã quarantine;
- stale project-memory startup test đã quarantine và thay bằng control-plane validator;
- obsolete git-snapshot.ts và worker-policy.ts đã quarantine sau khi không còn active caller;
- C5 active validation harness đã rewrite để test target architecture thay vì Admin/Codex/upstream.

Static guards C1–C4 và target-architecture validators đã được đưa vào default test chain.

GitHub Actions vẫn chưa cho runtime PASS đáng tin cậy: latest runs tiếp tục kết thúc với `steps=null` trước khi có test step, nên trạng thái hiện tại là static verified / runtime CI pending.

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
- ~~`src/lib/project-memory.ts`~~ → rename/remap thành project context loader;
- ~~`src/lib/auto-memory.ts`~~ → retire/quarantine, không replacement memory;
- `src/lib/skills-loader.ts`.

Naming target:

```text
project-memory.ts
→ project-context-loader.ts

ProjectMemory*
→ ProjectContext*

PROJECT_MEMORY_*
→ PROJECT_CONTEXT_*
```

Target:

```text
confirmed workspace
├─ project_context
├─ project-local instructions/rules
├─ project-local skills
├─ ~~GPTWorker-owned memory nếu giữ~~
└─ local runtime diagnostics
```

Corrected target:

```text
context
├─ project_context
├─ agent_status
├─ list_skills
├─ load_skill
└─ load_path_rules
```

Không có `remember`, `auto-memory`, `MEMORY.md` hay cross-session notes trong GPTWorker.

Group A đã xử lý trước:

- upstream status removed;
- `.codex/config.toml` removed;
- Codex plugin skill injection removed.

Còn phải xử lý:

- không auto-load global `~/.codex` / `~/.claude` làm authority;
- ~~auto-memory chuyển sang `getWorkerDataRoot()`;~~ **SUPERSEDED:** remove auto-memory entirely;
- diagnostics chỉ local;
- project-local `AGENTS.md`, `CLAUDE.md`, README, rules và skills tiếp tục được đọc on-demand như project context;
- remove tool `remember` khỏi context family / WorkGateway / tool profiles / tests;
- quarantine active `src/lib/auto-memory.ts`;
- rename/remap `project-memory.ts` thành project-context loader để tên phản ánh đúng behavior.

~~Target auto-memory:~~

~~```text
%LOCALAPPDATA%\GPTWorker\memory\projects\<workspace-hash>\MEMORY.md
```~~

Corrected rule:

```text
No GPTWorker knowledge-memory storage.
No MEMORY.md generated by GPTWorker.
No cross-session note persistence in GPTWorker.
```

`getWorkerDataRoot()` vẫn KEEP vì Custom Job, authoring staging/backup và Worker-owned operational data khác vẫn dùng nó; chỉ memory subtree bị retire.

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

# 5.1. POST-REVIEW CORRECTION — REMOVE GPTWORKER MEMORY

## STATUS: ✅ DONE / CORRECTED / STATIC VERIFIED

Review sau Group C phát hiện một quyết định C3 trước đó là sai với kiến trúc đã thống nhất.

Historical decision:

- ~~GPTWorker-owned auto-memory;~~
- ~~cross-session project notes under Worker data root;~~
- ~~tool `remember`;~~
- ~~`project-memory.ts` như một memory subsystem.~~

Correct decision:

```text
GPT/chat session
└─ conversational memory / reasoning continuity

GPTWorker
├─ technical MCP/session state
├─ Job/workspace runtime state
└─ on-demand local project context only
```

Required source correction:

1. remove `remember` from `src/tools/context.ts`;
2. remove `remember` from WorkGateway family mapping;
3. remove `remember` from local/slim tool profiles;
4. quarantine `src/lib/auto-memory.ts` into `legacy/group-c/lib/auto-memory.ts` or a new correction-specific legacy location if collision handling requires it;
5. remove all active imports/callers of auto-memory;
6. rename/remap active `src/lib/project-memory.ts` → `src/lib/project-context-loader.ts`;
7. rename exported `ProjectMemory*` symbols to `ProjectContext*`;
8. rename env/config wording `PROJECT_MEMORY_*` → `PROJECT_CONTEXT_*`;
9. rewrite C3 tests so they assert **absence of GPTWorker memory** while preserving project-context loading;
10. keep `getWorkerDataRoot()` only for operational Worker-owned data such as Custom Job authoring/staging/backups.

Implementation result:

- `src/lib/auto-memory.ts` removed from active tree;
- pre-correction auto-memory quarantined at `legacy/group-c/post-review/lib/auto-memory.ts`;
- `src/lib/project-memory.ts` removed from active tree;
- pre-correction project-memory quarantined at `legacy/group-c/post-review/lib/project-memory.ts`;
- new active loader: `src/lib/project-context-loader.ts`;
- `ProjectMemory*` → `ProjectContext*`;
- `PROJECT_MEMORY_*` → `PROJECT_CONTEXT_*`;
- `loadProjectMemory` → `loadProjectContext`;
- `remember` removed from context tool, WorkGateway, tool profiles and work policy;
- initialize wording no longer describes project memory;
- C3 tests now assert absence of GPTWorker knowledge memory while preserving on-demand project context.

Validation after correction:

- no active `src/lib/auto-memory.ts`;
- no tool named `remember`;
- no `memory/projects` runtime path;
- no generated `MEMORY.md`;
- no active `ProjectMemory*` naming;
- `project_context` still loads project-local files/rules correctly;
- Job/session/runtime architecture otherwise unchanged.

---


# 5.2. POST-REVIEW ROUND 2 — CALLER / MAPPING AUDIT

## STATUS: ⏳ IN PROGRESS

Review này kiểm tra theo chuỗi:

```text
caller
→ registry/profile
→ work_tool schema
→ family mapping
→ lazy loader
→ registerTool implementation
→ Job preload
→ Job skill/harness/validator paths
→ runtime policy / tests
```

Static audit result:

- 45/45 work-family operations có implementation tương ứng;
- 14/14 top-level control/Job/workspace/work gateway tools có registration;
- 45/45 default Job skill/harness/validator references tồn tại;
- legacy preload `mcp` / `ponytail` / `rewind` vẫn parse-safe và được ignore;
- C3 rename sang `project-context-loader.ts` không còn active caller trỏ vào project-memory/auto-memory.

Các correction phát hiện trong Round 2:

### R2.1 — P0: inner work_tool operations bị slim profile cắt nhầm

Current behavior:

- default profile = `slim`;
- `work_tool` dùng `shouldExposeTool(..., slim)` để tạo enum operation;
- 21 local operations có implementation nhưng biến mất khỏi schema mặc định.

Các operation bị ảnh hưởng gồm một phần filesystem/shell/git như:

`delete_file`, `create_directory`, `copy_file`, `process_status`, `stop_process`, `git_branch`, `git_push`, `git_pull`, `git_stash`, `git_reset`, base64/search/tree helpers, v.v.

Correct architecture:

```text
slim/full profile
→ controls top-level MCP surface only

work_tool
→ exposes the complete local operation set
→ local explicit disabled overrides may still remove a specific operation
```

### R2.2 — P1: agent_status classification drift

Current mismatch:

- WorkGateway maps `agent_status` to context family;
- `tool-work-policy.ts` marks `agent_status` as CONTROL;
- `toolFamily(agent_status)` therefore falls back to `core`.

Correct target:

- `agent_status` is an active-work context operation;
- remove it from `CONTROL_TOOLS`;
- include it in context family classification;
- lease/telemetry records family = `context`.

### R2.3 — P1: stale Job Pack instructions

Default Job asset mapping is complete, but `jobs/dev-coding/JOB.md` still references retired capability text such as checkpoint/rewind and upstream MCP.

`jobs/**` remains frozen. This Round 2 records the stale text but does **not** modify Job Pack files without explicit unfreeze.

### R2.4 — P2: Custom Job authoring cannot declare preload families

Job Runtime supports `runtime.preload_families`, but `job_create` / `job_update` authoring schema does not expose it for new custom Jobs.

Behavior still works through lazy loading, but custom Jobs cannot opt into the same warm-up path as bundled Jobs.

Correction target:

- add optional `preload_families` to Job authoring draft/patch + public tools;
- validate against runtime + accepted legacy family tokens;
- create/update writes `runtime.preload_families`;
- clone preserves existing runtime when not explicitly overridden.

### R2.5 — P2: stale projectMemoryInstructions naming in connection path

Behavior is control-plane instruction text, not memory.

Rename only:

```text
projectMemoryInstructions
→ controlPlaneInstructions
```

across `index.ts`, `mcp-session-manager.ts`, and `server-factory.ts`.

No transport/session behavior change.

### R2.6 — architecture note: Job permissions and Layla Gate 2 are behavioral policy, not hard runtime enforcement

Current facts:

- Job `permissions` is surfaced metadata;
- global runtime permission layer is currently open;
- Layla Gate 2 is enforced by `JOB.md` / `SKILL.md` behavioral instructions, not by a second server-side authority token.

This is **not treated as a mapping bug in Round 2**. Hard Job-level permission enforcement / second-gate authority would be a separate architecture decision because it changes execution semantics and risks breaking stable workflows.

---


# 6. FINAL CLEANUP — ✅ DONE WITH COMPATIBILITY EXCEPTIONS

Đã hoàn tất:

- removed obsolete `coding-agent` package keyword;
- removed dead `saveLocalToolOverrides()` writer;
- genericized active Codex/Claude wording in patch/filesystem tools;
- README / WORKER / AGENTS đã khóa target architecture mới;
- retired subsystems không còn được mô tả như optional runtime capability;
- obsolete startup-context helpers đã quarantine.

Compatibility exceptions cố ý giữ:

- `codex-mcp-server` bin alias + matching package-lock entry: KEEP cho install compatibility cho tới khi có migration riêng;
- `openai-tunnel.ps1` profile filename `codex-local`: KEEP cho local-install compatibility.

Hai tên compatibility này không kéo Codex runtime vào GPTWorker và không được coi là active architecture.

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

## Phase C1 — ✅ DONE

Clean WorkGateway active; old implementation quarantined.

## Phase C2 — ✅ DONE AS-IS

Current node_repl passed local-only architecture review; guard added.

## Phase C3 — ✅ DONE / POST-REVIEW CORRECTED

~~Context stack is workspace-local / GPTWorker-owned and rich context loads on demand.~~

Corrected architecture implemented:

- rich project context loads on-demand;
- GPTWorker-owned knowledge memory retired;
- `remember` + active `auto-memory` removed;
- `project-memory.ts` remapped/renamed to `project-context-loader.ts`;
- context family now contains only on-demand project context + local diagnostics/skills/rules.

## Phase C4 — ✅ DONE

Initialize context is control-plane only; old Codex-named prompt and startup context quarantined.

## Phase C5 — ✅ DONE

Active validation harness follows target architecture.

## Phase Final — ✅ DONE WITH COMPATIBILITY EXCEPTIONS

Package/docs/dead-code cleanup complete; compatibility aliases intentionally preserved.

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

Current static architecture status:

- target source boundary is implemented;
- Group A/B/C quarantine guards are active;
- C3 post-review memory correction is implemented;
- GPTWorker has no active knowledge-memory subsystem;
- runtime CI PASS is still pending because GitHub Actions currently fails before steps execute.

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
- ~~context is local workspace/GPTWorker-owned;~~
- context is read-only/on-demand local project context; conversational memory/state belongs to GPT/chat session, not GPTWorker;
- GPTWorker has no knowledge-memory subsystem, no `remember` tool, no generated `MEMORY.md`, and no cross-session project-note store;
- Job Packs with legacy preload tokens still activate safely;
- legacy quarantine never participates in runtime;
- Secure MCP Tunnel and Windows resident runtime remain stable.

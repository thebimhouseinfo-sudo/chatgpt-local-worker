# GPTWorker v2 — Execution ledger

Tất cả task triển khai dưới đây chưa thực hiện. READY nghĩa là scope đã đủ để bắt đầu sau khi thống nhất plan, không phải user đã cấp phép sửa code trong lượt review. Evidence review hiện có nằm trong REVIEW.md.

| ID | Status | Task / Output | Depends On | Acceptance | Subplan | Progress / Notes |
|---|---|---|---|---|---|---|
| TASK-V2-LOG-001 | IN_PROGRESS | Automatic structured runtime logging, redaction, rotation và Admin history | None | MCP/tool/session/HTTP/system events tự ghi JSONL; logging fail-open; secret được redact; record/file bounded; build + validate + test pass | None | P0 scope đã chốt; implementation đang thực hiện |
| TASK-V2-001 | READY | Baseline/regression specification và test diagnostics | None | Ghi build/jobs/test baseline; meaningful regressions cho R01–R05; spawn failure hiển thị error code | None | Baseline PASS, probes R01/R02/R03 đã có; regression files chưa viết |
| TASK-V2-002 | READY | Live ChatGPT/Tunnel identity + timing spike, quyết định OQ-01/OQ-02 | None | Evidence nhiều tool calls/hai chat/reconnect/close/probes; kết luận resume mapping và measured wake budget | None | Chưa chạy connector thật; không có permission mở chat/gửi request thay người dùng được suy từ review |
| TASK-V2-003 | TODO | Session ExecutionContext thay global cwd/shell/process/context/checkpoint scope | TASK-V2-001 | A/B xen kẽ async operations không lẫn; context đúng workspace sau activation/switch | None | R01/R10; bao gồm project instructions và startup bootstrap race |
| TASK-V2-004 | TODO | Dispatch gate và confirmation snapshot/token contract | TASK-V2-003 | Binding/revision/session drift bị reject; native/shell/REPL/upstream/hook gates được test | None | R02/R03; full-machine access không bị ngầm đổi thành sandbox |
| TASK-V2-005 | TODO | Stop/switch/dispose, operation/resource ownership và mutation leases | TASK-V2-003, TASK-V2-004 | Stop A không đổi B; cleanup owned child resources; no mutation sau revoked generation; cùng workspace có conflict handling | None | R04/R08 |
| TASK-V2-006 | TODO | Public MCP gateway + Driver SessionStore + versioned IPC prototype | TASK-V2-002, TASK-V2-004, TASK-V2-005 | Transport sống qua executor restart; SessionStore có single authority; protocol/ownership contract được test | None | R05; không giả lập restore bằng dựng JobRuntime trống |
| TASK-V2-007 | TODO | WakeCoordinator, quiescence, failure recovery và live wake acceptance | TASK-V2-006 | Single-flight; ba sleep/wake giữ Job; active resources giữ awake; crash không replay mutation; live client evidence | None | Ghi unknown side-effect outcome khi cần |
| TASK-V2-008 | TODO | Install/data path split, migration và portable harness runner | TASK-V2-003 | Cả ba packs chạy ngoài checkout; WORKER policy vẫn load; original data và modified jobs bảo toàn | None | R06; chốt OQ-03 phần harness |
| TASK-V2-009 | TODO | Manifest schema/API adapter, metadata catalog, immutable pack snapshots | TASK-V2-004, TASK-V2-008 | Legacy packs tương thích; aliases/API/resource path failures rõ; active revision được pin | None | R07/R09; giữ JSON-compatible YAML |
| TASK-V2-010 | TODO | Pack staging/publish/history transaction primitives | TASK-V2-005, TASK-V2-009 | Concurrent base conflict; hash validation; crash recovery mỗi bước; live/catalog nhất quán | None | Core transaction infrastructure |
| TASK-V2-011 | TODO | Job Authoring pack, fixtures và completion criteria | TASK-V2-010 | Create/update không hỏi project folder; staged invalid pack không publish; snapshot cũ tiếp tục chạy | None | Canonical pack mới theo yêu cầu v2 |
| TASK-V2-012 | TODO | Minimal chat command mapping và MCP internal diagnostics | TASK-V2-007, TASK-V2-011 | Bốn cú pháp route đúng; confirmation giữ nguyên; dynamic catalog dùng được trên ChatGPT | None | Không giả định server tự nhận toàn nội dung chat |
| TASK-V2-013 | TODO | Scheduled Task, supervision, credential migration và Windows lifecycle | TASK-V2-007, TASK-V2-008 | User logon/network reconnect/suspend/duplicate start/child crash; no secret leak; đúng process ownership | None | Chốt OQ-04; user-mode Driver |
| TASK-V2-014 | TODO | Packaging, clean-machine upgrade/uninstall, docs và v2 release acceptance | TASK-V2-009, TASK-V2-012, TASK-V2-013 | Cài/logon/ChatGPT/wake/sleep/resume hai chat; upgrade giữ jobs; đầy đủ validation và review diff | None | Chốt OQ-03 packaging; merge cần user approval |

## Execution Rules

- Status: TODO, READY, IN_PROGRESS, BLOCKED, DONE. Dependencies đạt mới bắt đầu dependent implementation.
- Nếu identity spike không chứng minh contract, mark TASK-V2-006/007 và dependent release acceptance BLOCKED; không đoán conversation ID hay dùng global state.
- DONE cần acceptance evidence và applicable deterministic validation, không chỉ file đã tạo.
- Các task code chưa được thực hiện trong lượt review này; không ghi DONE cho task baseline/regression chỉ vì baseline test có sẵn đã pass.
- Giữ stable IDs; task-local subplans chỉ chi tiết hóa phạm vi đã chốt.
- Scope/architecture mới phải có record trước implementation; không đưa mục Deferred thành required work một cách âm thầm.

## Completion Summary

2026-09-20: P0 được thu hẹp theo quyết định người dùng vào automatic runtime logging. Baseline build/validate/jobs/npm test PASS; đã reproduces changed-binding confirmation bug nhưng chưa xử lý vì ngoài P0. TASK-V2-LOG-001 đang triển khai; Driver, AppData migration, authoring và packaging chưa bắt đầu.

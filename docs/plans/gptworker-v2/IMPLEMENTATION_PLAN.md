# GPTWorker v2 — Implementation Plan sửa

## Objective

Sau setup, Windows logon tự khởi động nền; ChatGPT có thể gọi Worker, chọn đúng Job/context và tiếp tục qua sleep/wake khi identity hợp lệ. Hai phiên không làm lẫn workspace/resource; authoring publish pack đã validate vào AppData; cập nhật ứng dụng bảo toàn pack người dùng.

Đây là plan đề xuất, chưa triển khai. Không đặt version package thành v2 hoặc sửa root runtime policy chỉ vì tài liệu này tồn tại.

## Inputs / Governing Architecture

- [ARCHITECTURE.md](ARCHITECTURE.md) là kiến trúc đề xuất của bundle này.
- [REVIEW.md](REVIEW.md) ghi lỗi/giả định và bằng chứng baseline.
- Root `WORKER.md`, pack contracts và MTO invariants tiếp tục áp dụng cho code hiện tại đến phase thay đổi tương ứng.
- [TASKS.md](TASKS.md) là execution ledger; [TODO.md](TODO.md) là backlog.

## Constraints

- Windows user context; AppData jobs tồn tại độc lập application release.
- Một execution core; không thêm multi-agent hierarchy hay tool framework riêng cho pack.
- Giữ canonical IDs `dev-coding`, `dev-planing`, `mto`; thêm `job-authoring` theo yêu cầu v2.
- Giữ lifecycle DISCOVER → SELECT → RESOLVE → CONFIRM → EXECUTE → VALIDATE → COMPLETE và confirmation boundary.
- Review này chỉnh tài liệu. Implementation rộng chỉ bắt đầu sau khi người dùng thống nhất hướng sửa.

## Non-Goals

Kernel driver, Windows service trong release đầu, GUI bắt buộc, public Job marketplace, multi-machine Job resume, OS sandbox toàn diện cho shell và tự thay đổi business rules MTO.

## Implementation Strategy

Thực hiện theo lát cắt có acceptance chạy được. Đưa protocol/identity spike lên trước vì đây là rủi ro lớn nhất của thiết kế. Sửa isolation và activation trước khi đưa arbitrary mutable packs cùng background lifecycle vào production. Làm wake prototype trước authoring đầy đủ; packaging cuối cùng.

Không dùng passing unit tests làm bằng chứng conversation isolation. Mỗi contract có failure case riêng và test thực trên Windows/connector khi liên quan transport hoặc startup.

## Phases

1. **P0 — Baseline và feasibility.** Ghi baseline build/tests; thêm regression cases cho token, global context, stop. Dùng endpoint quan sát tối giản để test hai chat qua tunnel thật: initialize, repeated calls, refresh, reconnect, close, DELETE, timeout và discovery probe. Đo memory/process count lúc idle và cold-start envelope. Output: identity contract có evidence, disposition OQ-01/OQ-02; chưa đóng gói production. Nếu không xác nhận mapping thì tiếp tục foundation độc lập, giữ multi-conversation auto-resume BLOCKED.
2. **P1 — Session-scoped execution và activation.** Introduce ExecutionContext và resource ownership; bỏ global mutable project context trong đường thực thi. Gate mọi tool cần execution; bind confirmation token với snapshot; stop/switch drain resources đúng scope. Refresh instructions theo confirmed context; guard checkpoint/process truy cập chéo; lease xung đột cùng workspace. Acceptance: hai logical sessions với hai workspace, xen kẽ async reads/writes/shell không lẫn; stop A không thay B; changed token scope bị reject; mọi execution channel bị chặn trước confirm.
3. **P2 — Driver transport + Worker prototype.** Tách public SDK transport và SessionStore ra nền; dùng IPC versioned cho executor. Single-flight wake, queue bounds, drain/wake race, active resource leases, graceful shutdown, startup failure và crash unknown-result. Acceptance: cùng logical Job qua ít nhất ba sleep/wake; ba request đồng thời chỉ một child; long task/REPL/process giữ awake; Worker crash không replay mutation; Driver restart invalidates old authority. Chứng minh đường ChatGPT/Tunnel thật trước khi coi phase đạt đầy đủ.
4. **P3 — Paths, portable packs và catalog.** Tách install/data/config paths; migrate artifacts và seed packs không overwrite. Shared manifest schema + legacy adapter + worker API compatibility. Portable harness runner thay repo-relative import; metadata scan có diagnostics và immutable revision snapshots. Acceptance: scan/validate/run cả ba pack từ AppData fixture ngoài repo; malformed/colliding/outside-pack resources bị reject; package update giữ nguyên modified pack; unknown API có lỗi rõ.
5. **P4 — Publish transaction + Job Authoring.** Core staging/publish/history primitives có per-job lock, expected revision, content hash, journal recovery. Tạo job-authoring SOP/harness; create/update dùng staging; pin revision cho session cũ. Acceptance: invalid pack không live; hai update cùng base gây conflict xác định; crash giữa từng bước vẫn recover một revision hợp lệ; session cũ giữ rules cũ; session mới nhận rules mới.
6. **P5 — Chat control và diagnostics.** Map bốn cú pháp chat sang structured MCP calls; routing bằng metadata và confirmation, không giả định đọc được toàn chat. Giữ status/doctor/logs phục vụ nội bộ. Acceptance: create/update không hỏi workspace không cần thiết; thiếu yêu cầu chỉ hỏi phần thiếu; stop chỉ tác động current execution session; catalog mới dùng được qua ChatGPT mà không rebuild binary.
7. **P6 — Windows host integration.** Scheduled Task user logon, single-instance ownership, tunnel/Worker supervisor, backoff, machine sleep/resume, drive readiness, child-tree cleanup, credential migration. Acceptance: logoff/logon, crash child, network down/up, duplicate start, port conflict đều có trạng thái xác định và không nhân bản processes. Không ghi secrets vào log/job/state.
8. **P7 — Packaging và release acceptance.** Đóng gói prototype đạt dynamic imports/harness runtime; setup/upgrade/uninstall giữ user data mặc định; update docs nhỏ nhất theo authority. Acceptance trên máy Windows sạch: cài → logon → ChatGPT call → confirm → Job chạy → Worker ngủ → resume; hai chat độc lập; upgrade giữ customized jobs. Chỉ gắn nhãn v2 complete khi flow này có evidence.

## Migration / Compatibility

- V1 default env paths còn được nhận trong dev mode qua adapter có precedence được ghi rõ; production dùng installRoot/dataRoot riêng.
- Copy pack hiện có vào staging, validate và publish lần đầu; collision/id tồn tại không overwrite. Không silently activate Job từ v1 `worker-state.json`.
- Giữ legacy pack manifest qua adapter; manifest v2 parse JSON-compatible. Không tự rename `dev-planing` hoặc inherited `codex-*` surfaces.
- Tách bootstrap core validator khỏi pack-relative imports trước migration AppData.
- Giữ checkpoint/audit/history là dữ liệu tra cứu có scope; không dùng chúng cấp quyền phiên mới. Migration có dry-run, copy/verify và recovery; giữ original khi chưa kiểm chứng.
- Default setup seed pack mới thiếu; shipped pack upgrade là một publish/update có validation, không phải installer copy đè.
- Application rollback phải biết manifest/API support; báo incompatible pack, không sửa ngược Job người dùng một cách tự động.

## Validation Strategy

| Contract | Kiểm tra chấp nhận |
|---|---|
| Confirmation | Token scope/session/revision/expiry/replay; không nhận binding mới với token cũ; retry đúng request không gây activation hai lần |
| Execution isolation | A/B khác workspace và cùng workspace; async interleaving; shell, process, Git, context, REPL, checkpoint, upstream; stop/switch một phiên không phá phiên khác |
| Gate | Direct tool call trước confirm và sau stop; tất cả native/proxy/hook execution channels có policy rõ |
| Identity | Client thật qua tunnel, nhiều calls/chats, reconnect/refresh/close; nếu thiếu identity thì refuse auto-attach |
| Sleep/wake | Cold start concurrency, queue overflow, deadline, health probe, SSE/cancel, drain race, active process/REPL lease, Worker/Driver crash |
| Pack publish | Invalid manifest/paths/API, duplicate aliases, base revision conflict, active revision pinning, locked file, fault injection từng publish step |
| Migration | AppData có dấu/khoảng trắng, checkout không tồn tại, modified built-in pack, disk/full/permission failures, recovery không mất pack |
| Deployment | Windows user logon, no global Node contract, tunnel reconnect, no duplicate child, clean install/upgrade/uninstall preserving data |

Mỗi change chạy targeted tests trước, rồi `npm run build`, `npm run validate:jobs`, `npm test`, `git diff --check`. Bổ sung MCP integration suite phù hợp cho P1/P2/P5; `npm test` hiện không thay thế integration/live client checks. Chạy pack harness riêng khi sửa pack.

Baseline review: build/validate/jobs/full npm test PASS; full test cần quyền spawn process ngoài sandbox. Không sửa test để bỏ qua EPERM; ghi `result.error` giúp chẩn đoán đúng.

## Risks

- Identity không đủ: OQ-01 có thể buộc đổi resume UX; đây là release gate, không fallback global active Job.
- Driver giữ transport tốn memory hơn proxy HTTP nhỏ: benchmark, tránh import tool implementation vào Driver bundle.
- Resource không serialize khiến Worker chưa thể ngủ: expose idle-block reason, giải phóng bằng lifecycle; không tự kill để đạt metric.
- Unrestricted shell có side effect ngoài declared context: full-machine trust contract giữ nguyên, không tuyên bố OS sandbox từ path guard.
- Upstream/desktop applications có state dùng chung: adapter lease/ownership, chưa chứng minh thì không cho concurrent conflicting use.
- Mutable jobs và generated validators: cần shared schema/core gate, pack behavior fixtures và publish evidence.
- Windows file locks/process trees/drive mapping: fault injection và acceptance trên user session thật.

## Open Questions

Theo OQ-01 đến OQ-04 trong architecture. Các thông số timeout/retention/memory budget là lựa chọn dựa trên đo đạc, chưa được coi là đã chốt. Các task không phụ thuộc identity spike có thể chuẩn bị độc lập; acceptance conversation-level giữ BLOCKED khi thiếu evidence.

## Task Mapping

| Phase | Tasks |
|---|---|
| P0 | TASK-V2-001, TASK-V2-002 |
| P1 | TASK-V2-003, TASK-V2-004, TASK-V2-005 |
| P2 | TASK-V2-006, TASK-V2-007 |
| P3 | TASK-V2-008, TASK-V2-009 |
| P4 | TASK-V2-010, TASK-V2-011 |
| P5 | TASK-V2-012 |
| P6 | TASK-V2-013 |
| P7 | TASK-V2-014 |

## Handoff Notes

Đọc architecture → plan → TODO → TASKS trước source expansion. Sửa những module thuộc task; không triển khai toàn v2 trong một commit. Root WORKER/README/AGENTS và pack docs chỉ cập nhật cùng behavior tương ứng. Không biến proposal chưa được chốt thành runtime authority.

Một phase đạt local tests nhưng thiếu live acceptance phải ghi rõ partial evidence, không đánh dấu DONE. Có thể tạo task-plans cho bounded work; quyết định mới về identity/ownership/distribution phải quay lại architecture. Không merge PR nếu người dùng chưa đồng ý merge.

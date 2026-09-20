# GPTWorker v2 — Review và bản sửa đề xuất

Ngày review: 2026-09-20. Baseline: `9997d4c` trên `main`.

Phạm vi: review code liên quan đến v2 và sửa plan người dùng cung cấp. Đây là đề xuất kiến trúc để review, chưa phải thay đổi runtime hay thay thế `WORKER.md` hiện hành. Không phải audit toàn bộ codebase.

Quyết định scope mới nhất: P0 chỉ thêm lớp logging tự động, không thay đổi logic hoạt động hiện tại. Các đề xuất isolation/session/sleep/wake/AppData bên dưới là roadmap sau P0.

## Kết luận

Giữ mục tiêu tự chạy khi đăng nhập Windows, ChatGPT làm giao diện chính, Worker thực thi theo nhu cầu, Job Pack trong AppData, manifest làm nguồn đăng ký duy nhất và `job-authoring` làm workflow tạo/cập nhật Job.

Plan gốc chưa đủ điều kiện triển khai nguyên trạng. Ba phần quyết định thành công là identity thực tế qua ChatGPT/Tunnel, isolation xuyên suốt các tool, và quyền sở hữu state khi Worker tắt. Cần kiểm chứng chúng trước khi đầu tư installer/EXE.

Đọc bản sửa theo thứ tự:

1. [ARCHITECTURE.md](ARCHITECTURE.md) — hiện trạng, kiến trúc đề xuất, các contract cần giữ.
2. [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — thứ tự triển khai và acceptance.
3. [TODO.md](TODO.md) — backlog, phần hoãn và giới hạn phạm vi.
4. [TASKS.md](TASKS.md) — ledger để coding tiếp sau khi thống nhất plan.

## Các phát hiện từ code

P1: cần xử lý trước khi tuyên bố v2 hỗ trợ nhiều phiên độc lập. P2: cần xử lý trong các phase liên quan. Mức độ này áp dụng cho mục tiêu v2; không mặc định xem full-machine access hiện tại là lỗi.

| ID | Mức | Bằng chứng và tác động | Hướng sửa |
|---|---|---|---|
| R01 | P1 | `src/lib/path-security.ts:5` giữ `defaultCwd` toàn process; `src/lib/persistent-shell.ts:16` giữ cwd/history toàn process; `src/tools/shell.ts:30` giữ process map chung. Dù mỗi server có JobRuntime riêng, phiên B vẫn đổi ngữ cảnh thực thi của A. | Truyền ExecutionContext theo logical session vào mọi tool; session sở hữu shell, process handles, REPL, checkpoint scope và instruction context. |
| R02 | P1 | `src/jobs/job-runtime.ts:375` merge bindings mới trước khi kiểm tra token ở dòng 399. Đã tái hiện token cấp cho task `review only` kích hoạt task `different scope`. | Gắn token với session, generation, pack revision và canonical bindings hash; mọi thay đổi scope làm token cũ mất hiệu lực. |
| R03 | P1 | `src/lib/permissions.ts:33` và `:35` là no-op. `src/server-factory.ts` đăng ký tool thực thi mà không có gate kiểm tra active job. Confirmation hiện kiểm soát select, chưa chặn tool thực thi gọi trực tiếp. | Một dispatch gate chung cho native tools, shell, REPL, hooks có side effect và upstream proxy. Giữ full-machine trust model nhưng enforce active confirmed context. |
| R04 | P1 | `src/tools/jobs.ts:215` chỉ reset JobRuntime và ghi state idle; không dọn cwd, shell, process, REPL. `worker-state.json` là file chung; stop A có thể xóa context persistent của B. | Stop có lifecycle drain/cancel/dispose riêng cho phiên; xóa mọi handle của job đó và thu hồi execution generation. |
| R05 | P1 | `src/lib/mcp-session-manager.ts:415` dựng server mới khi recovery; server factory dựng JobRuntime mới. Recovery transport không restore active Job. `src/index.ts` còn cho phép sessionless request đi qua recovery. | Tách transport identity và logical execution identity; chỉ resume context có ownership đã kiểm chứng; Driver restart làm token/session cũ hết hiệu lực. |
| R06 | P2 | Cả ba `jobs/*/harness/validate.mjs:4` import `../../../shared-harness/job-pack-validator.mjs`. Copy riêng `jobs/` sang AppData làm mất dependency này. `getWorkerHome()` còn được dùng để tìm `WORKER.md`. | Tách install/assets path và writable data path; cung cấp harness runner/API dùng chung có contract ổn định; test từ pack bên ngoài checkout. |
| R07 | P2 | `JobRuntime.allPacks()` load cả `JOB.md`/`SKILL.md` của mọi pack; `status()` đọc lại live pack. Alias trùng được chọn theo thứ tự; runtime và shared validator dùng hai bộ kiểm tra khác nhau. | Scan metadata nhẹ, schema dùng chung, chẩn đoán pack lỗi, phát hiện alias trùng, load snapshot theo revision sau activation. |
| R08 | P2 | `removeSession()` chủ yếu bỏ reference; DELETE dùng timer cố định và `touch()` có thể hủy timer. Chưa có registry resource/operation để drain theo phiên. | Session `CLOSING` từ chối việc mới, theo dõi operation thực, cleanup idempotent; expiry không cắt thao tác đang chạy chỉ vì quá TTL. |
| R09 | P2 | `shared-harness/job-pack-validator.mjs` kiểm tra key/tồn tại file nhưng chưa kiểm tra đầy đủ kiểu, file nằm trong pack, alias collision, worker API hoặc ý nghĩa completion. | Một manifest schema cho runtime/validator và validation nhiều tầng. Không coi tồn tại validator là bằng chứng validator đã chạy. |
| R10 | P2 | `src/index.ts` tạo project instructions từ workspace lúc startup rồi dùng cho session mới. Trong deployment AppData, context bootstrap có thể không phải project đã xác nhận. | Startup chỉ có instructions chung; project memory/rules/skills được resolve theo context xác nhận, thay generation khi switch. |

Các item R04–R10 là kết luận từ inspection; chưa có live multi-chat/Tunnel reproduction trong lượt review này. R01 được kiểm chứng ở primitive path resolution; chưa phải test end-to-end hai conversation.

## Những chỗ phải sửa trong plan gốc

1. **Mục 8–11, 32–33: conversation không đồng nghĩa MCP session.** MCP định nghĩa session giữa client/server và termination qua transport; tài liệu được đọc không thiết lập một-một với chat hay một event đóng tab ChatGPT. Chính code cũ cũng có comment về MCP session thay đổi qua tool call, nhưng comment không phải bằng chứng hiện tại. Đưa spike hai chat, reconnect, refresh và close lên P0. [MCP transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).
2. **Mục 7, 10, 32, 40: state phải sống ngoài Worker.** Mục 32 giữ state trong memory và cho phép mất khi Driver restart là hợp lý; sơ đồ cuối đặt SessionManager trong Worker lại làm mất Job mỗi lần sleep. Bản sửa đặt public transport và SessionStore trong Driver; Worker nhận execution context qua IPC.
3. **Mục 4–6, 39: định nghĩa idle theo resource, không chỉ timestamp tool call.** Process nền, operation đang chạy và REPL không thể serialize phải giữ Worker thức. Không cam kết Worker luôn tắt sau một khoảng thời gian bất kể công việc.
4. **Mục 5: raw HTTP proxy chưa giải quyết protocol state.** Nếu SDK transport nằm trong child bị kill, giữ JSON Job state thôi chưa đủ để request mang session ID cũ tiếp tục. Chọn gateway giữ transport ở Driver để tránh giả lập reinitialize âm thầm.
5. **Mục 17: ví dụ YAML không parse bằng code hiện tại.** Hiện parser là `JSON.parse`. Đề xuất tiếp tục JSON-compatible YAML ở v2.0, thêm schema/context/API fields; full YAML là lựa chọn hoãn.
6. **Mục 18, 24: context và write policy là hai khái niệm.** `type: appdata` chỉ giải quyết đường dẫn; không tự cấp quyền publish hay thu hồi full-machine shell. Tách context resolution, activation và resource policy.
7. **Mục 21–23: atomic replace phải có transaction/recovery thật.** Update cần khóa theo job, unique staging directory, expected base revision, snapshot immutable và journal. Khóa file/antivirus/crash giữa các bước phải có recovery được test.
8. **Mục 20, 35: vẫn cần bootstrap/migration nội bộ.** Không cần command install cho người dùng, nhưng setup phải seed pack mới, xử lý pack đã sửa và migrate dependencies/config. App update không overwrite pack người dùng.
9. **Mục 28: server không tự thấy mọi câu chat.** ChatGPT phải gọi MCP tool với arguments cụ thể; command parser chỉ parse text thực sự được gửi cho nó. Bốn cú pháp chat là UX, không phải native slash commands hoặc một listener đọc toàn chat.
10. **Mục 34: credential migration đang thiếu.** `openai-tunnel.ps1` hiện đọc/ghi runtime key vào `.env`; v2 cần migration rõ ràng sang cơ chế cấu hình/credential được tunnel-client hỗ trợ. Không copy key vào state/log/Job.
11. **Mục 38: kiểm chứng session + wake sớm hơn authoring/packaging.** Nếu connector không cung cấp identity đủ mạnh, v2 không thể hứa tự resume đúng conversation theo thiết kế gốc.

HTTP target cho tunnel được tài liệu chính thức hỗ trợ. Việc Wake Bridge đứng ở target là lựa chọn thiết kế của dự án; timeout cold start, header forwarding và traffic probe vẫn phải đo với client thực. Skill OpenAI Docs giúp phân biệt phần có tài liệu xác nhận với giả định cần spike. [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels).

## Verification đã chạy

- `npm run build`: PASS.
- `npm run validate:jobs`: PASS cho ba pack hiện có.
- `npm test`: PASS khi chạy ngoài sandbox.
- Chẩn đoán lỗi trước đó: `spawnSync ... node.exe EPERM` trong sandbox. Không kết luận đây là lỗi logic của dev-coding harness; nên cải thiện thông báo test để hiển thị `result.error` khi process không spawn được.
- Probe read-only trên module đã build: đổi task với token cũ được chấp nhận; relative path đổi theo global cwd; permission helpers không chặn khi chưa có active Job.
- Chưa chạy live ChatGPT/Tunnel, Windows logon/reboot, sleep/wake hoặc installer v2. Các phần này là acceptance tương lai, không phải kết quả đã đạt.

Các test hiện tại pass nhưng chưa bao phủ những invariant v2 và lỗi confirmation nói trên.

# GPTWorker Cleanup Review

## 1. Mục tiêu cleanup

GPTWorker được xem là một **stability-first local worker**. Mục tiêu cleanup không phải làm repo nhỏ bằng mọi giá và cũng không phải tái thiết kế Job Pack. Mục tiêu là giảm các thành phần không cần thiết trên đường chạy:

```text
GPT Web
→ OpenAI Secure MCP Tunnel
→ GPTWorker local runtime
→ MCP session / recovery
→ admission + workspace
→ work_tool
→ local tools
```

Cleanup chỉ nên được thực hiện khi nó giúp một hoặc nhiều mục tiêu sau:

- giảm số subsystem phải khởi tạo cùng Worker;
- giảm dependency và failure surface không phục vụ kết nối/tool thực tế;
- giảm code/config kế thừa từ coding-agent architecture nhưng GPTWorker hiện không dùng;
- làm startup/reconnect/tool execution dễ chẩn đoán hơn;
- giữ optional feature ở trạng thái thật sự optional/lazy thay vì trở thành boot dependency;
- tránh thay đổi hành vi đang ổn chỉ để code ngắn hơn.

**Stability quan trọng hơn độ sạch tuyệt đối của source.**

## 2. Boundary của đợt cleanup

Đợt review này chỉ tập trung vào:

- GPT Web ↔ local connection;
- OpenAI Secure MCP Tunnel integration;
- MCP runtime/session lifecycle;
- tool registration, lazy loading và execution path;
- Windows resident/startup/health/restart support;
- optional runtime subsystem có thể làm nặng hoặc làm phức tạp đường chạy trên.

Không cleanup trong đợt này:

- `jobs/**`;
- Job Pack definitions;
- skills;
- harnesses;
- templates;
- các file mới vừa được tạo trong đợt validation/upgrade gần đây.

Các file mới từ validation được **giữ nguyên**. Nếu về sau cần dọn artifact do validation tạo ra thì xử lý trong một lượt riêng.

Những thành phần liên quan trực tiếp và cần thiết cho đường connection/tool ổn định được **cố ý không đưa vào các bảng cleanup bên dưới**.

---

## 3. Candidate có thể xoá

> "Có thể xoá" không có nghĩa là xoá ngay. Mỗi item phải đạt prerequisite trong cột cuối trước khi thực hiện.

| Item / khu vực | Hiện đang cung cấp gì | Vì sao là cleanup candidate | Khuyến nghị | Điều kiện trước khi xoá |
|---|---|---|---|---|
| `public/ui/*` | Web UI cho Admin service | Không nằm trong normal GPT Web → local workflow | **Có thể xoá** nếu Admin UI bị loại bỏ | Tách mọi chức năng còn cần, đặc biệt cấu hình Computer Use, khỏi Admin UI |
| `src/admin/server.ts` | Local Admin HTTP server ở port riêng | Worker normal flow không cần Admin server để tunnel, session hay tool hoạt động | **Có thể xoá sau khi decouple** | Không còn runtime feature nào phụ thuộc Admin API |
| `src/admin/routes.ts` | Admin API cho env, upstream MCP, plugin config, activity, Codex hooks | Phần lớn là management surface của architecture cũ, không phải đường execution chính | **Có thể xoá từng phần hoặc toàn bộ** | Di chuyển các setting thật sự còn cần sang config đơn giản hoặc tool/config khác |
| `src/admin/localhost-guard.ts` | Guard/auth cho Admin API | Chỉ có ý nghĩa nếu Admin API còn tồn tại | **Xoá cùng Admin subsystem** | Admin server/routes đã bỏ |
| Upstream MCP OAuth layer: `src/lib/mcp-oauth-provider.ts` | OAuth tới MCP server bên ngoài | Không liên quan OpenAI Secure MCP Tunnel; hiện không có upstream server active | **Candidate xoá** | Xác nhận GPTWorker không cần làm MCP hub cho external MCP |
| Upstream MCP proxy layer: `src/lib/mcp-tool-proxy.ts` | Proxy tool từ external MCP vào local server | Không cần cho local filesystem/shell/git/Windows tools | **Candidate xoá** | External MCP bridge bị retire |
| Upstream MCP import/discovery code trong `src/lib/mcp-upstream-config.ts` | Import cấu hình MCP từ Cursor/Claude/OpenCode | Không phục vụ connection GPT Web ↔ GPTWorker | **Candidate xoá phần import/discovery** | Không còn nhu cầu import external MCP config |
| `profiles/mcp-upstream.json` | Danh sách external MCP server | Các entry hiện disabled; có nhiều machine-specific path | **Candidate xoá khỏi default source** | Upstream MCP không còn được hỗ trợ hoặc chuyển sang user-local optional config |
| `src/tools/mcp-bridge.ts` | `mcp_servers`, `mcp_tools`, `mcp_call` | Chỉ phục vụ external/upstream MCP, không phải local Worker tools | **Candidate xoá** | Mọi Job/runtime reference tới family `mcp` đã được retire ở một lượt khác |
| `src/lib/mcp-upstream-manager.ts` | Manager cho external MCP server | Hiện được init dù external MCP không phải nhu cầu chính | **Candidate xoá cuối cùng trong nhóm upstream** | Admin + bridge + config/OAuth/proxy không còn phụ thuộc nó |

### Ghi chú quan trọng về upstream MCP

**OpenAI Secure MCP Tunnel không thuộc nhóm trên.**

Hai khái niệm phải được tách rõ:

```text
OpenAI Secure MCP Tunnel
= GPT Web ↔ GPTWorker transport
= core connection

Upstream MCP hub
= GPTWorker ↔ MCP server khác
= optional / hiện không cần
```

Không cleanup Tunnel chỉ vì cleanup upstream MCP.

---

## 4. Candidate có thể đơn giản hoá

| Item / khu vực | Hiện trạng | Vấn đề stability/complexity | Hướng đơn giản hoá đề xuất |
|---|---|---|---|
| Admin startup trong `src/index.ts` | Admin server được start cùng Worker | Một subsystem không thuộc normal workflow vẫn trở thành boot dependency | Trước mắt làm Admin **optional/off-by-default**; sau đó mới cân nhắc xoá |
| Upstream manager startup trong `src/index.ts` | `initUpstreamManager()` chạy lúc boot | Đọc/init external-MCP subsystem dù normal Worker không cần | Đổi thành **lazy init on first explicit external-MCP request** |
| Upstream manager injection vào mỗi MCP session | Session tạo server với upstream manager | Làm session layer biết về subsystem optional | Chỉ inject khi external MCP feature được bật |
| `src/lib/instruction-context.ts` ở slim mode | Vẫn load worker policy, project memory, git snapshot, skills, auto-memory trước khi quyết định slim/full | Tạo I/O và dependency trong startup/session init dù slim control plane không sử dụng phần lớn rich context | Với `slim`, chỉ build minimal connection/control instructions; rich context load sau khi work bắt đầu |
| Tool catalog/profile | Vẫn có catalog của nhiều optional tool family | Có thể khiến compatibility feature trông như core | Tách catalog thành **core work tools** và **optional adapters**; optional chỉ đăng ký khi enabled |
| `node_repl` + Computer Use integration | Computer Use được bật qua `profiles/plugins.json`, nhưng management UI nằm trong Admin | Windows tool là hữu ích, Admin UI thì không bắt buộc | Giữ Computer Use; chuyển enable/config sang config đơn giản độc lập, không cần Admin server |
| Runtime config trong `.env.example` | Trộn core connection config với optional Admin/upstream/checkpoint/hook config | Khó nhìn đâu là config bắt buộc để Worker sống | Chia rõ **CORE CONNECTION**, **TOOL RUNTIME**, **OPTIONAL/LEGACY**; optional có thể bỏ khỏi default example sau |
| Compatibility aliases / inherited naming | Một số `codex-*`, Local Worker, upstream naming còn tồn tại nội bộ | Không nhất thiết gây lỗi nhưng làm boundary khó hiểu | Chỉ đổi khi có lợi cho maintenance; không rename hàng loạt vì cosmetic |
| Activity + audit logging | Có cả runtime/activity và audit log | Hai đường log có overlap | Giữ trước vì hữu ích cho diagnosis; sau này có thể hợp nhất nếu chứng minh không mất evidence |
| Post-edit hook pipeline | Edit tool có thể gọi post-edit hooks nhưng config mặc định không hoạt động | Thêm một extension point vào file-edit path | Giữ disabled mặc định; cân nhắc chuyển thành plugin optional hoặc bỏ nếu không bao giờ dùng |

---

## 5. Không tham gia normal flow nhưng khuyến nghị giữ tạm

Các item này **vẫn được đưa vào file cleanup** để có thể đánh giá lại sau, nhưng hiện chưa nên xoá.

| Item / khu vực | Vì sao hiện không phải core normal flow | Vì sao khuyến nghị giữ tạm |
|---|---|---|
| Codex hooks / Ponytail compatibility | Không cần để GPT Web kết nối và chạy local filesystem/shell/git | User đang giữ nguyên coding/planning layer hiện tại; có thể còn được Job/skill cũ dùng. **Không đụng trong cleanup này.** |
| Project memory / skill loading / auto-memory | Không cần cho connection transport; slim mode không dùng rich context trước work | Có thể vẫn phục vụ Job hiện tại. Trước mắt chỉ nên giảm startup coupling, không xoá capability |
| Checkpoint / rewind | Không phải yêu cầu để connection sống | Hiện filesystem edit path có tích hợp checkpoint, nên xoá có thể thay đổi hành vi tool. Giữ cho tới khi có review riêng |
| Post-edit hooks | Mặc định có thể không active | Đã nằm trong edit enrichment path; giữ disabled cho đến khi xác nhận hoàn toàn không dùng |
| Admin activity/history endpoints | Không cần cho normal operation | Có thể hữu ích tạm thời khi debug stability trong giai đoạn cleanup; chỉ xoá sau khi logging/diagnostics độc lập đủ tốt |
| `node_repl` | Không phải tool tối thiểu cho mọi task | Hiện là carrier của Windows Computer Use integration. **Giữ** cho tới khi Windows tool có adapter riêng tốt hơn |
| Compatibility support cho protocol/client cũ | Không phải feature người dùng nhìn thấy | Có thể đang che các edge case reconnect/discovery. Không xoá nếu chưa có regression test chứng minh an toàn |

---

## 6. Cleanup order đề xuất

### Phase A — không thay đổi capability

1. Tách Admin khỏi boot path bắt buộc.
2. Tách upstream MCP khỏi boot/session init path.
3. Giữ mọi optional subsystem lazy/off-by-default.
4. Giảm work ở slim session initialization.
5. Đo startup, reconnect, tools/list và first tool call trước/sau thay đổi.

### Phase B — retire subsystem không dùng

Chỉ sau khi Phase A ổn định:

1. retire Admin UI nếu không còn cần;
2. retire upstream MCP UI/config/import/OAuth/proxy/bridge nếu thực tế không dùng;
3. dọn `.env.example` và package metadata tương ứng;
4. xoá test chỉ dành riêng cho subsystem đã retire.

### Phase C — review compatibility debt riêng

Không thực hiện cùng cleanup connection/tool:

- Codex hooks;
- Ponytail;
- checkpoint/rewind;
- project memory/skills;
- Job Pack execution behavior;
- coding/planning assets.

Các phần này cần một quyết định riêng vì có thể được giữ hoặc được thay thế bởi hệ GPT Super Agent trong tương lai.

---

## 7. Gate trước khi xoá bất kỳ item nào

Mỗi deletion phải trả lời được đủ các câu sau:

1. Item có nằm trên normal GPT Web → local path không?
2. Có tool nào thực tế còn import/call item đó không?
3. Có startup/tray/setup/test nào phụ thuộc không?
4. Có config/state hiện tại nào chỉ được quản lý qua item đó không?
5. Có thể disable/lazy trước để quan sát một thời gian không?
6. Sau khi bỏ, Worker còn qua được:
   - startup;
   - health check;
   - tunnel readiness;
   - MCP initialize;
   - reconnect/stale-session recovery;
   - tools/list;
   - confirmed `work_tool` call;
   - filesystem;
   - shell;
   - git;
   - Windows tool khi enabled?

Nếu chưa trả lời chắc chắn, ưu tiên **detach/lazy/disable trước, delete sau**.

---

## 8. Definition of success

Cleanup thành công không được đánh giá bằng số file xoá.

Cleanup thành công khi:

- GPTWorker boot ít dependency hơn;
- GPT Web reconnect ổn định hơn hoặc ít nhất không kém đi;
- optional feature hỏng không làm Worker core hỏng;
- tool call không bị ảnh hưởng bởi subsystem không liên quan;
- startup/restart/health diagnosis rõ hơn;
- source boundary phản ánh đúng sản phẩm: **GPTWorker là stable bridge từ GPT Web tới local tools**, không phải một coding-agent framework bắt buộc phải giữ toàn bộ architecture cũ.

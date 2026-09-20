# GPTWorker v2 — Work Tool Lease Pilot Test

## Purpose

Đây là vertical slice đầu tiên trước khi refactor toàn bộ v2. Mục tiêu duy nhất là chứng minh live trên ChatGPT:

```text
Job + Workspace confirmed
→ WorkRegistration
→ work_handle
→ execution tool borrows ephemeral lease
→ tool executes in registered workspace call-context
→ lease released
→ runtime log proves the lifecycle
```

Pilot chưa chứng minh full v2 isolation cho persistent shell/process/REPL/upstream resources.

## Expected log events

Một activation thành công phải có:

```text
work_registered
```

Mỗi native execution tool call phải có cùng work identity:

```text
tool_lease_acquired
→ tool call
→ tool_lease_released
```

Các field cần kiểm:

- `work_id`
- `job_id`
- `workspace_key`
- `lease_id`
- `tool_family`
- `driver_epoch`
- `generation`
- `call_sequence`

`authority_token` không được xuất hiện raw trong runtime log.

## Live acceptance

1. Pull/build/start bản pilot.
2. Chat A: activate `dev-coding` với Workspace A và confirm.
3. Kiểm tra ACTIVE response có `work_handle.execution_id` + `work_handle.authority_token`.
4. Trong cùng Chat A gọi ít nhất 5 filesystem tools, ưu tiên `read_text_file`, `list_directory`, `glob`, `grep`.
5. Không gọi lại `job_select` giữa các tool calls. ChatGPT phải tự carry work handle.
6. Chat B: activate cùng Job `dev-coding` nhưng Workspace B.
7. Xen kẽ filesystem calls giữa Chat A và Chat B.
8. Verify log:
   - A giữ một `work_id`, B giữ một `work_id` khác;
   - mỗi lease của A luôn mang Workspace A;
   - mỗi lease của B luôn mang Workspace B;
   - call sequence tăng độc lập;
   - acquire/release ghép cặp cùng `lease_id`;
   - không có raw authority token.
9. Negative test: gọi execution tool không có/handle sai phải bị `NO_ACTIVE_WORK` và ghi `tool_lease_rejected`.
10. `job_stop` với đúng work handle phải ghi `work_released`; handle cũ sau đó bị reject.

## Pass criteria

Pilot PASS khi live log chứng minh được:

```text
2 chats
2 work handles
2 workspaces
same filesystem Tool Family
interleaved calls
no work-handle swap
no lease identity swap
no token leak
```

Nếu ChatGPT không carry được work handle qua các MCP calls, dừng P1 và sửa continuity contract trước khi refactor sâu hơn.

## Not part of this pilot

- 5-minute idle release cho stateful resource/Worker executor;
- persistent shell cwd isolation;
- process ownership;
- REPL ownership;
- upstream MCP resource ownership;
- Driver/Worker split;
- AppData Job migration.

Short-lived filesystem tool leases được release ngay khi call hoàn tất; không giữ chờ 5 phút.

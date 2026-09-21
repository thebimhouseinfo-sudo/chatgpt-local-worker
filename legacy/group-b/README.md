# Group B — Extract / Remap Then Quarantine Old

Nơi chứa **implementation cũ** sau khi phần behavior cần giữ đã được extract/remap sang owner mới trong active tree.

`legacy/group-b/` là cây riêng ở root repo, **không phải `src/`**.

Mapping:

```text
src/lib/old-module.ts
→ legacy/group-b/lib/old-module.ts
```

Không tạo `legacy/group-b/src/**`.

Workflow:

```text
extract useful behavior
→ remap callers
→ old runtime callers = 0
→ move old implementation ra khỏi active tree vào đây
→ build + behavior/integration test
```

Nếu test fail, dùng file quarantine làm reference hoặc restore thủ công để tìm phần remap còn thiếu.

File trong thư mục này không được import, compile hoặc chạy bởi GPTWorker.

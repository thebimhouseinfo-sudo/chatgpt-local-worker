# Group C — Rewrite Clean / Quarantine Old

Nơi chứa **implementation cũ đã được thay bằng implementation viết mới** theo target architecture.

`legacy/group-c/` là cây riêng ở root repo, **không phải `src/`**.

Mapping:

```text
src/tools/work-gateway.ts   # implementation cũ
→ legacy/group-c/tools/work-gateway.ts

src/tools/work-gateway.ts   # implementation mới
→ vẫn nằm trong active src/
```

Không tạo `legacy/group-c/src/**`.

Workflow:

```text
write clean replacement trong active tree
→ switch callers sang replacement
→ move old implementation vào đây
→ build + behavior/integration test
```

Nếu replacement thiếu behavior, file cũ ở đây là reference/rollback thủ công.

File trong thư mục này không được import, compile hoặc chạy bởi GPTWorker.

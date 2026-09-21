# Group A — Delete Directly / Quarantine

Nơi chứa **file cũ đã bị remove khỏi active runtime tree** vì không còn behavior cần giữ.

`legacy/group-a/` là cây riêng ở root repo, **không phải `src/`**.

Mapping:

```text
src/lib/example.ts
→ legacy/group-a/lib/example.ts

scripts/example.mjs
→ legacy/group-a/scripts/example.mjs
```

Không tạo `legacy/group-a/src/**`.

Workflow:

```text
detach caller/import/config
→ move old file ra khỏi active tree vào đây
→ build + isolation test + real Worker validation
→ restore thủ công nếu regression chứng minh scan còn thiếu dependency
```

File trong thư mục này không được import, compile hoặc chạy bởi GPTWorker.

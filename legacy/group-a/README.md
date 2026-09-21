# Group A — Delete Directly

Quarantine cho file/subsystem được đánh giá không còn behavior cần giữ.

Workflow:

```text
detach caller/import/config
→ move old file vào đây, giữ nguyên relative source path
→ build + test + real Worker validation
→ restore ngay nếu regression cho thấy scan còn thiếu dependency
```

Không import/runtime từ thư mục này.

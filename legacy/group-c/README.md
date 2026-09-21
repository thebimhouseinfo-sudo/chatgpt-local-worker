# Group C — Rewrite Clean

Quarantine cho implementation cũ sau khi đã có replacement viết mới theo target architecture.

Workflow:

```text
write clean replacement
→ switch callers
→ move old implementation vào đây
→ behavior + integration test
```

Nếu replacement thiếu behavior, old implementation ở đây là reference/rollback trực tiếp.

Không import/runtime từ thư mục này.

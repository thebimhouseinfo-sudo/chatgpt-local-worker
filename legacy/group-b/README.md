# Group B — Extract / Remap Then Retire Old

Quarantine cho old implementation sau khi phần behavior cần giữ đã được extract/remap sang owner mới.

Workflow:

```text
extract
→ remap callers
→ old runtime callers = 0
→ move old file vào đây
→ test
```

Nếu test fail, dùng file quarantine làm reference/restore để tìm phần remap còn thiếu.

Không import/runtime từ thư mục này.

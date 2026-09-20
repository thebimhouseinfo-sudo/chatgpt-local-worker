# GPTWorker v2 — Backlog

## Active Backlog

Các phần bắt buộc đã có task trong TASKS.md. Những chi tiết dưới đây cần kết quả spike để định nghĩa acceptance chính xác, không tự tạo additional scope:

- [ ] Chọn worker idle duration, session expiry, memory/CPU/wake budgets từ TASK-V2-002/007.
- [ ] Chốt retention cho staging/history/cache/checkpoints; luôn giữ revisions có active lease và transactions chưa recover.
- [ ] Chốt naming/branding GPTWorker v2 và migration wording, giữ connector/alias compatibility cần thiết.
- [ ] Chốt cơ chế export diagnostic bundle đã redaction cho support nội bộ; không thêm command người dùng nếu chưa cần.

## Deferred

- [ ] Windows Service; user-logon background process là hướng release đầu.
- [ ] Full YAML parser; v2.0 đề xuất JSON-compatible YAML.
- [ ] Resume active Job sau Driver restart hoặc reboot; yêu cầu hiện tại là session cũ mất authority.
- [ ] Public rollback/remove/enable/disable command; transaction recovery backend vẫn bắt buộc ở release đầu.
- [ ] Publish Job marketplace/package manager và auto-download dependency từ manifest.

## Optional / Future

- [ ] Immutable version directories làm canonical storage nếu Windows publish transaction ở layout hiện tại quá phức tạp; thay layout phải quay lại architecture review.
- [ ] OS-enforced execution isolation cho untrusted Job Packs; hiện tại pack/harness là trusted local code.
- [ ] Detach long-running managed processes khỏi Worker để tăng khả năng sleep; cần lifecycle owner mới rõ ràng.
- [ ] Signed application releases và broader distribution hardening nếu phạm vi chuyển từ dùng cá nhân sang phân phối rộng.

## Out of Scope

- Thay HVAC/MTO rules, template/source authority hoặc write boundary nghiệp vụ.
- Kernel driver, multi-agent hierarchy, multi-machine coordination.
- Đọc trực tiếp database nội bộ ChatGPT để đoán conversation identity.
- Chuyển conversation/job sang user khác hoặc tự restore task cũ bằng workspace gần nhất.
- Sửa runtime code chỉ để hoàn tất lượt review plan này.

<div align="center">

# GPTWorker

**Cho phép ChatGPT làm việc trực tiếp với file và project trên máy Windows của bạn.**

[English](README.en.md)

**Thiết kế bởi Nam Trịnh**

</div>

## Tải và cài đặt

**[Tải GPTWorker-Setup-1.1.1.exe](https://github.com/thebimhouseinfo-sudo/chatgpt-local-worker/releases/latest/download/GPTWorker-Setup-1.1.1.exe)**

Chạy file cài đặt và làm theo hướng dẫn trên màn hình. Bạn có thể tự chọn thư mục cài đặt.

GPTWorker sẽ tự xử lý các thành phần cần thiết như Node.js, Git tùy chọn, runtime dependencies, Secure MCP Tunnel và cấu hình chạy cùng Windows.

Cuối quá trình cài đặt, GPTWorker sẽ mở hướng dẫn kết nối với ChatGPT.

## Cách dùng

Sau khi cài xong, GPTWorker chạy ở Windows tray.

Trong ChatGPT:

```text
@gptworker
```

Hoặc giao việc ngay:

```text
@gptworker sửa lỗi đăng nhập
```

GPTWorker có 3 Job mặc định:

- **Dev Coding** — sửa code, debug, refactor, build và test.
- **Dev Planing** — đọc repo, review kiến trúc và lập kế hoạch.
- **Layla** — công việc tổng quát với file và tài liệu.

GPTWorker có thể tự chọn Job phù hợp, nhưng **không tự đoán thư mục làm việc**. Bạn phải tự cung cấp đường dẫn thư mục trước khi công việc bắt đầu.

## An toàn

Trước khi làm việc, GPTWorker luôn hiển thị:

```text
JOB: ...
FOLDER: ...
TASK: ...

Xác nhận bắt đầu?
```

Chỉ sau khi bạn xác nhận, GPTWorker mới được thao tác trong thư mục đã chọn.

Các thao tác file, shell và Git được giới hạn trong thư mục làm việc đã xác nhận.

## Lệnh nhanh

```text
gr/
gr/help
gr/job list
gr/job create
gr/job update
gr/job remove
gr/job export
gr/job import
gr/job stop
```

## Browser QA

Dev Coding có thể dùng Vercel `agent-browser` để kiểm tra web/app trên trình duyệt. Tính năng này là tùy chọn và chỉ được bật khi người dùng chọn cài.

## Phát triển

```powershell
npm ci
npm run build
npm run validate:jobs
npm test
```

Build bộ cài Windows:

```powershell
npm run release:windows
```

GitHub Actions cũng có workflow **Build Windows Installer** để tự tạo và publish file EXE.

## Giấy phép và ghi nhận

GPTWorker là một dự án độc lập. Giai đoạn đầu có tham khảo và tái sử dụng một số thành phần MIT từ `hoangcoderr/chatgpt-local-coder`.

Các thành phần kế thừa tiếp tục tuân theo giấy phép và ghi nhận gốc.

**GPTWorker — thiết kế bởi Nam Trịnh.**

MIT License.

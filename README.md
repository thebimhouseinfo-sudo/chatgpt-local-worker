<div align="center">

# GPTWorker

**Cho phép ChatGPT làm việc trực tiếp với file và project trên máy Windows của bạn.**

[English](README.en.md)

**Thiết kế bởi Nam Trịnh**

</div>

## Tải và cài đặt

**[Tải GPTWorker-Setup-1.1.2.exe](https://github.com/thebimhouseinfo-sudo/chatgpt-local-worker/releases/latest/download/GPTWorker-Setup-1.1.2.exe)**

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

### Log tự động

GPTWorker ghi hoạt động MCP, công cụ, phiên làm việc và khởi động/dừng vào `.mcp-activity.jsonl` trong thư mục Worker (`LOCAL_WORKER_HOME`, hoặc thư mục khởi động). Log chứa thời gian, mã yêu cầu/phiên/công việc khi có, trạng thái và dữ liệu chẩn đoán đã che các dạng thông tin bí mật được nhận diện. Trạng thái HTTP không luôn phản ánh kết quả nghiệp vụ của công cụ; hãy đối chiếu sự kiện thực thi công việc.

Ghi file chạy bất đồng bộ. Lỗi ghi log không được truyền vào thao tác đang chạy. Hàng đợi tối đa 1.000 bản ghi hoặc 4 MB; khi đầy, bản ghi mới bị bỏ để Worker tiếp tục hoạt động. Log là dữ liệu chẩn đoán có giới hạn, không bảo đảm lưu mọi sự kiện khi quá tải hoặc tiến trình bị tắt đột ngột.

Các biến môi trường tùy chọn:

- `ACTIVITY_LOG_PATH`: đường dẫn file log.
- `ACTIVITY_LOG_ROTATE_BYTES`: ngưỡng xoay file, mặc định 20 MB; giữ một file cũ với đuôi `.1`. File có thể vượt ngưỡng nếu một bản ghi riêng lẻ lớn hơn ngưỡng.
- `ACTIVITY_LOG_MAX_RECORD_BYTES`: giới hạn mỗi bản ghi, mặc định 32 KB, tối thiểu 256 byte. Bản ghi lớn được thay bằng thông báo rút gọn.
- `ACTIVITY_LOG_DISABLED=true`: tắt ghi file log.

### Kiểm tra và build

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

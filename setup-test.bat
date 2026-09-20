@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title GPTWorker - Xem thử quá trình cài đặt
color 0B

call :screen "GPTWorker - XEM THỬ QUÁ TRÌNH CÀI ĐẶT" "Dành cho người dùng phổ thông, không cần biết lập trình"

echo   Đây là chế độ XEM THỬ để bạn kiểm tra toàn bộ trải nghiệm cài đặt.
echo.
echo   Bạn KHÔNG cần Tunnel thật và KHÔNG cần API key thật.
echo   Ở hai ô nhập Tunnel ID và API key, chỉ cần gõ bất kỳ chữ nào,
echo   ví dụ: demo
echo.
echo   Chế độ này:
echo     - không kiểm tra giá trị bạn nhập có đúng hay không
echo     - không lưu Tunnel ID hoặc API key thử
echo     - không thay thế kết nối GPTWorker hiện tại
echo.
echo   Khi chạy setup.bat thật, GPTWorker mới kiểm tra và lưu thông tin thật.
echo.
pause

call :screen "BƯỚC 1 / 4" "Kiểm tra máy tính"

echo   GPTWorker cần 2 chương trình nền là Node.js và Git.
echo   Bạn không cần biết cách dùng chúng; GPTWorker chỉ kiểm tra xem
echo   máy đã có sẵn hay chưa.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [THIẾU] Máy chưa có Node.js hoặc Windows chưa nhận ra Node.js.
  echo.
  echo   Hãy cài Node.js 18 trở lên, sau đó chạy lại setup-test.bat.
  goto :failed
)
for /f "tokens=*" %%V in ('node --version') do echo   [ĐÃ CÓ] Node.js %%V

where git >nul 2>nul
if errorlevel 1 (
  echo   [THIẾU] Máy chưa có Git hoặc Windows chưa nhận ra Git.
  echo.
  echo   Hãy cài Git for Windows, sau đó chạy lại setup-test.bat.
  goto :failed
)
for /f "tokens=*" %%V in ('git --version') do echo   [ĐÃ CÓ] %%V

echo.
echo   [OK] Máy đã có đủ chương trình cần thiết.
echo.
pause

call :screen "BƯỚC 2 / 4" "Chuẩn bị GPTWorker"

echo   Bước này GPTWorker tự làm. Bạn chỉ cần chờ.
echo   Có thể mất vài phút ở lần chạy đầu tiên.
echo.

echo   [1/4] Tải các thành phần cần thiết...
call npm install
if errorlevel 1 goto :failed

echo.
echo   [2/4] Chuẩn bị chương trình...
call npm run build
if errorlevel 1 goto :failed

echo.
echo   [3/4] Kiểm tra các Job có hợp lệ không...
call npm run validate:jobs
if errorlevel 1 goto :failed

echo.
echo   [4/4] Chạy kiểm tra an toàn...
call npm test
if errorlevel 1 goto :failed

echo.
echo   [OK] GPTWorker đã vượt qua các bước kiểm tra.
echo.
pause

call :screen "BƯỚC 3 / 4" "Tạo Tunnel và API key"

echo   Ở bước này trình duyệt sẽ mở trang OpenAI cho bạn.
echo   Hãy làm lần lượt theo hướng dẫn trên màn hình.
echo.
echo   PHẦN A - TẠO TUNNEL
echo.
echo     1. Mở trang OpenAI Platform - Tunnels.
echo     2. Nếu có phần quyền Tunnels, cần bật:
echo          Read
echo          Use
echo.
echo        Read = cho phép GPTWorker nhìn thấy Tunnel.
echo        Use  = cho phép GPTWorker thật sự sử dụng Tunnel.
echo.
echo        Nếu tài khoản của bạn là người trực tiếp tạo hoặc sửa Tunnel,
echo        cần có thêm quyền Manage.
echo.
echo     3. Tạo Tunnel mới.
echo     4. Nên đặt tên dễ nhận ra, ví dụ: gptworker.
echo     5. Nếu có mục chọn ChatGPT workspace, chọn đúng workspace
echo        mà bạn sẽ dùng GPTWorker.
echo     6. Bấm Create hoặc Save.
echo     7. Sau khi tạo xong, copy Tunnel ID.
echo        Tunnel ID thật thường có dạng: tunnel_...
echo.
echo   PHẦN B - TẠO API KEY CHO GPTWORKER
echo.
echo     1. Mở trang OpenAI Platform - API Keys.
echo     2. Bấm Create new secret key.
echo     3. Nên đặt tên: gptworker-runtime.
echo     4. Ở Permissions, chọn Restricted.
echo     5. Tìm mục Tunnels và bật CẢ HAI quyền:
echo          Read
echo          Use
echo.
echo     6. KHÔNG chọn Read Only vì thiếu quyền Use.
echo     7. KHÔNG cần cấp All cho toàn bộ API key.
echo        Chỉ cần Tunnels: Read + Use.
echo     8. Tạo key rồi copy ngay khi OpenAI hiển thị.
echo        API key thật thường bắt đầu bằng: sk-
echo.
echo   LƯU Ý CHO CHẾ ĐỘ XEM THỬ:
echo     - khi được hỏi Tunnel ID, gõ bất kỳ chữ nào, ví dụ demo
echo     - khi được hỏi API key, gõ bất kỳ chữ nào, ví dụ demo
echo     - dữ liệu thử sẽ KHÔNG được lưu
echo.
pause

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0openai-tunnel.ps1" -Init -WizardPreview
if errorlevel 1 goto :failed

echo.
echo   [OK] Bạn đã đi hết phần tạo Tunnel và API key thử.
echo.
pause

call :screen "BƯỚC 4 / 4" "Kết nối GPTWorker với ChatGPT"

if not exist ".env" (
  echo   Máy này chưa có kết nối GPTWorker thật được lưu.
  echo.
  echo   Không sao: phần XEM THỬ Tunnel và API key đã hoàn thành.
  echo   Vì dữ liệu thử không được lưu nên bước khởi động kết nối thật
  echo   sẽ được bỏ qua.
  echo.
  echo   Khi muốn cài thật, hãy chạy setup.bat.
  echo.
  goto :wizard_done
)

echo   Máy đã có kết nối GPTWorker thật từ trước.
echo   Setup-test sẽ dùng kết nối CŨ này để kiểm tra phần cuối.
echo.

echo   [1/3] Đăng ký GPTWorker tự chạy cùng Windows...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gptworker-tray.ps1" -InstallStartup
if errorlevel 1 goto :failed

echo.
echo   [2/3] Khởi động GPTWorker bằng kết nối đã lưu...
call "%~dp0run.bat"
if errorlevel 1 goto :failed

echo.
echo   [3/3] Mở ChatGPT Settings và hướng dẫn bằng hình...
start "" "https://chatgpt.com/#settings/Plugins"
start "" "%~dp0docs\setup-guide\index.html"

echo.
echo   [OK] GPTWorker đang chạy.
echo.
echo   Trong ChatGPT, làm lần lượt:
echo.
echo     1. Vào Settings.
echo     2. Mở Plugins và bật Developer mode.
echo     3. Mở trang Plugins rồi bấm dấu + để tạo plugin mới.
echo     4. Name: gptworker
echo     5. Connection: chọn Tunnel.
echo        KHÔNG chọn Server URL.
echo     6. Ở Available tunnels, chọn Tunnel của GPTWorker.
echo     7. Authentication: chọn No Auth.
echo     8. KHÔNG dùng Use tunnel ID instead.
echo     9. Tick ô xác nhận rồi bấm Connect hoặc Create.
echo    10. Restart Windows để kiểm tra GPTWorker tự khởi động.
echo    11. Sau khi Windows mở lại, vào ChatGPT và gõ @gptworker.
echo.
echo   Trang hướng dẫn bằng hình đã được mở để bạn đối chiếu từng bước.
echo.

:wizard_done
call :screen "HOÀN TẤT XEM THỬ" "Bạn đã đi hết luồng cài đặt GPTWorker"

echo   [OK] Kiểm tra máy tính
echo   [OK] Chuẩn bị và kiểm tra GPTWorker
echo   [OK] Hướng dẫn tạo Tunnel
echo   [OK] Hướng dẫn tạo API key
echo   [OK] Kiểm tra phần kết nối ChatGPT nếu máy đã có .env
echo.
echo   Tunnel ID và API key thử KHÔNG được lưu.
echo   Kết nối hiện tại của bạn KHÔNG bị thay thế.
echo.
echo   Khi đã sẵn sàng cài thật, chạy setup.bat.
echo.
pause
exit /b 0

:failed
call :screen "KHÔNG THỂ TIẾP TỤC" "Một bước kiểm tra chưa hoàn thành"

echo   Xem thông báo ngay phía trên để biết bước nào chưa đạt.
echo.
echo   Dữ liệu Tunnel/API thử không được ghi vào .env.
echo   Sau khi sửa lỗi, chạy lại setup-test.bat.
echo.
pause
exit /b 1

:screen
cls
echo.
echo ================================================================
echo   %~1
echo   %~2
echo ================================================================
echo.
exit /b 0

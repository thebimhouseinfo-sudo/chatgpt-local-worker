@echo off
setlocal
cd /d "%~dp0"
title GPTWorker Setup Wizard Preview
color 0B

call :screen "GPTWorker Setup Wizard Preview" "Ban co the thu toan bo giao dien ma khong can API/Tunnel that"

echo   [CHE DO THU GIAO DIEN]
echo.
echo   File nay dung de xem va kiem tra trai nghiem cai dat truoc.
echo   Ban KHONG can biet lap trinh va KHONG can co credential that.
echo.
echo   O 2 buoc nhap Tunnel ID va API key:
echo     - chi can go bat ky chu nao, vi du: demo
echo     - setup-test se cho qua man hinh
echo     - gia tri do KHONG duoc luu
echo     - ket noi hien tai cua ban KHONG bi thay the
echo.
echo   Khi chay setup.bat that, GPTWorker moi kiem tra Tunnel ID/API key that.
echo.
pause

call :screen "STEP 1 / 4" "Check this computer"

echo   Checking required software...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [FAIL] Node.js is not installed or not in PATH.
  echo          Install Node.js 18+ and run setup-test.bat again.
  goto :failed
)
for /f "tokens=*" %%V in ('node --version') do echo   [ OK ] Node.js %%V

where git >nul 2>nul
if errorlevel 1 (
  echo   [FAIL] Git is not installed or not in PATH.
  echo          Install Git for Windows and run setup-test.bat again.
  goto :failed
)
for /f "tokens=*" %%V in ('git --version') do echo   [ OK ] %%V

echo.
echo   This computer is ready for GPTWorker.
echo.
pause

call :screen "STEP 2 / 4" "Install, build and validate GPTWorker"

echo   [1/4] Installing dependencies...
call npm install
if errorlevel 1 goto :failed

echo.
echo   [2/4] Building source...
call npm run build
if errorlevel 1 goto :failed

echo.
echo   [3/4] Validating Job Packs...
call npm run validate:jobs
if errorlevel 1 goto :failed

echo.
echo   [4/4] Running tests...
call npm test
if errorlevel 1 goto :failed

echo.
echo   [ OK ] Source build and validation passed.
echo.
pause

call :screen "STEP 3 / 4" "Thu man hinh tao Tunnel va API key"

echo   Ban se thay 2 man hinh huong dan:
echo.
echo     1. TAO TUNNEL
echo        - vao OpenAI Platform -> Organization -> Tunnels
echo        - neu co muc quyen, bat Tunnels: Read + Use
echo        - neu ban tu tao/sua Tunnel, bat them Manage
echo        - chon dung ChatGPT workspace se dung GPTWorker
echo        - tao xong thi copy Tunnel ID
echo.
echo     2. TAO API KEY
echo        - bam Create new secret key
echo        - tai Permissions chon Restricted
echo        - tim muc Tunnels va bat CA HAI: Read + Use
echo        - KHONG dung Read Only
echo        - KHONG can bat All cho toan bo API key
echo        - tao xong thi copy key ngay
echo.
echo   Day chi la CHE DO THU GIAO DIEN.
echo   O moi o nhap, go bat ky chu nao de di tiep. Vi du: demo
echo   Gia tri ban go KHONG duoc kiem tra va KHONG duoc luu.
echo.
pause

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0openai-tunnel.ps1" -Init -WizardPreview
if errorlevel 1 goto :failed

echo.
echo   [ OK ] Connection wizard preview completed.
echo.
pause

call :screen "STEP 4 / 4" "Start GPTWorker and finish in ChatGPT"

if not exist ".env" (
  echo   No existing .env was found.
  echo.
  echo   The setup UX preview completed successfully.
  echo   Because preview credentials are intentionally not saved,
  echo   there is no real connection to launch at this final step.
  echo.
  echo   Run setup.bat when you are ready for the real installation.
  echo.
  goto :wizard_done
)

echo   [1/3] Registering GPTWorker startup entry...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gptworker-tray.ps1" -InstallStartup
if errorlevel 1 goto :failed

echo.
echo   [2/3] Starting tray/runtime with the EXISTING saved .env...
call "%~dp0run.bat"
if errorlevel 1 goto :failed

echo.
echo   [3/3] Opening ChatGPT Settings and local visual guide...
start "" "https://chatgpt.com/#settings/Plugins"
start "" "%~dp0docs\setup-guide\index.html"

echo.
echo   [ OK ] GPTWorker tray, Worker and Secure MCP Tunnel are ready.
echo.
echo   Finish onboarding in the browser:
echo.
echo     1. Enable Developer mode.
echo     2. Open Plugins and click +.
echo     3. Name = gptworker.
echo     4. Connection = Tunnel.
echo     5. Choose GPTWorker from Available tunnels.
echo     6. Authentication = No Auth.
echo     7. Connect/Create, then restart Windows.
echo     8. Open ChatGPT and type @gptworker.
echo.
echo   Restarting Windows is the final auto-start test.
echo.

:wizard_done
call :screen "PREVIEW COMPLETE" "Ban da di het luong cai dat thu"

echo   [ OK ] Kiem tra may
echo   [ OK ] Build va test
echo   [ OK ] Man hinh Tunnel
echo   [ OK ] Man hinh API key
echo.
echo   Du lieu thu KHONG duoc luu.
echo   Ket noi hien tai cua ban KHONG bi thay the.
echo.
pause
exit /b 0

:failed
call :screen "PREVIEW FAILED" "A setup-test step could not complete"

echo   Review the error shown above.
echo   No preview credential was written to .env.
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

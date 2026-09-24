@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title GPTWorker - Tam go cai dat

echo.
echo ╔══════════════════════════════════════════════════════════════════════╗
echo ║                 GPTWorker - TAM GO CAI DAT                         ║
echo ╠══════════════════════════════════════════════════════════════════════╣
echo ║  Se tat GPTWorker, go khoi Windows auto-start va an tray icon.     ║
echo ║  KHONG xoa file, cau hinh, Jobs, Tunnel/API hay node_modules.      ║
echo ╚══════════════════════════════════════════════════════════════════════╝
echo.
echo  Sau thao tac nay, ban co the test GPTWorker-Setup.exe nhu mot ban cai moi.
echo.

set /p "ANSWER=  Tiep tuc? [Y/N]: "
if /I not "%ANSWER%"=="Y" (
  echo.
  echo   Da huy. Khong co thay doi nao duoc thuc hien.
  echo.
  pause
  exit /b 0
)

echo.
echo ┌─ 1/3  Go GPTWorker khoi Windows auto-start
echo └──────────────────────────────────────────────────────────────────────

powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "$key='HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'; " ^
  "Remove-ItemProperty -Path $key -Name 'GPTWorker' -ErrorAction SilentlyContinue; " ^
  "Write-Host '  [OK] Windows auto-start da duoc go.' -ForegroundColor Green"

if errorlevel 1 goto :fail

echo.
echo ┌─ 2/3  Tat tray icon, Worker va Secure MCP Tunnel
echo └──────────────────────────────────────────────────────────────────────

if exist "%~dp0reset-runtime.ps1" (
  powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0reset-runtime.ps1"
  if errorlevel 1 goto :fail
) else (
  echo   [!] Khong tim thay reset-runtime.ps1.
  echo   Dang thu dung GPTWorker theo dau hieu runtime...
  powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference='Stop'; " ^
    "$ready=Join-Path $env:LOCALAPPDATA 'GPTWorker\tray-ready.json'; " ^
    "$tray=Get-CimInstance Win32_Process -ErrorAction SilentlyContinue ^| Where-Object { ($_.Name -ieq 'powershell.exe' -or $_.Name -ieq 'pwsh.exe') -and $_.CommandLine -and $_.CommandLine -match 'gptworker-tray\.ps1' }; " ^
    "foreach($p in $tray){ Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }; " ^
    "Remove-Item $ready -Force -ErrorAction SilentlyContinue; " ^
    "Write-Host '  [OK] Tray host da duoc dung.' -ForegroundColor Green"
  if errorlevel 1 goto :fail
)

echo.
echo ┌─ 3/3  Kiem tra che do tam go
echo └──────────────────────────────────────────────────────────────────────

powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "$key='HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'; " ^
  "$startup=Get-ItemProperty -Path $key -Name 'GPTWorker' -ErrorAction SilentlyContinue; " ^
  "$ready=Join-Path $env:LOCALAPPDATA 'GPTWorker\tray-ready.json'; " ^
  "if($startup){ Write-Host '  [!] Auto-start van con.' -ForegroundColor Yellow; exit 2 }; " ^
  "if(Test-Path $ready){ Write-Host '  [!] Tray-ready marker van con.' -ForegroundColor Yellow; exit 3 }; " ^
  "Write-Host '  [OK] GPTWorker dang o che do tam go.' -ForegroundColor Green"

if errorlevel 1 goto :fail

echo.
echo ╔══════════════════════════════════════════════════════════════════════╗
echo ║                         HOAN TAT                                    ║
echo ╠══════════════════════════════════════════════════════════════════════╣
echo ║  - Windows auto-start: OFF                                         ║
echo ║  - Tray icon/runtime:   OFF                                        ║
echo ║  - File va cau hinh:    GIU NGUYEN                                 ║
echo ╚══════════════════════════════════════════════════════════════════════╝
echo.
echo  Bay gio co the chay GPTWorker-Setup.exe de test.
echo  Muon dung lai ban cu: chay setup.bat hoac cai lai startup.
echo.
pause
exit /b 0

:fail
echo.
echo ╔══════════════════════════════════════════════════════════════════════╗
echo ║                         THAT BAI                                    ║
echo ╚══════════════════════════════════════════════════════════════════════╝
echo.
echo  Khong xoa file nao. Hay xem loi o tren truoc khi tiep tuc test EXE.
echo.
pause
exit /b 1

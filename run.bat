@echo off
setlocal
cd /d "%~dp0"
title GPTWorker Source Launcher

echo.
echo ========================================
echo   GPTWorker - Source tray runtime
echo ========================================
echo.

if not exist ".env" (
  echo [ERROR] GPTWorker is not set up yet.
  echo Run setup.bat first.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not in PATH.
  pause
  exit /b 1
)

echo Building current source...
call npm run build
if errorlevel 1 (
  echo [ERROR] Build failed.
  pause
  exit /b 1
)

set "WORKER_PORT=3000"
for /f "tokens=2 delims==" %%A in ('findstr /B /C:"PORT=" ".env"') do set "WORKER_PORT=%%A"
set "TUNNEL_HEALTH_PORT=8080"
for /f "tokens=2 delims==" %%A in ('findstr /B /C:"OPENAI_TUNNEL_HEALTH_PORT=" ".env"') do set "TUNNEL_HEALTH_PORT=%%A"

echo Resetting previous GPTWorker tray / Worker / Tunnel...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0reset-runtime.ps1" -WorkerPort %WORKER_PORT% -TunnelHealthPort %TUNNEL_HEALTH_PORT%
if errorlevel 1 (
  echo.
  echo [ERROR] Could not reset previous GPTWorker runtime safely.
  pause
  exit /b 1
)

del /q "%LOCALAPPDATA%\GPTWorker\tray-ready.json" >nul 2>nul

echo Starting GPTWorker tray host...
start "" powershell -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0gptworker-tray.ps1"

echo Waiting for tray host...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0wait-tray-ready.ps1" -TimeoutSeconds 10
if errorlevel 1 (
  echo.
  echo [ERROR] GPTWorker tray host failed to start.
  echo Error log:
  echo   %LOCALAPPDATA%\GPTWorker\logs\tray.err.log
  echo.
  powershell -NoProfile -Command "$p=Join-Path $env:LOCALAPPDATA 'GPTWorker\logs\tray.err.log'; if(Test-Path $p){ Get-Content $p -Tail 30 } else { Write-Host 'No tray.err.log was written.' }"
  echo.
  pause
  exit /b 1
)

echo.
echo [OK] GPTWorker tray host is running.
echo Worker + Secure MCP Tunnel are starting behind the tray.
echo Right-click the tray icon for Status / Open setup guide / Restart / Exit.
echo.
exit /b 0

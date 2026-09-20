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

echo Starting GPTWorker tray host...
start "" powershell -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0gptworker-tray.ps1"

echo.
echo [OK] Launch requested.
echo Look for the GPTWorker icon in the Windows system tray.
echo The tray host starts/adopts the local Worker + Secure MCP Tunnel.
echo.
exit /b 0

@echo off
setlocal
cd /d "%~dp0"
title GPTWorker Launcher

echo.
echo ========================================
echo   Starting GPTWorker
echo ========================================
echo.

if not exist ".env" (
  echo [ERROR] GPTWorker is not set up yet.
  echo Run setup.bat first.
  pause
  exit /b 1
)

if not exist "worker-state.json" (
  >"worker-state.json" echo {
  >>"worker-state.json" echo   "current_job": null,
  >>"worker-state.json" echo   "active_workspace": null,
  >>"worker-state.json" echo   "status": "idle",
  >>"worker-state.json" echo   "updated_at": null
  >>"worker-state.json" echo }
)

start "GPTWorker Server" /min powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0start.ps1" -Force

echo Waiting for local Worker...
powershell -NoProfile -Command "$ok=$false; foreach ($i in 1..20) { try { $r=Invoke-WebRequest 'http://127.0.0.1:3000/health' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { $ok=$true; break } } catch {}; Start-Sleep -Milliseconds 500 }; if (-not $ok) { exit 1 }"
if errorlevel 1 (
  echo [ERROR] Local Worker did not become ready.
  echo Check the GPTWorker Server window.
  pause
  exit /b 1
)

start "GPTWorker Tunnel" /min powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0openai-tunnel.ps1"

echo.
echo [OK] GPTWorker started.
echo Open ChatGPT and use: @gptworker
echo.
echo GPTWorker will resolve JOB + local FOLDER from the chat and ask for confirmation before working.
echo.
exit /b 0

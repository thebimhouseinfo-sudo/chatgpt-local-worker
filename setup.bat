@echo off
setlocal
cd /d "%~dp0"
title GPTWorker Setup

echo.
echo ========================================
echo   GPTWorker - One-time setup
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not in PATH.
  echo Install Node.js 18+ and run setup.bat again.
  pause
  exit /b 1
)

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git is not installed or not in PATH.
  echo Install Git for Windows and run setup.bat again.
  pause
  exit /b 1
)

if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo [OK] Created .env
)

if not exist "worker-state.json" (
  >"worker-state.json" echo {
  >>"worker-state.json" echo   "current_job": null,
  >>"worker-state.json" echo   "active_workspace": null,
  >>"worker-state.json" echo   "status": "idle",
  >>"worker-state.json" echo   "updated_at": null
  >>"worker-state.json" echo }
  echo [OK] Created worker-state.json
)

echo.
echo [1/4] Installing dependencies...
call npm install
if errorlevel 1 goto :failed

echo.
echo [2/4] Building...
call npm run build
if errorlevel 1 goto :failed

echo.
echo [3/4] Validating jobs...
call npm run validate:jobs
if errorlevel 1 goto :failed

echo.
echo [4/4] Running tests...
call npm test
if errorlevel 1 goto :failed

echo.
echo ========================================
echo   OpenAI Secure MCP Tunnel setup
echo ========================================
echo This is the only connection setup step.
echo Follow the prompts, then create the ChatGPT connection named: gptworker

echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0openai-tunnel.ps1" -Init
if errorlevel 1 goto :failed

echo.
echo Opening ChatGPT connector settings...
start "" "https://chatgpt.com/#settings/Connectors"

echo.
echo ========================================
echo   Setup complete
echo ========================================
echo Next time, only run: run.bat
echo Then use @gptworker in ChatGPT.
echo.
pause
exit /b 0

:failed
echo.
echo [ERROR] Setup failed. See the output above.
pause
exit /b 1

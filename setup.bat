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
echo   Starting local GPTWorker
echo ========================================

set "WORKER_PORT=3000"
for /f "tokens=2 delims==" %%A in ('findstr /B /C:"PORT=" ".env"') do set "WORKER_PORT=%%A"

start "GPTWorker Server" /min powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0start.ps1" -Port %WORKER_PORT% -Force

echo Waiting for local Worker on port %WORKER_PORT%...
powershell -NoProfile -Command "$ok=$false; foreach ($i in 1..30) { try { $r=Invoke-WebRequest 'http://127.0.0.1:%WORKER_PORT%/health' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { $ok=$true; break } } catch {}; Start-Sleep -Milliseconds 500 }; if (-not $ok) { exit 1 }"
if errorlevel 1 (
  echo [ERROR] Local Worker did not become ready before tunnel doctor.
  echo Check the GPTWorker Server window.
  goto :failed
)

echo [OK] Local Worker is ready.

echo.
echo ========================================
echo   OpenAI Secure MCP Tunnel setup
echo ========================================
echo The local Worker is running, so tunnel doctor can validate the MCP target.
echo Follow the prompts. The ChatGPT connection should be named: gptworker

echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0openai-tunnel.ps1" -Init
if errorlevel 1 goto :failed

set "TUNNEL_HEALTH_PORT=8080"
for /f "tokens=2 delims==" %%A in ('findstr /B /C:"OPENAI_TUNNEL_HEALTH_PORT=" ".env"') do set "TUNNEL_HEALTH_PORT=%%A"

echo.
echo Starting Secure MCP Tunnel...
start "GPTWorker Tunnel" /min powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0openai-tunnel.ps1" -Port %WORKER_PORT%

echo Waiting for tunnel readiness on port %TUNNEL_HEALTH_PORT%...
powershell -NoProfile -Command "$ok=$false; foreach ($i in 1..40) { try { $r=Invoke-WebRequest 'http://127.0.0.1:%TUNNEL_HEALTH_PORT%/readyz' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { $ok=$true; break } } catch {}; Start-Sleep -Milliseconds 500 }; if (-not $ok) { exit 1 }"
if errorlevel 1 (
  echo [ERROR] Secure MCP Tunnel did not become ready.
  echo Check the GPTWorker Tunnel window.
  goto :failed
)

echo [OK] GPTWorker and Secure MCP Tunnel are ready.

echo.
echo Opening ChatGPT app/connector settings...
start "" "https://chatgpt.com/#settings/Connectors"

echo.
echo In ChatGPT:
echo   1. Enable Developer Mode if the UI asks for it.
echo   2. Apps / Create -> Connection: Tunnel.
echo   3. Select your tunnel or paste the tunnel ID.
echo   4. Scan Tools / Test connection.
echo   5. Name the app: gptworker
echo.
echo Do NOT enter http://127.0.0.1:3000/mcp into ChatGPT.
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

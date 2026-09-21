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
echo   Resetting previous GPTWorker runtime
echo ========================================

set "WORKER_PORT=3000"
for /f "tokens=2 delims==" %%A in ('findstr /B /C:"PORT=" ".env"') do set "WORKER_PORT=%%A"
set "TUNNEL_HEALTH_PORT=8080"
for /f "tokens=2 delims==" %%A in ('findstr /B /C:"OPENAI_TUNNEL_HEALTH_PORT=" ".env"') do set "TUNNEL_HEALTH_PORT=%%A"

echo Clearing old tray / Worker / Tunnel...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0reset-runtime.ps1" -WorkerPort %WORKER_PORT% -TunnelHealthPort %TUNNEL_HEALTH_PORT%
if errorlevel 1 goto :failed

echo.
echo ========================================
echo   Starting local GPTWorker
echo ========================================

echo Starting Worker in background with logs...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-worker-background.ps1" -Port %WORKER_PORT% -Force
if errorlevel 1 goto :failed

echo Waiting for local Worker on port %WORKER_PORT%...
powershell -NoProfile -Command "$ok=$false; foreach ($i in 1..30) { try { $r=Invoke-WebRequest 'http://127.0.0.1:%WORKER_PORT%/health' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { $ok=$true; break } } catch {}; Start-Sleep -Milliseconds 500 }; if (-not $ok) { exit 1 }"
if errorlevel 1 (
  echo [ERROR] Local Worker did not become ready before tunnel doctor.
  echo Check whether port %WORKER_PORT% is occupied and rerun setup.bat.
  goto :failed
)

echo [OK] Local Worker is ready.

echo.
echo ========================================
echo   OpenAI Secure MCP Tunnel setup
echo ========================================
echo The local Worker is running, so tunnel doctor can validate the MCP target.
echo.
echo GPTWorker will guide the connection setup one step at a time.
echo Each OpenAI page will open automatically exactly when its value is needed.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0openai-tunnel.ps1" -Init -Force -Port %WORKER_PORT% -HealthPort %TUNNEL_HEALTH_PORT%
if errorlevel 1 goto :failed

echo.
echo Verifying local Worker again before starting the tunnel...
powershell -NoProfile -Command "try{$w=Invoke-RestMethod 'http://127.0.0.1:%WORKER_PORT%/health' -TimeoutSec 2; if($w.name -ne 'chatgpt-local-worker'){exit 1}}catch{exit 1}"
if errorlevel 1 (
  echo [ERROR] Local Worker stopped after tunnel doctor.
  echo Check: %LOCALAPPDATA%\GPTWorker\logs\worker.err.log
  goto :failed
)

echo Starting Secure MCP Tunnel...
start "" powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0openai-tunnel.ps1" -Port %WORKER_PORT% -HealthPort %TUNNEL_HEALTH_PORT% -Force

echo Waiting for tunnel readiness on port %TUNNEL_HEALTH_PORT%...
powershell -NoProfile -Command "$ok=$false; foreach ($i in 1..120) { try { $r=Invoke-WebRequest 'http://127.0.0.1:%TUNNEL_HEALTH_PORT%/readyz' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { $ok=$true; break } } catch {}; Start-Sleep -Milliseconds 500 }; if (-not $ok) { exit 1 }"
if errorlevel 1 (
  echo.
  echo [ERROR] Secure MCP Tunnel is live or starting but did not become ready within 60 seconds.
  echo Printing tunnel health diagnostics...
  powershell -NoProfile -Command "$urls=@('http://127.0.0.1:%TUNNEL_HEALTH_PORT%/healthz','http://127.0.0.1:%TUNNEL_HEALTH_PORT%/readyz','http://127.0.0.1:%TUNNEL_HEALTH_PORT%/health/control-plane','http://127.0.0.1:%TUNNEL_HEALTH_PORT%/health/mcp','http://127.0.0.1:%TUNNEL_HEALTH_PORT%/health/oauth','http://127.0.0.1:%TUNNEL_HEALTH_PORT%/health?details=true'); foreach($u in $urls){ Write-Host ''; Write-Host ('--- '+$u+' ---') -ForegroundColor Cyan; try { $r=Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 3; Write-Host ('HTTP '+[int]$r.StatusCode); Write-Host $r.Content } catch { if ($_.Exception.Response) { try { Write-Host ('HTTP '+[int]$_.Exception.Response.StatusCode.value__); } catch {} }; if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message } else { Write-Host $_.Exception.Message } } }"
  echo.
  echo Keep the GPTWorker Tunnel window open; the diagnostics above identify the failing component.
  goto :failed
)

echo [OK] GPTWorker and Secure MCP Tunnel are ready.

echo.
echo Registering GPTWorker tray app for this Windows user...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gptworker-tray.ps1" -InstallStartup
if errorlevel 1 goto :failed

echo Replacing any existing GPTWorker tray host...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0reset-runtime.ps1" -WorkerPort %WORKER_PORT% -TunnelHealthPort %TUNNEL_HEALTH_PORT%
if errorlevel 1 goto :failed

del /q "%LOCALAPPDATA%\GPTWorker\tray-ready.json" >nul 2>nul

echo Starting GPTWorker tray host...
wscript "%~dp0gptworker-tray.vbs"

echo Waiting for tray host...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0wait-tray-ready.ps1" -TimeoutSeconds 10
if errorlevel 1 (
  echo [ERROR] GPTWorker tray host failed to start.
  echo See: %LOCALAPPDATA%\GPTWorker\logs\tray.err.log
  goto :failed
)
echo [OK] GPTWorker tray host is visible.

echo Waiting for tray-managed Worker + Secure MCP Tunnel...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0wait-runtime-ready.ps1" -WorkerPort %WORKER_PORT% -TunnelHealthPort %TUNNEL_HEALTH_PORT% -TimeoutSeconds 75
if errorlevel 1 (
  echo [ERROR] Tray started but GPTWorker runtime did not become ready.
  goto :failed
)
echo [OK] GPTWorker tray runtime is connected.

echo.
echo Opening ChatGPT Settings and the local visual setup guide...
start "" "https://chatgpt.com/#settings/Plugins"
start "" "%~dp0docs\setup-guide\index.html"

echo.
echo Follow the visual guide that just opened:
echo   1. Images 1 + 2: open Plugins settings and enable Developer mode.
echo   2. Image 3: open Plugins and click + to create a new plugin.
echo   3. Image 4: Name=gptworker, Connection=Tunnel, select the Tunnel from the list, Authentication=No Auth.
echo   4. Do NOT enter a Server URL and do NOT use "Use tunnel ID instead".
echo   5. Image 5: after Connect/Create, restart Windows.
echo   6. After Windows starts again, open ChatGPT and type @gptworker.
echo   7. Then type gr/help (or gptworker/help) and read the usage guide before the first job.
echo.
echo The guide images live in docs\setup-guide\images\.
echo.
echo ========================================
echo   Setup complete
echo ========================================
echo GPTWorker is now registered to start automatically with this Windows user.
echo Complete the visual guide, then RESTART WINDOWS to verify auto-start.
echo After Windows starts again, open ChatGPT and type @gptworker.
echo Then type gr/help (or gptworker/help) and read the usage guide before the first job.
echo run.bat remains available only as a source-build fallback/manual restart.
echo.
pause
exit /b 0

:failed
echo.
echo [ERROR] Setup failed. See the output above.
echo.
echo Attempting to restore GPTWorker background runtime from the saved .env...
findstr /B /C:"OPENAI_TUNNEL_ID=tunnel_" ".env" >nul 2>nul
if not errorlevel 1 (
  findstr /B /C:"OPENAI_TUNNEL_API_KEY=sk-" ".env" >nul 2>nul
  if not errorlevel 1 (
    wscript "%~dp0gptworker-tray.vbs"
    echo Recovery tray launch requested.
  )
)
echo.
echo Worker log: %LOCALAPPDATA%\GPTWorker\logs\worker.err.log
echo Tray log:   %LOCALAPPDATA%\GPTWorker\logs\tray.err.log
pause
exit /b 1

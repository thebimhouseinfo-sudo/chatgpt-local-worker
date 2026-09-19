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

set "WORKER_PORT=3000"
for /f "tokens=2 delims==" %%A in ('findstr /B /C:"PORT=" ".env"') do set "WORKER_PORT=%%A"

start "GPTWorker Server" /min powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0start.ps1" -Port %WORKER_PORT% -Force

echo Waiting for local Worker on port %WORKER_PORT%...
powershell -NoProfile -Command "$ok=$false; foreach ($i in 1..20) { try { $r=Invoke-WebRequest 'http://127.0.0.1:%WORKER_PORT%/health' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { $ok=$true; break } } catch {}; Start-Sleep -Milliseconds 500 }; if (-not $ok) { exit 1 }"
if errorlevel 1 (
  echo [ERROR] Local Worker did not become ready.
  echo Check the GPTWorker Server window.
  pause
  exit /b 1
)

set "TUNNEL_HEALTH_PORT=8080"
for /f "tokens=2 delims==" %%A in ('findstr /B /C:"OPENAI_TUNNEL_HEALTH_PORT=" ".env"') do set "TUNNEL_HEALTH_PORT=%%A"

start "GPTWorker Tunnel" /min powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0openai-tunnel.ps1" -Port %WORKER_PORT%

echo Waiting for Secure MCP Tunnel on port %TUNNEL_HEALTH_PORT%...
powershell -NoProfile -Command "$ok=$false; foreach ($i in 1..120) { try { $r=Invoke-WebRequest 'http://127.0.0.1:%TUNNEL_HEALTH_PORT%/readyz' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { $ok=$true; break } } catch {}; Start-Sleep -Milliseconds 500 }; if (-not $ok) { exit 1 }"
if errorlevel 1 (
  echo.
  echo [ERROR] Secure MCP Tunnel did not become ready within 60 seconds.
  echo Printing tunnel health diagnostics...
  powershell -NoProfile -Command "$urls=@('http://127.0.0.1:%TUNNEL_HEALTH_PORT%/healthz','http://127.0.0.1:%TUNNEL_HEALTH_PORT%/readyz','http://127.0.0.1:%TUNNEL_HEALTH_PORT%/health/control-plane','http://127.0.0.1:%TUNNEL_HEALTH_PORT%/health/mcp','http://127.0.0.1:%TUNNEL_HEALTH_PORT%/health/oauth','http://127.0.0.1:%TUNNEL_HEALTH_PORT%/health?details=true'); foreach($u in $urls){ Write-Host ''; Write-Host ('--- '+$u+' ---') -ForegroundColor Cyan; try { $r=Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 3; Write-Host ('HTTP '+[int]$r.StatusCode); Write-Host $r.Content } catch { if ($_.Exception.Response) { try { Write-Host ('HTTP '+[int]$_.Exception.Response.StatusCode.value__); } catch {} }; if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message } else { Write-Host $_.Exception.Message } } }"
  echo.
  pause
  exit /b 1
)

echo.
echo [OK] GPTWorker and Secure MCP Tunnel are ready.
echo Open ChatGPT and use: @gptworker
echo.
echo GPTWorker will resolve JOB + local FOLDER from the chat and ask for confirmation before working.
echo.
exit /b 0

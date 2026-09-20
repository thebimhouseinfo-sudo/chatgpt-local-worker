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

start "" powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0start.ps1" -Port %WORKER_PORT% -Force

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
echo.
echo GPTWorker will guide the connection setup one step at a time.
echo Each OpenAI page will open automatically exactly when its value is needed.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0openai-tunnel.ps1" -Init
if errorlevel 1 goto :failed

set "TUNNEL_HEALTH_PORT=8080"
for /f "tokens=2 delims==" %%A in ('findstr /B /C:"OPENAI_TUNNEL_HEALTH_PORT=" ".env"') do set "TUNNEL_HEALTH_PORT=%%A"

echo.
echo Starting Secure MCP Tunnel...
start "" powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0openai-tunnel.ps1" -Port %WORKER_PORT%

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
powershell -NoProfile -Command "$target=[IO.Path]::GetFullPath('%~dp0gptworker-tray.ps1'); Get-CimInstance Win32_Process -ErrorAction SilentlyContinue ^| Where-Object { ($_.Name -ieq 'powershell.exe' -or $_.Name -ieq 'pwsh.exe') -and $_.CommandLine -and $_.CommandLine.IndexOf($target,[StringComparison]::OrdinalIgnoreCase) -ge 0 } ^| ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 700"
del /q "%LOCALAPPDATA%\GPTWorker\tray-ready.json" >nul 2>nul

echo Starting GPTWorker tray host...
start "" powershell -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0gptworker-tray.ps1"

echo Waiting for tray host...
powershell -NoProfile -Command "$p=Join-Path $env:LOCALAPPDATA 'GPTWorker\tray-ready.json'; $ok=$false; foreach($i in 1..40){ if(Test-Path $p){ try{$s=Get-Content $p -Raw ^| ConvertFrom-Json; if($s.ready -eq $true -and (Get-Process -Id ([int]$s.pid) -ErrorAction SilentlyContinue)){ $ok=$true; break }}catch{} }; Start-Sleep -Milliseconds 250 }; if(-not $ok){ exit 1 }"
if errorlevel 1 (
  echo [ERROR] GPTWorker tray host failed to start.
  echo See: %LOCALAPPDATA%\GPTWorker\logs\tray.err.log
  goto :failed
)
echo [OK] GPTWorker tray host is visible.

echo.
echo Opening ChatGPT Settings and the local visual setup guide...
start "" "https://chatgpt.com/#settings/Plugins"
start "" "%~dp0docs\setup-guide\index.html"

echo.
echo Follow the visual guide that just opened:
echo   1. Enable Developer mode in Plugins settings.
echo   2. Open Plugins and click + to create a new plugin.
echo   3. Create gptworker, choose Connection: Tunnel, then Scan/Test Tools.
echo   4. Open a new chat and call @gptworker, then try gptworker/
echo.
echo The guide images live in docs\setup-guide\images\.
echo Do NOT enter http://127.0.0.1:3000/mcp into ChatGPT.
echo.
echo ========================================
echo   Setup complete
echo ========================================
echo GPTWorker is now registered to start automatically with this Windows user.
echo Normally, just open ChatGPT and use @gptworker.
echo run.bat remains available as a source-build fallback/manual restart.
echo.
pause
exit /b 0

:failed
echo.
echo [ERROR] Setup failed. See the output above.
pause
exit /b 1

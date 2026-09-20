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

echo Restarting any existing GPTWorker tray host...
powershell -NoProfile -Command "$target=[IO.Path]::GetFullPath('%~dp0gptworker-tray.ps1'); Get-CimInstance Win32_Process -ErrorAction SilentlyContinue ^| Where-Object { $_.ProcessId -ne $PID -and ($_.Name -ieq 'powershell.exe' -or $_.Name -ieq 'pwsh.exe') -and $_.CommandLine -and $_.CommandLine.IndexOf($target,[StringComparison]::OrdinalIgnoreCase) -ge 0 } ^| ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 700"
del /q "%LOCALAPPDATA%\GPTWorker\tray-ready.json" >nul 2>nul

echo Starting GPTWorker tray host...
start "" powershell -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0gptworker-tray.ps1" -RestartRuntimeOnStart

echo Waiting for tray host...
powershell -NoProfile -Command "$p=Join-Path $env:LOCALAPPDATA 'GPTWorker\tray-ready.json'; $ok=$false; foreach($i in 1..40){ if(Test-Path $p){ try{$s=Get-Content $p -Raw ^| ConvertFrom-Json; if($s.ready -eq $true -and (Get-Process -Id ([int]$s.pid) -ErrorAction SilentlyContinue)){ $ok=$true; break }}catch{} }; Start-Sleep -Milliseconds 250 }; if(-not $ok){ exit 1 }"
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
echo Look for the Windows application icon in the system tray.
echo Right-click it to see Status / Open setup guide / Restart / Exit.
echo Worker + Secure MCP Tunnel are restarting behind the tray with this fresh build.
echo.
exit /b 0

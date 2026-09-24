@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title GPTWorker Setup Test

powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-test-flow.ps1"
set "EC=%ERRORLEVEL%"

if not "%EC%"=="0" (
  echo.
  echo ================================================================
  echo   GPTWorker Setup Test exited with code %EC%
  echo   The window is being kept open so you can read the error above.
  echo ================================================================
  echo.
  pause
)

exit /b %EC%

@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title GPTWorker Setup Test

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-test-flow.ps1"
set "EC=%ERRORLEVEL%"
exit /b %EC%

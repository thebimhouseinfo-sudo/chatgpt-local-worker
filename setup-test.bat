@echo off
setlocal
cd /d "%~dp0"
title GPTWorker Setup TEST

echo.
echo ========================================
echo   GPTWorker - FAKE SETUP FLOW
echo ========================================
echo.
echo This file only tests the first-time onboarding experience.
echo It does NOT modify .env, start/restart Worker, start/restart Tunnel,
echo or change any existing GPTWorker connection.
echo.
pause

echo.
echo ========================================
echo   [1/4] Secure MCP Tunnel
echo ========================================
echo.
echo Opening OpenAI Tunnels...
start "" "https://platform.openai.com/settings/organization/tunnels"
echo.
echo Create a tunnel as if this were a fresh install.
echo For this TEST, you do NOT need to create a real new tunnel.
echo You may paste any test value below.
echo.
set /p "FAKE_TUNNEL=Paste Tunnel ID here (test only): "
if "%FAKE_TUNNEL%"=="" set "FAKE_TUNNEL=tunnel_test"
echo [TEST] Accepted: %FAKE_TUNNEL%
echo [TEST] Nothing was saved.
pause

echo.
echo ========================================
echo   [2/4] Runtime API key
echo ========================================
echo.
echo Opening OpenAI API Keys...
start "" "https://platform.openai.com/settings/organization/api-keys"
echo.
echo Create a Runtime API key as if this were a fresh install.
echo For this TEST, do NOT paste a real secret.
echo Type any fake value, for example: sk-test
echo.
set /p "FAKE_KEY=Paste fake API key here: "
if "%FAKE_KEY%"=="" set "FAKE_KEY=sk-test"
echo [TEST] API key input accepted.
echo [TEST] The value was NOT saved or used.
pause

echo.
echo ========================================
echo   [3/4] Validate and start Tunnel
echo ========================================
echo.
echo [TEST] Checking Tunnel ID...
ping 127.0.0.1 -n 2 >nul
echo [OK] Tunnel ID looks ready.
echo [TEST] Checking Runtime API key...
ping 127.0.0.1 -n 2 >nul
echo [OK] Runtime API key looks ready.
echo [TEST] Starting Secure MCP Tunnel...
ping 127.0.0.1 -n 3 >nul
echo [OK] GPTWorker and Secure MCP Tunnel are ready.  ^(simulated^)
pause

echo.
echo ========================================
echo   [4/4] Connect ChatGPT
echo ========================================
echo.
echo Opening ChatGPT Settings and local visual guide...
start "" "https://chatgpt.com/#settings/Plugins"
start "" "%~dp0docs\setup-guide\index.html"
echo.
echo Follow the guide:
echo   1. Enable Developer mode.
echo   2. Open Plugins and click +.
echo   3. Create gptworker and choose Connection: Tunnel.
echo   4. Open a new chat and call @gptworker.
echo.
echo ========================================
echo   Fake setup test complete
echo ========================================
echo.
echo No GPTWorker config or runtime was changed.
echo.
pause
exit /b 0

@echo off
setlocal
cd /d "%~dp0"
title GPTWorker Final Source Test

echo.
echo ========================================
echo   GPTWorker - FINAL SOURCE TEST
echo ========================================
echo.
echo Tunnel/API onboarding below is simulated and does NOT modify .env.
echo At runtime step, GPTWorker will use your EXISTING saved .env to:
echo   - npm run build
echo   - start the real tray host
echo   - start/adopt the real Worker + Secure MCP Tunnel
echo   - register per-user Windows auto-start
echo.
echo This lets you test onboarding + tray + live ChatGPT connection in one pass.
echo.
pause

echo.
echo ========================================
echo   [1/4] Secure MCP Tunnel onboarding
echo ========================================
echo.
echo Opening OpenAI Tunnels...
start "" "https://platform.openai.com/settings/organization/tunnels"
echo.
echo Simulate the first-install instruction here.
echo You do NOT need to create a new tunnel for this test.
echo Paste any fake/test value below; it will NOT be saved.
echo.
set /p "FAKE_TUNNEL=Paste Tunnel ID here (test only): "
if "%FAKE_TUNNEL%"=="" set "FAKE_TUNNEL=tunnel_test"
echo [TEST] Accepted. Nothing was saved.
pause

echo.
echo ========================================
echo   [2/4] Runtime API key onboarding
echo ========================================
echo.
echo Opening OpenAI API Keys...
start "" "https://platform.openai.com/settings/organization/api-keys"
echo.
echo Simulate the first-install instruction here.
echo DO NOT paste a real secret into this test prompt.
echo Type any fake value, for example: sk-test
echo.
set /p "FAKE_KEY=Paste fake API key here: "
if "%FAKE_KEY%"=="" set "FAKE_KEY=sk-test"
echo [TEST] API key input accepted. The value was NOT saved or used.
pause

echo.
echo ========================================
echo   [3/4] Build + real tray runtime
echo ========================================
echo.

if not exist ".env" (
  echo [ERROR] Existing .env not found.
  echo Run real setup.bat once before using the combined final test.
  pause
  exit /b 1
)

echo Registering GPTWorker source tray for Windows logon...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gptworker-tray.ps1" -InstallStartup
if errorlevel 1 goto :failed

echo Building and launching the real source tray runtime...
call "%~dp0run.bat"
if errorlevel 1 goto :failed

echo.
echo The GPTWorker tray icon should now be visible.
echo RIGHT-CLICK the tray icon and choose:
echo   Restart GPTWorker
echo.
echo This intentionally tests Restart and guarantees the running Worker
echo reloads the build you just created.
pause

set "WORKER_PORT=3000"
for /f "tokens=2 delims==" %%A in ('findstr /B /C:"PORT=" ".env"') do set "WORKER_PORT=%%A"
set "TUNNEL_HEALTH_PORT=8080"
for /f "tokens=2 delims==" %%A in ('findstr /B /C:"OPENAI_TUNNEL_HEALTH_PORT=" ".env"') do set "TUNNEL_HEALTH_PORT=%%A"

echo Waiting for real Worker + Secure MCP Tunnel...
powershell -NoProfile -Command "$ok=$false; foreach($i in 1..140){ try{$w=Invoke-RestMethod 'http://127.0.0.1:%WORKER_PORT%/health' -TimeoutSec 1; $t=Invoke-WebRequest 'http://127.0.0.1:%TUNNEL_HEALTH_PORT%/readyz' -UseBasicParsing -TimeoutSec 1; if($w.name -eq 'chatgpt-local-worker' -and $t.StatusCode -eq 200){$ok=$true;break}}catch{}; Start-Sleep -Milliseconds 500}; if(-not $ok){exit 1}"
if errorlevel 1 (
  echo [ERROR] Real tray runtime did not become ready.
  echo Check tray status and logs under:
  echo   %LOCALAPPDATA%\GPTWorker\logs
  pause
  exit /b 1
)

echo [OK] Real Worker + Secure MCP Tunnel are ready behind the tray app.
echo [OK] Auto-start is registered for this Windows user.
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
echo Now test the real connection:
echo   1. Follow images 1.png - 4.png in the guide.
echo   2. Open a new chat and call @gptworker.
echo   3. Try gptworker/
echo   4. Right-click the tray icon and test Restart GPTWorker.
echo   5. Use Exit GPTWorker only when you are ready to stop the local bridge.
echo.
echo ========================================
echo   Combined source test ready
echo ========================================
echo.
echo Fake credentials were never saved.
echo Tray/runtime is REAL and uses the existing .env.
echo.
pause
exit /b 0

:failed
echo.
echo [ERROR] Source test failed. See the output above.
pause
exit /b 1

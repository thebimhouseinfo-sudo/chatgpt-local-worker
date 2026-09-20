@echo off
setlocal
cd /d "%~dp0"
title GPTWorker Setup Wizard Preview
color 0B

call :screen "GPTWorker Setup Wizard Preview" "Safe UX dry-run - your saved connection will not be replaced"

echo   [PREVIEW MODE]
echo.
echo   This flow lets you inspect the real first-time setup experience.
echo.
echo   What is safe in this preview:
echo     - Tunnel ID field accepts ANY non-empty text.
echo     - API key field accepts ANY non-empty text.
echo     - Preview credentials are NOT validated and NOT saved.
echo     - Existing .env connection is NOT replaced.
echo.
echo   The real setup.bat still validates both credentials normally.
echo.
echo   Existing .env may be used only at the final integration step
echo   to launch your already-configured GPTWorker runtime.
echo.
pause

call :screen "STEP 1 / 4" "Check this computer"

echo   Checking required software...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [FAIL] Node.js is not installed or not in PATH.
  echo          Install Node.js 18+ and run setup-test.bat again.
  goto :failed
)
for /f "tokens=*" %%V in ('node --version') do echo   [ OK ] Node.js %%V

where git >nul 2>nul
if errorlevel 1 (
  echo   [FAIL] Git is not installed or not in PATH.
  echo          Install Git for Windows and run setup-test.bat again.
  goto :failed
)
for /f "tokens=*" %%V in ('git --version') do echo   [ OK ] %%V

echo.
echo   This computer is ready for GPTWorker.
echo.
pause

call :screen "STEP 2 / 4" "Install, build and validate GPTWorker"

echo   [1/4] Installing dependencies...
call npm install
if errorlevel 1 goto :failed

echo.
echo   [2/4] Building source...
call npm run build
if errorlevel 1 goto :failed

echo.
echo   [3/4] Validating Job Packs...
call npm run validate:jobs
if errorlevel 1 goto :failed

echo.
echo   [4/4] Running tests...
call npm test
if errorlevel 1 goto :failed

echo.
echo   [ OK ] Source build and validation passed.
echo.
pause

call :screen "STEP 3 / 4" "Preview the OpenAI connection wizard"

echo   Two input screens will be shown:
echo.
echo     1. Secure MCP Tunnel ID
echo     2. Runtime API key
echo.
echo   This is UX PREVIEW mode.
echo   Type ANY non-empty text in either field to continue.
echo   Example: demo
echo.
echo   The same OpenAI pages used by real setup will still open so you
echo   can verify the complete onboarding flow.
echo.
echo   Nothing entered in this step will be saved.
echo.
pause

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0openai-tunnel.ps1" -Init -WizardPreview
if errorlevel 1 goto :failed

echo.
echo   [ OK ] Connection wizard preview completed.
echo.
pause

call :screen "STEP 4 / 4" "Start GPTWorker and finish in ChatGPT"

if not exist ".env" (
  echo   No existing .env was found.
  echo.
  echo   The setup UX preview completed successfully.
  echo   Because preview credentials are intentionally not saved,
  echo   there is no real connection to launch at this final step.
  echo.
  echo   Run setup.bat when you are ready for the real installation.
  echo.
  goto :wizard_done
)

echo   [1/3] Registering GPTWorker startup entry...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gptworker-tray.ps1" -InstallStartup
if errorlevel 1 goto :failed

echo.
echo   [2/3] Starting tray/runtime with the EXISTING saved .env...
call "%~dp0run.bat"
if errorlevel 1 goto :failed

echo.
echo   [3/3] Opening ChatGPT Settings and local visual guide...
start "" "https://chatgpt.com/#settings/Plugins"
start "" "%~dp0docs\setup-guide\index.html"

echo.
echo   [ OK ] GPTWorker tray, Worker and Secure MCP Tunnel are ready.
echo.
echo   Finish onboarding in the browser:
echo.
echo     1. Enable Developer mode.
echo     2. Open Plugins and click +.
echo     3. Name = gptworker.
echo     4. Connection = Tunnel.
echo     5. Choose GPTWorker from Available tunnels.
echo     6. Authentication = No Auth.
echo     7. Connect/Create, then restart Windows.
echo     8. Open ChatGPT and type @gptworker.
echo.
echo   Restarting Windows is the final auto-start test.
echo.

:wizard_done
call :screen "PREVIEW COMPLETE" "GPTWorker setup experience finished"

echo   [ OK ] System check
echo   [ OK ] Build and validation
echo   [ OK ] Tunnel input UX
echo   [ OK ] API key input UX
echo.
echo   Preview credentials were not saved.
echo   Your existing connection was not replaced.
echo.
pause
exit /b 0

:failed
call :screen "PREVIEW FAILED" "A setup-test step could not complete"

echo   Review the error shown above.
echo   No preview credential was written to .env.
echo.
pause
exit /b 1

:screen
cls
echo.
echo ================================================================
echo   %~1
echo   %~2
echo ================================================================
echo.
exit /b 0

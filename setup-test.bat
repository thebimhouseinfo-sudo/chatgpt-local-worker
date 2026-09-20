@echo off
setlocal
cd /d "%~dp0"
title GPTWorker Setup Wizard Test

cls
echo.
echo ============================================================
echo   GPTWorker Setup Wizard - Terminal Test
echo ============================================================
echo.
echo This is a DRY-RUN of the real first-time setup experience.
echo.
echo - Uses the same Tunnel and API instructions as setup.bat.
echo - Opens the same OpenAI pages at the same steps.
echo - Validates the values you enter.
echo - Does NOT save the entered Tunnel ID or API key.
echo - Does NOT replace your existing .env connection.
echo.
echo The existing .env, if already configured, will only be used later
echo to launch the real tray/runtime for the final integration check.
echo.
pause

cls
echo.
echo ============================================================
echo   Step 1 of 4 - Check this computer
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not in PATH.
  echo Install Node.js 18+ and run setup-test.bat again.
  goto :failed
)
for /f "tokens=*" %%V in ('node --version') do echo [OK] Node.js %%V

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git is not installed or not in PATH.
  echo Install Git for Windows and run setup-test.bat again.
  goto :failed
)
for /f "tokens=*" %%V in ('git --version') do echo [OK] %%V

echo.
echo This computer is ready for GPTWorker.
echo.
pause

cls
echo.
echo ============================================================
echo   Step 2 of 4 - Install, build and validate GPTWorker
echo ============================================================
echo.
echo Installing dependencies...
call npm install
if errorlevel 1 goto :failed

echo.
echo Building source...
call npm run build
if errorlevel 1 goto :failed

echo.
echo Validating Job Packs...
call npm run validate:jobs
if errorlevel 1 goto :failed

echo.
echo Running tests...
call npm test
if errorlevel 1 goto :failed

echo.
echo [OK] GPTWorker source passed build and validation.
echo.
pause

cls
echo.
echo ============================================================
echo   Step 3 of 4 - Connect OpenAI Secure MCP Tunnel
echo ============================================================
echo.
echo The next prompts are the SAME terminal instructions used by the
echo real setup flow.
echo.
echo The Tunnel page will open first. After a valid Tunnel ID is entered,
echo the API Keys page will open. Follow the instructions shown here.
echo.
echo This test validates the values but does not save them.
echo.
pause

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0openai-tunnel.ps1" -Init -WizardPreview
if errorlevel 1 goto :failed

echo.
echo [OK] Connection wizard flow completed successfully.
echo.
pause

cls
echo.
echo ============================================================
echo   Step 4 of 4 - Start GPTWorker and finish in ChatGPT
echo ============================================================
echo.

if not exist ".env" (
  echo Existing .env was not found.
  echo.
  echo The terminal wizard itself has been tested successfully, but this
  echo dry-run intentionally did not save the Tunnel/API values you entered.
  echo Run setup.bat for a real first-time installation.
  echo.
  goto :wizard_done
)

echo Registering GPTWorker to start with this Windows user...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gptworker-tray.ps1" -InstallStartup
if errorlevel 1 goto :failed

echo.
echo Starting the real tray/runtime using the EXISTING saved .env...
call "%~dp0run.bat"
if errorlevel 1 goto :failed

echo.
echo [OK] GPTWorker tray, Worker and Secure MCP Tunnel are ready.
echo.
echo Opening ChatGPT Settings and the local setup guide...
start "" "https://chatgpt.com/#settings/Plugins"
start "" "%~dp0docs\setup-guide\index.html"

echo.
echo Finish the onboarding in the browser:
echo.
echo   1. Images 1 + 2: enable Developer mode.
echo   2. Image 3: open Plugins and click +.
echo   3. Image 4: create gptworker using Connection = Tunnel,
echo      choose the Tunnel from Available tunnels, Authentication = No Auth.
echo   4. Image 5: restart Windows.
echo   5. After Windows starts again, open ChatGPT and type @gptworker.
echo   6. Then type gptworker/help and read the usage guide before working.
echo.
echo Restarting Windows is the final auto-start test.
echo.

:wizard_done
echo.
echo ============================================================
echo   Setup Wizard Test complete
echo ============================================================
echo.
echo The terminal onboarding flow has been exercised without replacing
echo your saved Tunnel ID or API key.
echo.
pause
exit /b 0

:failed
echo.
echo ============================================================
echo   Setup Wizard Test failed
echo ============================================================
echo.
echo Review the error above and fix that step before continuing.
echo.
pause
exit /b 1

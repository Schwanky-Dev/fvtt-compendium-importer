@echo off
REM ============================================================
REM  Compendium Importer — CORS Proxy Auto-Start Setup (Windows)
REM  Run this ONCE as Administrator on the Foundry server machine.
REM ============================================================

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js not found in PATH. Install it from https://nodejs.org
    pause
    exit /b 1
)

set SCRIPT_DIR=%~dp0
set TASK_NAME=CompendiumImporterProxy
set NODE_EXE=node
set PROXY_SCRIPT=%SCRIPT_DIR%server.mjs

echo.
echo === Compendium Importer CORS Proxy Setup ===
echo Proxy script: %PROXY_SCRIPT%
echo.

REM Remove existing task if present
schtasks /Delete /TN "%TASK_NAME%" /F >nul 2>nul

REM Create a scheduled task that runs at logon and restarts on failure
schtasks /Create /TN "%TASK_NAME%" /TR "\"%NODE_EXE%\" \"%PROXY_SCRIPT%\"" /SC ONLOGON /RL HIGHEST /F
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to create scheduled task. Are you running as Administrator?
    pause
    exit /b 1
)

echo.
echo Scheduled task "%TASK_NAME%" created (runs on logon).
echo Starting proxy now...
echo.

REM Start the proxy immediately
start "CORS Proxy" /MIN cmd /c "%NODE_EXE%" "%PROXY_SCRIPT%"

echo CORS proxy is running on port 3001.
echo Setup complete! The proxy will auto-start on login.
echo.
pause

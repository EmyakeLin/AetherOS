@echo off
setlocal enabledelayedexpansion

REM N.O.V.A Aether OS - Startup Script (Windows)

cd /d "%~dp0"

set PORT=%1
if "%PORT%"=="" set PORT=8411

echo.
echo   N.O.V.A Aether OS
echo   ==================
echo.

REM Create virtual environment if not exists
if not exist ".venv" (
    echo   [INFO] Creating virtual environment...
    python -m venv .venv
    if errorlevel 1 (
        echo   [ERROR] Failed to create venv. Please install Python first.
        pause
        exit /b 1
    )
)

REM Activate virtual environment
call .venv\Scripts\activate.bat

REM Check dependencies
echo   [INFO] Checking dependencies...
pip show fastapi >nul 2>&1
if errorlevel 1 (
    if exist "deps" (
        echo   [INFO] Installing dependencies from local deps/...
        pip install --no-index --find-links=deps/ -r requirements.txt
    ) else (
        echo   [INFO] Installing dependencies from PyPI...
        pip install -r requirements.txt
    )
) else (
    echo   [OK] Dependencies satisfied
)

REM Ensure directories exist
if not exist "static\core" mkdir static\core
if not exist "static\apps\files" mkdir static\apps\files
if not exist "static\apps\ide" mkdir static\apps\ide
if not exist "static\apps\terminal" mkdir static\apps\terminal
if not exist "static\apps\agent" mkdir static\apps\agent
if not exist "static\apps\browser" mkdir static\apps\browser
if not exist "static\apps\monitor" mkdir static\apps\monitor
if not exist "static\apps\settings" mkdir static\apps\settings
if not exist "static\lib\monaco" mkdir static\lib\monaco
if not exist "agent\tools\builtin" mkdir agent\tools\builtin
if not exist "agent\tools\custom" mkdir agent\tools\custom

echo.
echo   [INFO] Starting server on port %PORT%...
echo   [INFO] http://localhost:%PORT%
echo.

REM Start server in background
start "AetherOS Server" python server.py --port %PORT%

REM Wait for server to start
timeout /t 2 /nobreak >nul

REM Open browser
start http://localhost:%PORT%

echo   [OK] Server is running. Press any key to stop...
pause >nul

REM Stop server
taskkill /fi "WindowTitle eq AetherOS Server*" /f >nul 2>&1
echo   [OK] Server stopped.

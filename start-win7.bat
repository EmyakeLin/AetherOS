@echo off
setlocal enabledelayedexpansion

REM N.O.V.A Aether OS - Windows 7 Edition
REM Requires Python 3.8.10

cd /d "%~dp0"

set PORT=%1
if "%PORT%"=="" set PORT=8411

echo.
echo   N.O.V.A Aether OS [Win7 Edition]
echo   =================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo   [ERROR] Python not found. Please install Python 3.8.10.
    echo   [INFO] Download: https://www.python.org/downloads/release/python-3810/
    pause
    exit /b 1
)

for /f "tokens=2 delims= " %%v in ('python --version 2^>^&1') do set PYVER=%%v
echo   [INFO] Detected Python %PYVER%

REM Create virtual environment
if not exist ".venv-win7" (
    echo   [INFO] Creating virtual environment...
    python -m venv .venv-win7
    if errorlevel 1 (
        echo   [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
)

call .venv-win7\Scripts\activate.bat

REM Check dependencies
echo   [INFO] Checking dependencies...
set NEED_INSTALL=0
pip show fastapi >nul 2>&1 || set NEED_INSTALL=1
pip show uvicorn >nul 2>&1 || set NEED_INSTALL=1
pip show anthropic >nul 2>&1 || set NEED_INSTALL=1
pip show openai >nul 2>&1 || set NEED_INSTALL=1

if %NEED_INSTALL%==1 (
    if exist "deps-win7" (
        echo   [INFO] Installing from local deps-win7/ ...
        pip install --no-index --find-links=deps-win7/ -r requirements-win7.txt
        if errorlevel 1 (
            echo   [WARN] Local install failed, trying PyPI...
            pip install -r requirements-win7.txt
        )
    ) else (
        echo   [INFO] Installing from PyPI...
        pip install -r requirements-win7.txt
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
echo   [INFO] Starting server (port %PORT%)...
echo   [INFO] http://localhost:%PORT%
echo.

start "AetherOS Server" python server.py --port %PORT%

timeout /t 2 /nobreak >nul
start http://localhost:%PORT%

echo   [OK] Server is running. Press any key to stop...
pause >nul

taskkill /fi "WindowTitle eq AetherOS Server*" /f >nul 2>&1
echo   [OK] Server stopped.

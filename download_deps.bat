@echo off
setlocal enabledelayedexpansion

REM N.O.V.A Aether OS - Download Dependencies for Offline Installation

cd /d "%~dp0"

echo.
echo   N.O.V.A Aether OS - Offline Dependencies Downloader
echo   =====================================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo   [ERROR] Python is not installed or not in PATH.
    pause
    exit /b 1
)

REM Create deps directory
if not exist "deps" mkdir deps

echo   [INFO] Downloading dependencies to deps/...
echo.

REM Download all dependencies as wheel files
pip download -r requirements.txt -d deps/ --only-binary=:all: 2>nul || pip download -r requirements.txt -d deps/

if errorlevel 1 (
    echo.
    echo   [ERROR] Failed to download dependencies.
    pause
    exit /b 1
)

echo.
echo   [OK] Dependencies downloaded to deps/
echo   [INFO] You can now run start.bat on offline machines.
echo.

pause

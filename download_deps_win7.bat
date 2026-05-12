@echo off
setlocal enabledelayedexpansion

REM N.O.V.A Aether OS - Win7 Offline Dependency Downloader

cd /d "%~dp0"

echo.
echo   N.O.V.A Aether OS [Win7] - Offline Dependency Download
echo   ======================================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo   [ERROR] Python not found.
    pause
    exit /b 1
)

if not exist "deps-win7" mkdir deps-win7

echo   [INFO] Downloading Win7-compatible dependencies to deps-win7/...
echo.

pip download -r requirements-win7.txt -d deps-win7/ --only-binary=:all: 2>nul || pip download -r requirements-win7.txt -d deps-win7/

if errorlevel 1 (
    echo   [ERROR] Download failed.
    pause
    exit /b 1
)

echo.
echo   [OK] Dependencies downloaded to deps-win7/
echo   [INFO] Run start-win7.bat on the offline machine.
echo.

pause

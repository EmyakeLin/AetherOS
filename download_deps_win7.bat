@echo off
setlocal enabledelayedexpansion

REM N.O.V.A Aether OS - Win7 离线依赖下载器

cd /d "%~dp0"

echo.
echo   N.O.V.A Aether OS [Win7] - 离线依赖下载
echo   ==========================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo   [ERROR] 未找到 Python。
    pause
    exit /b 1
)

if not exist "deps-win7" mkdir deps-win7

echo   [INFO] 下载 Win7 兼容依赖到 deps-win7/...
echo.

pip download -r requirements-win7.txt -d deps-win7/ --only-binary=:all: 2>nul || pip download -r requirements-win7.txt -d deps-win7/

if errorlevel 1 (
    echo   [ERROR] 下载失败。
    pause
    exit /b 1
)

echo.
echo   [OK] 依赖已下载到 deps-win7/
echo   [INFO] 可在离线机器上运行 start-win7.bat
echo.

pause

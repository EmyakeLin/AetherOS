@echo off
setlocal enabledelayedexpansion

REM N.O.V.A Aether OS - Windows 7 专用版
REM 需要 Python 3.8.10

cd /d "%~dp0"

set PORT=%1
if "%PORT%"=="" set PORT=8411

echo.
echo   N.O.V.A Aether OS [Win7 Edition]
echo   =================================
echo.

REM 检测 Python
python --version >nul 2>&1
if errorlevel 1 (
    echo   [ERROR] 未找到 Python。请安装 Python 3.8.10。
    echo   [INFO] 下载地址: https://www.python.org/downloads/release/python-3810/
    pause
    exit /b 1
)

for /f "tokens=2 delims= " %%v in ('python --version 2^>^&1') do set PYVER=%%v
echo   [INFO] 检测到 Python %PYVER%

REM 创建虚拟环境（独立目录，避免污染原版）
if not exist ".venv-win7" (
    echo   [INFO] 创建虚拟环境...
    python -m venv .venv-win7
    if errorlevel 1 (
        echo   [ERROR] 创建虚拟环境失败。
        pause
        exit /b 1
    )
)

call .venv-win7\Scripts\activate.bat

REM 检查依赖（检查多个关键包）
echo   [INFO] 检查依赖...
set NEED_INSTALL=0
pip show fastapi >nul 2>&1 || set NEED_INSTALL=1
pip show uvicorn >nul 2>&1 || set NEED_INSTALL=1
pip show anthropic >nul 2>&1 || set NEED_INSTALL=1
pip show openai >nul 2>&1 || set NEED_INSTALL=1

if %NEED_INSTALL%==1 (
    if exist "deps-win7" (
        echo   [INFO] 从本地 deps-win7/ 安装依赖...
        pip install --no-index --find-links=deps-win7/ -r requirements-win7.txt
        if errorlevel 1 (
            echo   [WARN] 本地安装失败，尝试从 PyPI 安装...
            pip install -r requirements-win7.txt
        )
    ) else (
        echo   [INFO] 从 PyPI 安装依赖...
        pip install -r requirements-win7.txt
    )
) else (
    echo   [OK] 依赖已满足
)

REM 确保目录存在
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
echo   [INFO] 启动服务器 (端口 %PORT%)...
echo   [INFO] http://localhost:%PORT%
echo.

start "AetherOS Server" python server.py --port %PORT%

timeout /t 2 /nobreak >nul
start http://localhost:%PORT%

echo   [OK] 服务器已运行。按任意键停止...
pause >nul

taskkill /fi "WindowTitle eq AetherOS Server*" /f >nul 2>&1
echo   [OK] 服务器已停止。

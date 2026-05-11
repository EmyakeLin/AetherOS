@echo off
setlocal enabledelayedexpansion

REM N.O.V.A Aether OS - Stop Script (Windows)

echo   Stopping N.O.V.A Aether OS...

set FOUND=0

REM Kill all python processes running server.py
for /f "tokens=2" %%a in ('tasklist /fi "imagename eq python.exe" /fo list 2^>nul ^| findstr "PID:"') do (
    for /f "tokens=*" %%b in ('wmic process where "ProcessId=%%a" get CommandLine /value 2^>nul ^| findstr "CommandLine="') do (
        echo %%b | findstr /i "server.py" >nul
        if not errorlevel 1 (
            echo   [INFO] Terminating process: %%a
            taskkill /pid %%a /f >nul 2>&1
            set FOUND=1
        )
    )
)

if !FOUND!==1 (
    echo   [OK] Server stopped.
) else (
    echo   [INFO] No running server found.
)

pause

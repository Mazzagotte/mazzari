@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-display.ps1" %*
if errorlevel 1 (
    echo FLAP could not start. See the error above.
    pause
    exit /b 1
)

@echo off
call "%~dp0start-display.bat" -Kiosk %*
exit /b %errorlevel%

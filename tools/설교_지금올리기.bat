@echo off
chcp 65001 >nul
cd /d "%~dp0"
python sermon_sync.py %*
echo.
pause

@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ---- %date% %time% ---- >> bulletin_scan.log
python bulletin_scan.py %* >> bulletin_scan.log 2>&1

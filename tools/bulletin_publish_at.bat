@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ---- %date% %time% ---- >> bulletin_publish_at.log
python bulletin_publish_at.py %* >> bulletin_publish_at.log 2>&1

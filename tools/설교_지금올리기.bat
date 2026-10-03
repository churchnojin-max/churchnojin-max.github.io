@echo off
chcp 65001 >nul
title 설교 자동 올리기 - 지금 바로 확인
cd /d "%~dp0"
echo 설교 폴더를 확인해서 새 설교를 홈페이지에 올립니다...
echo.
python sermon_sync.py %*
echo.
pause

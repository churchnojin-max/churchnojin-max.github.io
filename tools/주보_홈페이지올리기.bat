@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem ── 완성된 주보(hwpx)를 홈페이지 관리자 화면에 자동으로 올려두는 도구 ──
rem  - 2026주보 폴더에서 가장 최근 hwpx를 자동으로 찾습니다.
rem  - 특정 파일을 쓰려면: 이 파일에 그 hwpx 파일을 끌어다 놓으세요.
rem  - 마지막 "게시" 버튼은 뜬 크롬 창에서 직접 눌러야 합니다.
if "%~1"=="" (
    python bulletin_publish.py
) else (
    python bulletin_publish.py "%~1"
)
echo.
pause

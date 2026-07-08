@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem ── ○○교회 QT 음성 업로더 ──────────────────────────────────────
rem  1) 아래 따옴표 안에 Supabase service_role 키를 한 번만 붙여넣으세요.
rem     (Supabase → Project Settings → API → service_role)
rem  2) 이 파일과 같은 폴더의 "qt음성" 폴더에 WAV(파일명에 날짜 2026-07-06 포함)를 넣으세요.
rem  3) 이 파일을 더블클릭하면 업로드됩니다.
rem ─────────────────────────────────────────────────────────────
set "SUPABASE_SERVICE_ROLE_KEY=여기에_service_role_키_붙여넣기"

if not exist "qt음성" mkdir "qt음성"
echo QT 음성 업로드를 시작합니다...
python tts_local.py --from-folder "qt음성"
echo.
pause

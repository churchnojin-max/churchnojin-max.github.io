@echo off
chcp 65001 >nul
title 설교 자동 올리기 - 전용 열쇠 넣기
echo.
echo  ┌──────────────────────────────────────────────────────────┐
echo  │  설교 자동 올리기 - 전용 열쇠 넣기 (처음 한 번만)         │
echo  └──────────────────────────────────────────────────────────┘
echo.
echo  Supabase 사이트에서 복사한 service_role 열쇠를 붙여 넣고 Enter 를 누르세요.
echo  (붙여 넣기: 마우스 오른쪽 단추 또는 Ctrl+V)
echo  열쇠는 이 컴퓨터의 %%APPDATA%%\nojin 폴더에만 저장되고 홈페이지 코드에는 들어가지 않습니다.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$k = Read-Host '열쇠'; $k = $k.Trim();" ^
  "if ($k.Length -lt 60 -or $k -notmatch '^(eyJ|sb_secret_)') { Write-Host ''; Write-Host '  열쇠 모양이 아닙니다. eyJ 또는 sb_secret_ 로 시작하는 긴 글자여야 합니다. 다시 복사해 주세요.' -ForegroundColor Red; exit 1 }" ^
  "$d = Join-Path $env:APPDATA 'nojin'; New-Item -ItemType Directory -Force $d | Out-Null;" ^
  "[IO.File]::WriteAllText((Join-Path $d 'supabase_service.key'), $k, (New-Object Text.UTF8Encoding $false));" ^
  "Write-Host ''; Write-Host '  저장했습니다. 이제 설교 폴더를 10분마다 확인해서 자동으로 올립니다.' -ForegroundColor Green"
echo.
pause

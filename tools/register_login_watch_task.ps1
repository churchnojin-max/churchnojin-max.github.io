# 홈페이지 로그인 보안 알림 예약 작업 등록 (2026-10-03)
#   5분마다 tools\login_watch.py 를 창 없이(pythonw) 실행한다: 해외 로그인은 바로, 밤 9시 뒤 하루 요약(텔레그램).
#   컴퓨터가 꺼져 있었으면 켜진 뒤 바로 돌고, 그동안 쌓인 것을 한꺼번에 알린다.
#   실행: powershell -NoProfile -ExecutionPolicy Bypass -File register_login_watch_task.ps1
$ErrorActionPreference = "Stop"
$toolsDir = $PSScriptRoot
$script = Join-Path $toolsDir "login_watch.py"
$pyw = (Get-Command pythonw.exe -ErrorAction SilentlyContinue | Where-Object { $_.Source -notmatch "WindowsApps" } | Select-Object -First 1).Source
if (-not $pyw) { $pyw = (Get-Command pythonw.exe).Source }

$action = New-ScheduledTaskAction -Execute $pyw -Argument "`"$script`"" -WorkingDirectory $toolsDir
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -StartWhenAvailable -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "LoginWatch" -Action $action -Trigger $trigger -Settings $settings -Description "Church homepage: login security alerts (overseas now, daily summary) via Telegram" -Force | Out-Null
Write-Host "Registered: LoginWatch (every 5 minutes, $pyw)" -ForegroundColor Green

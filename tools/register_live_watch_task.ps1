# 실시간 예배 방송 확인 예약 작업 등록 (2026-10-04)
#   주일 10:20 부터 16:00 까지 2분마다 tools\live_watch.py 를 창 없이(pythonw) 실행한다.
#   (등록하는 날이 주일이고 그 시간 안이면, 오늘도 지금부터 16:00 까지 돈다)
#   실행: powershell -NoProfile -ExecutionPolicy Bypass -File register_live_watch_task.ps1
$ErrorActionPreference = "Stop"
$toolsDir = $PSScriptRoot
$script = Join-Path $toolsDir "live_watch.py"
$pyw = (Get-Command pythonw.exe -ErrorAction SilentlyContinue | Where-Object { $_.Source -notmatch "WindowsApps" } | Select-Object -First 1).Source
if (-not $pyw) { $pyw = (Get-Command pythonw.exe).Source }

$action = New-ScheduledTaskAction -Execute $pyw -Argument "`"$script`"" -WorkingDirectory $toolsDir
$rep = (New-ScheduledTaskTrigger -Once -At "10:20" -RepetitionInterval (New-TimeSpan -Minutes 2) -RepetitionDuration (New-TimeSpan -Hours 5 -Minutes 40)).Repetition
$weekly = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At "10:20"
$weekly.Repetition = $rep
$triggers = @($weekly)
$now = Get-Date
$end = $now.Date.AddHours(16)
if ($now.DayOfWeek -eq "Sunday" -and $now -lt $end -and $now -ge $now.Date.AddHours(10).AddMinutes(20)) {
  $today = New-ScheduledTaskTrigger -Once -At $now.AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 2) -RepetitionDuration ($end - $now.AddMinutes(1))
  $triggers += $today
}
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 3) -StartWhenAvailable -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "LiveWatch" -Action $action -Trigger $triggers -Settings $settings -Description "Church homepage: check YouTube live status every 2 min on Sunday 10:20-16:00" -Force | Out-Null
Write-Host "Registered: LiveWatch (Sunday 10:20-16:00 every 2 min, $pyw, triggers: $($triggers.Count))" -ForegroundColor Green

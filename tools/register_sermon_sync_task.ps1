# 설교 자동 올리기 예약 작업 등록 (2026-10-03)
#   매일 0시부터 10분마다 tools\sermon_sync.py 를 창 없이(pythonw) 실행한다.
#   (로그온 트리거는 관리자 권한이 없으면 등록이 거부돼서 '매일 + 10분 반복'으로 둔다. 컴퓨터가 꺼져 있던 시간은 켜지면 바로 이어서 돈다.)
#   실행: powershell -NoProfile -ExecutionPolicy Bypass -File register_sermon_sync_task.ps1
$ErrorActionPreference = "Stop"
$toolsDir = $PSScriptRoot
$script = Join-Path $toolsDir "sermon_sync.py"
$pyw = (Get-Command pythonw.exe -ErrorAction SilentlyContinue | Where-Object { $_.Source -notmatch "WindowsApps" } | Select-Object -First 1).Source
if (-not $pyw) { $pyw = (Get-Command pythonw.exe).Source }

$action = New-ScheduledTaskAction -Execute $pyw -Argument "`"$script`"" -WorkingDirectory $toolsDir
$trigger = New-ScheduledTaskTrigger -Daily -At "00:00"
$rep = New-ScheduledTaskTrigger -Once -At "00:00" -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration (New-TimeSpan -Hours 23 -Minutes 50)
$trigger.Repetition = $rep.Repetition
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 40) -StartWhenAvailable -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName "SermonAutoUpload" -Action $action -Trigger $trigger -Settings $settings -Description "Sermon folder watcher: registers sermons on the church homepage" -Force | Out-Null
Start-ScheduledTask -TaskName "SermonAutoUpload"
Write-Host "Registered: SermonAutoUpload (every 10 min, $pyw)" -ForegroundColor Green

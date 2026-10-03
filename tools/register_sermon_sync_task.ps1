# 설교 자동 올리기 예약 작업 등록 (2026-10-03)
#   로그인할 때 시작해서 10분마다 tools\sermon_sync.py 를 창 없이(pythonw) 실행한다.
#   실행: powershell -NoProfile -ExecutionPolicy Bypass -File register_sermon_sync_task.ps1
$ErrorActionPreference = "Stop"
$toolsDir = $PSScriptRoot
$script = Join-Path $toolsDir "sermon_sync.py"
$pyw = (Get-Command pythonw.exe -ErrorAction SilentlyContinue | Where-Object { $_.Source -notmatch "WindowsApps" } | Select-Object -First 1).Source
if (-not $pyw) { $pyw = (Get-Command pythonw.exe).Source }

$action = New-ScheduledTaskAction -Execute $pyw -Argument "`"$script`"" -WorkingDirectory $toolsDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$trigger.Repetition = (New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration (New-TimeSpan -Days 3650)).Repetition
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 40) -StartWhenAvailable -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName "SermonAutoUpload" -Action $action -Trigger $trigger -Settings $settings -Description "설교 폴더를 지켜보다 홈페이지 설교관리에 자동 등록" -Force | Out-Null
Start-ScheduledTask -TaskName "SermonAutoUpload"
Write-Host "등록했습니다: SermonAutoUpload (로그인 후 10분마다, $pyw)" -ForegroundColor Green

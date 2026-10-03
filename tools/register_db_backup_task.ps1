# 홈페이지 DB 백업 예약 작업 등록 (2026-10-03)
#   매일 02:30 에 tools\db_backup.py 를 창 없이(pythonw) 실행한다. 그 시각에 컴퓨터가 꺼져 있었으면 켜진 뒤 바로 돈다.
#   실행: powershell -NoProfile -ExecutionPolicy Bypass -File register_db_backup_task.ps1
$ErrorActionPreference = "Stop"
$toolsDir = $PSScriptRoot
$script = Join-Path $toolsDir "db_backup.py"
$pyw = (Get-Command pythonw.exe -ErrorAction SilentlyContinue | Where-Object { $_.Source -notmatch "WindowsApps" } | Select-Object -First 1).Source
if (-not $pyw) { $pyw = (Get-Command pythonw.exe).Source }

$action = New-ScheduledTaskAction -Execute $pyw -Argument "`"$script`"" -WorkingDirectory $toolsDir
$trigger = New-ScheduledTaskTrigger -Daily -At "02:30"
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 2) -StartWhenAvailable -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName "DbBackupNightly" -Action $action -Trigger $trigger -Settings $settings -Description "Church homepage: nightly database backup to D:\church folder" -Force | Out-Null
Write-Host "Registered: DbBackupNightly (daily 02:30, $pyw)" -ForegroundColor Green

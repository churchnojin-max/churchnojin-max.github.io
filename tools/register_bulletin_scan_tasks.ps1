# Registers Saturday scheduled scans for the bulletin auto-upload tool.
# 14:00 / 18:00 / 22:00 : fill fields + save draft, notify via Telegram
# 23:59                 : same, and also auto-publish if not published yet
$ErrorActionPreference = "Stop"
$toolsDir = $PSScriptRoot
$bat = Join-Path $toolsDir "bulletin_scan.bat"

$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 20) -StartWhenAvailable

function Register-ScanTask($name, $time, $extraArgs) {
    if ($extraArgs) {
        $action = New-ScheduledTaskAction -Execute $bat -Argument $extraArgs -WorkingDirectory $toolsDir
    } else {
        $action = New-ScheduledTaskAction -Execute $bat -WorkingDirectory $toolsDir
    }
    $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Saturday -At $time
    Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Description "Church bulletin auto-upload scan" -Force | Out-Null
    Write-Host "Registered: $name ($time)"
}

Register-ScanTask "BulletinAutoUpload_1400" "14:00" $null
Register-ScanTask "BulletinAutoUpload_1800" "18:00" $null
Register-ScanTask "BulletinAutoUpload_2200" "22:00" $null
Register-ScanTask "BulletinAutoUpload_2359" "23:59" "--publish"

Write-Host ""
Write-Host "Done." -ForegroundColor Green

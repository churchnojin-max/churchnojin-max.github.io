# 변환용으로 뒤에서 띄운 한글(화면 없는 자동화 한글)만 정리한다.
# 목사님이 직접 연 한글 창은 명령줄에 -Automation 이 없으므로 절대 건드리지 않는다.
# 사용:
#   hwp_cleanup.ps1 -Since "2026-10-14T12:00:00"   그 시각 뒤에 뜬 자동화 한글만
#   hwp_cleanup.ps1 -OlderThanMin 30                30분 넘게 남아 있는 자동화 한글만 (남은 찌꺼기 청소)
param(
  [string]$Since = "",
  [int]$OlderThanMin = 0
)

$now = Get-Date
$procs = Get-CimInstance Win32_Process -Filter "Name='Hwp.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match '-Automation' }

foreach ($p in $procs) {
  $born = $p.CreationDate
  if ($Since -ne "" -and $born -lt [datetime]$Since) { continue }
  if ($OlderThanMin -gt 0 -and ($now - $born).TotalMinutes -lt $OlderThanMin) { continue }
  try {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
    Write-Output ("정리함: Hwp {0} (뜬 시각 {1:yyyy-MM-dd HH:mm})" -f $p.ProcessId, $born)
  } catch {}
}

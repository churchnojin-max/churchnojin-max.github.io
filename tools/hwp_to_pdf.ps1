# hwpx -> pdf 변환 (한글 프로그램 COM 자동화)
# 사용: powershell -NoProfile -ExecutionPolicy Bypass -File hwp_to_pdf.ps1 -SrcPath "..." -PdfPath "..."
#
# 원본은 열지 않고 임시 폴더에 복사한 사본을 연다.
# (2026-10-07: 변환이 중간에 끊겨 숨은 한글이 원본 에베소서(22).hwpx 를 일주일 동안 붙잡고 있었고,
#  그 때문에 목사님이 그 파일을 열면 [읽기 전용]으로 열렸다. 사본을 열면 그런 일이 생겨도 원본은 자유롭다.)
param(
  [Parameter(Mandatory = $true)][string]$SrcPath,
  [Parameter(Mandatory = $true)][string]$PdfPath
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class W32Fg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@

if (-not (Test-Path -LiteralPath $SrcPath)) {
  Write-Error "원본 파일을 찾을 수 없습니다: $SrcPath"
  exit 1
}

$ext = [IO.Path]::GetExtension($SrcPath)
$fmt = if ($ext -ieq ".hwp") { "HWP" } else { "HWPX" }
$tmpDir = Join-Path $env:TEMP "nojin_hwp2pdf"
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
$copy = Join-Path $tmpDir ([guid]::NewGuid().ToString("N") + $ext)
Copy-Item -LiteralPath $SrcPath -Destination $copy -Force

$prevFg = [W32Fg]::GetForegroundWindow()
$hwp = $null
try {
  $hwp = New-Object -ComObject HWPFrame.HwpObject
  $hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModuleExample") | Out-Null
  $hwp.XHwpWindows.Item(0).Visible = $false
  [W32Fg]::SetForegroundWindow($prevFg) | Out-Null

  $hwp.Open($copy, $fmt, "")
  $hwp.SaveAs($PdfPath, "PDF", "")
  Write-Output "OK: $PdfPath"
}
finally {
  if ($hwp) {
    try { $hwp.Clear(1) } catch {}
    try { $hwp.Quit() } catch {}
    try { [Runtime.InteropServices.Marshal]::ReleaseComObject($hwp) | Out-Null } catch {}
  }
  Start-Sleep -Milliseconds 500
  # 지난 사본(1시간 넘은 것)과 이번 사본 정리 — 아직 잡혀 있으면 다음 번에 지운다
  Get-ChildItem -LiteralPath $tmpDir -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -eq $copy -or $_.LastWriteTime -lt (Get-Date).AddHours(-1) } |
    ForEach-Object { try { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop } catch {} }
}

# ============================================================
#  집 PC 설정 — 사무실 PC와 같은 작업 환경 만들기
#  PowerShell 을 "관리자 권한으로 실행" 한 뒤 이 파일을 실행하세요.
#      powershell -ExecutionPolicy Bypass -File 집PC-설정.ps1
#
#  하는 일: winget 으로 Git·Node·Tailscale 설치 → 저장소 내려받기 →
#           Claude Code 설치까지. (SSH 키 등록은 안내만 하고 사람이 직접)
# ============================================================

$ErrorActionPreference = "Stop"
function Step($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "  OK  $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  !!  $m" -ForegroundColor Yellow }

# 사무실 PC 와 '같은 경로'를 써야 Claude 의 기억(memory)·프로젝트 설정이 그대로 이어집니다.
# Claude Code 는 프로젝트 폴더 경로로 기억을 구분하기 때문에 경로가 다르면 딴 프로젝트가 됩니다.
$REPO = "D:\노진교회홈페이지"
$GIT_URL = "git@github.com:churchnojin-max/churchnojin-max.github.io.git"

Step "1) 필수 프로그램 설치 (winget)"
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Warn "winget 이 없습니다. Microsoft Store 에서 '앱 설치 관리자'를 먼저 설치하세요."
  exit 1
}
foreach ($pkg in @(
  @{id="Git.Git";          name="Git"},
  @{id="OpenJS.NodeJS.LTS";name="Node.js"},
  @{id="tailscale.tailscale"; name="Tailscale"}
)) {
  Write-Host "  - $($pkg.name) 확인 중..."
  winget install --id $($pkg.id) --silent --accept-package-agreements --accept-source-agreements 2>$null | Out-Null
  Ok "$($pkg.name)"
}

Step "2) SSH 키 준비"
$sshDir = "$env:USERPROFILE\.ssh"
if (-not (Test-Path "$sshDir\id_ed25519")) {
  if (-not (Test-Path $sshDir)) { New-Item -ItemType Directory $sshDir | Out-Null }
  ssh-keygen -t ed25519 -N '""' -f "$sshDir\id_ed25519" | Out-Null
  Ok "새 SSH 키를 만들었습니다."
} else {
  Ok "이미 SSH 키가 있습니다."
}
Write-Host ""
Write-Host "  ▼ 아래 공개키를 GitHub 에 등록하세요 (한 번만)" -ForegroundColor Yellow
Write-Host "    https://github.com/settings/ssh/new  →  Key 칸에 붙여넣기" -ForegroundColor Yellow
Write-Host ""
Get-Content "$sshDir\id_ed25519.pub"
Write-Host ""
Read-Host "  등록을 마쳤으면 Enter 를 누르세요"

Step "3) 저장소 내려받기"
if (Test-Path $REPO) {
  Ok "이미 있습니다: $REPO  (git pull 로 최신화합니다)"
  Push-Location $REPO; git pull; Pop-Location
} else {
  $parent = Split-Path $REPO
  if (-not (Test-Path $parent)) {
    Warn "$parent 드라이브가 없습니다. 스크립트 위쪽 `$REPO 경로를 집 PC 에 맞게 고친 뒤 다시 실행하세요."
    Warn "단, 사무실과 경로가 다르면 Claude 의 기억이 이어지지 않습니다."
    exit 1
  }
  git clone $GIT_URL $REPO
  Ok "내려받기 완료: $REPO"
}

Step "4) Claude Code 설치"
npm install -g @anthropic-ai/claude-code
Ok "설치 완료 — 터미널에서 claude 명령으로 실행합니다."

Step "5) Tailscale 로그인"
Warn "작업표시줄의 Tailscale 아이콘 → Log in → 사무실 PC 와 '같은 계정'으로 로그인하세요."

Write-Host ""
Write-Host "끝났습니다. 남은 것은 사무실 PC 쪽 설정입니다:" -ForegroundColor Cyan
Write-Host "  · 윈도우 계정 비밀번호 설정 (비밀번호 없으면 원격접속 불가)"
Write-Host "  · 설정 ▸ 시스템 ▸ 원격 데스크톱  켜기"
Write-Host "  · 설정 ▸ 시스템 ▸ 전원  절전 '안 함'"
Write-Host ""
Write-Host "그 다음 집에서 접속: 시작 → '원격 데스크톱 연결' → 컴퓨터 이름에 desktop-4aamb8m" -ForegroundColor Cyan

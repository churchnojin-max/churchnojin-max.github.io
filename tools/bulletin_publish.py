#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
완성된 주보 hwpx 파일을 홈페이지 관리자 화면(주보 제작)에 자동으로 올려
날짜/제목/본문/설교자/예배순서/예물명단/말씀요약/교회소식/PDF까지 채워서
"임시저장"까지 해 둔다. 실제 "게시" 버튼은 사람이 확인 후 직접 누른다.

사용법:
    python bulletin_publish.py                 (2026주보 폴더에서 가장 최근 hwpx 자동 선택)
    python bulletin_publish.py "경로\26년9월20일 주보.hwpx"

동작 개요:
  1) hwpx 파일 선택 (인자 없으면 최신 파일 자동 탐색)
  2) 파일명에서 주일 날짜 추출
  3) 같은 이름의 .pdf가 이미 있으면 그걸 쓰고, 없으면 한글(HWP)로 새로 PDF 변환
  4) 관리자 화면 전용 크롬 창을 (없으면) 띄우고 연결 — 로그인 상태가 유지되도록
     이 창은 스크립트가 끝나도 닫지 않는다. 다음 실행 때 로그인이 남아있으면
     그대로 이어서 진행하고, 로그아웃돼 있으면 알림 창을 띄우고 기다린다.
  5) 주보제작 탭 -> 해당 날짜 주보(있으면 수정, 없으면 새로 작성) 열기
  6) hwpx 업로드(내용 자동 채움) -> pdf 업로드(게시용 파일) -> 임시저장
  7) 창은 그대로 열어두고 안내 메시지 출력 (게시 버튼은 사람이 누름)
"""

import ctypes
import re
import subprocess
import sys
import time
import zipfile
from pathlib import Path

from playwright.sync_api import sync_playwright

# 콘솔/로그 파일이 cp949일 때 ✓ 같은 특수문자에서 죽지 않도록 강제로 UTF-8 출력
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BULLETIN_ROOT = Path(r"C:\Users\PC\Desktop\노진교회\2026주보")
SITE_URL = "https://nojin.kr/affairs.html"
DEBUG_PORT = 9317
PROFILE_DIR = Path(r"C:\Users\PC\AppData\Local\ChurchBulletinBrowser")
PS_CONVERTER = Path(__file__).parent / "hwp_to_pdf.ps1"
HWP_CLEANUP = Path(__file__).parent / "hwp_cleanup.ps1"


def log(msg):
    print(msg, flush=True)


def msgbox(text, title="주보 홈페이지 올리기"):
    # MB_OK | MB_ICONINFORMATION | MB_TOPMOST | MB_SETFOREGROUND
    ctypes.windll.user32.MessageBoxW(0, text, title, 0x00000040 | 0x00040000 | 0x00010000)


# ── 1) hwpx 파일 찾기 ──────────────────────────────────────────
def find_latest_hwpx():
    candidates = [
        p for p in BULLETIN_ROOT.rglob("*.hwpx")
        if "초안" not in p.name and "임시" not in p.name
    ]
    if not candidates:
        raise SystemExit(f"hwpx 파일을 찾지 못했습니다: {BULLETIN_ROOT}")
    return max(candidates, key=lambda p: p.stat().st_mtime)


KOREAN_DATE_RE = re.compile(r"(\d{2,4})\s*년\s*0?(\d{1,2})\s*월\s*0?(\d{1,2})\s*일")
ISO_DATE_RE = re.compile(r"(\d{4})-(\d{2})-(\d{2})")


def parse_date_from_name(name):
    m = ISO_DATE_RE.search(name)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = KOREAN_DATE_RE.search(name)
    if m:
        y = m.group(1)
        y = "20" + y if len(y) == 2 else y
        return f"{y}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    return None


# ── 2) hwpx -> pdf ─────────────────────────────────────────────
def ensure_pdf(hwpx_path: Path) -> Path:
    pdf_path = hwpx_path.with_suffix(".pdf")
    if pdf_path.exists() and pdf_path.stat().st_mtime >= hwpx_path.stat().st_mtime:
        log(f"이미 있는 PDF를 씁니다: {pdf_path.name}")
        return pdf_path
    log("한글(HWP)로 PDF를 새로 만드는 중… (몇 초 걸릴 수 있습니다)")
    started = time.strftime("%Y-%m-%dT%H:%M:%S")
    try:
        r = subprocess.run(
            [
                "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass",
                "-File", str(PS_CONVERTER),
                "-SrcPath", str(hwpx_path),
                "-PdfPath", str(pdf_path),
            ],
            capture_output=True, text=True, timeout=120,
        )
    except subprocess.TimeoutExpired:
        # 변환용으로 뒤에서 띄운 한글만 정리 (예전 taskkill /IM Hwp.exe 는 목사님이 쓰던 한글 창까지 꺼 버렸음)
        subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(HWP_CLEANUP), "-Since", started],
                       capture_output=True)
        raise SystemExit(
            "PDF 변환이 2분 넘게 걸려 중단했습니다. 한글(HWP)이 다른 창에서 이미 열려 있으면 "
            "닫고 다시 시도해 주세요."
        )
    if r.returncode != 0 or not pdf_path.exists():
        subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(HWP_CLEANUP), "-Since", started],
                       capture_output=True)
        log(r.stdout)
        log(r.stderr)
        raise SystemExit("PDF 변환에 실패했습니다. 한글(HWP)이 켜져 있으면 닫고 다시 시도해 주세요.")
    log(f"PDF 생성 완료: {pdf_path.name}")
    return pdf_path


# ── 3) 관리자 크롬 창 연결/실행 ────────────────────────────────
def get_chromium_exe():
    base = Path.home() / "AppData" / "Local" / "ms-playwright"
    hits = sorted(base.glob("chromium-*/chrome-win64/chrome.exe"))
    if not hits:
        raise SystemExit(
            "playwright용 크롬을 찾지 못했습니다. 터미널에서 "
            "'python -m playwright install chromium' 을 한 번 실행해 주세요."
        )
    return str(hits[-1])


def launch_admin_browser():
    exe = get_chromium_exe()
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    args = [
        exe,
        f"--remote-debugging-port={DEBUG_PORT}",
        f"--user-data-dir={PROFILE_DIR}",
        "--no-first-run",
        "--no-default-browser-check",
    ]
    DETACHED = 0x00000008 | 0x00000200  # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
    subprocess.Popen(args, creationflags=DETACHED, close_fds=True)
    time.sleep(2.5)


def connect_admin_page(pw):
    try:
        browser = pw.chromium.connect_over_cdp(f"http://localhost:{DEBUG_PORT}")
    except Exception:
        log("관리자 화면용 크롬 창을 새로 엽니다…")
        launch_admin_browser()
        browser = pw.chromium.connect_over_cdp(f"http://localhost:{DEBUG_PORT}")

    ctx = browser.contexts[0] if browser.contexts else browser.new_context()
    page = None
    for pg in ctx.pages:
        if "affairs.html" in pg.url:
            page = pg
            break
    if page is None:
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
    if "affairs.html" not in page.url:
        page.goto(SITE_URL, wait_until="domcontentloaded", timeout=30000)
    page.bring_to_front()
    return page


# ── 4) 로그인 여부 확인 ─────────────────────────────────────────
def is_logged_in(page) -> bool:
    try:
        token = page.evaluate(
            """() => {
                for (const k of Object.keys(sessionStorage)) {
                    if (/^sb-.*-auth-token$/.test(k)) {
                        try {
                            const v = JSON.parse(sessionStorage.getItem(k));
                            const s = v && v.currentSession ? v.currentSession : v;
                            return !!(s && s.access_token);
                        } catch (e) { return false; }
                    }
                }
                return false;
            }"""
        )
        return bool(token)
    except Exception:
        return False


def wait_for_login(page, timeout_sec=600):
    if is_logged_in(page):
        return
    log("로그인이 안 되어 있습니다 — 열린 크롬 창에서 로그인해 주세요.")
    msgbox(
        "관리자 화면에 로그인이 필요합니다.\n\n"
        "지금 뜬 크롬 창 오른쪽 위에서 로그인해 주신 뒤,\n"
        "이 창에서 확인을 눌러주세요.\n\n"
        "(한 번 로그인해 두면, 이 창을 닫지 않는 한 다음 주부터는\n"
        " 다시 로그인 없이 바로 진행됩니다.)"
    )
    start = time.time()
    while time.time() - start < timeout_sec:
        if is_logged_in(page):
            log("로그인이 확인되었습니다. 이어서 진행합니다.")
            return
        time.sleep(2)
    raise SystemExit("로그인 대기 시간이 지났습니다. 다시 실행해 주세요.")


# ── 5) 주보 제작 화면 조작 ──────────────────────────────────────
def open_bulletin_editor(page, bdate: str):
    # 이전 실행이 중간에 끊겨 편집 화면(오버레이)이 열린 채로 남아있을 수 있으므로
    # 항상 새로고침해서 깨끗한 상태에서 시작한다(로그인은 sessionStorage라 유지됨).
    page.reload(wait_until="domcontentloaded")
    page.wait_for_selector('.fin-tabs button[data-t="bulletin"]', timeout=20000)
    page.click('.fin-tabs button[data-t="bulletin"]')
    page.wait_for_selector("#bt_list", timeout=15000)
    # 목록이 로딩될 시간을 조금 준다
    page.wait_for_timeout(800)

    existing_edit_btn = None
    rows = page.locator("table.fin-table tbody tr")
    try:
        count = rows.count()
    except Exception:
        count = 0
    for i in range(count):
        row = rows.nth(i)
        first_cell = row.locator("td").first.inner_text().strip()
        if first_cell == bdate:
            existing_edit_btn = row.locator(".bt-edit")
            break

    if existing_edit_btn is not None:
        log(f"{bdate} 주보가 이미 있어 수정 화면을 엽니다(기존 항목은 유지되고 빈 칸만 채워집니다).")
        existing_edit_btn.click()
    else:
        log(f"{bdate} 주보를 새로 만듭니다.")
        page.click("#bt_new")

    page.wait_for_selector("#bt_bdate", timeout=15000)
    page.fill("#bt_bdate", bdate)


def upload_hwpx_and_pdf(page, hwpx_path: Path, pdf_path: Path):
    log("hwpx 파일을 올려 내용을 자동으로 채우는 중…")
    page.set_input_files("#bt_pdf_file", str(hwpx_path))
    page.wait_for_function(
        """() => {
            const el = document.querySelector('#bt_pdf_msg');
            return el && el.textContent && el.textContent.trim().length > 0
                   && !el.textContent.includes('읽는 중');
        }""",
        timeout=20000,
    )
    msg = page.locator("#bt_pdf_msg").inner_text()
    log(f"  -> {msg}")

    log("게시용 PDF를 올리는 중…")
    page.set_input_files("#bt_pdf_file", str(pdf_path))
    page.wait_for_function(
        """() => {
            const el = document.querySelector('#bt_pdf_msg');
            return el && /올렸습니다|실패/.test(el.textContent || '');
        }""",
        timeout=30000,
    )
    msg = page.locator("#bt_pdf_msg").inner_text()
    log(f"  -> {msg}")


def save_draft(page):
    log("임시저장 하는 중…")
    page.click("#bt_save")
    page.wait_for_function(
        """() => {
            const el = document.querySelector('#bt_msg');
            return el && /저장되었습니다|실패/.test(el.textContent || '');
        }""",
        timeout=15000,
    )
    msg = page.locator("#bt_msg").inner_text()
    log(f"  -> {msg}")


# ── main ─────────────────────────────────────────────────────
def main():
    hwpx_path = Path(sys.argv[1]) if len(sys.argv) > 1 else find_latest_hwpx()
    if not hwpx_path.exists():
        raise SystemExit(f"파일이 없습니다: {hwpx_path}")

    bdate = parse_date_from_name(hwpx_path.name)
    if not bdate:
        raise SystemExit(f"파일 이름에서 날짜를 읽지 못했습니다: {hwpx_path.name}")

    log(f"선택된 주보: {hwpx_path}")
    log(f"주일 날짜: {bdate}")
    ans = input("이 파일로 진행할까요? (Enter=예, 다른 키+Enter=취소) ")
    if ans.strip():
        raise SystemExit("취소했습니다.")

    pdf_path = ensure_pdf(hwpx_path)

    with sync_playwright() as pw:
        page = connect_admin_page(pw)
        wait_for_login(page)
        open_bulletin_editor(page, bdate)
        upload_hwpx_and_pdf(page, hwpx_path, pdf_path)
        save_draft(page)
        page.bring_to_front()

    log("")
    log("=== 완료 ===")
    log("자동으로 채울 수 있는 내용까지 채워서 임시저장 해 두었습니다.")
    log("열려 있는 크롬 창에서 내용을 확인하신 뒤 '🌐 게시' 버튼을 직접 눌러주세요.")


if __name__ == "__main__":
    main()

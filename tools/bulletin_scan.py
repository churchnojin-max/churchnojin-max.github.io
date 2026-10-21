#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
토요일 예약 스캔용. bulletin_publish.py의 핵심 동작(업로드+내용 채움+임시저장)을
재사용하면서, 사람이 없어도 동작하도록 아래를 다르게 한다:
  - 확인 프롬프트(Enter) 없음 — 항상 자동으로 최신 완성본을 찾음
  - 로그인이 안 돼 있으면 화면 앞에서 기다리지 않고, 텔레그램으로 알린 뒤 즉시 종료
    (다음 예약 시간에 다시 시도됨)
  - 이미 처리한 내용이면(hwpx가 안 바뀌었으면) 아무 것도 하지 않고 조용히 종료
  - --publish 옵션을 줬을 때만(토요일 마지막 스캔) "게시"까지 자동으로 함

사용법:
  python bulletin_scan.py            (임시저장까지만 — 변경분 있으면 채워두고 텔레그램 알림)
  python bulletin_scan.py --publish  (변경분 채운 뒤, 아직 게시 전이면 게시까지 자동)
"""

import argparse
import datetime as dt
import json
import sys
import time
from pathlib import Path

import requests
from playwright.sync_api import sync_playwright

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from bulletin_publish import (
    BULLETIN_ROOT,
    connect_admin_page,
    ensure_pdf,
    is_logged_in,
    open_bulletin_editor,
    parse_date_from_name,
    save_draft,
    upload_hwpx_and_pdf,
)

STATE_PATH = Path(__file__).parent / "bulletin_scan_state.json"
TELEGRAM_ENV_PATH = Path(r"D:\클코저장소\텔레그램봇\.env")
LOGIN_NOTIFY_COOLDOWN_SEC = 2 * 3600


def log(msg):
    print(f"[{dt.datetime.now():%Y-%m-%d %H:%M:%S}] {msg}", flush=True)


# ── 텔레그램 알림 (기존 @nojinccBot 재사용) ─────────────────────
def _load_env(path: Path) -> dict:
    env = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env


def notify_telegram(text: str):
    try:
        env = _load_env(TELEGRAM_ENV_PATH)
        token = env["TELEGRAM_BOT_TOKEN"]
        ids = [x.strip() for x in env.get("ALLOWED_USER_IDS", "").split(",") if x.strip()]
        for uid in ids:
            requests.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": int(uid), "text": text},
                timeout=10,
            )
        log(f"텔레그램 알림 전송: {text[:40]}...")
    except Exception as e:
        log(f"[텔레그램 알림 실패] {e}")


# ── 상태 저장(날짜별로 이미 처리했는지 기억) ───────────────────
def load_state() -> dict:
    if STATE_PATH.exists():
        try:
            return json.loads(STATE_PATH.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_state(state: dict):
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


# ── 이번 주일자 hwpx 찾기(가장 최근 것이 아니라, 날짜가 맞는 것) ─
def find_hwpx_for_date(target_date: str):
    candidates = [
        p for p in BULLETIN_ROOT.rglob("*.hwpx")
        if "초안" not in p.name and "임시" not in p.name
        and parse_date_from_name(p.name) == target_date
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda p: p.stat().st_mtime)


def publish(page) -> bool:
    page.once("dialog", lambda d: d.accept())
    page.click("#bt_publish")
    page.wait_for_function(
        """() => {
            const el = document.querySelector('#bt_msg');
            return el && /게시되었습니다|실패/.test(el.textContent || '');
        }""",
        timeout=20000,
    )
    msg = page.locator("#bt_msg").inner_text()
    log(f"  -> {msg}")
    return "게시되었습니다" in msg


def run_scan(should_publish: bool):
    target_date = (dt.date.today() + dt.timedelta(days=1)).isoformat()
    log(f"스캔 시작 (대상 주일: {target_date}, 게시모드: {should_publish})")

    state = load_state()
    st = state.get(target_date, {})

    hwpx_path = find_hwpx_for_date(target_date)
    if not hwpx_path:
        log(f"{target_date}자 완성본 hwpx를 아직 찾지 못했습니다.")
        if should_publish:
            notify_telegram(
                f"⚠️ 주보 자동 올리기: 토요일 자정인데 {target_date}자 완성된 주보 파일을 "
                "아직 찾지 못했습니다. 직접 확인해 주세요."
            )
        return

    mtime = hwpx_path.stat().st_mtime
    already_drafted = st.get("drafted") and st.get("hwpx_mtime") == mtime
    already_published = st.get("published", False)

    if already_drafted and (already_published or not should_publish):
        log("변경 사항이 없어 조용히 건너뜁니다.")
        return

    pdf_path = ensure_pdf(hwpx_path)

    with sync_playwright() as pw:
        page = connect_admin_page(pw)

        if not is_logged_in(page):
            log("로그인이 안 되어 있습니다 — 사람이 없어도 되는 스캔이라 기다리지 않고 종료합니다.")
            last_notify = st.get("last_login_notify", 0)
            if time.time() - last_notify > LOGIN_NOTIFY_COOLDOWN_SEC:
                notify_telegram(
                    "⚠️ 주보 자동 올리기: 관리자 로그인이 필요합니다. PC에 이미 열려 있는 "
                    "크롬 창에서 로그인해 주시면, 다음 예약 시간에 자동으로 이어집니다."
                )
                st["last_login_notify"] = time.time()
                state[target_date] = st
                save_state(state)
            return

        open_bulletin_editor(page, target_date)

        if not already_drafted:
            upload_hwpx_and_pdf(page, hwpx_path, pdf_path)
            save_draft(page)
            st["drafted"] = True
            st["hwpx_mtime"] = mtime
            state[target_date] = st
            save_state(state)
            note = "" if should_publish else "\n(확인 안 하셔도 토요일 밤 12시에 자동으로 게시됩니다)"
            notify_telegram(
                f"📋 주보 자동 올리기: {target_date} 주보 내용을 홈페이지 관리자 화면에 "
                f"준비해 두었습니다. 확인 후 게시해 주세요.{note}"
            )

        if should_publish and not already_published:
            log("게시 진행 중…")
            ok = publish(page)
            st["published"] = ok
            state[target_date] = st
            save_state(state)
            if ok:
                notify_telegram(f"✅ 주보 자동 올리기: {target_date} 주보가 홈페이지에 게시되었습니다.")
            else:
                notify_telegram(f"❌ 주보 자동 올리기: {target_date} 주보 게시에 실패했습니다. 확인해 주세요.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--publish", action="store_true", help="변경분을 채운 뒤 게시까지 자동으로 함")
    args = ap.parse_args()
    try:
        run_scan(should_publish=args.publish)
    except Exception as e:
        log(f"[오류] {e}")
        notify_telegram(f"❌ 주보 자동 올리기 스캔 중 오류가 발생했습니다: {e}")
        raise


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
노진교회 홈페이지 — 실시간 예배 방송 확인 (2026-10-04, 사무실 PC 에서 주일 10:20~16:00 2분마다)

목사님 요청: "10시 30분부터 실시간인지 아닌지 확인해서 연동되게 해"
  · 유튜브 채널의 '실시간'(…/live) 화면을 읽어 지금 방송 중인지 본다(API 열쇠 없이).
      - 화면이 영상(watch?v=…)을 가리키고 "isLive":true 이고 예약 방송("isUpcoming":true)이 아니면 → 방송 중
      - 채널 첫 화면으로 가거나, 예약 방송이거나, 끝난 방송이면 → 방송 아님
  · 결과를 Supabase public.site_live 한 줄에 적는다(supabase/site_live_20261004.sql). 매번 checked_at 도 새로.
  · 홈페이지(js/live-status.js)는 이 줄을 읽어 실시간 점·설교 영상 칸을 켜고 끈다.
    6분 넘게 새 소식이 없으면(PC 꺼짐 등) 홈페이지는 시간으로 짐작한다(주일 10:30~16:00).

열쇠: %APPDATA%\\nojin\\supabase_service.key
기록: %APPDATA%\\nojin\\live_watch\\log.txt (방송 시작·끝, 오류만)
예약: tools\\register_live_watch_task.ps1 (LiveWatch: 주일 10:20 부터 2분마다 5시간 40분)
손으로: python tools\\live_watch.py          지금 한 번 확인해서 적기
        python tools\\live_watch.py --dry    적지 않고 결과만 보기
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

CHANNEL_ID = "UCYlesUmTrHecsHYmQNFYY1A"          # @노진교회
SUPABASE_URL = "https://vwuzmklacdwiqyqjrxyt.supabase.co"
APPDATA = Path(os.environ.get("APPDATA", str(Path.home())))
KEY_FILE = APPDATA / "nojin" / "supabase_service.key"
DATA_DIR = APPDATA / "nojin" / "live_watch"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept-Language": "ko-KR,ko;q=0.9"}
KST = timezone(timedelta(hours=9))
DRY = "--dry" in sys.argv


def log(msg):
    line = datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S") + "  " + msg
    if sys.stdout and sys.stdout.isatty() or DRY:
        print(line, flush=True)
    if DRY:
        return
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        p = DATA_DIR / "log.txt"
        if p.exists() and p.stat().st_size > 500_000:
            p.write_text(p.read_text(encoding="utf-8")[-100_000:], encoding="utf-8")
        with p.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


def check_youtube():
    """{'is_live': bool, 'video_id', 'title', 'started_at'}"""
    req = urllib.request.Request(f"https://www.youtube.com/channel/{CHANNEL_ID}/live", headers=UA)
    buf = b""
    with urllib.request.urlopen(req, timeout=30) as r:
        while True:                                  # 페이지가 1MB 넘어서, 필요한 데까지만 읽는다
            chunk = r.read(65536)
            if not chunk:
                break
            buf += chunk
            if b'"isLiveContent"' in buf and b'rel="canonical"' in buf or len(buf) > 2_500_000:
                break
    html = buf.decode("utf-8", "replace")
    m = re.search(r'<link rel="canonical" href="https://www\.youtube\.com/watch\?v=([A-Za-z0-9_-]{11})"', html)
    if not m:
        return {"is_live": False, "video_id": None, "title": None, "started_at": None}
    vid = m.group(1)
    live = bool(re.search(r'"isLive":true', html)) and not re.search(r'"isUpcoming":true', html)
    if not live:
        return {"is_live": False, "video_id": None, "title": None, "started_at": None}
    title = None
    try:                                             # 제목은 가벼운 공식 oEmbed 로
        u = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(f"https://www.youtube.com/watch?v={vid}", safe="")
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=15) as r:
            title = json.loads(r.read().decode("utf-8")).get("title")
    except Exception:
        pass
    st = re.search(r'"startTimestamp":"([^"]+)"', html)
    return {"is_live": True, "video_id": vid, "title": title, "started_at": st.group(1) if st else None}


def save(status):
    key = KEY_FILE.read_text(encoding="utf-8").strip()
    body = dict(status, checked_at=datetime.now(timezone.utc).isoformat())
    req = urllib.request.Request(SUPABASE_URL + "/rest/v1/site_live?id=eq.1", data=json.dumps(body).encode("utf-8"), method="PATCH",
                                 headers={"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json", "Prefer": "return=minimal"})
    urllib.request.urlopen(req, timeout=20).read()


def main():
    try:
        status = check_youtube()
    except Exception as e:
        log("유튜브 확인 실패(다음에 다시): " + type(e).__name__ + " " + str(e)[:120])
        return 0                                     # 적지 않음 → 6분 뒤 홈페이지는 시간으로 짐작
    sp = DATA_DIR / "state.json"
    prev = None
    try:
        prev = json.loads(sp.read_text(encoding="utf-8")).get("is_live")
    except Exception:
        pass
    if DRY:
        print(json.dumps(status, ensure_ascii=False), flush=True)
        return 0
    try:
        save(status)
    except Exception as e:
        log("Supabase 적기 실패: " + type(e).__name__)
        return 0
    if prev != status["is_live"]:
        log(("방송 시작: " + (status.get("title") or status.get("video_id") or "")) if status["is_live"] else "방송 아님(끝났거나 아직)")
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        sp.write_text(json.dumps({"is_live": status["is_live"], "at": datetime.now(KST).isoformat()}), encoding="utf-8")
    except OSError:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())

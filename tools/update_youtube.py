"""노진교회 유튜브 채널의 최근 설교 영상 목록을 data/youtube.json 에 적는다.

'예배와 말씀' 첫 화면 오른쪽의 설교 영상 창(js/sermon-video.js)이 이 파일을 읽어
그 주 주일낮예배 설교 영상을 바로 보여 준다.

- 자동 실행: .github/workflows/youtube.yml (GitHub 가 주일에는 30분마다, 평일에는 6시간마다 실행)
- 손으로 실행: python tools/update_youtube.py   (홈페이지 폴더에서)

API 열쇠 없이 동작한다: 채널의 '라이브'·'동영상' 화면에서 영상 번호를 순서대로 읽고,
제목은 유튜브 공식 oEmbed 로 가져온다. (유튜브 RSS 주소는 2026-10 현재 404 라 쓰지 않음)
아직 시작 안 한 예약 방송·지금 방송 중인 영상(썸네일이 *_live.jpg)은 '지난 설교'에서 뺀다.

영상마다 "date"(한국 날짜, 예: 2026-09-27)도 적는다(2026-10-03 목사님 요청: 주일 당일은 '이번 주', 월요일부터 '지난 주').
영상 페이지의 방송 시작 시각(liveBroadcastDetails.startTimestamp, 없으면 publishDate)을 한국 시각으로 바꾼 날이고,
'주일…' 예배 영상이 주일이 아닌 날 올라왔으면 그 앞 주일로 맞춘다. 한 번 찾은 날짜는 다음에 다시 찾지 않는다.
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta

CHANNEL_ID = "UCYlesUmTrHecsHYmQNFYY1A"          # @노진교회
HANDLE = "@%EB%85%B8%EC%A7%84%EA%B5%90%ED%9A%8C"  # @노진교회 (주소용)
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "youtube.json")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept-Language": "ko-KR,ko;q=0.9"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8", "replace")


def video_ids(tab):
    html = get(f"https://www.youtube.com/{HANDLE}/{tab}")
    ids, live = [], set()
    for vid in re.findall(r'"videoId":"([A-Za-z0-9_-]{11})"', html):
        if vid not in ids:
            ids.append(vid)
    for vid in re.findall(r"/vi/([A-Za-z0-9_-]{11})/[a-z]*default_live\.jpg", html):
        live.add(vid)
    return ids[:12], live


def title_of(vid):
    u = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(f"https://www.youtube.com/watch?v={vid}")
    return json.loads(get(u)).get("title", "")


KST = timezone(timedelta(hours=9))


def date_of(vid, service=""):
    """영상의 한국 날짜 'YYYY-MM-DD'. 못 찾으면 ''"""
    try:
        html = get(f"https://www.youtube.com/watch?v={vid}")
    except Exception:
        return ""
    m = (re.search(r'"liveBroadcastDetails":\{[^}]*?"startTimestamp":"([^"]+)"', html)
         or re.search(r'"publishDate":"([^"]+)"', html)
         or re.search(r'"uploadDate":"([^"]+)"', html))
    if not m:
        return ""
    try:
        d = datetime.fromisoformat(m.group(1).replace("Z", "+00:00")).astimezone(KST).date()
    except ValueError:
        return ""
    if "주일" in service and d.weekday() != 6:          # 주일 예배 영상을 다른 날 올렸으면 그 앞 주일로
        d = d - timedelta(days=(d.weekday() + 1) % 7)
    return d.isoformat()


def split_title(t):
    # "하나님이 나의 상급이십니다 | 창 15:1-6 | 주일낮예배 | 손병민 목사"
    parts = [p.strip() for p in t.split("|")]
    return {
        "title": parts[0] if parts else t,
        "passage": parts[1] if len(parts) > 1 else "",
        "service": parts[2] if len(parts) > 2 else "",
        "preacher": parts[3] if len(parts) > 3 else "",
    }


def main():
    old = None
    if os.path.exists(OUT):
        try:
            with open(OUT, encoding="utf-8") as f:
                old = json.load(f)
        except Exception:
            old = None
    known_dates = {r["id"]: r.get("date") for r in ((old or {}).get("recent") or []) if r.get("date")}
    ids, live = [], set()
    for tab in ("streams", "videos"):
        try:
            t_ids, t_live = video_ids(tab)
        except Exception as e:  # 한쪽이 실패해도 다른 쪽으로
            print(f"[{tab}] 읽기 실패: {e}", file=sys.stderr)
            continue
        live |= t_live
        for v in t_ids:
            if v not in ids:
                ids.append(v)
    recent = []
    for vid in ids:
        if vid in live:
            continue
        try:
            t = title_of(vid)
        except Exception:
            continue  # 비공개·삭제 등
        if not t:
            continue
        parts = split_title(t)
        recent.append(dict(id=vid, full=t, date=known_dates.get(vid) or date_of(vid, parts["service"]), **parts))
        if len(recent) >= 6:
            break
    if not recent:
        print("영상을 하나도 찾지 못해 파일을 그대로 둡니다.", file=sys.stderr)
        return 1
    main_one = next((r for r in recent if "주일낮예배" in r["service"] or "주일낮예배" in r["full"]), recent[0])
    data = {
        "channelId": CHANNEL_ID,
        "sermon": main_one,
        "recent": recent,
        "updated": datetime.now(KST).strftime("%Y-%m-%d %H:%M"),
    }
    if old and old.get("sermon") == data["sermon"] and old.get("recent") == data["recent"]:
        print("바뀐 것 없음:", main_one["title"])
        return 0
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print("새로 적음:", main_one["title"], "/", len(recent), "개")
    return 0


if __name__ == "__main__":
    sys.exit(main())

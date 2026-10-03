#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
'예배와 말씀 > 매일 말씀 묵상'에 띄울 매일성경(성서유니온) 오늘의 본문을 받아
data/daily-bible.json 에 적는다. (GitHub Actions 가 매일 새벽에 실행)

- 받는 것: 제목, 본문 범위, 찬송가 번호, 본문 말씀(개역개정)
- 해설·묵상 글은 받지 않는다(매일성경 저작물). 해설은 매일성경 누리집 링크로 연결.
- 어제부터 7일 뒤까지 받아 두고, 실패하면 있던 자료를 그대로 둔다.
"""
import datetime as dt
import json
import sys
import urllib.request
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BASE = "https://sum.su.or.kr:8888/Ajax/Bible/"
OUT = Path(__file__).resolve().parent.parent / "data" / "daily-bible.json"
KST = dt.timezone(dt.timedelta(hours=9))


def post(endpoint, date):
    body = ("{ 'qt_ty' : 'QT1' , 'Base_de' : '%s'}" % date).encode("utf-8")
    req = urllib.request.Request(BASE + endpoint, data=body, method="POST", headers={
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": "Mozilla/5.0 (nojin church homepage daily bible)",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch_day(date):
    info = post("BodyMatterDetail", date)
    verses = post("BodyBible", date)
    book = (info.get("Bible_name") or "").strip()
    rng = (info.get("Bible_chapter") or "").strip()
    if not book or not verses:
        return None
    # "사사기(Judges)" → "사사기",  "15:1 - 15:20" → "15:1-20"
    book_ko = book.split("(")[0].strip()
    a, _, b = [x.strip() for x in rng.partition("-")]
    if b and a.split(":")[0] == b.split(":")[0]:
        b = b.split(":")[1]
    ref = f"{book_ko} {a}" + (f"-{b}" if b else "")
    # 장·절·찬송 번호는 숫자로만 받는다(그쪽 사이트 값이 그대로 화면에 들어가지 않게)
    def num(x):
        try:
            return int(str(x).strip())
        except (TypeError, ValueError):
            return 0
    return {
        "title": (info.get("Qt_sj") or "").strip(),
        "ref": ref,
        "hymn": num(info.get("New_song")),
        "verses": [[num(v.get("Chapter")), num(v.get("Verse")), (v.get("Bible_Cn") or "").strip()] for v in verses],
    }


def main():
    old = {}
    if OUT.exists():
        try:
            old = json.loads(OUT.read_text(encoding="utf-8")).get("days", {})
        except Exception:
            old = {}
    today = dt.datetime.now(KST).date()
    days = {}
    for off in range(-1, 8):
        d = (today + dt.timedelta(days=off)).isoformat()
        try:
            got = fetch_day(d)
        except Exception as e:  # 한 날짜가 실패해도 나머지는 계속
            print(f"{d} 받기 실패: {e}")
            got = None
        if got and (got["title"] or d not in old):
            days[d] = got
        elif d in old:
            days[d] = old[d]
        print(d, (days.get(d) or {}).get("ref", "(없음)"), (days.get(d) or {}).get("title", ""))
    if not days:
        print("받은 것이 없어 그대로 둡니다.")
        return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    data = {"source": "매일성경(성서유니온선교회) · 성경전서 개역개정판 저작권: 재단법인 대한성서공회",
            "days": dict(sorted(days.items()))}
    new_text = json.dumps(data, ensure_ascii=False, indent=1)
    if OUT.exists() and OUT.read_text(encoding="utf-8") == new_text:
        print("바뀐 것 없음")
        return
    OUT.write_text(new_text, encoding="utf-8")
    print("저장:", OUT)


if __name__ == "__main__":
    main()

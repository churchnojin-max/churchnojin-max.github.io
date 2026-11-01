#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
임시저장해 둔 주보를 정해진 시각에 '게시'한다(관리자 화면의 [게시] 버튼과 같은 일: published=true).
말씀 자료 글 파일을 주면 그 주보의 '설교 요약(summary)' 칸도 그 글로 바꾼다.
게시 전 행 전체를 JSON으로 백업하고, 결과를 텔레그램으로 알린다.

사용법:
  python bulletin_publish_at.py 2026-11-01 [말씀자료.txt]
예약: Windows 작업 스케줄러에 한 번만 도는 작업으로 건다(예: BulletinPublish_20261101).
"""
import datetime as dt
import json
import sys
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

sys.path.insert(0, str(Path(__file__).parent))
import sermon_sync as s
from bulletin_scan import notify_telegram

BACKUP_DIR = Path(r"C:\Users\PC\AppData\Local\ChurchBulletinBrowser\backup")


def log(msg):
    print(f"[{dt.datetime.now():%Y-%m-%d %H:%M:%S}] {msg}", flush=True)


def main():
    bdate = sys.argv[1]
    summary_file = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    st = s.Store(s.load_key())
    rows = st.get(f"bulletins?select=*&bdate=eq.{bdate}")
    if not rows:
        log(f"{bdate} 주보가 홈페이지에 없습니다.")
        notify_telegram(f"❌ 주보 예약 게시: {bdate} 주보가 홈페이지에 없어 게시하지 못했습니다. 관리자 화면에서 확인해 주세요.")
        return 1
    row = rows[0]
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    bk = BACKUP_DIR / f"bulletin_{bdate}_{dt.datetime.now():%Y%m%d_%H%M%S}.json"
    bk.write_text(json.dumps(row, ensure_ascii=False, indent=1), encoding="utf-8")
    log(f"백업: {bk}")

    patch = {"published": True, "updated_at": dt.datetime.now(dt.timezone.utc).isoformat()}
    if summary_file:
        data = dict(row.get("data") or {})
        data["summary"] = summary_file.read_text(encoding="utf-8").strip()
        patch["data"] = data
    st.patch("bulletins", row["id"], patch)

    after = st.get(f"bulletins?select=published,data&id=eq.{row['id']}")[0]
    ok = after.get("published") is True and (not summary_file or after["data"].get("summary") == patch["data"]["summary"])
    log(f"게시 {'완료' if ok else '확인 실패'}: {row.get('title')} ({bdate}), 요약 {len((after.get('data') or {}).get('summary') or '')}자")
    if ok:
        notify_telegram(f"✅ 주보 예약 게시: {bdate} 「{row.get('title')}」 주보와 말씀 자료가 홈페이지에 올라갔습니다.")
    else:
        notify_telegram(f"❌ 주보 예약 게시: {bdate} 주보 게시가 확인되지 않습니다. 관리자 화면에서 확인해 주세요.")
    return 0 if ok else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        log(f"[오류] {e}")
        notify_telegram(f"❌ 주보 예약 게시 중 오류: {e}")
        raise

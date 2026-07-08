#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
○○교회 — 무료 로컬 TTS 도구
로컬에서 만든(또는 MeloTTS로 생성한) QT 음성을 Supabase 저장소(tts-cache 버킷)에 올립니다.
홈페이지는 tts-cache/qt-<날짜>.mp3(또는 .wav)가 있으면 그 음성을 먼저 재생합니다(비용 0).

환경변수(둘 다 필요):
  SUPABASE_URL                (기본값 내장)
  SUPABASE_SERVICE_ROLE_KEY   Supabase → Project Settings → API → service_role (비밀키)
  SUPABASE_ANON_KEY           (선택, QT 조회용. 없으면 service_role 사용)

사용법:
  # ① 영상 프로그램(Voicebox 등)으로 만든 음성 파일 업로드 (파일명에 2026-07-06 처럼 날짜 포함)
  python tts_local.py --from-folder "C:/음성폴더"

  # ② MeloTTS로 최근 QT 음성을 직접 생성·업로드 (MeloTTS 설치 필요)
  python tts_local.py --generate --days 7
"""
import os, sys, json, re, argparse, tempfile, urllib.request, urllib.error

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://YOUR-PROJECT.supabase.co").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
BUCKET = "tts-cache"


def _req(method, url, data=None, headers=None):
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def obj_exists(name):
    st, _ = _req("GET", f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{name}",
                 headers={"Authorization": f"Bearer {SERVICE_KEY}", "apikey": SERVICE_KEY})
    return st == 200


def upload(name, data, content_type):
    return _req("POST", f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{name}", data=data,
                headers={"Authorization": f"Bearer {SERVICE_KEY}", "apikey": SERVICE_KEY,
                         "Content-Type": content_type, "x-upsert": "true"})


def fetch_qt(limit=30):
    key = ANON_KEY or SERVICE_KEY
    url = (f"{SUPABASE_URL}/rest/v1/qt_published?select=sermon_date,title,scripture,"
           f"qt_bible_text,content,prayer&order=sermon_date.desc&limit={limit}")
    st, body = _req("GET", url, headers={"apikey": key, "Authorization": f"Bearer {key}"})
    if st != 200:
        raise SystemExit(f"QT 조회 실패({st}): {body[:200]}")
    return json.loads(body)


def strip_html(s):
    if not s:
        return ""
    s = re.sub(r"<br\s*/?>", "\n", str(s), flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = s.replace("&nbsp;", " ")
    return re.sub(r"\s+", " ", s).strip()


def qt_text(row):
    parts = []
    for k in ("title", "scripture", "qt_bible_text", "content", "prayer"):
        v = row.get(k)
        if v:
            parts.append(strip_html(v) if k in ("content", "prayer") else str(v))
    return ". ".join(parts)


def cmd_from_folder(folder, force):
    n = 0
    for fn in sorted(os.listdir(folder)):
        m = re.search(r"(\d{4}-\d{2}-\d{2})", fn)
        e = os.path.splitext(fn)[1].lower()
        if not m or e not in (".mp3", ".wav"):
            continue
        name = f"qt-{m.group(1)}{e}"
        if not force and obj_exists(name):
            print("건너뜀(이미 있음):", name); continue
        with open(os.path.join(folder, fn), "rb") as f:
            data = f.read()
        st, body = upload(name, data, "audio/mpeg" if e == ".mp3" else "audio/wav")
        ok = st in (200, 201)
        print(("올림 ✓" if ok else f"실패({st})"), name, "" if ok else body[:150])
        n += 1 if ok else 0
    print(f"완료: {n}개 업로드")


def cmd_generate(days, force):
    try:
        from melo.api import TTS
    except Exception as e:
        raise SystemExit("MeloTTS가 설치되어 있지 않습니다. TTS-로컬설치안내.md 참고, 또는 --from-folder 방식을 쓰세요.\n" + str(e))
    model = TTS(language="KR", device="cpu")
    spk2id = model.hps.data.spk2id
    spk = spk2id.get("KR") if hasattr(spk2id, "get") else list(spk2id.values())[0]
    n = 0
    for row in fetch_qt(limit=days):
        d = str(row.get("sermon_date", ""))[:10]
        if not d:
            continue
        name = f"qt-{d}.wav"
        if not force and obj_exists(name):
            print("건너뜀(이미 있음):", name); continue
        text = qt_text(row)
        if not text.strip():
            continue
        tmp = os.path.join(tempfile.gettempdir(), name)
        model.tts_to_file(text[:4000], spk, tmp, speed=1.0)
        with open(tmp, "rb") as f:
            data = f.read()
        st, _ = upload(name, data, "audio/wav")
        ok = st in (200, 201)
        print(("생성·올림 ✓" if ok else f"실패({st})"), name)
        n += 1 if ok else 0
    print(f"완료: {n}개 생성·업로드")


if __name__ == "__main__":
    if not SERVICE_KEY:
        raise SystemExit("환경변수 SUPABASE_SERVICE_ROLE_KEY 를 설정하세요. (Supabase → Project Settings → API → service_role)")
    ap = argparse.ArgumentParser(description="○○교회 무료 로컬 TTS 업로드/생성")
    ap.add_argument("--from-folder", dest="from_folder", help="이 폴더의 오디오(파일명에 YYYY-MM-DD 포함)를 업로드")
    ap.add_argument("--generate", action="store_true", help="MeloTTS로 최근 QT 음성을 직접 생성·업로드")
    ap.add_argument("--days", type=int, default=7, help="--generate 시 최근 며칠분(기본 7)")
    ap.add_argument("--force", action="store_true", help="이미 있어도 덮어씀")
    a = ap.parse_args()
    if a.from_folder:
        cmd_from_folder(a.from_folder, a.force)
    elif a.generate:
        cmd_generate(a.days, a.force)
    else:
        print(__doc__)

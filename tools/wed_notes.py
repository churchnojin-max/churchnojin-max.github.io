# -*- coding: utf-8 -*-
"""
수요기도회 말씀 자료(인용 구절·설교 요약) 만들기 — 2026-10-05 목사님 요청
  "수요예배 때 성도들이 참고할 수 있도록 인용 구절과 설교 요약을 홈페이지에"
  목사님 결정: 예배와 말씀 + 수요일 첫 화면 / 저녁 8시에 한꺼번에 / 로그인한 회원만 / 목사님 확인 뒤 올림
  같은 날 밤 고침: "내 설교를 밖으로 공개하지 않으려는 거야. 오는 사람들에게만 특권" → 본문·제목·핵심 3가지(아주 짧게)·인용 구절만,
  저녁 7시 45분에 열리고 밤 10시 30분에 닫힘(지난 자료 모아 보기 없음). 악보(콘티)는 목사님이 홈페이지에서 올림(이 도구와 상관없음).
  2026-10-07 고침: "8시로 했는데 내가 미리 줄테니 7시 45분쯤에 … 열려져서 자료가 보일 수 있도록" → 여는 시각 저녁 7시 45분.
  화면: js/wed-notes.js · 표: sermon_notes (supabase/sermon_notes_20261005.sql, sermon_notes_short_conti_20261005.sql)

흐름 — 수요일 예약 작업(클로드 '수요 말씀 자료')이 차례로 부른다
  1. check    이번 주 수요 원고가 설교관리(sermons)에 올라왔는지, 자료를 새로 만들 차례인지 (첫 줄 STATUS=…, 밤 10시 30분이 지났으면 PAST)
  2. prepare  원고 + 구절 후보를 JSON 으로. 인용 블록·장절 표기를 bible.js(bible-verse 스킬)로 찾는다.
              → 클로드가 원고를 읽고 note.json(인용 구절 장절 목록·핵심 3가지)을 쓴다
  3. save     note.json → 구절 본문은 bible-verse 자료(bible.js)에서만 가져와 '확인 전(draft)'으로 저장
              → 목사님 텔레그램에 미리보기 + [올리기] 단추(비서봇 sermon_note_actions.py 가 받는다)
  4. remind   저녁 7시 15분이 넘도록 확인 전이면 한 번 더 알림(같은 자료로는 한 번만)
  올린 자료는 그날 저녁 7시 45분(트리거가 정함)부터 로그인한 성도님께 보인다. 목사님(관리자)은 홈페이지에서 미리 보고 고칠 수 있다.

  python tools/wed_notes.py check   [--date 2026-10-07]
  python tools/wed_notes.py prepare [--date …] [--out 파일]
  python tools/wed_notes.py save    note.json [--no-telegram] [--force] [--head "첫 줄"]
  python tools/wed_notes.py remind  [--date …]
  python tools/wed_notes.py show    [--date …]
  python tools/wed_notes.py conti   [--date …] [--dry] [--names "제목1|…"]   원고 속 악보 → 그날 악보(이미 있으면 그대로 둠)
날짜를 안 주면 오늘이 수요일이면 오늘, 아니면 지난 수요일.
열쇠: %APPDATA%\\nojin\\supabase_service.key (화면·기록·텔레그램에 내보내지 않음). 기록: %APPDATA%\\nojin\\wed_notes\\log.txt
"""
import argparse
import datetime as dt
import difflib
import hashlib
import html
import json
import os
import re
import subprocess
import sys
import urllib.parse
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

APPDATA = Path(os.environ.get("APPDATA", str(Path.home())))
DATA_DIR = APPDATA / "nojin" / "wed_notes"
KEY_FILE = APPDATA / "nojin" / "supabase_service.key"
LOG_PATH = DATA_DIR / "log.txt"
STATE_PATH = DATA_DIR / "state.json"
BIBLE_JS = next((p for p in (Path.home() / ".claude/skills/bible-verse/scripts/bible.js",
                             Path(r"C:\Users\PC\.claude\skills\bible-verse\scripts\bible.js")) if p.exists()),
                Path(r"C:\Users\PC\.claude\skills\bible-verse\scripts\bible.js"))
TELEGRAM_ENV_PATH = Path(r"D:\클코저장소\텔레그램봇\.env")
SUPABASE_URL = "https://vwuzmklacdwiqyqjrxyt.supabase.co"   # js/config.js 와 같은 값(공개)
SITE_URL = "https://churchnojin-max.github.io/word.html#wed"
SERVICE = "수요기도회"
KST = dt.timezone(dt.timedelta(hours=9))
OPEN_AT = (19, 45)      # 저녁 7시 45분에 열림(supabase 트리거와 같은 값 — 10/07 8시에서 고침)
CLOSE_AT = (22, 30)     # 밤 10시 30분에 닫힘(supabase 트리거와 같은 값)
REMIND_AFTER = (19, 15)  # 이 시각이 넘도록 확인 전이면 한 번 더 알림(여는 때보다 30분 앞)


def hm_label(h, m):
    """(19, 45) → '저녁 7시 45분'"""
    return ("저녁 " if h >= 17 else "오후 " if h >= 12 else "오전 ") + f"{h - 12 if h > 12 else h}시" + (f" {m}분" if m else "")


OPEN_LABEL = hm_label(*OPEN_AT)


def log(msg):
    line = f"[{dt.datetime.now(KST):%Y-%m-%d %H:%M:%S}] {msg}"
    print(line, flush=True)
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with LOG_PATH.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def load_state():
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_state(s):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(s, ensure_ascii=False, indent=1), encoding="utf-8")


# ── 날짜 ─────────────────────────────────────────────────────
def now_kst():
    return dt.datetime.now(KST)


def default_date():
    t = now_kst().date()
    return t - dt.timedelta(days=(t.weekday() - 2) % 7)     # 월=0 … 수=2


def md(d):
    d = dt.date.fromisoformat(str(d))
    return f"{d.month}월 {d.day}일({'월화수목금토일'[d.weekday()]})"


def opens_at(d):
    return dt.datetime.combine(dt.date.fromisoformat(str(d)), dt.time(*OPEN_AT), KST)


def closes_at(d):
    return dt.datetime.combine(dt.date.fromisoformat(str(d)), dt.time(*CLOSE_AT), KST)


# ── 창고(Supabase, service_role) ──────────────────────────────
class Store:
    def __init__(self):
        import requests
        self.rq = requests
        key = KEY_FILE.read_text(encoding="utf-8").strip()
        self.h = {"apikey": key, "Authorization": "Bearer " + key}

    def get(self, q):
        r = self.rq.get(f"{SUPABASE_URL}/rest/v1/{q}", headers=self.h, timeout=30)
        if r.status_code >= 300:
            raise RuntimeError(f"조회 실패 {r.status_code}: {r.text[:200]}")
        return r.json()

    def post(self, table, data):
        r = self.rq.post(f"{SUPABASE_URL}/rest/v1/{table}", headers={**self.h, "Content-Type": "application/json", "Prefer": "return=representation"}, json=data, timeout=30)
        if r.status_code >= 300:
            raise RuntimeError(f"저장 실패 {r.status_code}: {r.text[:200]}")
        return r.json()[0]

    def patch(self, table, q, data):
        r = self.rq.patch(f"{SUPABASE_URL}/rest/v1/{table}?{q}", headers={**self.h, "Content-Type": "application/json", "Prefer": "return=representation"}, json=data, timeout=30)
        if r.status_code >= 300:
            raise RuntimeError(f"고치기 실패 {r.status_code}: {r.text[:200]}")
        return r.json()


def q(v):
    return urllib.parse.quote(str(v), safe="")


def get_sermon(st, date):
    rows = st.get(f"sermons?select=id,sermon_date,title,scripture,preacher,series,content,bible_text"
                  f"&service=eq.{q(SERVICE)}&sermon_date=eq.{date}&order=created_at.desc&limit=1")
    return rows[0] if rows else None


def get_note(st, date):
    rows = st.get(f"sermon_notes?select=*&service=eq.{q(SERVICE)}&note_date=eq.{date}")
    return rows[0] if rows else None


def source_hash(s):
    raw = "\n".join([s.get("title") or "", s.get("scripture") or "", s.get("content") or ""])
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


# ── 성경(bible-verse 스킬의 bible.js — 구절은 기억으로 쓰지 않는다) ──
BOOKS = [
    ("창세기", "창"), ("출애굽기", "출"), ("레위기", "레"), ("민수기", "민"), ("신명기", "신"), ("여호수아", "수"),
    ("사사기", "삿"), ("룻기", "룻"), ("사무엘상", "삼상"), ("사무엘하", "삼하"), ("열왕기상", "왕상"), ("열왕기하", "왕하"),
    ("역대상", "대상"), ("역대하", "대하"), ("에스라", "스"), ("느헤미야", "느"), ("에스더", "에"), ("욥기", "욥"),
    ("시편", "시"), ("잠언", "잠"), ("전도서", "전"), ("아가", "아"), ("이사야", "사"), ("예레미야", "렘"),
    ("예레미야애가", "애"), ("에스겔", "겔"), ("다니엘", "단"), ("호세아", "호"), ("요엘", "욜"), ("아모스", "암"),
    ("오바댜", "옵"), ("요나", "욘"), ("미가", "미"), ("나훔", "나"), ("하박국", "합"), ("스바냐", "습"),
    ("학개", "학"), ("스가랴", "슥"), ("말라기", "말"), ("마태복음", "마"), ("마가복음", "막"), ("누가복음", "눅"),
    ("요한복음", "요"), ("사도행전", "행"), ("로마서", "롬"), ("고린도전서", "고전"), ("고린도후서", "고후"),
    ("갈라디아서", "갈"), ("에베소서", "엡"), ("빌립보서", "빌"), ("골로새서", "골"), ("데살로니가전서", "살전"),
    ("데살로니가후서", "살후"), ("디모데전서", "딤전"), ("디모데후서", "딤후"), ("디도서", "딛"), ("빌레몬서", "몬"),
    ("히브리서", "히"), ("야고보서", "약"), ("베드로전서", "벧전"), ("베드로후서", "벧후"), ("요한일서", "요일"),
    ("요한이서", "요이"), ("요한삼서", "요삼"), ("유다서", "유"), ("요한계시록", "계"),
]
ABBR2FULL = {a: f for f, a in BOOKS}
_names = sorted([f for f, _ in BOOKS] + [a for _, a in BOOKS], key=len, reverse=True)
BOOK_RE = "|".join(_names)
# 에베소서 3:6 / 엡 3:7~9 / 요한계시록 21장 3절 / 창세기 50장 20절 / 빌립보서 1:12-14
REF_RE = re.compile(r"(?<![가-힣])(" + BOOK_RE + r")\s?(\d{1,3})\s*(?:(?:장|편)\s*(\d{1,3})\s*절?|[:：]\s*(\d{1,3}))"
                    r"(?:\s*[-~–]\s*(?:(\d{1,3})\s*[:：]\s*)?(\d{1,3})\s*절?)?")
CHAP_RE = re.compile(r"(?<![가-힣])(" + BOOK_RE + r")\s?(\d{1,3})\s*(?:장|편)(?!\s*\d)")
BARE_RE = re.compile(r"(?<![가-힣\d:])(\d{1,3})\s*장\s*(\d{1,3})\s*절")    # 책 이름 없이 '1장 20절' → 본문 책

_lookup_cache = {}


def _node(args):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = DATA_DIR / "_q.txt"
    tmp.write_text(args[-1], encoding="utf-8")
    r = subprocess.run(["node", str(BIBLE_JS)] + args[:-1] + ["--파일", str(tmp)], capture_output=True, timeout=90)
    return r.stdout.decode("utf-8", "replace")


def lookup(ref):
    """장절 → (정식 장절, [{"v":절,"t":본문}] 또는 장이 넘어가면 {"c","v","t"}) / 못 읽으면 (None, None)"""
    ref = re.sub(r"[–—－]", "~", str(ref or "")).strip()
    ref = re.sub(r"(\d+)\s*장\s*(\d+)\s*절\s*(?:~|에서)\s*(\d+)\s*장\s*(\d+)\s*절", r"\1:\2~\3:\4", ref)
    ref = re.sub(r"(\d+)\s*장\s*(\d+)\s*절\s*(?:~|에서)\s*(\d+)\s*절", r"\1:\2~\3", ref)
    ref = re.sub(r"(\d+)\s*(?:장|편)\s*(\d+)\s*절?", r"\1:\2", ref)
    ref = re.sub(r"\s+", " ", ref).strip(" []()")
    if not ref:
        return None, None
    if ref in _lookup_cache:
        return _lookup_cache[ref]
    out = _node(["찾기", ref])
    m = re.search(r"^◎\s*(.+?)\s*$", out, re.M)
    if not m or "(없음)" in out or "읽지 못했습니다" in out:
        _lookup_cache[ref] = (None, None)
        return None, None
    lines = []
    for l in out.split("\n"):
        mm = re.match(r"^\s+(?:(\d+):)?(\d+)\s+(.+?)\s*$", l)
        if mm and not l.startswith("◎"):
            item = {"v": int(mm.group(2)), "t": mm.group(3)}
            if mm.group(1):
                item["c"] = int(mm.group(1))
            lines.append(item)
    _lookup_cache[ref] = (m.group(1).strip(), lines) if lines else (None, None)
    return _lookup_cache[ref]


def search_words(words, maxn=8):
    """낱말로 찾기 → [(약칭, 장, 절, 본문)]"""
    out = _node(["낱말", "--최대", str(maxn), words])
    return [(a, int(c), int(v), t) for a, c, v, t in re.findall(r"^\s+(\S+)\s(\d+):(\d+)\s(.+?)\s*$", out, re.M)]


def _norm(t):
    return re.sub(r"[^가-힣0-9A-Za-z]", "", t or "")


def coverage(verse, quote):
    """절 본문이 인용 글 안에 얼마나 들어 있나(0~1)"""
    a, b = _norm(verse), _norm(quote)
    if not a or not b:
        return 0.0
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    return sum(x.size for x in sm.get_matching_blocks()) / len(a)


def parse_canon(canon):
    """'에베소서 3:7~9' → (책, 장1, 절1, 장2, 절2)"""
    m = re.match(r"^(\S+)\s(\d+):(\d+)(?:~(?:(\d+):)?(\d+))?$", canon or "")
    if not m:
        return None
    b, c1, v1 = m.group(1), int(m.group(2)), int(m.group(3))
    c2 = int(m.group(4)) if m.group(4) else c1
    v2 = int(m.group(5)) if m.group(5) else v1
    return b, c1, v1, c2, v2


def inside(canon, passage):
    a, p = parse_canon(canon), parse_canon(passage)
    if not a or not p or a[0] != p[0]:
        return False
    return (p[1], p[2]) <= (a[1], a[2]) and (a[3], a[4]) <= (p[3], p[4])


def ref_text(m):
    """REF_RE 결과를 bible.js 가 읽는 글로"""
    book, c, v1, v1b, c2, v2 = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5), m.group(6)
    v = v1 or v1b
    s = f"{book} {c}:{v}"
    if v2:
        s += f"~{c2}:{v2}" if c2 else f"~{v2}"
    return s


def find_quote(quote, passage_book=None):
    """인용 블록 글 → 정식 장절(가장 잘 맞는 절) / 못 찾으면 None. (장절, 방법, 맞음 정도)"""
    m = REF_RE.search(quote)
    if m:
        canon, _ = lookup(ref_text(m))
        if canon:
            return canon, "장절 표기", 1.0
    num = re.match(r"^\s*(\d{1,3})\s*[.)]?\s+", quote)
    t = re.sub(r"^\s*\d{1,3}\s*[.)]?\s+", "", quote)
    t = re.sub(r"\([^)]*\)\s*$", "", t).strip()
    words = [w for w in re.sub(r"[\"“”‘’'.,?!·…]", " ", t).split() if w]
    if len(words) < 2:
        return None
    best = None
    for ws in (words[:5], words[1:6], words[-5:], words[:3]):
        qtxt = " ".join(ws)
        if len(qtxt) < 6:
            continue
        for a, c, v, vt in search_words(qtxt):
            cov = coverage(vt, t)
            if num and int(num.group(1)) == v:
                cov += 0.05
            if passage_book and ABBR2FULL.get(a) == passage_book:
                cov += 0.02
            if not best or cov > best[0]:
                best = (cov, a, c, v)
        if best and best[0] >= 0.9:
            break
    if best and best[0] >= 0.7:
        canon, _ = lookup(f"{best[1]} {best[2]}:{best[3]}")
        if canon:
            return canon, "글로 찾음", round(min(best[0], 1.0), 2)
    return None


# ── 원고(HTML) → 순서대로 (글/인용) ───────────────────────────
def _lines(h):
    h = re.sub(r"<(?:/p|br\s*/?|/h\d|/li|/div)>", "\n", h, flags=re.I)
    t = html.unescape(re.sub(r"<[^>]+>", "", h))
    return [re.sub(r"\s+", " ", l).strip() for l in t.split("\n") if l.strip()]


def segments(content):
    segs, pos = [], 0
    for m in re.finditer(r"<blockquote[^>]*>(.*?)</blockquote>", content or "", re.S | re.I):
        segs += [("글", l) for l in _lines(content[pos:m.start()])]
        qt = " ".join(_lines(m.group(1)))
        if qt:
            segs.append(("인용", qt))
        pos = m.end()
    segs += [("글", l) for l in _lines((content or "")[pos:])]
    return segs


def guess_series(s, passage_book):
    title = (s.get("title") or "").strip()
    m = re.search(r"\s*\((\d+)\s*강\)\s*$", title)
    n = m.group(1) if m else None
    clean = title[:m.start()].strip() if m else title
    series = (s.get("series") or "").strip() or (f"{passage_book} 강해" if passage_book else "")
    if n and series and not re.search(r"\d+\s*강", series):
        series = f"{series} {n}강"
    return clean, series


# ── ^ 표시 구절 · 원고 속 악보 (2026-10-07 목사님) ─────────────
#   "인용 구절 넣을 부분에 내가 ^ 표시를 했거든? 이 표시가 들어간 것들의 성경 구절을 다 검색해서 띄워줘야 돼."
#   "원고에 텍스트도 있고 이미지 파일도 있거든? … PDF 사진 따로 올리고 이러면 서로 힘들어."
#   → 원고에 ^ 가 있으면 인용 구절은 ^ 바로 앞의 장절만, 설교 순서대로(오늘 본문 안 구절은 '오늘 본문'으로 따로 나와 뺀다).
#     "5절^"·"2장 13절^"처럼 책·장을 안 쓰면 오늘 본문의 책·장으로 본다. "(1:23)^"·"고린도전서 4:2^"도 읽는다.
#   → 원고(hwpx·docx) 속 그림은 찬양 악보로 보고 'conti' 명령이 그날 악보(sermon_conti)로 올린다.
CARET_RE = re.compile(r"(?:([가-힣]{1,6})\s*)?\(?\s*(?:(\d{1,3})\s*(?:장\s*|[:：]\s*))?(\d{1,3})\s*절?\s*\)?\s*\^")


def caret_refs(content, passage):
    """원고의 ^ 표시 → [(정식 장절 또는 None, 원고에 쓴 글)] (설교 순서, 겹치면 한 번)"""
    text = html.unescape(re.sub(r"<[^>]+>", " ", content or ""))
    p = parse_canon(passage) if passage else None
    out, seen = [], set()
    for m in CARET_RE.finditer(text):
        book, ch, v = m.group(1), m.group(2), m.group(3)
        tries = []
        if book:
            tries.append(f"{book} {ch or (p[1] if p else 1)}:{v}")
        if p:
            tries.append(f"{p[0]} {ch or p[1]}:{v}")
        canon = next((c for c in (lookup(t)[0] for t in tries) if c), None)
        said = text[max(0, m.start(3) - 8): m.end()].strip()
        if not canon:
            out.append((None, said))
        elif canon not in seen:
            seen.add(canon)
            out.append((canon, said))
    return out


def cited_refs(content, passage):
    """인용 구절 = ^ 표시 구절 + 원고에서 따로 떼어 읽은 인용 블록 구절, 설교 순서대로 (2026-10-07 목사님:
       "^ 표시가 없어도 누가 봐도 인용한 거면 넣어야지. 본문에 있으면 안 넣고 반복되는 건 넣을 필요가 없고")
       → [(정식 장절 또는 None, 어떻게 찾았나)] — 본문 안·겹친 것은 resolve 가 뺀다"""
    pb = parse_canon(passage)[0] if passage else None
    out = []
    for kind, t in segments(content):
        if kind == "인용":
            hit = find_quote(t, pb)
            if hit:
                out.append((hit[0], "인용 블록"))
        else:
            out += [(c, "^ " + w) for c, w in caret_refs(t, passage)]
    return out


def _sermon_file(date):
    """그날 수요 원고의 바탕화면 파일(hwpx·docx) — sermon_sync 처럼 저장한 주의 수요일로 맞춘다"""
    import importlib.util
    spec = importlib.util.spec_from_file_location("sermon_sync", Path(__file__).resolve().parent / "sermon_sync.py")
    ss = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ss)
    folder = ss.SERMON_ROOT / "수요 설교"
    best = None
    for p in (folder.iterdir() if folder.is_dir() else []):
        if p.suffix.lower() not in (".hwpx", ".docx") or ss.SKIP_NAME.search(p.name):
            continue
        d = dt.date.fromtimestamp(p.stat().st_mtime)
        if d + dt.timedelta(days=(2 - d.weekday()) % 7) == date and (not best or p.stat().st_mtime > best.stat().st_mtime):
            best = p
    return best


def manuscript_images(path):
    """원고 속 그림을 원고에 나오는 차례대로 [png bytes] — 아주 작은 그림(장식)은 뺀다"""
    import zipfile
    from io import BytesIO
    from PIL import Image
    z = zipfile.ZipFile(path)
    names = z.namelist()
    if path.suffix.lower() == ".hwpx":
        order = []
        for sec in sorted(n for n in names if re.match(r"Contents/section\d+\.xml$", n)):
            order += re.findall(r'binaryItemIDRef="([^"]+)"', z.read(sec).decode("utf-8", "replace"))
        files = [next((n for n in names if n.startswith("BinData/") and Path(n).stem == i), None) for i in order]
    else:
        rels = dict(re.findall(r'Id="([^"]+)"[^>]*Target="(media/[^"]+)"', z.read("word/_rels/document.xml.rels").decode("utf-8")))
        files = ["word/" + rels[i] for i in re.findall(r'r:embed="([^"]+)"', z.read("word/document.xml").decode("utf-8")) if i in rels]
    out, seen = [], set()
    for f in files:
        if not f or f in seen:
            continue
        seen.add(f)
        try:
            im = Image.open(BytesIO(z.read(f)))
            if min(im.size) < 200:
                continue
            buf = BytesIO()
            im.convert("RGB").save(buf, "PNG", optimize=True)
            out.append(buf.getvalue())
        except Exception:
            continue
    return out


def cmd_conti(date, names=None, dry=False):
    st = Store()
    have = st.get(f"sermon_conti?select=id,files&service=eq.{q(SERVICE)}&note_date=eq.{date}")
    if have and (have[0].get("files") or []):
        print(f"{md(date)} 악보가 이미 {len(have[0]['files'])}장 있어 원고 악보는 넣지 않았습니다(목사님이 올리신 것을 그대로 둡니다).")
        return 0
    src = _sermon_file(date)
    if not src:
        print(f"{md(date)} 수요 원고 파일(hwpx·docx)을 바탕화면 '수요 설교' 폴더에서 찾지 못했습니다.")
        return 1
    imgs = manuscript_images(src)
    if not imgs:
        print(f"{md(date)} 원고({src.name})에 악보 그림이 없습니다.")
        return 0
    if dry:
        d = DATA_DIR / f"{date}_conti"
        d.mkdir(parents=True, exist_ok=True)
        for i, b in enumerate(imgs, 1):
            (d / f"{i}.png").write_bytes(b)
        print(f"{md(date)} 원고({src.name}) 속 악보 {len(imgs)}장 → {d}  (그림을 보고 곡 제목을 --names \"제목1|제목2|…\" 로 주세요)")
        return 0
    names = [n.strip() for n in names.split("|")] if names else []
    files = []
    for i, b in enumerate(imgs, 1):
        key = f"conti/{date}/ms_{i}.png"
        r = st.rq.post(f"{SUPABASE_URL}/storage/v1/object/private_files/{key}",
                       headers={**st.h, "Content-Type": "image/png", "x-upsert": "true"}, data=b, timeout=120)
        if r.status_code >= 300:
            raise RuntimeError(f"악보 올리기 실패 {r.status_code}: {r.text[:200]}")
        files.append({"path": key, "name": (names[i - 1] if i <= len(names) and names[i - 1] else f"찬양 악보 {i}"), "type": "image/png"})
    if have:
        st.patch("sermon_conti", f"id=eq.{have[0]['id']}", {"files": files})
    else:
        st.post("sermon_conti", {"service": SERVICE, "note_date": str(date), "files": files})
    log(f"원고 악보 {date} {len(files)}장 ({src.name})")
    print(f"{md(date)} 원고({src.name}) 속 악보 {len(files)}장을 올렸습니다: " + " · ".join(f["name"] for f in files))
    return 0


# ── 명령 ─────────────────────────────────────────────────────
def cmd_check(date):
    if now_kst() >= closes_at(date):
        print(f"STATUS=PAST\n{md(date)} 수요기도회 시간(밤 10시 30분)이 지나 자료를 만들지 않습니다.")
        return "PAST"
    st = Store()
    s = get_sermon(st, date)
    if not s or not (s.get("content") or "").strip():
        print(f"STATUS=NO_SERMON\n{md(date)} 수요 원고가 아직 설교관리에 없습니다(바탕화면 '수요 설교' 폴더에 저장하시면 10분 안에 올라옵니다).")
        return "NO_SERMON"
    n = get_note(st, date)
    h = source_hash(s)
    if n and n.get("status") == "approved":
        changed = (n.get("source_hash") or "") != h
        print(f"STATUS=APPROVED\n{md(date)} 자료는 이미 올렸습니다." + (" (그 뒤에 원고가 바뀌었습니다 — 다시 만들려면 목사님께 여쭌 뒤 save --force)" if changed else ""))
        return "APPROVED"
    if n and n.get("made_by") == "pastor":
        print(f"STATUS=WAITING\n{md(date)} 자료는 목사님이 홈페이지에서 고치신 것이라 새로 만들지 않습니다(목사님 확인을 기다립니다).")
        return "WAITING"
    if n and n.get("summary") and (n.get("source_hash") or "") == h:
        print(f"STATUS=WAITING\n{md(date)} 자료를 만들어 두었고 목사님 확인을 기다립니다(원고 그대로).")
        return "WAITING"
    why = "자료가 아직 없습니다" if not n else ("원고가 바뀌었습니다" if (n.get("source_hash") or "") != h else "요약이 비어 있습니다")
    print(f"STATUS=NEEDS\n{md(date)} 새로 만들 차례입니다 — {why}. 제목: {s.get('title')} / {s.get('scripture')} / 원고 {len(s.get('content') or '')}자")
    return "NEEDS"


def cmd_prepare(date, out=None):
    st = Store()
    s = get_sermon(st, date)
    if not s:
        print(f"{md(date)} 수요 원고가 없습니다.")
        return 1
    passage, passage_lines = lookup(s.get("scripture"))
    pb = parse_canon(passage)[0] if passage else None
    segs = segments(s.get("content"))
    cands, seen = [], set()
    for kind, t in segs:
        if kind != "인용":
            continue
        hit = find_quote(t, pb)
        item = {"quote": t[:120], "ref": hit[0] if hit else None, "how": hit[1] if hit else "못 찾음",
                "match": hit[2] if hit else 0, "in_passage": bool(hit and passage and inside(hit[0], passage))}
        if hit and hit[0] in seen:
            continue
        if hit:
            seen.add(hit[0])
        cands.append(item)
    mentions, chapters = [], []
    for kind, t in segs:
        if kind != "글":
            continue
        spans = []
        for m in REF_RE.finditer(t):
            spans.append(m.span())
            canon, _ = lookup(ref_text(m))
            if canon and canon not in seen and not (passage and inside(canon, passage)):
                seen.add(canon)
                mentions.append({"ref": canon, "context": t[max(0, m.start() - 25): m.end() + 25]})
        if pb:
            for m in BARE_RE.finditer(t):
                if any(a <= m.start() < b for a, b in spans):
                    continue
                canon, _ = lookup(f"{pb} {m.group(1)}:{m.group(2)}")
                if canon and canon not in seen and not (passage and inside(canon, passage)):
                    seen.add(canon)
                    mentions.append({"ref": canon, "context": t[max(0, m.start() - 25): m.end() + 25], "how": "책 이름 없이(본문 책으로 봄)"})
        for m in CHAP_RE.finditer(t):
            ctx = t[m.start(): m.end() + 70]
            phrase = re.search(r"[\"“]([^\"”]{4,40})[\"”]", ctx)
            found = None
            if phrase:
                full = ABBR2FULL.get(m.group(1), m.group(1))
                for a, c, v, vt in search_words(phrase.group(1)):
                    if ABBR2FULL.get(a, a) == full and c == int(m.group(2)):
                        found, _ = lookup(f"{a} {c}:{v}")
                        break
            if found and found not in seen:
                seen.add(found)
                mentions.append({"ref": found, "context": ctx[:90], "how": "장 + 따옴표 글로 찾음"})
            elif not found:
                chapters.append({"text": m.group(0), "context": ctx[:90]})
    carets = caret_refs(s.get("content"), passage)
    cited = cited_refs(s.get("content"), passage)
    clean_title, series = guess_series(s, pb)
    plain ="\n".join(("【인용】" + t + "【끝】") if k == "인용" else t for k, t in segs)
    data = {
        "date": str(date), "sermon_id": s["id"], "title": clean_title, "title_raw": s.get("title"),
        "series_guess": series, "scripture": passage or s.get("scripture"), "preacher": s.get("preacher"),
        "source_hash": source_hash(s),
        "passage_lines": passage_lines or [],
        "caret_refs": [{"ref": c, "said": w, "in_passage": bool(c and passage and inside(c, passage))} for c, w in carets],
        "cited_refs": [{"ref": c, "how": w, "in_passage": bool(c and passage and inside(c, passage))} for c, w in cited],
        "candidates": cands, "mentions": mentions, "chapter_only_mentions": chapters,
        "manuscript": plain,
    }
    out = Path(out) if out else DATA_DIR / f"{date}_prepare.json"
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{md(date)} {s.get('title')} / {passage} — 인용 블록 {sum(1 for k, _ in segs if k == '인용')}개")
    for c in cands:
        mark = "본문" if c["in_passage"] else ("??" if not c["ref"] else "  ")
        print(f"  [{mark}] {c['ref'] or '(못 찾음)'}  ({c['how']} {c['match']})  {c['quote'][:40]}")
    if carets:
        print("  ^ 표시 구절: " + " · ".join(c or f"(못 찾음: {w})" for c, w in carets))
        print("  싣는 인용 구절(^ + 인용 블록, 설교 순서): " + " · ".join(c for c, _ in cited if c and not (passage and inside(c, passage))))
    print("  말씀 중에 나온 구절: " + (" · ".join(m["ref"] for m in mentions) or "없음"))
    if chapters:
        print("  장만 말한 곳: " + " · ".join(c["text"] for c in chapters))
    print(f"→ {out}")
    return 0


def _clean_text(v, limit):
    v = re.sub(r"[ \t]+", " ", str(v or "")).strip()
    return v[:limit]


POINT_MAX = 60   # 핵심 한 줄 글자 수 상한(목사님: "최대한 짧게" — 클로드에게는 30자 안팎으로 쓰라고 함)


def _clean_summary(sm):
    """핵심 3가지만 남긴다(목사님 2026-10-05: 설교를 밖에 내지 않도록 아주 짧게)."""
    sm = sm or {}
    pts = []
    for p in (sm.get("points") or []):
        t = _clean_text(p.get("text") or p.get("title"), 300)
        if t:
            pts.append({"label": _clean_text(p.get("label"), 12), "text": t})
    return {"points": pts[:3]}


def _prayer_list(v):
    return [t for t in (_clean_text(x, 200) for x in (v or [])) if t][:20]


def prayer_for(st, date, note, old):
    """기도 제목(2026-10-07 목사님: 위 '고정', 아래 '말씀 후 적용' 두 칸)
       note.json 에 있으면 그것, 없으면 그날 자료에 있던 것. 고정이 비면 지난 자료의 고정을 이어 받는다."""
    given = note.get("prayer") or (note.get("summary") or {}).get("prayer")
    had = ((old or {}).get("summary") or {}).get("prayer") or {}
    src = given if given is not None else had
    fixed, apply_ = _prayer_list(src.get("fixed")), _prayer_list(src.get("apply"))
    if not fixed:
        prev = st.get(f"sermon_notes?select=summary&service=eq.{q(SERVICE)}&note_date=lt.{date}&order=note_date.desc&limit=8")
        fixed = next((f for f in (_prayer_list(((r.get("summary") or {}).get("prayer") or {}).get("fixed")) for r in prev) if f), [])
    return {"fixed": fixed, "apply": apply_}


def resolve(refs, passage, skip):
    out, bad = [], []
    for r in refs or []:
        canon, lines = lookup(r)
        if not canon:
            bad.append(r)
            continue
        if canon in skip or (passage and inside(canon, passage)):
            continue
        skip.add(canon)
        out.append({"ref": canon, "lines": lines})
    return out, bad


def cmd_save(path, no_tg=False, force=False, head=None):
    note = json.loads(Path(path).read_text(encoding="utf-8"))
    date = dt.date.fromisoformat(note["date"])
    st = Store()
    s = get_sermon(st, date)
    if not s:
        print(f"{md(date)} 수요 원고가 없어 저장하지 않았습니다.")
        return 1
    passage, passage_lines = lookup(s.get("scripture"))
    skip = set()
    if caret_refs(s.get("content"), passage):   # ^ 표시가 있는 원고면 ^ 구절 + 인용 블록 구절(설교 순서)이 인용 구절이다
        found = [c for c, _ in cited_refs(s.get("content"), passage) if c]
        note["verses"] = found + [v for v in (note.get("verses") or []) if v not in found]   # 도구가 못 찾아 클로드가 찾은 것은 뒤에
    verses, bad1 = resolve(note.get("verses"), passage, skip)
    mentions = []        # 말로만 언급한 구절은 싣지 않는다(목사님 2026-10-05: 인용 구절만)
    if bad1:
        print("이 장절을 성경 자료에서 찾지 못해 저장하지 않았습니다: " + ", ".join(bad1))
        return 2
    summary = _clean_summary(note.get("summary"))
    if len(summary["points"]) != 3:
        print(f"핵심이 {len(summary['points'])}개입니다. 꼭 3가지로 써 주세요(저장하지 않았습니다).")
        return 2
    long_ = [p["text"] for p in summary["points"] if len(p["text"]) > POINT_MAX]
    if long_:
        print(f"핵심이 너무 깁니다({POINT_MAX}자 넘음) — 더 짧게 고쳐 주세요(저장하지 않았습니다): " + " / ".join(long_))
        return 2
    pb = parse_canon(passage)[0] if passage else None
    clean_title, series = guess_series(s, pb)
    row = {
        "sermon_id": s["id"], "service": SERVICE, "note_date": str(date),
        "title": _clean_text(note.get("title") or clean_title, 120),
        "scripture": passage or s.get("scripture"), "preacher": s.get("preacher"),
        "series": _clean_text(note.get("series") or series, 60),
        "passage": passage_lines or [], "verses": verses, "mentions": mentions, "summary": summary,
        "status": "draft", "source_hash": source_hash(s), "made_by": note.get("made_by") or "claude",
    }
    old = get_note(st, date)
    row["summary"]["prayer"] = prayer_for(st, date, note, old)
    if old and old.get("status") == "approved" and not force:
        print(f"{md(date)} 자료는 이미 올렸습니다. 덮어쓰지 않았습니다(목사님께 여쭌 뒤 --force — 다시 '확인 전'이 됩니다).")
        return 3
    if old and old.get("made_by") == "pastor" and not force:
        print(f"{md(date)} 자료는 목사님이 홈페이지에서 고치신 것이라 덮어쓰지 않았습니다(목사님께 여쭌 뒤 --force).")
        return 3
    saved = st.patch("sermon_notes", f"id=eq.{old['id']}", row)[0] if old else st.post("sermon_notes", row)
    state_word = "올림" if row["status"] == "approved" else "확인 전"
    log(f"저장({state_word}) {date} {row['title']} — 인용 구절 {len(verses)} · 핵심 {len(summary['points'])}")
    if not no_tg:
        ok = telegram(preview_text(saved, head) if head else preview_text(saved), keyboard(saved["id"], date))
        log("텔레그램 미리보기 " + ("보냄" if ok else "실패"))
        stt = load_state()
        stt[str(date)] = {"hash": row["source_hash"], "sent": now_kst().isoformat(timespec="minutes")}
        save_state(stt)
    print(f"저장했습니다({state_word}): {md(date)} {row['title']} · 인용 구절 {len(verses)} · 핵심 {len(summary['points'])}")
    return 0


def preview_text(n, head="📖 수요기도회 말씀 자료 — 확인해 주세요"):
    d = n["note_date"]
    lines = [head, f"{md(d)} · {n.get('series') or SERVICE}", f"「{n.get('title')}」 {n.get('scripture') or ''}".strip(), ""]
    lines.append("[핵심 3가지]")
    for i, p in enumerate((n.get("summary") or {}).get("points") or [], 1):
        lines.append(f"{i}. {(p.get('label') + ' — ') if p.get('label') else ''}{p.get('text')}")
    vs = n.get("verses") or []
    lines += ["", f"[인용 구절 {len(vs)}] " + (" · ".join(v["ref"] for v in vs) or "없음")]
    pr = (n.get("summary") or {}).get("prayer") or {}
    for title, key in (("함께 드리는 기도 제목", "fixed"), ("말씀 후 적용 기도 제목", "apply")):
        if pr.get(key):
            lines += ["", f"[{title}]"] + [f"{i}. {t}" for i, t in enumerate(pr[key], 1)]
    now = now_kst()
    if n.get("status") == "approved":
        tail = ((md(d) + " " + OPEN_LABEL + "에 로그인한 성도님께 열리고" if now < opens_at(d)
                 else "지금 로그인한 성도님께 보이고" if now < closes_at(d) else "예배 시간이 지나 성도님께는 보이지 않고")
                + ", 밤 10시 30분에 닫힙니다.")
        lines += ["", tail, "고치실 곳은 홈페이지 '예배와 말씀 ▸ 수요기도회 말씀'에서 고치시거나 클로드에게 말씀해 주세요."]
        text = "\n".join(lines)
        return text if len(text) <= 3900 else text[:3880] + "\n…(길어서 줄였습니다)"
    if now < opens_at(d):
        tail = "[올리기]를 누르시면 " + md(d) + " " + OPEN_LABEL + "에 로그인한 성도님께 열리고, 밤 10시 30분에 닫힙니다."
    elif now < closes_at(d):
        tail = "[올리기]를 누르시면 로그인한 성도님께 바로 보이고, 밤 10시 30분에 닫힙니다."
    else:
        tail = "예배 시간(밤 10시 30분)이 지나 올려도 성도님께는 보이지 않습니다."
    lines += ["", tail, "고칠 곳은 홈페이지 '예배와 말씀 ▸ 수요기도회 말씀'(목사님 확인용)에서 고치시거나 클로드에게 말씀해 주세요."]
    text = "\n".join(lines)
    return text if len(text) <= 3900 else text[:3880] + "\n…(길어서 줄였습니다)"


def keyboard(note_id, date):
    now = now_kst()
    label = ("✅ 올리기 (" + OPEN_LABEL + "에 열림)" if now < opens_at(date)
             else "✅ 올리기 (바로 열림 · 10시 30분 닫힘)" if now < closes_at(date) else "✅ 올리기 (예배가 끝나 보이지 않음)")
    return {"inline_keyboard": [
        [{"text": label, "callback_data": f"wed:ok:{note_id}"}],
        [{"text": "🔍 홈페이지에서 보기·고치기", "url": SITE_URL}],
    ]}


def telegram(text, markup=None):
    try:
        import requests
        env = {}
        for line in TELEGRAM_ENV_PATH.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
        token = env["TELEGRAM_BOT_TOKEN"]
        ok = False
        for uid in [x.strip() for x in env.get("ALLOWED_USER_IDS", "").split(",") if x.strip()]:
            body = {"chat_id": int(uid), "text": text, "disable_web_page_preview": True}
            if markup:
                body["reply_markup"] = markup
            r = requests.post(f"https://api.telegram.org/bot{token}/sendMessage", json=body, timeout=15)
            ok = ok or r.status_code == 200
        return ok
    except Exception as e:
        log(f"[텔레그램 실패] {type(e).__name__}")     # 주소에 토큰이 있어 오류 글은 남기지 않는다
        return False


def cmd_remind(date):
    st = Store()
    n = get_note(st, date)
    if not n or n.get("status") == "approved":
        print("알릴 것 없음(자료가 없거나 이미 올렸습니다).")
        return 0
    if now_kst() < dt.datetime.combine(date, dt.time(*REMIND_AFTER), KST):
        print("아직 알릴 시각이 아닙니다(" + hm_label(*REMIND_AFTER) + " 뒤).")
        return 0
    if now_kst() >= closes_at(date):
        print("예배 시간이 지나 알리지 않습니다.")
        return 0
    stt = load_state()
    key = f"remind:{date}:{n.get('source_hash')}"
    if stt.get(key):
        print("이미 한 번 더 알렸습니다.")
        return 0
    ok = telegram(preview_text(n, "⏰ 아직 올리지 않은 수요기도회 말씀 자료가 있습니다"), keyboard(n["id"], date))
    stt[key] = now_kst().isoformat(timespec="minutes")
    save_state(stt)
    log("다시 알림 " + ("보냄" if ok else "실패") + f" {date}")
    return 0


def cmd_show(date):
    n = get_note(Store(), date)
    if not n:
        print(f"{md(date)} 자료가 없습니다.")
        return 0
    print(f"상태: {'올림' if n['status'] == 'approved' else '확인 전'} · 열리는 때 {n.get('publish_at')}")
    print(preview_text(n, "📖 저장된 자료"))
    return 0


def main():
    ap = argparse.ArgumentParser(description="수요기도회 말씀 자료 만들기")
    ap.add_argument("cmd", choices=["check", "prepare", "save", "remind", "show", "conti"])
    ap.add_argument("--names", help='conti: 악보 제목들 "제목1|제목2|…"')
    ap.add_argument("--dry", action="store_true", help="conti: 올리지 않고 그림만 꺼내 보기")
    ap.add_argument("file", nargs="?")
    ap.add_argument("--date")
    ap.add_argument("--out")
    ap.add_argument("--no-telegram", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--head", help="텔레그램 미리보기 첫 줄(시험 때)")
    a = ap.parse_args()
    date = dt.date.fromisoformat(a.date) if a.date else default_date()
    if a.cmd == "check":
        cmd_check(date)
        return 0
    if a.cmd == "prepare":
        return cmd_prepare(date, a.out)
    if a.cmd == "save":
        if not a.file:
            print("note.json 경로를 주세요.")
            return 1
        return cmd_save(a.file, a.no_telegram, a.force, a.head)
    if a.cmd == "remind":
        return cmd_remind(date)
    if a.cmd == "conti":
        return cmd_conti(date, a.names, a.dry)
    return cmd_show(date)


if __name__ == "__main__":
    sys.exit(main() or 0)

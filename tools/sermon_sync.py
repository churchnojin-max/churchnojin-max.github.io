#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
설교 자동 올리기 (2026-10-03)
──────────────────────────────────────────────────────────────
목사님이 설교 파일을 늘 저장하시는 폴더(바탕화면\\노진교회\\설교)를 지켜보다가,
새 파일이나 바뀐 파일이 있으면 글을 읽어 날짜·예배·제목·본문·원고를 알아내고
홈페이지 설교관리(sermons 표)에 등록한다. PDF가 없는 한글 파일은 PDF로 변환해 붙인다.

폴더 이름 → 예배 종류
  주일 낮 설교   → 주일 낮 예배   (파일 이름 "9월 27일 …", 머리글 "제목 : …" / "본문 : …" 또는 첫 줄 제목·둘째 줄 장절)
  주일 오후 설교 → 주일 오후예배  (첫 줄 제목, 다음 줄 장절. 날짜는 파일 이름 (0913)·글 속 2026. 9. 20.·없으면 가장 가까운 주일)
  수요 설교      → 수요기도회     (머리글 "제목: …" "본문: …" 또는 첫 줄 제목·[에베소서 3:7~9]. 날짜는 파일을 저장한 주의 수요일)
  새벽 설교      → 새벽기도       (한 파일에 여러 회차 → 화·목·금(3편) / 화·수·목·금(4편) 각각 등록. '주일 예배' 편은 건너뜀)

같은 날짜·예배의 파일이 여러 개면 저장 시간이 가장 최근인 것을 쓴다(2026-10-03 목사님 결정).
이미 손으로 올려 둔 설교(이 프로그램이 만들지 않은 것)는 빈칸만 채우고 덮어쓰지 않는다.

필요한 것
  · 전용 열쇠 파일: %APPDATA%\\nojin\\supabase_service.key  (tools\\설교올리기_열쇠넣기.bat 로 넣음)
  · 성경 본문은 bible-verse 스킬(bible.js)로 뽑는다(기억으로 쓰지 않음).
  · 한글 → PDF 변환: tools\\hwp_to_pdf.ps1 (한글 프로그램 필요)

사용법
  python sermon_sync.py              # 새 파일·바뀐 파일만 처리(예약 작업용)
  python sermon_sync.py --dry-run    # 올리지 않고 무엇을 어떻게 읽었는지만 표로 보여 줌
  python sermon_sync.py --all        # 처리 기록을 무시하고 전부 다시 확인
  python sermon_sync.py --no-pdf     # 한글→PDF 변환 없이(시험용)
  python sermon_sync.py --dump 날짜  # 그 날짜 설교의 읽은 결과(제목·장절·원고 앞부분)를 보여 줌
"""
import argparse
import datetime as dt
import hashlib
import html
import json
import os
import re
import subprocess
import sys
import zipfile
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# ── 위치 ─────────────────────────────────────────────────────
SERMON_ROOT = Path(r"C:\Users\PC\Desktop\노진교회\설교")
SERVICES = {
    "주일 낮 설교": "주일 낮 예배",
    "주일 오후 설교": "주일 오후예배",
    "수요 설교": "수요기도회",
    "새벽 설교": "새벽기도",
}
APPDATA = Path(os.environ.get("APPDATA", str(Path.home())))
DATA_DIR = APPDATA / "nojin" / "sermon_sync"
KEY_FILE = APPDATA / "nojin" / "supabase_service.key"
STATE_PATH = DATA_DIR / "state.json"
LOG_PATH = DATA_DIR / "log.txt"
PDF_CACHE = DATA_DIR / "pdf"
TOOLS_DIR = Path(__file__).resolve().parent
HWP2PDF = TOOLS_DIR / "hwp_to_pdf.ps1"
BIBLE_JS = Path(r"C:\Users\PC\.claude\skills\bible-verse\scripts\bible.js")
TELEGRAM_ENV_PATH = Path(r"D:\클코저장소\텔레그램봇\.env")

SUPABASE_URL = "https://vwuzmklacdwiqyqjrxyt.supabase.co"   # js/config.js 와 같은 값(공개)
BUCKET = "uploads"
PREACHER = "손병민 담임목사"

SKIP_NAME = re.compile(r"^\[준비메모\]|찬양|^~\$")
EXTS = {".hwpx", ".pdf", ".docx"}
TEXT_PRIORITY = {".hwpx": 0, ".docx": 1, ".pdf": 2}   # 글을 읽을 때 문단이 살아 있는 쪽을 먼저


def log(msg):
    line = f"[{dt.datetime.now():%Y-%m-%d %H:%M:%S}] {msg}"
    print(line, flush=True)
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with LOG_PATH.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


# ── 글 뽑기 (줄 단위 — PDF 는 접힌 줄 그대로, 문단 잇기는 나중에) ──
def _xml_text(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s))


def text_hwpx(p):
    z = zipfile.ZipFile(p)
    out = []
    for n in sorted(z.namelist()):
        if n.startswith("Contents/section") and n.endswith(".xml"):
            x = z.read(n).decode("utf-8", "ignore")
            for pa in re.findall(r"<hp:p\b[^>]*>(.*?)</hp:p>", x, re.S):
                t = "".join(re.findall(r"<hp:t[^>]*>(.*?)</hp:t>", pa, re.S))
                out.append(_xml_text(t))
    return [l for l in out if l.strip()]


def text_docx(p):
    z = zipfile.ZipFile(p)
    x = z.read("word/document.xml").decode("utf-8", "ignore")
    out = []
    for pa in re.findall(r"<w:p\b[^>]*>(.*?)</w:p>", x, re.S):
        t = "".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", pa, re.S))
        out.append(_xml_text(t))
    return [l for l in out if l.strip()]


def text_pdf(p):
    import fitz
    d = fitz.open(p)
    raw = []
    for pg in d:
        for l in pg.get_text().split("\n"):
            if re.fullmatch(r"\s*-\s*\d+\s*-\s*", l):   # 쪽 번호 "- 3 -"
                continue
            if l.strip():
                raw.append(l.rstrip("\r\n").rstrip(" ") + (" " if l.endswith(" ") else ""))
    return raw


def read_lines(p: Path):
    ext = p.suffix.lower()
    if ext == ".hwpx":
        return text_hwpx(p)
    if ext == ".docx":
        return text_docx(p)
    return text_pdf(p)


HEADING_RE = re.compile(r"^(?:[IVX]+\.|[1-9]\.|✦|♪|【)\s*\S")


def _ends_sentence(s):
    return bool(re.search(r"[.!?。」”\"’)\]]\s*$", s)) or s.endswith(("니다", "까", "시오", "지요", "네요", "어요", "아요"))


def merge_pdf_paragraphs(lines):
    """PDF 의 접힌 줄을 문단으로 잇는다.
    · 전각 공백(　)·두 칸 들여쓰기·절 번호·|| 로 시작하면 새 문단
    · 소제목(I. / 1. / ✦ / ♪)·장절 줄은 한 줄짜리 문단
    · 줄이 문장 끝으로 끝나고 그 줄이 짧으면(줄 끝까지 안 찼으면) 문단 끝
    · 이을 때 앞 줄 끝에 공백이 있었으면 띄우고(낱말 경계), 없었으면 붙인다(낱말 중간에서 접힌 것)"""
    if not lines:
        return []
    maxlen = max(len(l.strip()) for l in lines)
    # 한글(HWP) PDF 는 낱말 경계에서 접힌 줄 끝에 공백이 남는다. 그런 표시가 거의 없는 PDF(낱말 단위로 접힌 것)는 늘 띄운다.
    space_marks = sum(1 for l in lines if l.endswith(" ")) > len(lines) * 0.15
    paras, cur, prev_raw = [], "", ""

    def flush():
        nonlocal cur
        if cur.strip():
            paras.append(re.sub(r"\s{2,}", " ", cur.strip()))
        cur = ""

    for l in lines:
        t = l.strip()
        standalone = HEADING_RE.match(t) or whole_ref(t) or (re.match(r"^[가-힣]{1,7}\s?\d{1,3}:\d", t) and len(t) < 30)
        starts_new = l.startswith("　") or l.startswith("  ") or t.startswith("||") or re.match(r"^\d{1,3}\s", t) or t.startswith("·")
        if standalone:
            flush()
            paras.append(t)
            prev_raw = l
            continue
        prev = prev_raw.strip()
        if cur and (starts_new or (_ends_sentence(prev) and len(prev) < maxlen * 0.72)):
            flush()
        if cur:
            glue = " " if (not space_marks or prev_raw.endswith(" ") or prev.endswith((".", ",", "?", "!", ")", "\"", "”", "—", "·"))) else ""
            cur = cur + glue + t
        else:
            cur = t
        prev_raw = l
    flush()
    return paras


# ── 성경 장절 ─────────────────────────────────────────────────
REF_CORE = (r"[가-힣]{1,7}\s?\d{1,3}\s?(?:[:：]|장\s?)\s?\d{1,3}\s?절?"
            r"(?:\s?(?:~|-|–|—|에서)\s?\d{1,3}(?:\s?(?:[:：]|장\s?)\s?\d{1,3})?\s?절?)?")
REF_INLINE = re.compile("(" + REF_CORE + ")")
REF_FULL = re.compile("^(" + REF_CORE + ")$")


def strip_ref_label(t):
    t = t.strip()
    t = re.sub(r"^[\[(]?\s*(?:봉독\s*본문|본\s*문)\s*(?:\([^)]*\))?\s*[:：]?\s*", "", t)   # 본문(교독):
    t = re.sub(r"\(\s*개역개정\s*\)", "", t)
    t = re.sub(r"\s{2,}찬송.*$", "", t)                           # 본문 … 찬송 예수 나를 위하여
    t = re.sub(r"\s*\([^()]*\)\s*$", "", t)                     # 꼬리 괄호: (봉독 13~16절) (17강 · 21–22절 중심)
    t = re.sub(r"(\d+):(\d+)\s*~\s*(\d+):(\d+)\s*~\s*(\d+)", r"\1:\2~\3:\5", t)   # 2:28 ~ 3:1~3 -> 2:28~3:3
    return t.strip(" []()\"“”")


def whole_ref(t):
    """줄 전체가 장절이면 그 장절을, 아니면 None"""
    m = REF_FULL.match(strip_ref_label(t))
    return m.group(1).strip() if m else None


_bible_cache = {}


def bible_lookup(ref):
    """bible.js 로 장절을 정식 이름으로 고치고 개역개정 본문을 받는다. (정식장절, 본문) / 못 읽으면 (None, None)"""
    ref = re.sub(r"[–—－]", "~", ref)
    ref = re.sub(r"(\d+)\s*장\s*(\d+)\s*절\s*(?:~|에서)\s*(\d+)\s*장\s*(\d+)\s*절", r"\1:\2~\3:\4", ref)
    ref = re.sub(r"(\d+)\s*장\s*(\d+)\s*절\s*(?:~|에서)\s*(\d+)\s*절", r"\1:\2~\3", ref)
    ref = re.sub(r"(\d+)\s*장\s*(\d+)\s*절", r"\1:\2", ref)
    ref = re.sub(r"\s+", " ", ref).strip(" []()")
    if ref in _bible_cache:
        return _bible_cache[ref]
    try:
        tmp = DATA_DIR / "_ref.txt"
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        tmp.write_text(ref, encoding="utf-8")
        r = subprocess.run(["node", str(BIBLE_JS), "찾기", "--파일", str(tmp)], capture_output=True, timeout=60)
        out = r.stdout.decode("utf-8", "replace")
    except Exception as e:
        log(f"bible.js 실행 실패: {e}")
        _bible_cache[ref] = (None, None)
        return _bible_cache[ref]
    m = re.search(r"^◎\s*(.+?)\s*$", out, re.M)
    if not m or "(없음)" in out or "읽지 못했습니다" in out:
        _bible_cache[ref] = (None, None)
        return _bible_cache[ref]
    verses = [l.strip() for l in out.split("\n") if l.strip() and not l.startswith("◎")]
    _bible_cache[ref] = (m.group(1), "\n".join(verses))
    return _bible_cache[ref]


def verse_lookup(verse_text):
    """절 글의 앞 낱말로 성경에서 그 절을 찾는다 → ("에베소서 1", 3) / 못 찾으면 None"""
    words = re.sub(r"[○\"“”]", "", verse_text).split()
    q = " ".join(words[:5])
    if len(q) < 8:
        return None
    try:
        tmp = DATA_DIR / "_word.txt"
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        tmp.write_text(q, encoding="utf-8")
        r = subprocess.run(["node", str(BIBLE_JS), "낱말", "--파일", str(tmp), "--최대", "5"], capture_output=True, timeout=60)
        out = r.stdout.decode("utf-8", "replace")
    except Exception:
        return None
    hits = re.findall(r"^\s+([가-힣]+)\s(\d+):(\d+)\s", out, re.M)
    if len(hits) != 1:
        return None
    full, _ = bible_lookup(f"{hits[0][0]} {hits[0][1]}:{hits[0][2]}")
    if not full:
        return None
    return (full.rsplit(":", 1)[0], int(hits[0][2]))


# ── 날짜 ─────────────────────────────────────────────────────
def year_for(month, day, base: dt.date):
    """월·일만 있을 때 연도 정하기: 파일 저장일 기준, 너무 멀면 앞뒤 해로"""
    for y in (base.year, base.year - 1, base.year + 1):
        try:
            d = dt.date(y, month, day)
        except ValueError:
            continue
        if abs((d - base).days) <= 200:
            return d
    return None


def nearest_sunday(base: dt.date):
    off = (6 - base.weekday()) % 7
    nxt = base + dt.timedelta(days=off)
    return nxt if (nxt - base).days <= 3 else nxt - dt.timedelta(days=7)


def week_monday(base: dt.date, roll_weekend=True):
    wd = base.weekday()
    if roll_weekend and wd >= 5:
        return base + dt.timedelta(days=7 - wd)
    return base - dt.timedelta(days=wd)


# ── 머리글 읽기(공통) ─────────────────────────────────────────
JUNK_LINE = re.compile(r"^(?:[가-힣]+\s*\(\s*\d+(?:\.\d+)?\s*\)|수요기도회\s*/.*|말씀\s*전\s*찬송.*|찬송가?\s*\d+장.*|\d{3}장\s.*|노진교회.*예배.*)$")


def clean_title(t):
    t = re.sub(r"^제\s*목\s*[:：]\s*", "", t.strip())
    t = re.sub(r"\s*\(\d{1,2}/\d{1,2}\)\s*$", "", t)        # (9/27)
    t = re.sub(r"\s*\(?\d{4}\)?\s*$", "", t)                  # (0913)
    t = t.strip(" \"“”「」‘’'")
    t = re.sub(r"\s*\((?:" + REF_CORE + r")\)\s*$", "", t)   # 제목 (에베소서 2:4–7)
    t = re.sub(r"[.。]\s*$", "", t)
    return t.strip()


def read_header(lines, p: Path, base: dt.date):
    """제목·장절·날짜·원고 시작 줄을 첫 줄들에서 찾는다(주일 낮·오후·수요 공통)."""
    first_verse = None
    for i, l in enumerate(lines[:12]):
        if re.match(r"^\s*(?:\|\|\s*)?\d{1,3}\s+\S", l):
            first_verse = i
            break
    head_n = first_verse if first_verse is not None else min(6, len(lines))
    title = scripture = date = None
    title_idx = -1
    for i in range(head_n):
        t = lines[i].strip()
        md = re.search(r"(20\d{2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})", t)
        if md and len(t) < 50:
            date = dt.date(int(md.group(1)), int(md.group(2)), int(md.group(3)))
            continue
        if scripture is None and whole_ref(t):
            scripture = whole_ref(t)
            continue
        if title is None and " / " in t:
            a, b = [x.strip() for x in t.split(" / ", 1)]
            if whole_ref(a):
                scripture, title, title_idx = whole_ref(a), clean_title(b), i
                continue
        if re.match(r"^제\s*목\s*[:：]", t):
            title, title_idx = clean_title(t), i
            continue
        if title is None and not JUNK_LINE.match(t) and len(t) < 70 and not HEADING_RE.match(t):
            title, title_idx = clean_title(t), i
    if title and scripture is None:
        m = REF_INLINE.search(lines[title_idx]) if title_idx >= 0 else None
        if m and lines[title_idx].strip().endswith(")"):
            scripture = m.group(1)
    # 장절 줄이 없고 절 번호만 있으면(예: 10~13절) 원고 속 "본문은 역대하 33장"에서 책·장을 찾는다
    if scripture is None and first_verse is not None:
        nums = [int(m.group(1)) for l in lines[first_verse:first_verse + 30] for m in [re.match(r"^\s*(?:\|\|\s*)?(\d{1,3})\s+\S", l)] if m]
        body = " ".join(lines[first_verse:first_verse + 40])
        mb = re.search(r"본문[은는이]?\s*([가-힣]{2,7})\s*(\d{1,3})\s*장", body)
        if mb and nums:
            scripture = f"{mb.group(1)} {mb.group(2)}:{min(nums)}~{max(nums)}"
        elif nums:
            found = verse_lookup(re.sub(r"^\s*(?:\|\|\s*)?\d{1,3}\s+", "", lines[first_verse]))
            if found and found[1] == min(nums):
                scripture = f"{found[0]}:{min(nums)}~{max(nums)}"
    if not title:
        m = re.match(r"^([가-힣]+)\s*\(\s*(\d+)", p.stem)   # 에베소서(3) → 에베소서 3강
        if m:
            title = f"{m.group(1)} {m.group(2)}강"
    body_start = first_verse if first_verse is not None else (title_idx + 1 if title_idx >= 0 else 0)
    return title, scripture, date, body_start


def body_after_bible(lines, start_idx, bible_text):
    """본문 구절 블록이 바로 이어지면 그 블록 뒤부터 원고. 마지막 절의 끝말(6글자)이 든 줄을 찾는다."""
    i = start_idx
    while i < len(lines) and (whole_ref(lines[i]) or re.match(r"^\s*(?:♪|찬송)", lines[i])):
        i += 1
    if i >= len(lines):
        return i
    first = lines[i].strip()
    block_follows = bool(re.match(r"^(?:\|\|\s*)?\d{1,3}\s+\S", first) or first.startswith(("\"", "“", "||")))
    if not block_follows:
        return i
    tail = ""
    if bible_text:
        last = re.sub(r"^[\d:]+\s*", "", bible_text.strip().split("\n")[-1])
        tail = re.sub(r"\s+", "", last)[-6:]
    if tail:
        for j in range(i, min(len(lines), i + 40)):
            if HEADING_RE.match(lines[j].strip()):
                break
            if tail in re.sub(r"\s+", "", lines[j]):
                return j + 1
    while i < len(lines) and re.match(r"^\s*(?:\|\|\s*)?\d{1,3}\s", lines[i]):
        i += 1
    return i


# ── 종류별 ───────────────────────────────────────────────────
def parse_sunday_am(p, lines, base):
    title, scripture, date, bs = read_header(lines, p, base)
    m = re.search(r"(\d{1,2})\s*월\s*(\d{1,2})\s*일", p.stem)
    if m:
        date = year_for(int(m.group(1)), int(m.group(2)), base) or date
    if not date:
        md = re.search(r"\((\d{1,2})/(\d{1,2})\)", " ".join(lines[:3]))
        date = year_for(int(md.group(1)), int(md.group(2)), base) if md else nearest_sunday(base)
    return [dict(date=date, title=title, scripture=scripture, body_start=bs)]


def parse_sunday_pm(p, lines, base):
    title, scripture, date, bs = read_header(lines, p, base)
    if not date:
        m = re.search(r"\(?(\d{2})(\d{2})\)?\s*$", p.stem) or re.search(r"\s(\d{2})(\d{2})(?:\)|\s|$)", p.stem)
        if m:
            date = year_for(int(m.group(1)), int(m.group(2)), base)
    if not date:
        m = re.search(r"(\d{1,2})\s*월\s*(\d{1,2})\s*일", p.stem)
        if m:
            date = year_for(int(m.group(1)), int(m.group(2)), base)
    if not scripture:
        mm = REF_INLINE.search(p.stem)
        if mm:
            scripture = mm.group(1)
    if not date:
        date = nearest_sunday(base)
    return [dict(date=date, title=title, scripture=scripture, body_start=bs)]


def parse_wed(p, lines, base):
    title, scripture, _d, bs = read_header(lines, p, base)
    date = week_monday(base, roll_weekend=False) + dt.timedelta(days=2)
    return [dict(date=date, title=title, scripture=scripture, body_start=bs)]


DAWN_HDR = re.compile(r"새벽\s*(\d)\s*회(?:\s*차)?\s*$")


def parse_dawn(p, lines, base):
    """한 파일에 '새벽 N회차' 여러 편. 차례 줄(| 또는 · 로 시작)은 건너뛰고 본문 머리글로 자른다. '주일 예배' 편은 등록하지 않음."""
    hdr = [i for i, l in enumerate(lines) if DAWN_HDR.search(l.strip()) and "|" not in l and not l.strip().startswith("·")]
    if not hdr:
        return []
    # 각 편의 끝: 다음 머리글, 또는 '주일 예배' 편 머리글, 또는 '설교문 끝'
    ends = []
    for k, h in enumerate(hdr):
        nxt = hdr[k + 1] if k + 1 < len(hdr) else len(lines)
        for j in range(h + 1, nxt):
            t = lines[j].strip()
            if re.search(r"·\s*주일\s*예배\s*$", t) or re.search(r"설교문\s*끝\s*$", t):
                nxt = j
                break
        ends.append(nxt)
    mon = week_monday(base, roll_weekend=True)
    n = len(hdr)
    days = {3: [1, 3, 4], 4: [1, 2, 3, 4], 5: [0, 1, 2, 3, 4], 2: [1, 4], 1: [1]}.get(n, list(range(n)))
    out = []
    for k, h in enumerate(hdr):
        seg = lines[h + 1:ends[k]]
        title_parts, scripture, bidx = [], None, 0
        for j, l in enumerate(seg[:8]):
            t = l.strip()
            r = whole_ref(t)
            if r:
                scripture, bidx = r, j + 1
                break
            if re.match(r"^(?:♪|찬송)", t) or HEADING_RE.match(t):
                continue
            title_parts.append(t.lstrip("—- ").strip())
        title = " — ".join([x for x in title_parts if x][:2]) if title_parts else None
        date = mon + dt.timedelta(days=days[k]) if k < len(days) else None
        out.append(dict(date=date, title=title, scripture=scripture, lines=seg, body_start=bidx, part=k + 1))
    return out


PARSERS = {"주일 낮 설교": parse_sunday_am, "주일 오후 설교": parse_sunday_pm, "수요 설교": parse_wed, "새벽 설교": parse_dawn}


# ── 원고 → HTML ───────────────────────────────────────────────
def para_html(lines):
    out = []
    for l in lines:
        t = l.strip()
        if not t:
            continue
        if t.startswith("||"):
            t = re.sub(r"\s*/\s*주보에 없음\s*$", "", t[2:].strip())
            out.append("<blockquote>" + html.escape(t) + "</blockquote>")
        elif HEADING_RE.match(t) and len(t) < 60:
            out.append("<h3>" + html.escape(t) + "</h3>")
        else:
            out.append("<p>" + html.escape(t) + "</p>")
    return "\n".join(out)


# ── 파일 모으기 ───────────────────────────────────────────────
def collect():
    groups = {}
    for folder in SERVICES:
        d = SERMON_ROOT / folder
        if not d.is_dir():
            continue
        for p in d.iterdir():
            if not p.is_file() or p.suffix.lower() not in EXTS or SKIP_NAME.search(p.name):
                continue
            groups.setdefault(folder, {}).setdefault(p.stem, []).append(p)
    return groups


def sig_of(paths):
    h = hashlib.md5()
    for p in sorted(paths):
        st = p.stat()
        h.update(f"{p.name}|{int(st.st_mtime)}|{st.st_size}".encode("utf-8"))
    return h.hexdigest()


# ── PDF 준비 ─────────────────────────────────────────────────
def ensure_pdf(paths, allow_convert=True):
    pdfs = [p for p in paths if p.suffix.lower() == ".pdf"]
    src = sorted([p for p in paths if p.suffix.lower() in (".hwpx", ".docx")], key=lambda x: x.stat().st_mtime, reverse=True)
    if pdfs:
        pdf = max(pdfs, key=lambda x: x.stat().st_mtime)
        if not src or pdf.stat().st_mtime >= src[0].stat().st_mtime - 3600:
            return pdf
    if not src:
        return None
    s = src[0]
    if s.suffix.lower() != ".hwpx" or not allow_convert:
        return pdfs[0] if pdfs else s          # docx 는 그대로 붙임
    PDF_CACHE.mkdir(parents=True, exist_ok=True)
    out = PDF_CACHE / (hashlib.md5(str(s).encode("utf-8")).hexdigest()[:10] + "_" + re.sub(r"[^\w가-힣.()\- ]", "", s.stem) + ".pdf")
    if out.exists() and out.stat().st_mtime >= s.stat().st_mtime:
        return out
    log(f"한글 → PDF 변환: {s.name}")
    try:
        r = subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(HWP2PDF),
                            "-SrcPath", str(s), "-PdfPath", str(out)], capture_output=True, timeout=180)
        if out.exists() and out.stat().st_size > 1000:
            return out
        log(f"PDF 변환 실패({r.returncode}): {r.stderr.decode('utf-8', 'replace')[:200]}")
    except Exception as e:
        log(f"PDF 변환 오류: {e}")
    return pdfs[0] if pdfs else None


# ── 창고(Supabase) ────────────────────────────────────────────
def load_key():
    try:
        k = KEY_FILE.read_text(encoding="utf-8").strip()
        return k or None
    except Exception:
        return None


class Store:
    def __init__(self, key):
        import requests
        self.rq = requests
        self.h = {"apikey": key, "Authorization": f"Bearer {key}"}

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

    def patch(self, table, row_id, data):
        r = self.rq.patch(f"{SUPABASE_URL}/rest/v1/{table}?id=eq.{row_id}", headers={**self.h, "Content-Type": "application/json", "Prefer": "return=minimal"}, json=data, timeout=30)
        if r.status_code >= 300:
            raise RuntimeError(f"고치기 실패 {r.status_code}: {r.text[:200]}")

    def upload(self, path: Path, key: str):
        ctype = {"pdf": "application/pdf", "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                 "hwpx": "application/octet-stream"}.get(path.suffix.lower().lstrip("."), "application/octet-stream")
        with path.open("rb") as f:
            r = self.rq.post(f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{key}", headers={**self.h, "Content-Type": ctype, "x-upsert": "true"}, data=f, timeout=120)
        if r.status_code >= 300:
            raise RuntimeError(f"파일 올리기 실패 {r.status_code}: {r.text[:200]}")
        return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{key}"


def notify_telegram(text):
    try:
        import requests
        env = {}
        for line in TELEGRAM_ENV_PATH.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
        token = env["TELEGRAM_BOT_TOKEN"]
        for uid in [x.strip() for x in env.get("ALLOWED_USER_IDS", "").split(",") if x.strip()]:
            requests.post(f"https://api.telegram.org/bot{token}/sendMessage", json={"chat_id": int(uid), "text": text}, timeout=10)
    except Exception as e:
        log(f"[텔레그램 알림 실패] {e}")


# ── 주 흐름 ───────────────────────────────────────────────────
def build_entries(groups):
    """파일 묶음 → 설교 항목. 같은 (예배, 날짜)는 저장 시간이 최근인 것만."""
    entries, problems = {}, []
    for folder, stems in groups.items():
        service = SERVICES[folder]
        for stem, paths in stems.items():
            paths.sort(key=lambda p: (TEXT_PRIORITY.get(p.suffix.lower(), 9), -p.stat().st_mtime))
            text_src = paths[0]
            newest = max(p.stat().st_mtime for p in paths)
            base = dt.datetime.fromtimestamp(newest).date()
            try:
                lines = read_lines(text_src)
            except Exception as e:
                problems.append(f"{folder}/{text_src.name}: 글을 읽지 못함({e})")
                continue
            if len(lines) < 5:
                problems.append(f"{folder}/{text_src.name}: 글이 너무 짧음")
                continue
            try:
                parts = PARSERS[folder](text_src, lines, base)
            except Exception as e:
                problems.append(f"{folder}/{text_src.name}: 읽는 중 오류({e})")
                continue
            if not parts:
                problems.append(f"{folder}/{text_src.name}: 설교 머리글을 못 찾음")
                continue
            for pt in parts:
                if not pt.get("date") or not pt.get("scripture") or not pt.get("title"):
                    problems.append(f"{folder}/{text_src.name}" + (f" {pt.get('part')}회차" if pt.get("part") else "") +
                                    f": 날짜={pt.get('date')} 제목={pt.get('title')} 본문={pt.get('scripture')} ← 빠진 것이 있어 올리지 않음")
                    continue
                key = f"{service}|{pt['date']:%Y-%m-%d}"
                e = dict(service=service, date=pt["date"], title=pt["title"], scripture_raw=pt["scripture"],
                         lines=pt.get("lines", lines), body_start=pt["body_start"], paths=paths, text_src=text_src,
                         mtime=newest, part=pt.get("part"), folder=folder, is_pdf=text_src.suffix.lower() == ".pdf")
                if key in entries and entries[key]["mtime"] >= newest:
                    continue
                entries[key] = e
    return entries, problems


def finish_entry(e):
    """성경 장절 정식화 + 개역개정 본문 + 원고 HTML. 문제가 있으면 설명을 돌려준다."""
    sc, bible_text = bible_lookup(e["scripture_raw"])
    if not sc:
        return f"본문 장절을 읽지 못함: {e['scripture_raw']}"
    e["scripture"] = sc
    e["bible_text"] = bible_text
    lines = e["lines"]
    start = body_after_bible(lines, e["body_start"], bible_text)
    body = [l for l in lines[start:] if not re.search(r"설교문\s*끝\s*$|^다음\s*주[:：]", l.strip())]
    if e.get("is_pdf"):
        body = merge_pdf_paragraphs(body)
    e["content"] = para_html(body)
    if len(re.sub(r"<[^>]+>", "", e["content"])) < 300:
        return "원고가 너무 짧게 읽힘(본문 블록 뒤를 못 찾음)"
    return None


def plain_len(h):
    return len(re.sub(r"<[^>]+>", "", h or ""))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--no-pdf", action="store_true")
    ap.add_argument("--dump", help="날짜(YYYY-MM-DD)의 읽은 결과 보기")
    a = ap.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    state = {}
    if STATE_PATH.exists() and not a.all:
        try:
            state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        except Exception:
            state = {}

    groups = collect()
    entries, problems = build_entries(groups)

    if a.dump:
        for key, e in sorted(entries.items(), key=lambda kv: kv[1]["date"]):
            if f"{e['date']:%Y-%m-%d}" != a.dump:
                continue
            err = finish_entry(e)
            print(f"===== {e['date']} {e['service']} | {e['title']} | {e.get('scripture')} | {e['text_src'].name}" + (f" | ⚠ {err}" if err else ""))
            print(re.sub(r"</(p|h3|blockquote)>", "\n", e.get("content") or "")[:1500])
        return

    todo = []
    for key, e in sorted(entries.items(), key=lambda kv: kv[1]["date"]):
        sig = sig_of(e["paths"]) + ("" if e["part"] is None else f"#{e['part']}")
        st = state.get(key)
        if st and st.get("sig") == sig and not a.dry_run:
            continue
        e["sig"] = sig
        todo.append((key, e))

    if a.dry_run:
        print(f"설교 {len(entries)}편 읽음 (올리지 않음)")
        for key, e in todo:
            err = finish_entry(e)
            print(f"  {e['date']}  {e['service']:7s}  {e['title'][:28]:30s} {e.get('scripture') or e['scripture_raw']:22s} "
                  f"원고 {plain_len(e.get('content'))}자  ← {e['text_src'].name}" + (f"  ⚠ {err}" if err else ""))
        if problems:
            print(f"\n확인 필요 {len(problems)}건:")
            for p in problems:
                print("  ·", p[:160])
        return

    if not todo:
        log("새 설교 파일이 없습니다.")
        return

    key = load_key()
    if not key:
        log("전용 열쇠가 없습니다. tools\\설교올리기_열쇠넣기.bat 를 먼저 실행해 주세요.")
        if not state.get("_nokey_notified"):          # 10분마다 돌아도 알림은 한 번만
            notify_telegram("⚠️ 설교 자동 올리기: 전용 열쇠가 아직 없습니다. '설교올리기_열쇠넣기'를 한 번 실행해 주세요.")
            state["_nokey_notified"] = True
            STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")
        return
    store = Store(key)

    done, failed = [], []
    for key, e in todo:
        label = f"{e['date']:%m/%d} {e['service']} '{e['title'][:20]}'"
        try:
            err = finish_entry(e)
            if err:
                failed.append(f"{label}: {err}")
                continue
            pdf = ensure_pdf(e["paths"], allow_convert=not a.no_pdf)
            d = e["date"].strftime("%Y-%m-%d")
            svc_slug = {"주일 낮 예배": "sun-am", "주일 오후예배": "sun-pm", "수요기도회": "wed", "새벽기도": "dawn"}[e["service"]]
            file_url = None
            if pdf:
                file_url = store.upload(pdf, f"sermons/{d}_{svc_slug}.{pdf.suffix.lower().lstrip('.')}")
            rows = store.get(f"sermons?select=id,title,scripture,content,file_url,bible_text,preacher&sermon_date=eq.{d}&service=eq.{e['service']}")
            st = state.get(key) or {}
            payload = dict(title=e["title"], scripture=e["scripture"], content=e["content"], bible_text=e["bible_text"],
                           preacher=PREACHER, status="완료")
            if file_url:
                payload["file_url"] = file_url
            mine = [r for r in rows if str(r["id"]) == str(st.get("row_id"))]
            if mine:                                   # 이 프로그램이 만든 것 → 새 내용으로 덮어씀
                store.patch("sermons", mine[0]["id"], payload)
                row_id, how = mine[0]["id"], "다시 올림"
            elif rows:                                 # 손으로 올려 둔 것 → 빈칸만 채움
                r0 = rows[0]
                fill = {k: v for k, v in payload.items() if k in ("title", "scripture", "content", "bible_text", "file_url", "preacher") and not str(r0.get(k) or "").strip()}
                if fill:
                    store.patch("sermons", r0["id"], fill)
                row_id, how = r0["id"], ("빈칸 채움: " + ", ".join(fill) if fill else "이미 있음(그대로 둠)")
            else:
                payload.update(sermon_date=d, service=e["service"])
                try:
                    row = store.post("sermons", payload)
                except RuntimeError as ex:
                    if "PGRST204" in str(ex) or "column" in str(ex):
                        for k in ("status", "bible_text"):
                            payload.pop(k, None)
                        row = store.post("sermons", payload)
                    else:
                        raise
                row_id, how = row["id"], "새로 올림"
            state[key] = dict(sig=e["sig"], row_id=row_id, file_url=file_url, src=e["text_src"].name, at=dt.datetime.now().isoformat(timespec="seconds"))
            STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")
            done.append(f"{label} — {how}")
            log(f"{label} — {how}")
        except Exception as ex:
            failed.append(f"{label}: {ex}")
            log(f"{label} 실패: {ex}")

    msg = []
    if done:
        msg.append(f"📖 설교 {len(done)}편 홈페이지에 올렸습니다.")
        msg += ["· " + x for x in done[:12]]
        if len(done) > 12:
            msg.append(f"· … 외 {len(done) - 12}편")
    if failed:
        msg.append(f"\n⚠️ 올리지 못한 것 {len(failed)}건")
        msg += ["· " + x for x in failed[:8]]
    new_problems = [p for p in problems if p not in state.get("_problems", [])]
    if new_problems:
        msg.append(f"\n🔎 확인 필요 {len(new_problems)}건 (등록하지 않음)")
        msg += ["· " + x[:120] for x in new_problems[:8]]
    state["_problems"] = problems
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")
    if done or failed or new_problems:
        notify_telegram("\n".join(msg))


if __name__ == "__main__":
    main()

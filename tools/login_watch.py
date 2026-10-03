#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
노진교회 홈페이지 — 로그인 보안 알림 (2026-10-03, 사무실 PC 에서 5분마다)

목사님 요청: "하루 요약으로 하되, 해외 접속만 실시간으로 알림"
  · 해외에서 로그인하면 → 바로 텔레그램 알림(한 번만)
  · 밤 9시가 지나면 하루 한 번 요약 → 로그인한 사람·횟수, 해외 로그인, 새 가입, 권한 변경·계정 정지·강제 로그아웃·되살림
    (아무 일이 없어도 '조용한 하루'로 보내서 알림 도구가 살아 있는지도 알 수 있게)
  · 로그인 기록은 1년 지나면 지운다(개인정보처리방침 제4조)

자료:  public.login_log — 누가 로그인하면 DB 트리거가 시각·사람·IP·기기를 남긴다(supabase/login_log_20261003.sql)
나라:  DB-IP 'IP to Country Lite'(CC BY 4.0, https://db-ip.com) — PC 안에서만 찾는다(교인 IP 를 바깥에 보내지 않음).
       %APPDATA%\\nojin\\geoip\\dbip-country-lite.csv.gz, 매달 새 판을 받는다(2026-10-03 목사님 허락).
알림:  D:\\클코저장소\\텔레그램봇\\.env 의 봇(백업 실패 알림과 같은 봇). 텔레그램에는 이름·시각·나라·기기만 보내고 IP 는 보내지 않는다.
열쇠:  %APPDATA%\\nojin\\supabase_service.key
상태:  %APPDATA%\\nojin\\login_watch\\state.json, 기록: log.txt
예약:  tools\\register_login_watch_task.ps1 (5분마다, LoginWatch)
손으로: python tools\\login_watch.py            한 번 돌리기
        python tools\\login_watch.py --preview  보내지 않고 화면에만(요약·나라 찾기 시험)
        python tools\\login_watch.py --summary-now  지금 요약 보내기
"""
import os, sys, json, gzip, bisect, ipaddress, re, urllib.request, urllib.error, urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path

SUPABASE_URL = "https://vwuzmklacdwiqyqjrxyt.supabase.co"
APPDATA = Path(os.environ.get("APPDATA", str(Path.home())))
KEY_FILE = APPDATA / "nojin" / "supabase_service.key"
DATA_DIR = APPDATA / "nojin" / "login_watch"
GEO_DIR = APPDATA / "nojin" / "geoip"
GEO_FILE = GEO_DIR / "dbip-country-lite.csv.gz"
GEO_URL = "https://download.db-ip.com/free/dbip-country-lite-{ym}.csv.gz"
TELEGRAM_ENV = Path(r"D:\클코저장소\텔레그램봇\.env")
KST = timezone(timedelta(hours=9))
SUMMARY_HOUR = 21            # 밤 9시 이후 하루 한 번 요약
KEEP_DAYS = 365              # 로그인 기록 보관 기간
HOME_COUNTRY = "KR"

COUNTRY_KO = {
    "KR": "한국", "US": "미국", "JP": "일본", "CN": "중국", "HK": "홍콩", "TW": "대만", "VN": "베트남", "PH": "필리핀",
    "TH": "태국", "ID": "인도네시아", "MY": "말레이시아", "SG": "싱가포르", "IN": "인도", "KH": "캄보디아", "MN": "몽골",
    "KZ": "카자흐스탄", "UZ": "우즈베키스탄", "RU": "러시아", "UA": "우크라이나", "TR": "튀르키예", "DE": "독일",
    "FR": "프랑스", "GB": "영국", "NL": "네덜란드", "IT": "이탈리아", "ES": "스페인", "CA": "캐나다", "MX": "멕시코",
    "BR": "브라질", "AU": "호주", "NZ": "뉴질랜드", "IL": "이스라엘", "AE": "아랍에미리트", "KP": "북한", "IR": "이란",
}
PERM_KO = {"can_finance": "재정", "can_gyojeok": "교적", "can_homepage": "홈페이지", "can_worship": "예배", "can_affairs": "목회행정",
           "can_board": "게시판", "can_district": "교구사역", "can_district_all": "교구사역 전체", "can_score": "악보"}

PREVIEW = "--preview" in sys.argv


def log(msg):
    if PREVIEW:                           # 시험(--preview)은 화면에만, 기록 파일에는 남기지 않는다
        print(msg, flush=True)
        return
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    p = DATA_DIR / "log.txt"
    try:
        if p.exists() and p.stat().st_size > 1_000_000:
            p.write_text(p.read_text(encoding="utf-8")[-200_000:], encoding="utf-8")
        with p.open("a", encoding="utf-8") as f:
            f.write(datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S") + "  " + msg + "\n")
    except OSError:
        pass
    if sys.stdout and sys.stdout.isatty():
        print(msg, flush=True)


# ── Supabase ──
KEY = KEY_FILE.read_text(encoding="utf-8").strip() if KEY_FILE.exists() else None


def api(method, path, body=None, prefer=None):
    h = {"apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json"}
    if prefer:
        h["Prefer"] = prefer
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(SUPABASE_URL + path, data=data, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=60) as r:
        t = r.read().decode("utf-8")
        return json.loads(t) if t else None


# ── 텔레그램 ──
def telegram(text):
    if PREVIEW:
        print("\n[텔레그램으로 보낼 글]\n" + text + "\n", flush=True)
        return True
    try:
        env = {}
        for line in TELEGRAM_ENV.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
        token = env["TELEGRAM_BOT_TOKEN"]
        ok = False
        for uid in [x.strip() for x in env.get("ALLOWED_USER_IDS", "").split(",") if x.strip()]:
            req = urllib.request.Request("https://api.telegram.org/bot" + token + "/sendMessage",
                                         data=json.dumps({"chat_id": int(uid), "text": text}).encode("utf-8"),
                                         headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=15) as r:
                ok = ok or r.status == 200
        return ok
    except Exception as e:
        log("[텔레그램 실패] " + type(e).__name__)      # 주소에 토큰이 들어 있어 오류 글은 남기지 않는다
        return False


# ── 나라 찾기(DB-IP, PC 안에서만) ──
_geo = None


def ensure_geo(state):
    """파일이 없거나 달이 바뀌었으면 새 판을 받는다(하루 한 번만 시도)."""
    ym = datetime.now(KST).strftime("%Y-%m")
    today = datetime.now(KST).strftime("%Y-%m-%d")
    if GEO_FILE.exists() and not state.get("geo_month"):          # 손으로 받아 둔 파일이면 파일 날짜로
        state["geo_month"] = datetime.fromtimestamp(GEO_FILE.stat().st_mtime, KST).strftime("%Y-%m")
    if GEO_FILE.exists() and state.get("geo_month") == ym:
        return
    if GEO_FILE.exists() and (datetime.now(KST).day < 2 or state.get("geo_try") == today):
        return
    state["geo_try"] = today
    for cand in (ym, (datetime.now(KST).replace(day=1) - timedelta(days=1)).strftime("%Y-%m")):
        try:
            GEO_DIR.mkdir(parents=True, exist_ok=True)
            tmp = GEO_FILE.with_suffix(".part")
            req = urllib.request.Request(GEO_URL.format(ym=cand), headers={"User-Agent": "nojin-login-watch"})
            with urllib.request.urlopen(req, timeout=120) as r, tmp.open("wb") as f:
                f.write(r.read())
            with gzip.open(tmp, "rt", encoding="utf-8") as g:           # 받은 파일이 멀쩡한지
                if not re.match(r"^[0-9a-fA-F:.]+,[0-9a-fA-F:.]+,[A-Z]{2}", g.readline()):
                    raise ValueError("파일 모양이 이상함")
            tmp.replace(GEO_FILE)
            state["geo_month"] = cand
            log("나라 자료 새 판: " + cand)
            return
        except Exception as e:
            log("나라 자료 받기 실패(" + cand + "): " + type(e).__name__)


def load_geo():
    global _geo
    if _geo is not None:
        return _geo
    v4s, v4e, v4c, v6s, v6e, v6c = [], [], [], [], [], []
    if GEO_FILE.exists():
        with gzip.open(GEO_FILE, "rt", encoding="utf-8") as g:
            for line in g:
                a, b, c = line.strip().split(",")[:3]
                ia, ib = ipaddress.ip_address(a), ipaddress.ip_address(b)
                if ia.version == 4:
                    v4s.append(int(ia)); v4e.append(int(ib)); v4c.append(c)
                else:
                    v6s.append(int(ia)); v6e.append(int(ib)); v6c.append(c)
    _geo = ((v4s, v4e, v4c), (v6s, v6e, v6c))
    return _geo


def country_of(ip):
    """'KR', 'US' … / 'LOCAL'(내부망) / None(모름)"""
    if not ip:
        return None
    try:
        a = ipaddress.ip_address(ip.split("/")[0])
    except ValueError:
        return None
    if a.is_private or a.is_loopback or a.is_link_local or a.is_reserved:
        return "LOCAL"
    s, e, c = load_geo()[0 if a.version == 4 else 1]
    i = bisect.bisect_right(s, int(a)) - 1
    if i >= 0 and int(a) <= e[i] and c[i] != "ZZ":
        return c[i]
    return None


def country_name(cc):
    if cc is None:
        return "나라를 알 수 없음"
    if cc == "LOCAL":
        return "내부망"
    return COUNTRY_KO.get(cc, cc) + " (" + cc + ")"


def device(ua):
    if not ua:
        return "기기 모름"
    u = ua.lower()
    if "kakaotalk" in u:
        app = "카카오톡 안 브라우저"
    elif "samsungbrowser" in u:
        app = "삼성 인터넷"
    elif "naver(inapp" in u or ("naver" in u and "inapp" in u):
        app = "네이버 앱"
    elif "whale/" in u:
        app = "웨일"
    elif "edg/" in u:
        app = "엣지"
    elif "firefox/" in u:
        app = "파이어폭스"
    elif "chrome/" in u or "crios/" in u:
        app = "크롬"
    elif "safari/" in u:
        app = "사파리"
    else:
        app = "앱·프로그램"
    if "iphone" in u:
        dev = "아이폰"
    elif "ipad" in u:
        dev = "아이패드"
    elif "android" in u:
        dev = "안드로이드 휴대폰" if "mobile" in u else "안드로이드 태블릿"
    elif "windows" in u:
        dev = "윈도우 PC"
    elif "macintosh" in u or "mac os" in u:
        dev = "맥"
    elif "linux" in u or "cros" in u:
        dev = "리눅스·크롬북 등"
    else:
        dev = "기기 모름"
    return dev + " · " + app


def kst(t):
    return datetime.fromisoformat(t.replace("Z", "+00:00")).astimezone(KST)


def when(t):
    d = kst(t)
    return str(d.month) + "월 " + str(d.day) + "일 " + d.strftime("%H:%M")


# ── 사람 이름·역할 ──
_people = None


def people():
    global _people
    if _people is not None:
        return _people
    names = {p["id"]: p.get("name") for p in api("GET", "/rest/v1/profiles?select=id,name")}
    admins = {a["uid"] for a in api("GET", "/rest/v1/admins?select=uid")}
    try:
        owners = {o["uid"] for o in api("GET", "/rest/v1/site_owners?select=uid")}
    except urllib.error.HTTPError:
        owners = set()
    perms = {}
    for l in api("GET", "/rest/v1/member_links?select=*"):
        perms[l["user_id"]] = [PERM_KO.get(k, k) for k, v in l.items() if k.startswith("can_") and v is True]
    _people = (names, admins, owners, perms)
    return _people


def who(uid, with_role=True):
    if not uid:
        return "관리 화면·비상 복구"
    names, admins, owners, perms = people()
    n = names.get(uid) or "(이름 없음)"
    if not with_role:
        return n
    role = "최고 운영자" if uid in owners else "관리자" if uid in admins else "권한자" if perms.get(uid) else "교인"
    return n + "(" + role + ")"


# ── 할 일 ──
def check_new_logins(state):
    rows = api("GET", "/rest/v1/login_log?select=*&id=gt." + str(state.get("last_id", 0)) + "&order=id&limit=1000")
    if not rows:
        return
    first = not state.get("initialized")
    for r in rows:
        cc = country_of(r.get("ip"))
        if PREVIEW:
            print("  " + when(r["at"]) + "  " + who(r.get("user_id")) + "  " + country_name(cc) + "  " + device(r.get("user_agent")), flush=True)
        if not PREVIEW and r.get("country") != (cc or "?"):
            api("PATCH", "/rest/v1/login_log?id=eq." + str(r["id"]), {"country": cc or "?"}, "return=minimal")
        overseas = cc not in (HOME_COUNTRY, "LOCAL")
        if overseas and not r.get("alerted") and not first:
            text = ("🚨 해외에서 홈페이지 로그인\n"
                    "누구: " + who(r.get("user_id")) + "\n"
                    "언제: " + when(r["at"]) + "\n"
                    "어디: " + country_name(cc) + "\n"
                    "기기: " + device(r.get("user_agent")) + "\n\n"
                    "목사님이 모르는 일이면 사무실 PC 바탕화면 「홈페이지 비상복구」에서\n"
                    "[3] 비밀번호 털림 또는 [4] 모든 사람 로그아웃을 골라 주세요.")
            if telegram(text) and not PREVIEW:
                api("PATCH", "/rest/v1/login_log?id=eq." + str(r["id"]), {"alerted": True}, "return=minimal")
            log("해외 로그인 알림: " + who(r.get("user_id"), False) + " " + str(cc))
        state["last_id"] = max(state.get("last_id", 0), r["id"])
    if first:
        state["initialized"] = True
        log("처음 실행: 지난 로그인 " + str(len(rows)) + "개의 나라만 채움(알림 없음)")


def summary_text(since):
    s_iso = since.astimezone(timezone.utc).isoformat()
    q = urllib.parse.quote(s_iso, safe="")
    logins = api("GET", "/rest/v1/login_log?select=at,user_id,country,ip&at=gt." + q + "&order=at")
    for l in logins:                      # 아직 나라를 못 채운 줄은 여기서 찾는다
        if l.get("country") in (None, ""):
            l["country"] = country_of(l.get("ip")) or "?"
    lines = ["📋 노진교회 홈페이지 하루 요약",
             "(" + str(since.month) + "월 " + str(since.day) + "일 " + since.strftime("%H:%M") + " ~ 지금)"]
    if logins:
        cnt = {}
        for l in logins:
            cnt[l["user_id"]] = cnt.get(l["user_id"], 0) + 1
        top = sorted(cnt.items(), key=lambda x: -x[1])
        lines.append("· 로그인 " + str(len(logins)) + "번, " + str(len(cnt)) + "명")
        lines.append("   " + " · ".join(who(u) + " " + str(n) + "번" for u, n in top[:25]) + (" 외" if len(top) > 25 else ""))
        abroad = [l for l in logins if (l.get("country") or "?") not in (HOME_COUNTRY, "LOCAL")]
        lines.append("· 해외 로그인: " + ("없음 ✓" if not abroad else
                     str(len(abroad)) + "번 ⚠️ " + ", ".join(who(l["user_id"], False) + "(" + country_name(None if l.get("country") == "?" else l.get("country")) + ")" for l in abroad[:10])))
    else:
        lines.append("· 로그인: 없음")
    try:
        page = api("GET", "/auth/v1/admin/users?per_page=1000")
        users = page.get("users", []) if isinstance(page, dict) else page
        new = [u for u in users if u.get("created_at") and kst(u["created_at"]) > since]
        lines.append("· 새 가입: " + ("없음" if not new else str(len(new)) + "명 — " + ", ".join(
            (people()[0].get(u["id"]) or u.get("email") or "(이름 없음)") + "(" + ((u.get("app_metadata") or {}).get("provider") or "") + ")" for u in new[:10])))
    except urllib.error.HTTPError:
        pass
    try:
        acts = api("GET", "/rest/v1/access_log?select=at,actor,target,what,detail&at=gt." + q + "&order=at")
    except urllib.error.HTTPError:
        acts = []
    perm = [a for a in acts if a["what"] in ("관리자 지정", "관리자 해제", "권한")]
    other = [a for a in acts if a not in perm]

    def act_line(a):
        det = ""
        d = a.get("detail") or {}
        if a["what"] == "권한":
            det = ", ".join(PERM_KO.get(k, "회원" if k == "member_status" else k) + " " +
                            ("켬" if v[1] is True else "끔" if v[1] is False else str(v[0]) + "→" + str(v[1])) for k, v in d.items())
        elif d.get("table"):
            det = d["table"] + " " + str(d.get("rows")) + "줄"
        elif d.get("note"):
            det = d["note"]
        return when(a["at"]) + " " + who(a.get("actor"), False) + " → " + (who(a.get("target"), False) if a.get("target") else "-") + ": " + a["what"] + (" " + det if det else "")
    lines.append("· 권한 변경: " + ("없음" if not perm else str(len(perm)) + "건"))
    for a in perm[:10]:
        lines.append("   " + act_line(a))
    lines.append("· 계정 정지·강제 로그아웃·되살림: " + ("없음" if not other else str(len(other)) + "건"))
    for a in other[:10]:
        lines.append("   " + act_line(a))
    if not logins and not perm and not other:
        lines.append("오늘은 조용한 하루였습니다 ✓")
    return "\n".join(lines)


def maybe_summary(state, force=False):
    now = datetime.now(KST)
    today = now.strftime("%Y-%m-%d")
    if not force and (now.hour < SUMMARY_HOUR or state.get("summary_date") == today):
        return
    since = datetime.fromisoformat(state["summary_at"]) if state.get("summary_at") else now - timedelta(days=1)
    if telegram(summary_text(since)) and not PREVIEW:
        state["summary_date"] = today
        state["summary_at"] = now.isoformat()
        log("하루 요약 보냄")


def cleanup(state):
    today = datetime.now(KST).strftime("%Y-%m-%d")
    if state.get("cleanup_date") == today or PREVIEW:
        return
    cut = (datetime.now(timezone.utc) - timedelta(days=KEEP_DAYS)).isoformat()
    api("DELETE", "/rest/v1/login_log?at=lt." + urllib.parse.quote(cut, safe=""), prefer="return=minimal")
    state["cleanup_date"] = today


def main():
    if not KEY:
        log("열쇠 파일이 없습니다: " + str(KEY_FILE))
        return 1
    sp = DATA_DIR / "state.json"
    state = json.loads(sp.read_text(encoding="utf-8")) if sp.exists() else {}
    try:
        ensure_geo(state)
        check_new_logins(state)
        maybe_summary(state, force="--summary-now" in sys.argv)
        cleanup(state)
    except urllib.error.URLError as e:
        log("연결 실패(다음에 다시): " + str(getattr(e, "reason", e))[:120])
    except Exception as e:
        log("오류: " + type(e).__name__ + " " + str(e)[:200])
    finally:
        if not PREVIEW:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            sp.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())

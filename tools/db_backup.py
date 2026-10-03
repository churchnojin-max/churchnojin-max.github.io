#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
노진교회 홈페이지 — DB 백업 (2026-10-03)

왜: 교적·헌금·설교 같은 자료는 Supabase(인터넷 서버)에만 있다. 실수로 지우거나 누가 지우면
    되살릴 방법이 없으므로, 사무실 PC 가 매일 밤 전체를 내려받아 날짜별로 보관한다.

무엇을:
  · 표(table) 전부 → 표마다 json 한 개 (공개용 창(view)은 원본 표에서 다시 만들 수 있어 뺌)
  · 가입 계정 목록(이메일·가입일·가입 방식. 비밀번호는 내려받을 수 없다)
  · 보관함(사진·주보·문서) 파일 목록 + 파일 자체(새로 생긴 것만 받아 덧붙임)
어디에: D:\\교회\\홈페이지_DB백업\\  (DB\\nojin_db_날짜_시각.zip, 파일\\<보관함>\\…)
보관: 최근 30개 + 매달 첫 백업은 12달

  · 전용 열쇠 파일: %APPDATA%\\nojin\\supabase_service.key (설교 자동 올리기와 같은 열쇠)
  · 예약 작업 등록: tools\\register_db_backup_task.ps1 (매일 02:30, DbBackupNightly)
  · 손으로 실행: python tools\\db_backup.py   (파일은 빼고 표만: --no-files)
  · 기록: %APPDATA%\\nojin\\db_backup\\log.txt, 실패하면 텔레그램으로 알림
  · 백업에는 교인 개인정보가 들어 있다. 이 폴더를 홈페이지 저장소 안으로 옮기지 말 것.
"""
import os, sys, json, argparse, zipfile, tempfile, shutil
import datetime as dt
from pathlib import Path

APPDATA = Path(os.environ.get("APPDATA", str(Path.home())))
DATA_DIR = APPDATA / "nojin" / "db_backup"
KEY_FILE = APPDATA / "nojin" / "supabase_service.key"
LOG_PATH = DATA_DIR / "log.txt"
OUT_ROOT = Path(r"D:\교회\홈페이지_DB백업")
TELEGRAM_ENV_PATH = Path(r"D:\클코저장소\텔레그램봇\.env")

SUPABASE_URL = "https://vwuzmklacdwiqyqjrxyt.supabase.co"   # js/config.js 와 같은 값(공개)
VIEWS = {"bulletins_public", "qt_published", "album_feed"}   # 원본 표에서 다시 만들 수 있는 공개용 창
SKIP_FILE_BUCKETS = {"hymns", "tts-cache"}                   # 악보는 원본이 PC 에 있고, 음성은 다시 만들 수 있다
SKIP_TABLES = {"login_log"}   # 로그인 기록은 1년만 보관(개인정보처리방침 제4조) — 백업(최대 12달 더 보관)에 넣으면 그보다 오래 남으므로 뺀다
KEEP_RECENT, KEEP_MONTHS = 30, 12
PAGE = 1000


def log(msg):
    line = f"[{dt.datetime.now():%Y-%m-%d %H:%M:%S}] {msg}"
    try:
        print(line)
    except Exception:
        pass
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with LOG_PATH.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


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
        log(f"[텔레그램 알림 실패] {type(e).__name__}")   # 주소에 토큰이 들어 있어 오류 글은 남기지 않는다


class Api:
    def __init__(self, key):
        import requests
        self.rq = requests
        self.h = {"apikey": key, "Authorization": f"Bearer {key}"}

    def _get(self, path, **kw):
        r = self.rq.get(SUPABASE_URL + path, headers={**self.h, **kw.pop("headers", {})}, timeout=60, **kw)
        if r.status_code >= 300:
            raise RuntimeError(f"조회 실패 {r.status_code} {path.split('?')[0]}: {r.text[:160]}")
        return r

    def tables(self):
        """표 이름 → 정렬에 쓸 칸(기본 열쇠, 없으면 첫 칸)"""
        spec = self._get("/rest/v1/").json()
        out = {}
        for name, d in (spec.get("definitions") or {}).items():
            if name in VIEWS or name in SKIP_TABLES:
                continue
            props = d.get("properties") or {}
            pk = [c for c, p in props.items() if "<pk/>" in (p.get("description") or "")]
            out[name] = pk or list(props)[:1]
        return out

    def dump_table(self, name, order_cols):
        rows, off = [], 0
        order = ("&order=" + ",".join(order_cols)) if order_cols else ""
        while True:
            r = self._get(f"/rest/v1/{name}?select=*{order}&limit={PAGE}&offset={off}")
            part = r.json()
            rows.extend(part)
            if len(part) < PAGE:
                return rows
            off += PAGE

    def users(self):
        out, page = [], 1
        keep = ("id", "email", "phone", "created_at", "last_sign_in_at", "banned_until", "app_metadata", "user_metadata")
        while True:
            j = self._get(f"/auth/v1/admin/users?page={page}&per_page=1000").json()
            part = j.get("users", j if isinstance(j, list) else [])
            out.extend({k: u.get(k) for k in keep} for u in part)
            if len(part) < 1000:
                return out
            page += 1

    def buckets(self):
        return self._get("/storage/v1/bucket").json()

    def list_files(self, bucket, prefix=""):
        """보관함 안의 모든 파일(폴더는 따라 들어감) → [{name, size, updated_at}]"""
        out, off = [], 0
        while True:
            r = self.rq.post(f"{SUPABASE_URL}/storage/v1/object/list/{bucket}", headers={**self.h, "Content-Type": "application/json"},
                             json={"prefix": prefix, "limit": PAGE, "offset": off, "sortBy": {"column": "name", "order": "asc"}}, timeout=60)
            if r.status_code >= 300:
                raise RuntimeError(f"보관함 목록 실패 {r.status_code} {bucket}/{prefix}: {r.text[:160]}")
            part = r.json()
            for it in part:
                path = (prefix + "/" if prefix else "") + it["name"]
                if it.get("id") is None:                      # 폴더
                    out.extend(self.list_files(bucket, path))
                else:
                    out.append({"name": path, "size": (it.get("metadata") or {}).get("size"), "updated_at": it.get("updated_at")})
            if len(part) < PAGE:
                return out
            off += PAGE

    def download(self, bucket, name, dest: Path):
        from urllib.parse import quote
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_name(dest.name + ".part")
        with self.rq.get(f"{SUPABASE_URL}/storage/v1/object/{bucket}/{quote(name)}", headers=self.h, stream=True, timeout=300) as r:
            if r.status_code >= 300:
                raise RuntimeError(f"파일 받기 실패 {r.status_code} {bucket}/{name}")
            with tmp.open("wb") as f:
                for chunk in r.iter_content(1 << 20):
                    f.write(chunk)
        tmp.replace(dest)


def prune(db_dir: Path):
    """최근 KEEP_RECENT 개 + 달마다 첫 백업 KEEP_MONTHS 달치만 남긴다."""
    zips = sorted(db_dir.glob("nojin_db_*.zip"))
    keep = set(zips[-KEEP_RECENT:])
    first_of_month = {}
    for z in zips:
        first_of_month.setdefault(z.name[9:16], z)          # nojin_db_YYYY-MM-…
    keep.update(sorted(first_of_month.values())[-KEEP_MONTHS:])
    for z in zips:
        if z not in keep:
            z.unlink()
            log(f"오래된 백업 지움: {z.name}")


def main():
    ap = argparse.ArgumentParser(description="노진교회 홈페이지 DB 백업")
    ap.add_argument("--no-files", action="store_true", help="보관함 파일은 받지 않고 표만 백업")
    a = ap.parse_args()

    try:
        key = KEY_FILE.read_text(encoding="utf-8").strip()
    except Exception:
        key = ""
    if not key:
        log("열쇠 파일이 없습니다 — tools\\설교올리기_열쇠넣기.bat 으로 먼저 넣어 주세요.")
        return 2

    api = Api(key)
    stamp = f"{dt.datetime.now():%Y-%m-%d_%H%M}"
    db_dir = OUT_ROOT / "DB"
    db_dir.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix="nojin_db_"))
    try:
        summary, total = {}, 0
        for name, order_cols in sorted(api.tables().items()):
            rows = api.dump_table(name, order_cols)
            (work / f"{name}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
            summary[name] = len(rows)
            total += len(rows)
        users = api.users()
        (work / "_auth_users.json").write_text(json.dumps(users, ensure_ascii=False, indent=1), encoding="utf-8")

        manifests = {}
        for b in api.buckets():
            manifests[b["id"]] = {"public": b.get("public"), "files": api.list_files(b["id"])}
        (work / "_storage_files.json").write_text(json.dumps(manifests, ensure_ascii=False, indent=1), encoding="utf-8")
        (work / "_summary.json").write_text(json.dumps(
            {"at": stamp, "tables": summary, "rows": total, "users": len(users),
             "files": {k: len(v["files"]) for k, v in manifests.items()}}, ensure_ascii=False, indent=1), encoding="utf-8")

        zpath = db_dir / f"nojin_db_{stamp}.zip"
        with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
            for f in sorted(work.iterdir()):
                z.write(f, f.name)
        log(f"DB 백업 완료: 표 {len(summary)}개 · {total}줄 · 계정 {len(users)}개 → {zpath.name} ({zpath.stat().st_size // 1024} KB)")

        got = failed = 0
        if not a.no_files:
            for bucket, m in manifests.items():
                if bucket in SKIP_FILE_BUCKETS:
                    continue
                for f in m["files"]:
                    dest = OUT_ROOT / "파일" / bucket / Path(*f["name"].split("/"))
                    if dest.exists() and (f["size"] is None or dest.stat().st_size == f["size"]):
                        continue
                    try:
                        api.download(bucket, f["name"], dest)
                        got += 1
                    except Exception as e:
                        failed += 1
                        log(f"[파일 받기 실패] {bucket}/{f['name']}: {e}")
            log(f"보관함 파일: 새로 받은 것 {got}개" + (f", 실패 {failed}개" if failed else ""))
        prune(db_dir)
        if failed:
            notify_telegram(f"⚠️ 홈페이지 DB 백업: 표는 백업했지만 보관함 파일 {failed}개를 받지 못했습니다. (기록: %APPDATA%\\nojin\\db_backup\\log.txt)")
        return 0
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        log(f"[백업 실패] {e}")
        notify_telegram(f"⚠️ 홈페이지 DB 백업이 실패했습니다: {str(e)[:200]}\n(사무실 PC, 기록: %APPDATA%\\nojin\\db_backup\\log.txt)")
        sys.exit(1)

/* 실시간 예배 상태(2026-10-04 목사님 요청: "10시 30분부터 실시간인지 확인해서 연동")
   · 사무실 PC(tools/live_watch.py, 예약 작업 LiveWatch)가 주일 10:20~16:00 2분마다 유튜브 채널의 '실시간' 화면을 보고
     Supabase site_live 한 줄에 적는다(supabase/site_live_20261004.sql). 여기서는 그 줄을 읽기만 한다.
   · 6분 넘게 새 소식이 없으면(PC 꺼짐 등) 시간으로 짐작한다: 주일 10:30~16:00.
   · 주일 10:00~16:30 밖에서는 묻지 않고 '방송 아님'.
   · 쓰는 곳: js/live-badge.js(첫 화면 실시간 점), js/sermon-video.js(예배와 말씀 설교 영상 칸)
   · config.js(SUPABASE_URL·SUPABASE_ANON_KEY) 다음에 불러야 한다. */
(function () {
  const FRESH_MS = 6 * 60 * 1000;
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  function kst() {
    const p = {};
    fmt.formatToParts(new Date()).forEach((x) => { p[x.type] = x.value; });
    return { sun: p.weekday === "Sun", mins: (parseInt(p.hour, 10) % 24) * 60 + parseInt(p.minute, 10) };
  }
  function byTime() { const t = kst(); return t.sun && t.mins >= 630 && t.mins < 960; }          // 10:30 ~ 16:00
  function inWatchWindow() { const t = kst(); return t.sun && t.mins >= 600 && t.mins < 990; }   // 10:00 ~ 16:30
  let last = null, lastAt = 0, pending = null;
  function get() {
    if (!inWatchWindow()) return Promise.resolve({ live: false, id: null, title: null, source: "time" });
    if (last && Date.now() - lastAt < 50 * 1000) return Promise.resolve(last);    // 여러 곳에서 불러도 1분에 한 번만
    if (pending) return pending;
    const u = window.SUPABASE_URL, k = window.SUPABASE_ANON_KEY;
    pending = (u && k
      ? fetch(u + "/rest/v1/site_live?select=is_live,video_id,title,checked_at&id=eq.1", { headers: { apikey: k, Authorization: "Bearer " + k }, cache: "no-store" })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => [])
      : Promise.resolve([]))
      .then((rows) => {
        const row = rows && rows[0];
        const fresh = row && Date.now() - Date.parse(row.checked_at) < FRESH_MS;
        last = fresh
          ? { live: !!row.is_live, id: row.video_id || null, title: row.title || null, source: "youtube" }
          : { live: byTime(), id: null, title: null, source: "time" };
        lastAt = Date.now();
        pending = null;
        return last;
      });
    return pending;
  }
  window.LiveStatus = { get, byTime, inWatchWindow };
})();

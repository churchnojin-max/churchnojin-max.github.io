/* 수요기도회 말씀 — 본문·제목·핵심 3가지·인용 구절 + 찬양 악보 (2026-10-05 목사님 요청·같은 날 밤 고침)
   "수요예배 때 성도들이 참고할 수 있도록" → "내 설교를 밖으로 공개하지 않으려는 거야. 오는 사람들에게만 특권을 주는 거지.
    아주 짧게 본문, 제목, 핵심 3가지와 인용 구절만. 콘티를 올리면 악보도 — 오후 10시 30분에는 사라지게."
   목사님 결정: 예배와 말씀(이번 주 말씀 아래) + 수요일 저녁 첫 화면 띠 / 로그인한 회원만 / 목사님 확인 뒤 올림 /
     말씀 자료는 그날 저녁 7시 45분에 열리고 밤 10시 30분에 닫힌다('지난 수요 말씀' 모아 보기 없음) /
     (2026-10-07 목사님: "8시로 했는데 내가 미리 줄테니 7시 45분쯤에 팝업이 뜨거나 그때 열려져서 자료가 보일 수 있도록")
     악보(콘티)는 목사님이 올리면 그날 보이고 밤 10시 30분에 사라진다(파일은 지우지 않고 숨김 — 목사님은 늘 봄).
   ① 예배와 말씀 #wed : 로그인 안 했으면 🔒 안내. 했으면 — 예배 시간엔 말씀 카드(핵심 3가지 + 인용 구절·악보 단추),
      그 전엔 악보만(올렸으면), 그 밖엔 '수요일 저녁 7시 45분에 열립니다' 안내
   ② 크게 읽는 창 : 핵심 3가지 · 오늘 본문 · 인용 구절(설교에서 읽는 순서 ①②③) · 찬양 악보
      휴대폰 '뒤로'로 닫히고, 열려 있는 동안은 옆으로 밀어도 다른 화면으로 넘어가지 않는다(page-slide.js 가 pop-open 을 봄).
   ③ 관리자(목사님) : 확인용 카드(미리보기·고치기·올리기·내리기) + 이번 수요일 콘티·악보 올리기/빼기(비공개 보관함 conti/)
   ④ 첫 화면 '이번 주 설교' 띠 : 수요일 저녁 7시 45분 ~ 밤 10시 30분, 열린 자료가 있으면 '오늘 수요기도회 말씀'
   ⑤ 첫 화면 알림 창 : 같은 때, 그날 한 번 '오늘 수요기도회 말씀이 열렸습니다' → [말씀 자료 보기]면 ①로 가서 ②를 바로 연다.
      로그인 안 했어도 이 기기에서 로그인한 적이 있으면(성도님 기기) [로그인하고 보기] → 로그인 뒤 바로 자료로.
      첫 화면을 열어 둔 채 7시 45분이 되어도 저절로 뜬다.
   보이는 규칙은 데이터베이스가 지킨다(supabase/sermon_notes_20261005.sql, sermon_notes_short_conti_20261005.sql) — 이 파일은 그리는 일만.
   만들기: tools/wed_notes.py(수요일 예약 작업) → 목사님 텔레그램 [올리기]. */
(function () {
  "use strict";
  if (!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY)) return;
  var box = document.getElementById("wedNotes");
  var banner = document.getElementById("heroSermonBanner");
  if (!box && !banner) return;

  var SERVICE = "수요기도회";
  // 여는 때 — 데이터베이스 트리거(supabase/sermon_notes_open1945_20261007.sql)와 같은 값. 닫는 때는 밤 10시 30분.
  var OPEN_H = 19, OPEN_M = 45, OPEN_TXT = "저녁 7시 45분";
  var SB = window.SUPABASE_URL.replace(/\/$/, "");
  var esc = function (t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]; }); };

  function localSession() {
    try {
      var ref = new URL(window.SUPABASE_URL).hostname.split(".")[0];
      var raw = sessionStorage.getItem("sb-" + ref + "-auth-token");
      if (!raw) return null;
      var s = JSON.parse(raw);
      return s && s.currentSession ? s.currentSession : s;
    } catch (e) { return null; }
  }
  function me() { var s = localSession(); return (s && s.user) || null; }
  function headers(extra) {
    var sess = localSession();
    var h = { apikey: window.SUPABASE_ANON_KEY, "Content-Type": "application/json" };
    if (sess && sess.access_token) h.Authorization = "Bearer " + sess.access_token;
    if (extra) Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }
  function api(method, path, body, extra) {
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 12000) : null;
    return fetch(SB + "/rest/v1/" + path, { method: method, headers: headers(extra), body: body ? JSON.stringify(body) : undefined, signal: ctl ? ctl.signal : undefined })
      .then(function (res) {
        return res.text().then(function (txt) {
          var data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
          if (!res.ok) { var err = new Error((data && (data.message || data.hint)) || ("HTTP " + res.status)); err.status = res.status; throw err; }
          return data;
        });
      })
      .finally(function () { if (timer) clearTimeout(timer); });
  }
  // 휴대폰에서 창을 오래 열어 두면 로그인 열쇠가 낡아(1시간) 401 이 난다 → auth.js 가 열쇠를 새로 받을 때까지 기다렸다가 한 번 더
  function whenAuthReady() {
    return new Promise(function (res) {
      if (window.__sb) { res(window.__sb); return; }
      window.addEventListener("sb-ready", function (e) { res((e.detail && e.detail.sb) || window.__sb); }, { once: true });
      setTimeout(function () { res(window.__sb || null); }, 8000);
    });
  }
  function freshSession() {
    return whenAuthReady().then(function (sb) { return sb ? sb.auth.getSession() : null; }).catch(function () { return null; });
  }

  // ── 날짜(한국 시각)
  function kst() { return new Date(Date.now() + 9 * 3600e3); }          // getUTC* 로 읽는다
  function isoOf(d) { return d.toISOString().slice(0, 10); }
  function todayKST() { return isoOf(kst()); }
  function atKST(iso, hh, mm) { var p = String(iso).split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2], hh - 9, mm || 0); }
  function dayLabel(iso) {
    var p = String(iso || "").split("-");
    if (p.length < 3) return "";
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return (+p[1]) + "월 " + (+p[2]) + "일(" + "일월화수목금토"[d.getUTCDay()] + ")";
  }
  // 이번 수요일: 오늘이 수요일이고 밤 10시 30분 전이면 오늘, 아니면 다음 수요일
  function targetWed() {
    var k = kst(), dow = k.getUTCDay(), add = (3 - dow + 7) % 7;
    var d = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() + add));
    if (add === 0 && Date.now() >= atKST(isoOf(d), 22, 30)) d = new Date(d.getTime() + 7 * 864e5);
    return isoOf(d);
  }
  function closeMs(n) { return n.close_at ? Date.parse(n.close_at) : atKST(n.note_date, 22, 30); }
  function isOpen(n) { return !!(n && n.status === "approved" && Date.parse(n.publish_at) <= Date.now() && Date.now() < closeMs(n)); }
  function contiOpen(c) { return !!(c && (c.files || []).length && Date.parse(c.open_at) <= Date.now() && Date.now() < Date.parse(c.close_at)); }
  function circ(i) { return i <= 20 ? String.fromCharCode(0x2460 + i - 1) : "(" + i + ")"; }

  // ── 관리자(목사님)인지 — 확인 전 자료·지난 악보는 데이터베이스가 관리자에게만 준다(is_admin)
  var _admin = null;
  function isAdmin() {
    if (_admin !== null) return Promise.resolve(_admin);
    if (!me()) { _admin = false; return Promise.resolve(false); }
    return api("POST", "rpc/my_perms", {}).then(function (p) { _admin = !!(p && p.isAdmin); return _admin; })
      .catch(function () { _admin = false; return false; });
  }

  // ===== ① 예배와 말씀 #wed =====
  var notes = [], contis = [], admin = false, shownUid = null, retried = false;
  function noteById(id) { return notes.filter(function (n) { return n.id === id; })[0]; }
  function contiFor(iso) { return contis.filter(function (c) { return c.note_date === iso; })[0]; }

  function renderLocked() {
    box.innerHTML = '<div class="member-only wed-locked"><p>🔒 수요기도회 말씀 자료는<br />수요일 저녁 예배 때 로그인하신 분께만 보여 드립니다.</p>' +
      '<div class="member-only-btns"><button type="button" class="btn btn-solid" data-mo="join">가입하기</button><button type="button" class="btn btn-line" data-mo="login">로그인</button></div></div>';
  }

  function load() {
    if (!box) return Promise.resolve();
    shownUid = (me() || {}).id || "";
    if (!me()) { renderLocked(); return Promise.resolve(); }
    box.innerHTML = '<p class="qt-loading">불러오는 중…</p>';
    var svc = "&service=eq." + encodeURIComponent(SERVICE);
    return Promise.all([
      api("GET", "sermon_notes?select=*" + svc + "&order=note_date.desc&limit=6"),
      api("GET", "sermon_conti?select=*" + svc + "&order=note_date.desc&limit=4"),
      isAdmin()
    ]).then(function (res) {
      notes = res[0] || []; contis = res[1] || []; admin = res[2];
      retried = false;
      render();
      ensureAnchor();
      scheduleTick();
      autoOpen();
    }).catch(function (e) {
      if (e && e.status === 401 && !retried) { retried = true; _admin = null; return freshSession().then(load); }
      box.innerHTML = '<div class="wed-empty">수요기도회 말씀을 불러오지 못했습니다.<br /><button type="button" class="btn btn-line" data-wretry>다시 불러오기</button></div>';
    });
  }

  function pointsHtml(n, cls) {
    var pts = ((n.summary || {}).points || []).slice(0, 3);
    if (!pts.length) return "";
    return '<ol class="' + (cls || "wed-points") + '">' + pts.map(function (p) {
      return '<li>' + (p.label ? '<span class="wr-pill">' + esc(p.label) + '</span>' : '') + '<span>' + esc(p.text) + '</span></li>';
    }).join("") + '</ol>';
  }

  // 기도 제목(2026-10-07 목사님): "위에는 고정, 아래는 말씀 후 적용 기도 제목 — 두 개로 나누면"
  //   summary.prayer = { fixed: [...], apply: [...] } — 고정은 tools/wed_notes.py 가 지난 자료에서 이어 받는다
  var PRAYER_FIXED = "고정 기도 제목", PRAYER_APPLY = "특별 기도 제목";   // 이름은 목사님이 주신 글의 제목 그대로(10/07)
  function prayerOf(n) {
    var p = ((n && n.summary) || {}).prayer || {};
    var clean = function (a) { return (a || []).map(function (x) { return String(x || "").trim(); }).filter(Boolean); };
    return { fixed: clean(p.fixed), apply: clean(p.apply) };
  }
  // 말씀의 흐름(2026-10-07 목사님: "설교문을 다 넣기보다 이해를 돕기 위한 자료 — 논리적 흐름") summary.flow = ["단계", …]
  function flowOf(n) { return (((n && n.summary) || {}).flow || []).map(function (x) { return String(x || "").trim(); }).filter(Boolean); }
  function flowHtml(n) {
    var f = flowOf(n);
    if (!f.length) return "";
    return '<section class="wr-sec" id="wrFlow"><h4 class="wr-h">말씀의 흐름</h4><ol class="wr-flow">' +
      f.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join("") + '</ol></section>';
  }
  function prayerCount(n) { var p = prayerOf(n); return p.fixed.length + p.apply.length; }
  function prayerHtml(n) {
    var p = prayerOf(n);
    if (!p.fixed.length && !p.apply.length) return "";
    var part = function (title, list, cls) {
      return list.length ? '<div class="wr-pray-part ' + cls + '"><p class="wr-pray-t">' + esc(title) + '</p><ol class="wr-pray">' +
        list.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join("") + '</ol></div>' : "";
    };
    return '<section class="wr-sec" id="wrPrayer"><h4 class="wr-h">기도 제목</h4>' +
      part(PRAYER_FIXED, p.fixed, "wr-pray-fixed") + part(PRAYER_APPLY, p.apply, "wr-pray-apply") + '</section>';
  }

  function mainCard(n) {
    var cnt = (n.verses || []).length, c = contiFor(n.note_date), pc = prayerCount(n);
    var showConti = c && (contiOpen(c) || (admin && (c.files || []).length));
    return '<article class="week-sermon wed-card">' +
      '<span class="ws-date">' + esc(String(n.note_date).replace(/-/g, ".")) + ' · 수요기도회</span>' +
      (n.series ? '<p class="wed-series">' + esc(n.series) + '</p>' : '') +
      '<h3 class="ws-title">' + esc(n.title) + '</h3>' +
      (n.scripture ? '<p class="ws-ref">' + esc(n.scripture) + '</p>' : '') +
      pointsHtml(n) +
      '<div class="wed-btns">' +
        '<button type="button" class="wed-btn" data-wopen="' + esc(n.id) + '" data-wsec="wrVerses"><span aria-hidden="true">📖</span> <span>인용 구절</span>' + (cnt ? ' <b>' + cnt + '</b>' : '') + '</button>' +
        (showConti ? '<button type="button" class="wed-btn wed-btn-2" data-wopen="' + esc(n.id) + '" data-wsec="wrConti"><span aria-hidden="true">🎵</span> <span>찬양 악보</span></button>'
                   : '<button type="button" class="wed-btn wed-btn-2" data-wopen="' + esc(n.id) + '" data-wsec="wrPassage"><span aria-hidden="true">📜</span> <span>오늘 본문</span></button>') +
      '</div>' +
      (pc ? '<div class="wed-btns wed-btns-1 wed-btns-pray"><button type="button" class="wed-btn wed-btn-2" data-wopen="' + esc(n.id) + '" data-wsec="wrPrayer"><span aria-hidden="true">🙏</span> <span>기도 제목</span> <b>' + pc + '</b></button></div>' : '') +
      '<p class="wed-close-note">밤 10시 30분에 닫힙니다</p>' +
      '</article>';
  }

  function contiCard(c) {
    var beforeOpen = Date.now() < atKST(c.note_date, OPEN_H, OPEN_M);
    return '<article class="week-sermon wed-card">' +
      '<span class="ws-date">' + esc(String(c.note_date).replace(/-/g, ".")) + ' · 수요기도회</span>' +
      '<h3 class="ws-title">오늘 찬양 악보</h3>' +
      '<div class="wed-btns wed-btns-1"><button type="button" class="wed-btn" data-wconti="' + esc(c.note_date) + '"><span aria-hidden="true">🎵</span> <span>찬양 악보 보기</span> <b>' + (c.files || []).length + '</b></button></div>' +
      '<p class="wed-close-note">' + (beforeOpen ? "말씀 자료는 " + OPEN_TXT + "에 열립니다 · " : "") + '악보는 밤 10시 30분에 사라집니다</p>' +
      '</article>';
  }

  function adminCard(n) {
    var st = n.status === "approved", open = isOpen(n), closed = Date.now() >= closeMs(n);
    var state = !st ? "확인 전 · 성도님께는 아직 안 보입니다"
      : open ? "올림 · 지금 로그인한 성도님께 보입니다(밤 10시 30분까지)"
      : closed ? "올림 · 예배가 끝나 닫혔습니다"
      : "올림 · " + dayLabel(n.note_date) + " " + OPEN_TXT + "에 열립니다";
    return '<div class="wed-admin">' +
      '<p class="wed-admin-tag">목사님 확인용</p>' +
      '<p class="wed-admin-t"><b>' + esc(dayLabel(n.note_date)) + '</b> 「' + esc(n.title) + '」</p>' +
      '<p class="wed-admin-s">' + esc(state) + '</p>' +
      '<div class="wed-admin-btns"><button type="button" class="btn btn-line" data-wopen="' + esc(n.id) + '">미리보기·고치기</button>' +
      (closed ? '' : st ? '<button type="button" class="btn btn-line" data-wstatus="draft" data-id="' + esc(n.id) + '">내리기</button>'
                        : '<button type="button" class="btn btn-solid" data-wstatus="approved" data-id="' + esc(n.id) + '">올리기</button>') +
      '</div></div>';
  }

  function contiAdminCard() {
    var iso = targetWed(), c = contiFor(iso), files = (c && c.files) || [];
    return '<div class="wed-admin wed-conti-admin">' +
      '<p class="wed-admin-tag">목사님 확인용 · 콘티·악보</p>' +
      '<p class="wed-admin-t"><b>' + esc(dayLabel(iso)) + '</b> 수요기도회 악보 ' + files.length + '장</p>' +
      '<p class="wed-admin-s">그날 로그인한 성도님께 보이고, 밤 10시 30분에 사라집니다(목사님은 늘 보심).</p>' +
      (files.length ? '<ul class="wca-files">' + files.map(function (f, i) {
        return '<li><span>' + (i + 1) + '. ' + esc(f.name || "악보") + '</span><button type="button" class="wca-x" data-cremove="' + i + '" aria-label="' + esc(f.name || "악보") + ' 빼기">×</button></li>';
      }).join("") + '</ul>' : '') +
      '<div class="wed-admin-btns"><label class="btn btn-solid wca-up">사진·PDF 올리기<input type="file" accept="image/*,application/pdf" multiple hidden data-cupload="' + esc(iso) + '" /></label>' +
      (files.length ? '<button type="button" class="btn btn-line" data-wconti="' + esc(iso) + '">악보 보기</button>' : '') + '</div>' +
      '<p class="wca-msg" role="status"></p></div>';
  }

  function render() {
    if (!box) return;
    var h = "";
    if (admin) {
      var recent = atKST(todayKST(), 0, 0) - 6 * 864e5;
      h += notes.filter(function (n) { return atKST(n.note_date, 0, 0) >= recent && !isOpen(n); }).map(adminCard).join("");
      h += contiAdminCard();
    }
    var open = notes.filter(isOpen)[0];
    var conti = contis.filter(contiOpen)[0];
    if (open) h += mainCard(open);
    else if (conti) h += contiCard(conti);
    else h += '<div class="wed-empty">수요기도회 말씀 자료(본문·핵심 3가지·인용 구절)는<br />수요일 ' + OPEN_TXT + '에 열리고, 밤 10시 30분에 닫힙니다.</div>';
    box.innerHTML = h;
  }

  // 첫 화면 알림 창의 [말씀 자료 보기]로 왔으면(2분 안) 크게 읽는 창을 바로 연다
  var GO_KEY = "nojin_wed_go", LOGIN_KEY = "nojin_wed_login";
  function flagFresh(k, ms) {
    try { var v = +sessionStorage.getItem(k); return !!v && Date.now() - v < ms; } catch (e) { return false; }
  }
  function flagSet(k) { try { sessionStorage.setItem(k, String(Date.now())); } catch (e) {} }
  function flagClear(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  function autoOpen() {
    if (!flagFresh(GO_KEY, 120000)) return;
    flagClear(GO_KEY);
    var open = notes.filter(isOpen)[0];
    if (open) openReader(open.id);
  }

  // 저녁 7시 45분·밤 10시 30분이 되면 저절로 다시 그린다(창을 열어 둔 채여도 열리고 닫히게)
  var tick = null;
  function scheduleTick() {
    if (tick) clearTimeout(tick);
    var now = Date.now(), t = todayKST();
    var marks = [atKST(t, 0, 0) + 864e5, atKST(t, OPEN_H, OPEN_M), atKST(t, 22, 30)]
      .concat(notes.map(function (n) { return Date.parse(n.publish_at); }), notes.map(closeMs))
      .filter(function (m) { return m > now && m - now < 18 * 3600e3; });
    if (inWindow() && !notes.filter(isOpen)[0]) marks.push(now + 5 * 60e3);   // 예배 시간인데 아직 안 올라왔으면 5분마다 다시
    if (!marks.length) return;
    var next = Math.min.apply(null, marks);
    tick = setTimeout(function () {
      if (rdOpen && !admin && !(cur && isOpen(cur)) && !contiOpen(curConti)) closeReader();
      load();
    }, next - now + 3000);
  }

  // 주소가 #wed 이면, 위쪽 칸(이번 주 말씀)이 늦게 그려져 밀려도 이 자리로 다시 맞춘다(손가락을 대기 전까지만)
  var touched = false;
  ["touchstart", "wheel", "keydown"].forEach(function (ev) { window.addEventListener(ev, function () { touched = true; }, { passive: true, once: true }); });
  function ensureAnchor() {
    if (location.hash !== "#wed") return;
    var go = function () { var el = document.getElementById("wed"); if (el && !touched) el.scrollIntoView({ block: "start" }); };
    go(); setTimeout(go, 700); setTimeout(go, 1600);
  }

  // ── 악보 파일: 비공개 보관함에서 '닫히는 때까지만 쓰는 주소'를 받아 연다
  var signCache = {};
  function signed(path, until) {
    var c = signCache[path];
    if (c && c.exp > Date.now() + 30000) return Promise.resolve(c.url);
    var ttl = Math.max(60, Math.min(3600, Math.floor(((until || Date.now() + 3600e3) - Date.now()) / 1000)));
    return fetch(SB + "/storage/v1/object/sign/private_files/" + String(path).split("/").map(encodeURIComponent).join("/"), {
      method: "POST", headers: headers(), body: JSON.stringify({ expiresIn: ttl })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        var u = d && (d.signedURL || d.signedUrl);
        if (!r.ok || !u) throw new Error("악보를 열 수 없습니다(시간이 지났거나 권한이 없습니다)");
        var full = SB + "/storage/v1" + u;
        signCache[path] = { url: full, exp: Date.now() + ttl * 1000 };
        return full;
      });
    });
  }
  function contiHtml(c) {
    var files = (c && c.files) || [];
    if (!files.length) return "";
    return '<section class="wr-sec" id="wrConti"><h4 class="wr-h">찬양 악보 <small>누르면 크게 · 밤 10시 30분에 사라집니다</small></h4><div class="wr-conti">' +
      files.map(function (f, i) {
        var pdf = /pdf/i.test(f.type || "") || /\.pdf$/i.test(f.path || "");
        return pdf
          ? '<p><a class="btn btn-line wr-conti-pdf" data-cpath="' + esc(f.path) + '" href="#" target="_blank" rel="noopener">📄 ' + esc(f.name || ("악보 " + (i + 1))) + ' 열기</a></p>'
          : '<a class="wr-conti-img" data-cpath="' + esc(f.path) + '" href="#" target="_blank" rel="noopener"><img alt="' + esc(f.name || ("악보 " + (i + 1))) + '" data-cimg="' + esc(f.path) + '" /></a>';
      }).join("") + '</div></section>';
  }
  function fillConti(c) {
    if (!c || !rd) return;
    var until = admin ? null : Date.parse(c.close_at);
    rd.querySelectorAll("a[data-cpath]").forEach(function (a) {
      var p = a.getAttribute("data-cpath"), img = a.querySelector("img[data-cimg]");
      signed(p, until).then(function (u) {
        a.href = u;
        if (img) img.src = u;
      }).catch(function (e) {
        var msg = document.createElement("p");
        msg.className = "wr-conti-err";
        msg.textContent = e.message;
        a.replaceWith(msg);
      });
    });
  }

  // ===== ② 크게 읽는 창 =====
  var rd = null, rdBody = null, rdTitle = null, rdDate = null, rdTabs = null, rdOpen = false, cur = null, curConti = null;
  function buildReader() {
    if (rd) return;
    document.body.insertAdjacentHTML("beforeend",
      '<div class="modal wed-reader" id="wedReader" hidden>' +
        '<div class="modal-backdrop" data-wclose></div>' +
        '<div class="modal-box wed-box" role="dialog" aria-modal="true" aria-labelledby="wedRTitle">' +
          '<div class="wed-top"><div class="wed-top-tx"><span class="wed-top-d" id="wedRDate"></span><b id="wedRTitle"></b></div>' +
          '<button type="button" class="wed-x" data-wclose aria-label="닫기">&times;</button></div>' +
          '<div class="wed-tabs" id="wedRTabs"></div>' +
          '<div class="wed-body" id="wedRBody"></div>' +
        '</div>' +
      '</div>');
    rd = document.getElementById("wedReader");
    rdBody = document.getElementById("wedRBody");
    rdTitle = document.getElementById("wedRTitle");
    rdDate = document.getElementById("wedRDate");
    rdTabs = document.getElementById("wedRTabs");
    rd.addEventListener("click", onReaderClick);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && rdOpen) closeReader(); });
  }
  function linesHtml(lines, bare) {
    lines = lines || [];
    var multi = lines.some(function (l) { return l.c; });
    return '<div class="sv-lines wr-lines">' + lines.map(function (l) {
      var num = (bare && lines.length === 1) ? "" : "<sup>" + (multi && l.c ? l.c + ":" : "") + esc(l.v) + "</sup>";
      return '<p class="sv-line">' + num + esc(l.t) + "</p>";
    }).join("") + "</div>";
  }
  function adminNotice(n) {
    var st = n.status === "approved", open = isOpen(n), closed = Date.now() >= closeMs(n);
    var msg = !st ? "확인 전 자료입니다 · 성도님께는 아직 보이지 않습니다."
      : open ? "올린 자료입니다 · 지금 로그인한 성도님께 보입니다(밤 10시 30분까지)."
      : closed ? "올린 자료입니다 · 예배가 끝나 닫혔습니다."
      : "올린 자료입니다 · " + dayLabel(n.note_date) + " " + OPEN_TXT + "에 열립니다.";
    return '<div class="wr-admin"><p><b>목사님 확인용</b> ' + esc(msg) + '</p><div class="wr-admin-btns">' +
      (closed ? '' : st ? '<button type="button" class="btn btn-line" data-wstatus="draft" data-id="' + esc(n.id) + '">내리기</button>'
                        : '<button type="button" class="btn btn-solid" data-wstatus="approved" data-id="' + esc(n.id) + '">올리기</button>') +
      '<button type="button" class="btn btn-line" data-wedit="' + esc(n.id) + '">고치기</button></div></div>';
  }
  function readerHtml(n, c) {
    var h = "";
    if (n) {
      if (admin) h += adminNotice(n);
      h += '<header class="wr-head">' + (n.series ? '<p class="wr-series">' + esc(n.series) + '</p>' : '') +
        '<h3 class="wr-title">' + esc(n.title) + '</h3>' +
        '<p class="wr-ref">' + esc(n.scripture || "") + (n.preacher ? ' · ' + esc(n.preacher) : '') + '</p></header>';
      var pts = pointsHtml(n, "wr-points");
      if (pts) h += '<section class="wr-sec" id="wrPoints"><h4 class="wr-h">핵심 3가지</h4>' + pts + '</section>';
      h += flowHtml(n);
      if ((n.passage || []).length) h += '<section class="wr-sec" id="wrPassage"><h4 class="wr-h">오늘 본문 <small>' + esc(n.scripture || "") + '</small></h4>' + linesHtml(n.passage) + '</section>';
      var vs = n.verses || [];
      if (vs.length) {
        h += '<section class="wr-sec" id="wrVerses"><h4 class="wr-h">인용 구절 <small>설교에서 읽는 순서대로</small></h4><ol class="wr-verses">' +
          vs.map(function (v, i) {
            return '<li class="wr-v"><p class="wr-v-ref"><span class="wr-no" aria-hidden="true">' + circ(i + 1) + '</span>' + esc(v.ref) + '</p>' + linesHtml(v.lines, true) + '</li>';
          }).join("") + '</ol></section>';
      }
      h += prayerHtml(n);
    }
    if (c && (contiOpen(c) || admin)) h += contiHtml(c);
    return h;
  }
  function tabsHtml(n, c) {
    var t = [];
    if (n && ((n.summary || {}).points || []).length) t.push(["wrPoints", "핵심"]);
    if (n && flowOf(n).length) t.push(["wrFlow", "흐름"]);
    if (n && (n.passage || []).length) t.push(["wrPassage", "본문"]);
    if (n && (n.verses || []).length) t.push(["wrVerses", "인용 구절"]);
    if (n && prayerCount(n)) t.push(["wrPrayer", "기도"]);
    if (c && (c.files || []).length && (contiOpen(c) || admin)) t.push(["wrConti", "악보"]);
    return t.length > 1 ? t.map(function (x) { return '<button type="button" data-go="' + x[0] + '">' + x[1] + '</button>'; }).join("") : "";
  }
  function goSec(id) {
    var el = id && document.getElementById(id);
    if (el) rdBody.scrollTop += el.getBoundingClientRect().top - rdBody.getBoundingClientRect().top - 6;
  }
  function paint(n, c, sec) {
    cur = n; curConti = c || null;
    var iso = n ? n.note_date : c.note_date;
    rdDate.textContent = dayLabel(iso) + " · 수요기도회";
    rdTitle.textContent = n ? (n.title || "") : "찬양 악보";
    rdTabs.innerHTML = tabsHtml(n, c);
    rdBody.innerHTML = readerHtml(n, c);
    rdBody.scrollTop = 0;
    fillConti(c);
    if (sec) requestAnimationFrame(function () { goSec(sec); });
  }
  function hideDom() {
    if (!rdOpen) return;
    rdOpen = false;
    rd.hidden = true;
    document.documentElement.classList.remove("pop-open");
  }
  function closeReader() {
    if (!rdOpen) return;
    if (!(window.ModalNav && window.ModalNav.close())) hideDom();
  }
  function showReader() {
    if (rdOpen) return;
    rd.hidden = false;
    rdOpen = true;
    document.documentElement.classList.add("pop-open");
    if (window.ModalNav) window.ModalNav.open(hideDom);
  }
  function openReader(id, sec) {
    buildReader();
    var n = noteById(id);
    if (!n) return;
    paint(n, contiFor(n.note_date), sec);
    showReader();
  }
  function openConti(iso) {
    buildReader();
    var c = contiFor(iso);
    if (!c) return;
    var n = notes.filter(function (x) { return x.note_date === iso && isOpen(x); })[0] || null;
    paint(n, c, "wrConti");
    showReader();
  }
  function onReaderClick(e) {
    var t = e.target;
    if (t.closest("[data-wclose]")) { closeReader(); return; }
    var g = t.closest("[data-go]");
    if (g) { goSec(g.getAttribute("data-go")); return; }
    var a = t.closest("a[data-cpath]");
    if (a && a.getAttribute("href") === "#") { e.preventDefault(); return; }   // 아직 주소를 받기 전
    var st = t.closest("[data-wstatus]");
    if (st) { setStatus(st.getAttribute("data-id"), st.getAttribute("data-wstatus")); return; }
    if (t.closest("[data-wedit]") && cur) { openEdit(cur); return; }
    if (t.closest("[data-wsave]")) { saveEdit(); return; }
    if (t.closest("[data-wcancel]")) { paint(cur, curConti); return; }
  }

  // ===== ③ 관리자: 올리기·내리기·고치기 =====
  function replaceNote(r) { notes = notes.map(function (x) { return x.id === r.id ? r : x; }); }
  function setStatus(id, status) {
    var n = noteById(id);
    if (!n) return;
    var nowOpen = Date.parse(n.publish_at) <= Date.now();
    var ask = status === "approved"
      ? "이 자료를 올릴까요?\n" + (nowOpen ? "로그인한 성도님께 바로 보이고, 밤 10시 30분에 닫힙니다." : dayLabel(n.note_date) + " " + OPEN_TXT + "에 로그인한 성도님께 열리고, 밤 10시 30분에 닫힙니다.")
      : "이 자료를 내릴까요?\n성도님께 보이지 않게 됩니다(지워지지는 않습니다).";
    if (!confirm(ask)) return;
    api("PATCH", "sermon_notes?id=eq." + encodeURIComponent(id), { status: status }, { Prefer: "return=representation" })
      .then(function (rows) {
        var r = rows && rows[0];
        if (!r) throw new Error("바뀐 것이 없습니다(관리자 권한을 확인해 주세요)");
        replaceNote(r);
        render();
        if (rdOpen && cur && cur.id === id) paint(r, curConti);
        if (window.showFlash) window.showFlash(status === "approved" ? "올렸습니다" : "내렸습니다");
      })
      .catch(function (e) { alert("저장하지 못했습니다: " + e.message); });
  }

  function editHtml(n) {
    var pts = (((n.summary || {}).points) || []).slice(0, 3);
    while (pts.length < 3) pts.push({});
    var refs = (n.verses || []).map(function (v) { return v.ref; }).join("\n"), pr = prayerOf(n);
    var inp = function (id, v, ph) { return '<input id="' + id + '" type="text" value="' + esc(v || "") + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + ' />'; };
    return '<div class="wr-edit">' +
      '<p class="wr-edit-note">고친 뒤 [저장]을 누르세요. 핵심은 한 줄씩 짧게, 인용 구절은 장절만 한 줄에 하나씩 적으시면 본문은 홈페이지 성경(개역개정)에서 채웁니다.</p>' +
      '<label>제목' + inp("we_title", n.title) + '</label>' +
      pts.map(function (p, i) {
        return '<fieldset class="wr-edit-pt"><legend>핵심 ' + (i + 1) + '</legend><div class="wr-edit-row">' +
          inp("we_pl" + i, p.label, "예: 7절") + inp("we_px" + i, p.text, "한 줄로 짧게(비우면 빠짐)") + '</div></fieldset>';
      }).join("") +
      '<label>말씀의 흐름 <small>한 줄에 한 단계(3~6단계, 짧게) · 비우면 빠짐</small><textarea id="we_flow" rows="5">' + esc(flowOf(n).join("\n")) + '</textarea></label>' +
      '<label>인용 구절 <small>설교에서 읽는 순서대로, 한 줄에 하나</small><textarea id="we_verses" rows="6" placeholder="예: 에베소서 1:20">' + esc(refs) + '</textarea></label>' +
      '<label>' + PRAYER_FIXED + ' <small>한 줄에 하나 · 다음 주 자료에도 그대로 이어집니다</small><textarea id="we_pfixed" rows="5">' + esc(pr.fixed.join("\n")) + '</textarea></label>' +
      '<label>' + PRAYER_APPLY + ' <small>한 줄에 하나 · 이번 주만</small><textarea id="we_papply" rows="4">' + esc(pr.apply.join("\n")) + '</textarea></label>' +
      '<p class="wr-edit-msg" id="we_msg" role="status"></p>' +
      '<div class="wr-edit-btns"><button type="button" class="btn btn-solid" data-wsave>저장</button><button type="button" class="btn btn-line" data-wcancel>취소</button></div>' +
      '</div>';
  }
  function openEdit(n) {
    rdTabs.innerHTML = "";
    rdBody.innerHTML = editHtml(n);
    rdBody.scrollTop = 0;
  }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
  function refLabel(r) {
    var WV = window.WorshipView;
    var b = WV && WV.bookName ? WV.bookName(r.no) : "";
    var s = b + " " + r.c1 + ":" + r.v1;
    if (r.c2 !== r.c1) s += "~" + r.c2 + ":" + r.v2;
    else if (r.v2 !== r.v1) s += "~" + r.v2;
    return s;
  }
  function resolveRefs(text, old) {
    var WV = window.WorshipView;
    var keep = {};
    (old || []).forEach(function (v) { keep[String(v.ref).replace(/\s+/g, "")] = v; });
    var lines = String(text || "").split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
    return Promise.all(lines.map(function (l) {
      if (keep[l.replace(/\s+/g, "")]) return Promise.resolve(keep[l.replace(/\s+/g, "")]);
      var r = WV && WV.parseRef ? WV.parseRef(l) : null;
      if (!r || r.v2 === 999) return Promise.reject(new Error("이 장절을 읽지 못했습니다: " + l));
      return WV.getVerses(r).then(function (vs) {
        if (!vs.length) throw new Error("성경에 없는 장절입니다: " + l);
        var multi = r.c2 !== r.c1;
        return { ref: refLabel(r), lines: vs.map(function (x) { var o = { v: x.v, t: x.t }; if (multi) o.c = x.c; return o; }) };
      });
    }));
  }
  function saveEdit() {
    var n = cur, msg = document.getElementById("we_msg");
    if (!n) return;
    msg.textContent = "저장하는 중…";
    var points = [];
    for (var i = 0; i < 3; i++) if (val("we_px" + i)) points.push({ label: val("we_pl" + i), text: val("we_px" + i) });
    resolveRefs(val("we_verses"), n.verses)
      .then(function (verses) {
        var lines = function (id) { return val(id).split(/\n+/).map(function (l) { return l.replace(/^\s*(?:\d+[.)]|[-·•])\s*/, "").trim(); }).filter(Boolean); };
        var body = { title: val("we_title") || n.title, verses: verses, mentions: [], made_by: "pastor",
                     summary: { points: points, flow: lines("we_flow").map(function (l) { return l.replace(/^\s*(?:→|->)\s*/, ""); }),
                                prayer: { fixed: lines("we_pfixed"), apply: lines("we_papply") } } };
        return api("PATCH", "sermon_notes?id=eq." + encodeURIComponent(n.id), body, { Prefer: "return=representation" });
      })
      .then(function (rows) {
        var r = rows && rows[0];
        if (!r) throw new Error("저장되지 않았습니다(관리자 권한을 확인해 주세요)");
        replaceNote(r);
        render();
        paint(r, curConti);
        if (window.showFlash) window.showFlash("저장했습니다");
      })
      .catch(function (e) { msg.textContent = "⚠️ " + e.message; });
  }

  // ── 콘티·악보 올리기/빼기(관리자) — 비공개 보관함 private_files 의 conti/<날짜>/ (js/upload.js)
  function contiSave(iso, files) {
    var c = contiFor(iso);
    var p = c ? api("PATCH", "sermon_conti?id=eq." + encodeURIComponent(c.id), { files: files }, { Prefer: "return=representation" })
              : api("POST", "sermon_conti", { service: SERVICE, note_date: iso, files: files }, { Prefer: "return=representation" });
    return p.then(function (rows) {
      var r = rows && rows[0];
      if (!r) throw new Error("저장되지 않았습니다(관리자 권한을 확인해 주세요)");
      contis = contis.filter(function (x) { return x.note_date !== iso; }).concat([r]);
      return r;
    });
  }
  function contiMsg(t) { var m = box.querySelector(".wca-msg"); if (m) m.textContent = t; }
  function uploadConti(iso, list) {
    var U = window.ChurchUpload;
    if (!U || !U.isReady()) { alert("올리기 기능을 불러오지 못했습니다. 화면을 새로 고친 뒤 다시 해 주세요."); return; }
    var files = ((contiFor(iso) || {}).files || []).slice(), arr = Array.prototype.slice.call(list || []), done = 0;
    var step = function () {
      if (done >= arr.length) {
        return contiSave(iso, files).then(function () { render(); if (window.showFlash) window.showFlash("악보를 올렸습니다"); });
      }
      var f = arr[done];
      contiMsg("올리는 중… " + (done + 1) + " / " + arr.length);
      var isImg = /^image\//.test(f.type || "");
      var prep = isImg ? U.compressImage(f, 2400, 0.85).catch(function () { return f; }) : Promise.resolve(f);
      return prep.then(function (g) { return U.upload(g, { folder: "conti/" + iso, compress: false }); })
        .then(function (r) {
          // 악보는 반드시 비공개 보관함(private_files)에 — 아니면(옛 화면 코드 등) 바로 지우고 멈춘다
          if (!/^conti\//.test(r.key || "") || !/\/authenticated\/private_files\//.test(r.url || "")) {
            if (r.key) U.remove(r.key);
            throw new Error("악보가 비공개 보관함에 올라가지 않았습니다. 화면을 새로 고친 뒤 다시 해 주세요.");
          }
          files.push({ path: r.key, name: f.name || ("악보 " + (files.length + 1)), type: f.type || "" });
          done++;
          return step();
        });
    };
    step().catch(function (e) {
      contiMsg("⚠️ " + (e && e.message ? e.message : "올리지 못했습니다"));
      if (files.length) contiSave(iso, files).then(render).catch(function () {});
    });
  }
  function removeConti(i) {
    var iso = targetWed(), c = contiFor(iso);
    if (!c) return;
    var f = (c.files || [])[i];
    if (!f || !confirm("이 악보를 뺄까요?\n" + (f.name || "") + "\n(파일도 지워집니다)")) return;
    var files = c.files.filter(function (_, k) { return k !== i; });
    contiSave(iso, files).then(function () {
      if (window.ChurchUpload) window.ChurchUpload.remove(f.path);
      render();
    }).catch(function (e) { alert("빼지 못했습니다: " + e.message); });
  }

  // 카드·목록의 단추
  if (box) {
    box.addEventListener("click", function (e) {
      if (e.target.closest("[data-wretry]")) { retried = false; _admin = null; freshSession().then(load); return; }
      var o = e.target.closest("[data-wopen]");
      if (o) { openReader(o.getAttribute("data-wopen"), o.getAttribute("data-wsec")); return; }
      var cv = e.target.closest("[data-wconti]");
      if (cv) { openConti(cv.getAttribute("data-wconti")); return; }
      var rm = e.target.closest("[data-cremove]");
      if (rm) { removeConti(+rm.getAttribute("data-cremove")); return; }
      var st = e.target.closest("[data-wstatus]");
      if (st) setStatus(st.getAttribute("data-id"), st.getAttribute("data-wstatus"));
    });
    box.addEventListener("change", function (e) {
      var inp = e.target.closest("[data-cupload]");
      if (inp && inp.files && inp.files.length) uploadConti(inp.getAttribute("data-cupload"), inp.files);
    });
  }

  // ===== ④ 첫 화면 띠 — 수요일 저녁 7시 45분 ~ 밤 10시 30분 =====
  function inWindow() {
    var k = kst(), mins = k.getUTCHours() * 60 + k.getUTCMinutes();
    return k.getUTCDay() === 3 && mins >= OPEN_H * 60 + OPEN_M && mins < 22 * 60 + 30;
  }
  var bannerTimer = null, bannerRetried = false;
  function bannerLater(ms) {
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { bannerTimer = null; paintBanner(); }, ms);
  }
  function paintBanner() {
    if (!banner) return;
    // 첫 화면을 열어 둔 채 7시 45분이 되면 그때 다시 본다
    var at = atKST(todayKST(), OPEN_H, OPEN_M), now = Date.now();
    if (kst().getUTCDay() === 3 && now < at && at - now < 12 * 3600e3) { bannerLater(at - now + 3000); return; }
    if (!inWindow()) return;
    api("POST", "rpc/wed_note_now", {}).then(function (r) {
      bannerRetried = false;
      if (!r || !r.open) { bannerLater(5 * 60e3); return; }   // 목사님이 아직 안 올리셨으면 5분마다 다시
      banner.dataset.wed = "1";
      var lb = banner.querySelector(".hsb-label"), t = banner.querySelector(".hsb-title"),
          rf = banner.querySelector(".hsb-ref"), ar = banner.querySelector(".hsb-arrow");
      if (lb) lb.textContent = "오늘 수요기도회 말씀";
      if (t) t.textContent = r.title || "본문·핵심·인용 구절";
      if (rf) rf.textContent = r.title ? (r.scripture || "") : "로그인하신 분께 보여 드립니다";
      if (ar) ar.textContent = "말씀 자료 보기 →";
      banner.setAttribute("href", "word.html#wed");
      banner.classList.add("is-wed");
      wedPop(r);
    }).catch(function (e) {
      // 로그인 열쇠가 낡았으면(401) 새로 받아 한 번 더
      if (e && e.status === 401 && !bannerRetried) { bannerRetried = true; freshSession().then(paintBanner); }
    });
  }

  // ===== ⑤ 첫 화면 알림 창 — 그날 한 번(이 기기) =====
  //  로그인한 분: 제목·본문 + [말씀 자료 보기] → 예배와 말씀으로 가서 크게 읽는 창을 바로 연다.
  //  로그인 안 했지만 이 기기에서 로그인한 적이 있으면(성도님 기기): [로그인하고 보기] → 로그인 뒤 창 없이 바로 자료로.
  //  처음 오신 분(로그인한 적 없는 기기)에게는 띄우지 않는다(띠만). 사용법 안내·로그인 창 등이 떠 있으면 닫힐 때까지 기다린다.
  var POP_KEY = "nojin_wed_pop";   // localStorage: 띄운 날짜(로그인한 분) / POP_KEY + "_g": 로그인 안 한 성도님 기기
  var pop = null, popOn = false, popR = null, popTimer = null, popWait = 0;
  function popSeen(k) { try { return localStorage.getItem(k) === todayKST(); } catch (e) { return true; } }
  function popMark(k) { try { localStorage.setItem(k, todayKST()); } catch (e) {} }
  function knownDevice() { try { return !!localStorage.getItem("nojin_known_member"); } catch (e) { return false; } }
  function screenBusy() {
    return !!document.querySelector(".modal:not([hidden]), .pop-modal:not([hidden]), .ig-viewer:not([hidden])") ||
      document.documentElement.classList.contains("pop-open") || document.body.classList.contains("menu-lock");
  }
  function wedPop(r) {
    if (r.title && flagFresh(LOGIN_KEY, 15 * 60e3)) {   // [로그인하고 보기]로 로그인하고 돌아왔다
      flagClear(LOGIN_KEY); flagSet(GO_KEY);
      location.href = "word.html#wed";
      return;
    }
    popR = r;
    if (popOn || popTimer) return;
    popTimer = setTimeout(firePop, 1200);
  }
  function firePop() {
    popTimer = null;
    var r = popR, member = !!(r && r.title), key = member ? POP_KEY : POP_KEY + "_g";
    if (!r || popOn || popSeen(key) || !inWindow() || member !== !!me()) return;
    if (!member && !knownDevice()) return;
    if (screenBusy()) { if (popWait++ < 120) popTimer = setTimeout(firePop, 1500); return; }
    showPop(r, member, key);
  }
  function showPop(r, member, key) {
    if (!pop) {
      pop = document.createElement("div");
      pop.className = "modal wed-pop";
      pop.hidden = true;
      document.body.appendChild(pop);
      pop.addEventListener("click", onPopClick);
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && popOn) popClose(); });
    }
    pop.innerHTML = '<div class="modal-backdrop" data-wpop="close"></div>' +
      '<div class="modal-box wpop-box" role="dialog" aria-modal="true" aria-labelledby="wpopTitle">' +
        '<button type="button" class="modal-close" data-wpop="close" aria-label="닫기">&times;</button>' +
        '<p class="wpop-eyebrow"><span aria-hidden="true">📖</span> 오늘 수요기도회 말씀</p>' +
        (member
          ? '<h3 class="wpop-title" id="wpopTitle">' + esc(r.title) + '</h3>' +
            (r.scripture ? '<p class="wpop-ref">' + esc(r.scripture) + '</p>' : '') +
            '<p class="wpop-text">본문 · 핵심 3가지 · 인용 구절을<br />지금 보실 수 있습니다.</p>' +
            '<button type="button" class="btn btn-solid wpop-go" data-wpop="go">말씀 자료 보기</button>'
          : '<h3 class="wpop-title" id="wpopTitle">말씀 자료가 열렸습니다</h3>' +
            '<p class="wpop-text">예배에 오신 성도님께 드리는 자료입니다.<br />로그인하시면 바로 보실 수 있습니다.</p>' +
            '<button type="button" class="btn btn-solid wpop-go" data-wpop="login">로그인하고 보기</button>') +
        '<button type="button" class="btn btn-line wpop-later" data-wpop="close">닫기</button>' +
        '<p class="wpop-note">밤 10시 30분에 닫힙니다</p>' +
      '</div>';
    popMark(key);
    pop.hidden = false;
    popOn = true;
    document.body.style.overflow = "hidden";
    document.documentElement.classList.add("pop-open");   // 뒤 화면이 옆으로 넘어가지 않게
    if (window.ModalNav) window.ModalNav.open(popHide);   // 휴대폰 '뒤로'로 이 창만 닫히게
  }
  function popHide() {
    if (!popOn) return;
    popOn = false;
    pop.hidden = true;
    if (!document.querySelector(".modal:not([hidden]), .pop-modal:not([hidden])")) {
      document.body.style.overflow = "";
      document.documentElement.classList.remove("pop-open");
    }
  }
  function popClose() { if (popOn && !(window.ModalNav && window.ModalNav.close())) popHide(); }
  // 창을 닫고('뒤로' 기록까지 정리한 뒤) 다음 일을 한다
  function afterPop(fn) {
    var done = false, run = function () { if (done) return; done = true; popHide(); fn(); };
    if (popOn && window.ModalNav && window.ModalNav.close()) {
      window.addEventListener("popstate", function () { setTimeout(run, 0); }, { once: true });
      setTimeout(run, 800);
    } else run();
  }
  function onPopClick(e) {
    var b = e.target.closest("[data-wpop]");
    if (!b) return;
    var act = b.getAttribute("data-wpop");
    if (act === "close") { popClose(); return; }
    if (act === "go") { flagSet(GO_KEY); afterPop(function () { location.href = "word.html#wed"; }); return; }
    if (act === "login") {
      flagSet(LOGIN_KEY);
      afterPop(function () {   // 다른 화면의 '로그인' 단추(data-mo)와 같은 창
        if (window.__authSetMode) window.__authSetMode("login"); else window.__authPendingMode = "login";
        var m = document.getElementById("authModal");
        if (m) { m.hidden = false; document.body.style.overflow = "hidden"; }
      });
    }
  }

  load();
  paintBanner();
  window.addEventListener("church:auth", function () { _admin = null; load(); paintBanner(); });
  // 휴대폰에서 다른 앱을 보다 돌아왔을 때(멈춰 있던 시계 대신) 한 번 더 본다
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && banner && !banner.dataset.wed && inWindow()) paintBanner();
  });
  // 이 화면에서 로그인·로그아웃하면(다시 불러오지 않는 경우에도) 바로 다시 그린다
  whenAuthReady().then(function (sb) {
    if (!sb) return;
    try {
      sb.auth.onAuthStateChange(function (ev, session) {
        var uid = (session && session.user && session.user.id) || "";
        if (uid !== shownUid) { _admin = null; load(); paintBanner(); }
      });
    } catch (e) {}
  });
  window.WedNotes = { open: openReader, reload: load };
})();

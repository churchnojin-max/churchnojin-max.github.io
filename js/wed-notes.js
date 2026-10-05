/* 수요기도회 말씀 — 인용 구절·설교 요약 (2026-10-05 목사님 요청)
   "수요예배 때 성도들이 참고할 수 있도록 인용 구절과 설교 요약을 홈페이지에"
   목사님 결정: 예배와 말씀(이번 주 말씀 아래) + 수요일 저녁 첫 화면 띠 / 저녁 8시에 한꺼번에 / 로그인한 회원만 / 목사님 확인 뒤 올림
   ① 예배와 말씀 #wed : 로그인 안 했으면 🔒 안내, 했으면 가장 최근 수요 말씀 카드(큰 단추 두 개) + 지난 수요 말씀
   ② 크게 읽는 창 : 오늘 본문 · 인용 구절(설교에서 읽는 순서대로 ①②③) · 말씀 중에 나온 구절 · 설교 요약 · 함께 드리는 기도
      휴대폰 '뒤로'로 닫히고, 열려 있는 동안은 옆으로 밀어도 다른 화면으로 넘어가지 않는다(page-slide.js 가 pop-open 을 봄).
      글씨는 rem 이라 맨 위 '가+' 크기를 그대로 따른다.
   ③ 관리자(목사님) : 확인 전 자료 미리보기 · [올리기]/[내리기] · [고치기](장절을 고치면 본문은 홈페이지 성경 자료에서 채움)
   ④ 첫 화면 '이번 주 설교' 띠 : 수요일 저녁 8시 ~ 목요일 낮 12시에 열린 자료가 있으면 '오늘 수요기도회 말씀'으로 (rpc wed_note_now)
   자료: Supabase sermon_notes(supabase/sermon_notes_20261005.sql). 만들기: tools/wed_notes.py(수요일 예약 작업) → 텔레그램 [올리기].
   보이는 규칙(올린 것만·저녁 8시부터·로그인한 분만)은 데이터베이스가 지킨다 — 이 파일은 그리는 일만 한다. */
(function () {
  "use strict";
  if (!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY)) return;
  var box = document.getElementById("wedNotes");
  var banner = document.getElementById("heroSermonBanner");
  if (!box && !banner) return;

  var SERVICE = "수요기도회";
  var LIST_COLS = "id,note_date,title,scripture,preacher,series,status,publish_at,made_by";
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
  function api(method, path, body, extra) {
    var sess = localSession();
    var headers = { apikey: window.SUPABASE_ANON_KEY, "Content-Type": "application/json" };
    if (sess && sess.access_token) headers.Authorization = "Bearer " + sess.access_token;
    if (extra) Object.keys(extra).forEach(function (k) { headers[k] = extra[k]; });
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 12000) : null;
    return fetch(window.SUPABASE_URL + "/rest/v1/" + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, signal: ctl ? ctl.signal : undefined })
      .then(function (res) {
        return res.text().then(function (txt) {
          var data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
          if (!res.ok) { var err = new Error((data && (data.message || data.hint)) || ("HTTP " + res.status)); err.status = res.status; throw err; }
          return data;
        });
      })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  // ── 날짜(한국 시각)
  function kst() { return new Date(Date.now() + 9 * 3600e3); }          // getUTC* 로 읽는다
  function todayKST() { return kst().toISOString().slice(0, 10); }
  function dayLabel(iso) {
    var p = String(iso || "").split("-");
    if (p.length < 3) return "";
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return (+p[1]) + "월 " + (+p[2]) + "일(" + "일월화수목금토"[d.getUTCDay()] + ")";
  }
  function isOpen(n) { return n && n.status === "approved" && Date.parse(n.publish_at) <= Date.now(); }
  function wedEveningBefore8() { var k = kst(); return k.getUTCDay() === 3 && k.getUTCHours() < 20; }
  function circ(i) { return i <= 20 ? String.fromCharCode(0x2460 + i - 1) : "(" + i + ")"; }

  // ── 관리자(목사님)인지 — 확인 전 자료는 데이터베이스가 관리자에게만 준다(is_admin)
  var _admin = null;
  function isAdmin() {
    if (_admin !== null) return Promise.resolve(_admin);
    if (!me()) { _admin = false; return Promise.resolve(false); }
    return api("POST", "rpc/my_perms", {}).then(function (p) { _admin = !!(p && p.isAdmin); return _admin; })
      .catch(function () { _admin = false; return false; });
  }

  // ===== ① 예배와 말씀 #wed =====
  var list = [], full = {}, admin = false;
  function getFull(id) {
    if (full[id]) return Promise.resolve(full[id]);
    return api("GET", "sermon_notes?id=eq." + encodeURIComponent(id) + "&select=*").then(function (rows) {
      if (!rows || !rows[0]) throw new Error("자료를 찾지 못했습니다");
      full[id] = rows[0];
      return rows[0];
    });
  }

  function renderLocked() {
    box.innerHTML = '<div class="member-only wed-locked"><p>🔒 인용 구절과 설교 요약은<br />가입하고 로그인하신 분께만 보여 드립니다.</p>' +
      '<div class="member-only-btns"><button type="button" class="btn btn-solid" data-mo="join">가입하기</button><button type="button" class="btn btn-line" data-mo="login">로그인</button></div></div>';
  }

  function load() {
    if (!box) return Promise.resolve();
    if (!me()) { renderLocked(); return Promise.resolve(); }
    box.innerHTML = '<p class="qt-loading">불러오는 중…</p>';
    return Promise.all([
      api("GET", "sermon_notes?select=" + LIST_COLS + "&service=eq." + encodeURIComponent(SERVICE) + "&order=note_date.desc&limit=60"),
      isAdmin()
    ]).then(function (res) {
      list = res[0] || [];
      admin = res[1];
      var latest = list.filter(isOpen)[0];
      return latest ? getFull(latest.id).catch(function () { return null; }) : null;
    }).then(function () { render(); ensureAnchor(); })
      .catch(function () { box.innerHTML = '<p class="qt-loading">수요기도회 말씀을 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.</p>'; });
  }

  function adminCard(n) {
    var open = isOpen(n), st = n.status === "approved";
    var state = st ? (open ? "올림 · 지금 보입니다" : "올림 · " + dayLabel(n.note_date) + " 저녁 8시에 열립니다") : "확인 전 · 성도님께는 아직 안 보입니다";
    return '<div class="wed-admin">' +
      '<p class="wed-admin-tag">목사님 확인용</p>' +
      '<p class="wed-admin-t"><b>' + esc(dayLabel(n.note_date)) + '</b> 「' + esc(n.title) + '」</p>' +
      '<p class="wed-admin-s">' + esc(state) + '</p>' +
      '<div class="wed-admin-btns"><button type="button" class="btn btn-line" data-wopen="' + esc(n.id) + '">미리보기·고치기</button>' +
      (st ? '<button type="button" class="btn btn-line" data-wstatus="draft" data-id="' + esc(n.id) + '">내리기</button>'
          : '<button type="button" class="btn btn-solid" data-wstatus="approved" data-id="' + esc(n.id) + '">올리기</button>') +
      '</div></div>';
  }

  function mainCard(n) {
    var f = full[n.id] || n;
    var cnt = (f.verses || []).length;
    return '<article class="week-sermon wed-card">' +
      '<span class="ws-date">' + esc(String(n.note_date).replace(/-/g, ".")) + ' · 수요기도회</span>' +
      (n.series ? '<p class="wed-series">' + esc(n.series) + '</p>' : '') +
      '<h3 class="ws-title">' + esc(n.title) + '</h3>' +
      (n.scripture ? '<p class="ws-ref">' + esc(n.scripture) + '</p>' : '') +
      (n.preacher ? '<p class="ws-preacher">설교 · ' + esc(n.preacher) + '</p>' : '') +
      '<div class="wed-btns">' +
        '<button type="button" class="wed-btn" data-wopen="' + esc(n.id) + '" data-wsec="wrVerses"><span aria-hidden="true">📖</span> <span>인용 구절</span>' + (cnt ? ' <b>' + cnt + '</b>' : '') + '</button>' +
        '<button type="button" class="wed-btn wed-btn-2" data-wopen="' + esc(n.id) + '" data-wsec="wrSummary"><span aria-hidden="true">📝</span> <span>설교 요약</span></button>' +
      '</div>' +
      '<button type="button" class="wed-link" data-wopen="' + esc(n.id) + '" data-wsec="wrPassage">오늘 본문부터 차례로 보기 →</button>' +
      '</article>';
  }

  function pastList(arr) {
    return '<details class="wed-past"><summary>지난 수요 말씀 <span>' + arr.length + '편</span></summary><ul>' +
      arr.map(function (n) {
        var p = String(n.note_date).split("-");
        return '<li><button type="button" data-wopen="' + esc(n.id) + '"><span class="wp-d">' + (+p[1]) + "." + (+p[2]) + '</span>' +
          '<span class="wp-t"><b>' + esc(n.title) + '</b>' + (n.series ? '<small>' + esc(n.series) + '</small>' : '') + '</span></button></li>';
      }).join("") + '</ul></details>';
  }

  function render() {
    if (!box) return;
    var open = list.filter(isOpen);
    var pending = admin ? list.filter(function (n) { return !isOpen(n); }) : [];
    var latest = open[0];
    var h = pending.map(adminCard).join("");
    h += latest ? mainCard(latest) : '<div class="wed-empty">아직 올라온 수요기도회 말씀 자료가 없습니다.<br />수요일 저녁 8시 수요기도회 때 열립니다.</div>';
    if (latest && wedEveningBefore8() && latest.note_date !== todayKST()) h += '<p class="wed-hint">이번 주 자료는 오늘 저녁 8시 수요기도회 때 열립니다.</p>';
    if (open.length > 1) h += pastList(open.slice(1));
    box.innerHTML = h;
  }

  // 주소가 #wed 이면, 위쪽 칸(이번 주 말씀)이 늦게 그려져 밀려도 이 자리로 다시 맞춘다(손가락을 대기 전까지만)
  var touched = false;
  ["touchstart", "wheel", "keydown"].forEach(function (ev) { window.addEventListener(ev, function () { touched = true; }, { passive: true, once: true }); });
  function ensureAnchor() {
    if (location.hash !== "#wed") return;
    var go = function () { var el = document.getElementById("wed"); if (el && !touched) el.scrollIntoView({ block: "start" }); };
    go(); setTimeout(go, 700); setTimeout(go, 1600);
  }

  // ===== ② 크게 읽는 창 =====
  var rd = null, rdBody = null, rdTitle = null, rdDate = null, rdTabs = null, rdOpen = false, cur = null;
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
    var open = isOpen(n), st = n.status === "approved";
    var msg = st ? (open ? "올린 자료입니다 · 로그인한 성도님께 보이고 있습니다." : "올린 자료입니다 · " + dayLabel(n.note_date) + " 저녁 8시에 열립니다.")
                 : "확인 전 자료입니다 · 성도님께는 아직 보이지 않습니다.";
    return '<div class="wr-admin"><p><b>목사님 확인용</b> ' + esc(msg) + '</p><div class="wr-admin-btns">' +
      (st ? '<button type="button" class="btn btn-line" data-wstatus="draft" data-id="' + esc(n.id) + '">내리기</button>'
          : '<button type="button" class="btn btn-solid" data-wstatus="approved" data-id="' + esc(n.id) + '">올리기</button>') +
      '<button type="button" class="btn btn-line" data-wedit="' + esc(n.id) + '">고치기</button></div></div>';
  }
  function readerHtml(n) {
    var s = n.summary || {}, h = "";
    if (admin) h += adminNotice(n);
    h += '<header class="wr-head">' + (n.series ? '<p class="wr-series">' + esc(n.series) + '</p>' : '') +
      '<h3 class="wr-title">' + esc(n.title) + '</h3>' +
      '<p class="wr-ref">' + esc(n.scripture || "") + (n.preacher ? ' · ' + esc(n.preacher) : '') + '</p></header>';
    if ((n.passage || []).length) {
      h += '<section class="wr-sec" id="wrPassage"><h4 class="wr-h">오늘 본문 <small>' + esc(n.scripture || "") + '</small></h4>' + linesHtml(n.passage) + '</section>';
    }
    var vs = n.verses || [];
    if (vs.length) {
      h += '<section class="wr-sec" id="wrVerses"><h4 class="wr-h">인용 구절 <small>설교에서 읽는 순서대로</small></h4><ol class="wr-verses">' +
        vs.map(function (v, i) {
          return '<li class="wr-v"><p class="wr-v-ref"><span class="wr-no" aria-hidden="true">' + circ(i + 1) + '</span>' + esc(v.ref) + '</p>' + linesHtml(v.lines, true) + '</li>';
        }).join("") + '</ol></section>';
    }
    var ms = n.mentions || [];
    if (ms.length) {
      h += '<section class="wr-sec wr-ment"><h4 class="wr-h wr-h-s">말씀 중에 나온 구절 <small>누르면 본문이 보입니다</small></h4><div class="wr-chips">' +
        ms.map(function (m, i) { return '<button type="button" class="wr-chip" data-ment="' + i + '" aria-expanded="false">' + esc(m.ref) + '</button>'; }).join("") +
        '</div><div class="wr-ment-box" id="wrMentBox" hidden></div></section>';
    }
    if ((s.points || []).length) {
      h += '<section class="wr-sec" id="wrSummary"><h4 class="wr-h">설교 요약</h4>';
      if (s.question) h += '<p class="wr-q"><span>오늘의 질문</span>' + esc(s.question) + '</p>';
      h += s.points.map(function (p) {
        return '<div class="wr-pt"><p class="wr-pt-h">' + (p.label ? '<span class="wr-pill">' + esc(p.label) + '</span>' : '') + (p.title ? '<b>' + esc(p.title) + '</b>' : '') + '</p><p class="wr-pt-x">' + esc(p.text) + '</p></div>';
      }).join("");
      if (s.one_line) h += '<div class="wr-one"><span>오늘의 한 문장</span><p>' + esc(s.one_line) + '</p></div>';
      h += '</section>';
    }
    if ((s.prayers || []).length) {
      h += '<section class="wr-sec" id="wrPrayer"><h4 class="wr-h">함께 드리는 기도</h4>' +
        s.prayers.map(function (p) { return '<p class="wr-pr">' + (p.label ? '<span class="wr-pill">' + esc(p.label) + '</span>' : '') + esc(p.text) + '</p>'; }).join("") + '</section>';
    }
    if (s.next) h += '<p class="wr-next"><b>다음 주</b>' + esc(s.next) + '</p>';
    return h;
  }
  function tabsHtml(n) {
    var t = [];
    if ((n.passage || []).length) t.push(["wrPassage", "본문"]);
    if ((n.verses || []).length) t.push(["wrVerses", "인용 구절"]);
    if (((n.summary || {}).points || []).length) t.push(["wrSummary", "설교 요약"]);
    if (((n.summary || {}).prayers || []).length) t.push(["wrPrayer", "기도"]);
    return t.map(function (x) { return '<button type="button" data-go="' + x[0] + '">' + x[1] + '</button>'; }).join("");
  }
  function goSec(id) {
    var el = id && document.getElementById(id);
    if (el) rdBody.scrollTop += el.getBoundingClientRect().top - rdBody.getBoundingClientRect().top - 6;
  }
  function paint(n, sec) {
    cur = n;
    rdDate.textContent = dayLabel(n.note_date) + " · 수요기도회";
    rdTitle.textContent = n.title || "";
    rdTabs.innerHTML = tabsHtml(n);
    rdBody.innerHTML = readerHtml(n);
    rdBody.scrollTop = 0;
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
  function openReader(id, sec) {
    buildReader();
    return getFull(id).then(function (n) {
      paint(n, sec);
      if (!rdOpen) {
        rd.hidden = false;
        rdOpen = true;
        document.documentElement.classList.add("pop-open");
        if (window.ModalNav) window.ModalNav.open(hideDom);
      }
    }).catch(function () { alert("자료를 불러오지 못했습니다. 잠시 뒤 다시 눌러 주세요."); });
  }
  function onReaderClick(e) {
    var t = e.target;
    if (t.closest("[data-wclose]")) { closeReader(); return; }
    var g = t.closest("[data-go]");
    if (g) { goSec(g.getAttribute("data-go")); return; }
    var c = t.closest("[data-ment]");
    if (c && cur) {
      var i = +c.getAttribute("data-ment"), m = (cur.mentions || [])[i], mb = document.getElementById("wrMentBox");
      var on = c.getAttribute("aria-expanded") === "true";
      rd.querySelectorAll(".wr-chip").forEach(function (x) { x.setAttribute("aria-expanded", "false"); });
      if (on || !m) { mb.hidden = true; return; }
      c.setAttribute("aria-expanded", "true");
      mb.innerHTML = '<p class="wr-ment-ref">' + esc(m.ref) + '</p>' + linesHtml(m.lines, true);
      mb.hidden = false;
      return;
    }
    var st = t.closest("[data-wstatus]");
    if (st) { setStatus(st.getAttribute("data-id"), st.getAttribute("data-wstatus")); return; }
    var ed = t.closest("[data-wedit]");
    if (ed && cur) { openEdit(cur); return; }
    if (t.closest("[data-wsave]")) { saveEdit(); return; }
    if (t.closest("[data-wcancel]")) { paint(cur); return; }
  }

  // ===== ③ 관리자: 올리기·내리기·고치기 =====
  function setStatus(id, status) {
    var n = full[id] || list.filter(function (x) { return x.id === id; })[0];
    if (!n) return;
    var past = Date.parse(n.publish_at) <= Date.now();
    var ask = status === "approved"
      ? "이 자료를 올릴까요?\n" + (past ? "로그인한 성도님께 바로 보입니다." : dayLabel(n.note_date) + " 저녁 8시에 로그인한 성도님께 열립니다.")
      : "이 자료를 내릴까요?\n성도님께 보이지 않게 됩니다(지워지지는 않습니다).";
    if (!confirm(ask)) return;
    api("PATCH", "sermon_notes?id=eq." + encodeURIComponent(id), { status: status }, { Prefer: "return=representation" })
      .then(function (rows) {
        var r = rows && rows[0];
        if (!r) throw new Error("바뀐 것이 없습니다(관리자 권한을 확인해 주세요)");
        full[id] = r;
        list = list.map(function (x) { return x.id === id ? r : x; });
        render();
        if (rdOpen && cur && cur.id === id) paint(r);
        if (window.showFlash) window.showFlash(status === "approved" ? "올렸습니다" : "내렸습니다");
      })
      .catch(function (e) { alert("저장하지 못했습니다: " + e.message); });
  }

  function editHtml(n) {
    var s = n.summary || {};
    var pts = (s.points || []).slice();
    while (pts.length < 4) pts.push({});
    var prs = (s.prayers || []).slice();
    while (prs.length < 3) prs.push({});
    var refs = function (a) { return (a || []).map(function (v) { return v.ref; }).join("\n"); };
    var ta = function (id, v, rows, ph) { return '<textarea id="' + id + '" rows="' + (rows || 3) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>' + esc(v || "") + '</textarea>'; };
    var inp = function (id, v, ph) { return '<input id="' + id + '" type="text" value="' + esc(v || "") + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + ' />'; };
    return '<div class="wr-edit">' +
      '<p class="wr-edit-note">고친 뒤 [저장]을 누르세요. 장절은 한 줄에 하나씩 적으시면 본문은 홈페이지 성경(개역개정)에서 채웁니다.</p>' +
      '<label>제목' + inp("we_title", n.title) + '</label>' +
      '<label>시리즈' + inp("we_series", n.series, "예: 에베소서 강해 22강") + '</label>' +
      '<label>인용 구절 <small>설교에서 읽는 순서대로, 한 줄에 하나</small>' + ta("we_verses", refs(n.verses), 6, "예: 에베소서 1:20") + '</label>' +
      '<label>말씀 중에 나온 구절 <small>한 줄에 하나</small>' + ta("we_mentions", refs(n.mentions), 4) + '</label>' +
      '<label>오늘의 질문' + ta("we_q", s.question, 2) + '</label>' +
      pts.map(function (p, i) {
        return '<fieldset class="wr-edit-pt"><legend>요약 ' + (i + 1) + '</legend>' +
          '<div class="wr-edit-row">' + inp("we_pl" + i, p.label, "예: 7절") + inp("we_pt" + i, p.title, "작은 제목") + '</div>' +
          ta("we_px" + i, p.text, 4, "내용(비우면 빠집니다)") + '</fieldset>';
      }).join("") +
      '<label>오늘의 한 문장' + ta("we_one", s.one_line, 2) + '</label>' +
      prs.map(function (p, i) {
        return '<fieldset class="wr-edit-pt"><legend>기도 ' + (i + 1) + '</legend>' +
          '<div class="wr-edit-row">' + inp("we_rl" + i, p.label, "예: 감사") + '</div>' + ta("we_rx" + i, p.text, 2, "기도(비우면 빠집니다)") + '</fieldset>';
      }).join("") +
      '<label>다음 주' + ta("we_next", s.next, 2) + '</label>' +
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
    var points = [], prayers = [];
    for (var i = 0; i < 8; i++) {
      if (!document.getElementById("we_px" + i)) break;
      if (val("we_px" + i)) points.push({ label: val("we_pl" + i), title: val("we_pt" + i), text: val("we_px" + i) });
    }
    for (var j = 0; j < 6; j++) {
      if (!document.getElementById("we_rx" + j)) break;
      if (val("we_rx" + j)) prayers.push({ label: val("we_rl" + j), text: val("we_rx" + j) });
    }
    Promise.all([resolveRefs(val("we_verses"), n.verses), resolveRefs(val("we_mentions"), n.mentions)])
      .then(function (res) {
        var body = {
          title: val("we_title") || n.title, series: val("we_series") || null,
          verses: res[0], mentions: res[1], made_by: "pastor",
          summary: { question: val("we_q"), points: points, one_line: val("we_one"), prayers: prayers, next: val("we_next") }
        };
        return api("PATCH", "sermon_notes?id=eq." + encodeURIComponent(n.id), body, { Prefer: "return=representation" });
      })
      .then(function (rows) {
        var r = rows && rows[0];
        if (!r) throw new Error("저장되지 않았습니다(관리자 권한을 확인해 주세요)");
        full[r.id] = r;
        list = list.map(function (x) { return x.id === r.id ? r : x; });
        render();
        paint(r);
        if (window.showFlash) window.showFlash("저장했습니다");
      })
      .catch(function (e) { msg.textContent = "⚠️ " + e.message; });
  }

  // 카드·목록의 단추
  if (box) {
    box.addEventListener("click", function (e) {
      var o = e.target.closest("[data-wopen]");
      if (o) { openReader(o.getAttribute("data-wopen"), o.getAttribute("data-wsec")); return; }
      var st = e.target.closest("[data-wstatus]");
      if (st) setStatus(st.getAttribute("data-id"), st.getAttribute("data-wstatus"));
    });
  }

  // ===== ④ 첫 화면 띠 — 수요일 저녁 8시 ~ 목요일 낮 12시 =====
  function paintBanner() {
    if (!banner) return;
    var k = kst(), d = k.getUTCDay(), hr = k.getUTCHours();
    if (!((d === 3 && hr >= 20) || (d === 4 && hr < 12))) return;
    api("POST", "rpc/wed_note_now", {}).then(function (r) {
      if (!r || !r.open) return;
      banner.dataset.wed = "1";
      var lb = banner.querySelector(".hsb-label"), t = banner.querySelector(".hsb-title"),
          rf = banner.querySelector(".hsb-ref"), ar = banner.querySelector(".hsb-arrow");
      if (lb) lb.textContent = r.date === todayKST() ? "오늘 수요기도회 말씀" : "수요기도회 말씀";
      if (t) t.textContent = r.title || "인용 구절과 설교 요약";
      if (rf) rf.textContent = r.title ? (r.scripture || "") : "가입하고 로그인하신 분께 보여 드립니다";
      if (ar) ar.textContent = "말씀 자료 보기 →";
      banner.setAttribute("href", "word.html#wed");
      banner.classList.add("is-wed");
    }).catch(function () {});
  }

  load();
  paintBanner();
  window.addEventListener("church:auth", function () { _admin = null; full = {}; load(); paintBanner(); });
  window.WedNotes = { open: openReader, reload: load };
})();

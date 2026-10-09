/* worship-live.js — 주일 예배 화면 (worship.html)
 * 2026-10-09 목사님 요청:
 *  - '오늘 예배 현장 입장하기'(?m=site): 이번 주 주보를 예배 순서대로 크게. 순서마다 사도신경·교독문 전문·새찬송가 악보·성경봉독 본문이 펼쳐져
 *    병원 등 어디서든 이 화면 하나로 예배를 따라 드릴 수 있게.
 *  - '온라인 예배드리기'(?m=online): 왼쪽 주보, 오른쪽 예배 실황(유튜브). 휴대폰은 실황을 위에 고정하고 주보는 아래로 넘김.
 *  - 정회원(로그인)만, 주일 10:45~12:30(한국 시각, js/church.js sundayWorship)에만. 그 밖에는 안내 글.
 *    관리자(목사님)는 언제든 열어 미리 볼 수 있다(위에 '미리보기' 표시).
 *  - 악보는 새찬송가만(모두의 찬양은 열지 않음). 보관함 hymns 의 NNN.webp 를 서명 주소로 — 서버 규칙(supabase/sunday_worship_scores_20261009.sql)이
 *    정회원에게는 주일 그 시간에만 허락한다.
 */
(function () {
  "use strict";
  var page = document.getElementById("wlPage"), body = document.getElementById("wlBody");
  if (!page || !body) return;

  var CH = window.CHURCH || {};
  var SW = CH.sundayWorship || { open: "10:45", close: "12:30" };
  var YT_CHANNEL = "UCYlesUmTrHecsHYmQNFYY1A";          // 노진교회 유튜브(js/sermon-video.js 와 같은 값)
  var MODE = /(?:^|[?&])m=online(?:&|$)/.test(location.search) ? "online" : "site";
  try {
    var saved = JSON.parse(sessionStorage.getItem("nojin_wl_mode") || "null");
    sessionStorage.removeItem("nojin_wl_mode");
    if (MODE === "site" && saved && saved.m === "online" && Date.now() - saved.at < 15 * 60e3) {
      MODE = "online";
      try { history.replaceState(null, "", "worship.html?m=online"); } catch (e) {}
    }
  } catch (e) {}

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function hm(s) { var m = String(s || "").match(/^(\d{1,2}):(\d{2})$/); return m ? (+m[1]) * 60 + (+m[2]) : 0; }
  var OPEN_M = hm(SW.open), CLOSE_M = hm(SW.close);
  // 한국 시각: +9시간 옮긴 Date 를 getUTC* 로만 읽는다(어느 나라 기기에서도 같게)
  function kst() { return new Date(Date.now() + 9 * 3600e3); }
  function isOpenNow() { var k = kst(), m = k.getUTCHours() * 60 + k.getUTCMinutes(); return k.getUTCDay() === 0 && m >= OPEN_M && m < CLOSE_M; }
  function todayIso() { var k = kst(); return k.getUTCFullYear() + "-" + ("0" + (k.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + k.getUTCDate()).slice(-2); }
  // 다음 열림·닫힘까지 남은 밀리초(오늘이 주일일 때만, 아니면 null)
  function msToNextMark() {
    var k = kst();
    var nowMs = (k.getUTCHours() * 60 + k.getUTCMinutes()) * 60e3 + k.getUTCSeconds() * 1e3 + k.getUTCMilliseconds();
    var toMidnight = 24 * 3600e3 - nowMs;
    if (k.getUTCDay() !== 0) return toMidnight;                // 다른 날은 자정에 다시 확인(토요일 밤 → 주일 0시 → 10:45)
    var o = OPEN_M * 60e3, c = CLOSE_M * 60e3;
    if (nowMs < o) return o - nowMs;
    if (nowMs < c) return c - nowMs;
    return toMidnight;
  }
  // 닫히는 시각까지 남은 초(악보 서명 주소의 유효 시간에 씀)
  function secToClose() { var k = kst(), nowS = (k.getUTCHours() * 60 + k.getUTCMinutes()) * 60 + k.getUTCSeconds(); return CLOSE_M * 60 - nowS; }
  function timeTxt(s) { var m = hm(s), h = Math.floor(m / 60), mi = m % 60; return (h < 12 ? "오전 " : "오후 ") + (h > 12 ? h - 12 : h) + "시" + (mi ? " " + mi + "분" : ""); }
  function mdOf(s) { var m = String(s || "").match(/^\d{4}-(\d{2})-(\d{2})/); return m ? (+m[1]) + "월 " + (+m[2]) + "일" : ""; }

  // ── 글씨 크기(가− / 가+) — 이 기기에 기억 ──
  var FS = [1, 1.14, 1.3], fsI = 1;
  try { var f0 = localStorage.getItem("nojin_wl_fs"); if (f0 !== null && /^[0-2]$/.test(f0)) fsI = +f0; } catch (e) {}
  function applyFs() { page.style.setProperty("--wl-fs", FS[fsI]); try { localStorage.setItem("nojin_wl_fs", fsI); } catch (e) {} }
  applyFs();

  // ── 위 막대: 제목 · 현장/온라인 바꾸기 · 글씨 크기 ──
  var bar = document.getElementById("wlBar");
  function paintBar() {
    if (!bar) return;
    bar.innerHTML =
      '<a class="wl-home" href="index.html" aria-label="첫 화면으로">‹ 첫 화면</a>' +
      '<div class="wl-modes" role="tablist">' +
      '<a role="tab" href="worship.html" class="' + (MODE === "site" ? "on" : "") + '" aria-selected="' + (MODE === "site") + '">현장 예배</a>' +
      '<a role="tab" href="worship.html?m=online" class="' + (MODE === "online" ? "on" : "") + '" aria-selected="' + (MODE === "online") + '">온라인 예배</a>' +
      '</div>' +
      '<div class="wl-fs"><button type="button" data-fs="-1" aria-label="글씨 작게">가−</button><button type="button" data-fs="1" aria-label="글씨 크게">가+</button></div>';
    bar.querySelectorAll("[data-fs]").forEach(function (b) {
      b.onclick = function () { fsI = Math.max(0, Math.min(FS.length - 1, fsI + (+b.getAttribute("data-fs")))); applyFs(); };
    });
  }
  paintBar();
  document.title = (MODE === "online" ? "온라인 예배" : "오늘 예배 현장") + " | " + (CH.name || "교회");

  // ── 안내 화면(정회원 아님·시간 밖·닫힘) ──
  function gate(title, text, opts) {
    opts = opts || {};
    stopVideo();
    body.innerHTML = '<div class="wl-gate"><div class="wl-gate-ic" aria-hidden="true">' + (opts.icon || "🔒") + '</div><h1>' + esc(title) + '</h1>' +
      (text ? '<p>' + esc(text) + '</p>' : "") +
      '<div class="wl-gate-btns">' +
      (opts.login ? '<button type="button" class="wl-btn wl-btn-solid" data-mo="login" id="wlLogin">로그인하기</button>' : "") +
      (opts.bulletin ? '<a class="wl-btn" href="index.html#pop-bulletin">이번 주 주보 보기</a>' : "") +
      '<a class="wl-btn" href="index.html">첫 화면으로</a></div></div>';
    var lb = document.getElementById("wlLogin");
    if (lb) lb.addEventListener("click", function () { try { sessionStorage.setItem("nojin_wl_mode", JSON.stringify({ m: MODE, at: Date.now() })); } catch (e) {} });
  }

  // ── 서버 묻기 ──
  var sb = null;
  function token() {
    try { var ref = (window.SUPABASE_URL || "").match(/https:\/\/([^.]+)\./)[1]; var s = JSON.parse(sessionStorage.getItem("sb-" + ref + "-auth-token")); return s && (s.access_token || (s.currentSession && s.currentSession.access_token)); } catch (e) { return null; }
  }
  function hdr() { var h = { apikey: window.SUPABASE_ANON_KEY }; var t = token(); h.Authorization = "Bearer " + (t || window.SUPABASE_ANON_KEY); return h; }
  function api(path, opt) {
    opt = opt || {};
    return fetch(window.SUPABASE_URL + path, { method: opt.method || "GET", headers: Object.assign({ "Content-Type": "application/json" }, hdr()), body: opt.body, cache: "no-store" })
      .then(function (r) { if (!r.ok) { var e = new Error("HTTP " + r.status); e.status = r.status; throw e; } return r.json(); });
  }

  // ── 순서 하나하나 그리기 ──
  var INVITE = ["형제들아! 우리가 예수의 피를 힘입어 성소에 들어갈 담력을 얻었나니", "참 마음과 온전한 믿음으로 하나님께 나아가자", "하나님은 영이시니 예배하는 자가 영과 진리로 예배할지니라 <아멘>"];
  var CREED = ["전능하사 천지를 만드신 하나님 아버지를 내가 믿사오며,", "그 외아들 우리 주 예수 그리스도를 믿사오니,", "이는 성령으로 잉태하사 동정녀 마리아에게 나시고,",
    "본디오 빌라도에게 고난을 받으사, 십자가에 못 박혀 죽으시고,", "장사한 지 사흘 만에 죽은 자 가운데서 다시 살아나시며,",
    "하늘에 오르사, 전능하신 하나님 우편에 앉아 계시다가,", "저리로서 산 자와 죽은 자를 심판하러 오시리라.",
    "성령을 믿사오며, 거룩한 공회와, 성도가 서로 교통하는 것과,", "죄를 사하여 주시는 것과, 몸이 다시 사는 것과,", "영원히 사는 것을 믿사옵나이다. 아멘."];
  var LORDS = ["하늘에 계신 우리 아버지여 이름이 거룩히 여김을 받으시오며", "나라가 임하시오며 뜻이 하늘에서 이루어진 것 같이 땅에서도 이루어지이다", "오늘 우리에게 일용할 양식을 주시옵고",
    "우리가 우리에게 죄 지은 자를 사하여 준 것 같이 우리 죄를 사하여 주시옵고", "우리를 시험에 들게 하지 마시옵고 다만 악에서 구하시옵소서", "대개 나라와 권세와 영광이 아버지께 영원히 있사옵나이다 아멘."];

  // "찬 송 가" → "찬송가" (한 글자씩 띄어 쓴 이름만 붙인다)
  function tidyName(s) { s = String(s || "").trim(); return /^([가-힣]\s+)+[가-힣]$/.test(s) ? s.replace(/\s+/g, "") : s; }
  function hymnOf(detail) {
    var m = String(detail || "").match(/(^|[^\d가-힣])(\d{1,3})\s*장(?!\s*\d)(?:\s*[\/·]\s*(.+))?/);
    if (!m || +m[2] < 1 || +m[2] > 645) return null;
    return { no: +m[2], title: (m[3] || "").trim() };
  }
  function gyodokNo(detail) {
    var d = String(detail || ""), m = d.match(/(\d{1,3})\s*번/) || d.match(/^\s*(\d{1,3})(?!\s*(?:장|편|절|:|\d))/);
    return m && +m[1] >= 1 && +m[1] <= 137 ? +m[1] : 0;
  }
  // 한 줄에 찬송이 여럿('28장 복의 근원 · 210장 시온성')이거나 '28장 1, 3절'처럼 부를 절을 적어도 모두 찾는다(찬송 줄일 때만)
  function hymnsLoose(detail) {
    var out = [], re = /(^|[^\d가-힣])(\d{1,3})\s*장/g, m;
    while ((m = re.exec(String(detail || "")))) { var n = +m[2]; if (n >= 1 && n <= 645 && out.indexOf(n) < 0) out.push(n); }
    return out;
  }
  function linesHtml(arr, cls) { return '<div class="wl-read' + (cls ? " " + cls : "") + '">' + arr.map(function (l) { return "<p>" + esc(l) + "</p>"; }).join("") + "</div>"; }

  function gyodokHtml(no) {
    var g = (window.GYODOK || []).filter(function (x) { return x.no === no; })[0];
    if (!g) return '<p class="wl-hint">교독문 ' + no + "번을 불러오지 못했습니다.</p>";
    var html = '<p class="wl-gd-t">교독문 ' + g.no + "번 · " + esc(g.title) + "</p>", lead = true;
    g.body.forEach(function (raw) {
      var line = String(raw).replace(/\s*\((?:[가-힣]+\s*)?\d+(?::\d+)?[상하]?(?:\s*[-~,]\s*(?:\d+:)?\d+[상하]?)*\)\s*$/, "").trim();
      if (!line) return;
      if (/다같이/.test(line.slice(0, 8))) { html += '<p class="wl-gd-all"><span class="wl-role">다같이</span>' + esc(line.replace(/^\(?다같이\)?\s*/, "")) + "</p>"; lead = true; return; }
      html += lead ? '<p class="wl-gd-lead"><span class="wl-role">인도</span>' + esc(line) + "</p>" : '<p class="wl-gd-people"><span class="wl-role">회중</span>' + esc(line) + "</p>";
      lead = !lead;
    });
    return '<div class="wl-gd">' + html + "</div>";
  }

  // 성경봉독: 주보의 '본문' 칸(줄마다 "7 또 그에게…") — 없으면 성경 자료(data/gyr)에서 찾는다
  function versesHtml(lines) {
    return '<div class="wl-verses">' + lines.map(function (l) {
      var m = String(l).match(/^(\d{1,3})\s+(.+)$/);
      return m ? '<p><sup>' + m[1] + "</sup>" + esc(m[2]) + "</p>" : "<p>" + esc(l) + "</p>";
    }).join("") + "</div>";
  }
  function bibleFill(el, ref) {
    var WV = window.WorshipView;
    if (!WV || !WV.parseRef) { el.innerHTML = ""; return; }
    var r = WV.parseRef(ref);
    if (!r) { el.innerHTML = ""; return; }
    WV.getVerses(r).then(function (vs) {
      if (!vs || !vs.length) { el.innerHTML = ""; return; }
      el.innerHTML = versesHtml(vs.map(function (v) { return v.v + " " + v.t; }));
    }).catch(function () { el.innerHTML = ""; });
  }

  // 말씀선포: 주보 '설교 요약' 칸의 ●장절 + 본문 줄 → 인용 구절([..질문..] 칸은 뺀다)
  // ● 없이 '창세기 2:21 여호와 하나님이…'처럼 장절과 본문을 한 줄에 적어도 말씀 칸 안이면 나눈다(js/worship-view.js splitRefLine)
  function xrefsOf(summary) {
    var out = [], cur = null, skip = false, verseSec = false, WV = window.WorshipView || {};
    String(summary || "").split(/\r?\n/).forEach(function (raw) {
      var l = raw.trim(); if (!l) return;
      var h = l.match(/^\[(.*)\]$/);
      if (h) { skip = /질문/.test(h[1]); verseSec = WV.isVerseHead ? WV.isVerseHead(h[1]) : false; cur = null; return; }
      if (skip) return;
      var bullet = /^●/.test(l), sp = (bullet || verseSec) && WV.splitRefLine ? WV.splitRefLine(l) : null;
      if (bullet || sp) {
        cur = { ref: sp ? sp.label : l.replace(/^●\s*/, ""), lines: sp && sp.text ? [sp.text] : [] };
        out.push(cur);
        return;
      }
      if (cur) cur.lines.push(l);
    });
    return out;
  }

  var hymnJobs = [], isAdminView = false, bibleSeen = false;
  function itemHtml(o, i, b) {
    var d = b.data || {};
    var name = tidyName(o.name), detail = String(o.detail || "").trim();
    var plainDetail = /^(인도자|설교자|사회자)$/.test(detail) ? "" : detail;
    var sub = esc(detail), c = "";
    var isBible = /성경\s*봉독|봉독|성경\s*말씀/.test(name);
    var isSermon = /말씀\s*선포|말씀\s*강해|설교|^말\s*씀$/.test(name);
    var isHymnName = /찬송|봉헌|헌금/.test(name);
    var WV = window.WorshipView, bibleRefLike = !!(WV && WV.parseRef && WV.parseRef(detail));
    var hymns = [];
    if (!isBible && !isSermon) {
      if (isHymnName) hymns = hymnsLoose(detail);
      else { var h1 = hymnOf(detail); if (h1 && h1.title && !bibleRefLike) hymns = [h1.no]; }   // '시편 23장 / …' 같은 성경 장은 찬송으로 읽지 않는다
    }
    var creedName = /신앙\s*고백|사도\s*신경/.test(name), lordName = /주기도/.test(name);
    if (/예배로\s*초대|예배로\s*부름|부르심/.test(name)) c = linesHtml(INVITE, "wl-invite");
    else if (lordName || (creedName && /주기도/.test(detail))) c = linesHtml(LORDS);
    else if (creedName || (!isSermon && !hymns.length && /^\s*사도\s*신경\s*$/.test(detail))) c = linesHtml(CREED, "wl-creed");
    else if (/교\s*독|성시\s*교독/.test(name) && gyodokNo(detail)) {
      c = gyodokHtml(gyodokNo(detail));
      var gg = (window.GYODOK || []).filter(function (x) { return x.no === gyodokNo(detail); })[0];
      if (gg) sub = gg.no + "번 · " + esc(gg.title);                // 머리에도 교독문 자료의 제목(주보 글과 달라도 본문과 같게)
      var said = (detail.replace(/^\s*\d{1,3}\s*(?:번|\.)?\s*/, "").match(/[가-힣]+\s*\d+\s*(?:편|장)/) || [])[0];
      if (isAdminView && gg && said && said.replace(/\s+/g, "") !== String(gg.title).replace(/\s+/g, "").slice(0, said.replace(/\s+/g, "").length))
        c = '<p class="wl-note">목사님께만 보이는 안내: 주보에는 「' + esc(detail) + '」로 적혀 있는데, 교독문 ' + gg.no + "번은 「" + esc(gg.title) + "」입니다. 번호대로 보여 드립니다.</p>" + c;
    }
    else if (hymns.length) {
      var one = hymns.length === 1 ? hymnOf(detail) : null;
      sub = hymns.length === 1 ? hymns[0] + "장" + (one && one.no === hymns[0] && one.title ? " · " + esc(one.title) : "") : esc(detail);
      c = hymns.map(function (no) {
        return (hymns.length > 1 ? '<p class="wl-hy-t">새찬송가 ' + no + "장</p>" : "") +
          '<figure class="wl-score" data-hymn="' + no + '"><p class="wl-hint">새찬송가 ' + no + "장 악보를 불러오는 중…</p></figure>";
      }).join("");
    }
    else if (isBible) {
      var hl = String(d.headline || "").split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
      var useHeadline = hl.length && !bibleSeen;                   // 주보 '본문' 칸은 첫 성경봉독에만(둘째 봉독은 자기 장절로)
      bibleSeen = true;
      var ref = bibleRefLike ? detail : (b.scripture || detail);
      c = useHeadline ? versesHtml(hl) : '<div class="wl-bible" data-ref="' + esc(ref) + '"><p class="wl-hint">본문 말씀을 불러오는 중…</p></div>';
    }
    else if (isSermon) {
      var xr = xrefsOf(d.summary);
      c = '<p class="wl-sermon"><b>' + esc(plainDetail || b.title || "") + "</b>" +
        (b.scripture ? "<span>" + esc(b.scripture) + "</span>" : "") + (b.preacher ? "<span>" + esc(b.preacher) + "</span>" : "") + "</p>" +
        (xr.length ? '<details class="wl-xref"><summary>말씀 속 인용 구절 ' + xr.length + "곳 보기</summary>" +
          xr.map(function (x) {
            return '<div class="wl-x"><b>' + esc(x.ref) + "</b>" + (x.lines.length ? x.lines.map(function (l) { return "<p>" + esc(l) + "</p>"; }).join("")
              : '<div class="wl-bible" data-ref="' + esc(x.ref) + '"><p class="wl-hint">본문을 불러오는 중…</p></div>') + "</div>";
          }).join("") + "</details>" : "");
      sub = "";
    }
    else if (/교회\s*소식|광고/.test(name)) {
      var ns = String(d.notices || "").split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
      // 번호 동그라미 + '제목 ― 내용'이면 제목은 굵게 한 줄, 내용은 그 아래(2026-10-09 목사님: 번호 없이 글만 있어 읽기 불편)
      c = ns.length ? '<ol class="wl-news">' + ns.map(function (l, i) {
        var no = (l.match(/^(\d+)\s*[.)]/) || [])[1] || String(i + 1), t = l.replace(/^\d+\s*[.)]\s*/, "");
        var m = t.match(/^([^―—]{2,30}?)\s*[―—]\s*(.+)$/);
        return '<li><span class="wl-news-no">' + esc(no) + "</span><p>" + (m ? "<b>" + esc(m[1]) + "</b>" + esc(m[2]) : esc(t)) + "</p></li>";
      }).join("") + "</ol>" : "";
      sub = esc(plainDetail);
    }
    else sub = esc(plainDetail || detail);
    return '<section class="wl-item" id="wl-' + (i + 1) + '"><h2><span class="wl-no">' + (i + 1) + '</span><span class="wl-name">' + esc(name) + "</span>" +
      (sub ? '<small>' + sub + "</small>" : "") + "</h2>" + (c ? '<div class="wl-c">' + c + "</div>" : "") + "</section>";
  }

  function bulletinHtml(b, preview) {
    var d = b.data || {}, order = (d.order || []).filter(function (o) { return o && (o.name || o.detail); });
    var head = '<header class="wl-head"><p class="wl-date">' + esc(mdOf(b.bdate)) + " 주일 예배" + (d.week ? " · " + esc(d.week) : "") + "</p>" +
      "<h1>" + esc(b.title || "") + "</h1>" + (b.scripture ? '<p class="wl-ref">' + esc(b.scripture) + "</p>" : "") + "</header>";
    var stale = b.bdate && b.bdate !== todayIso() && kst().getUTCDay() === 0
      ? '<p class="wl-note">오늘 주보가 아직 올라오지 않아 ' + esc(mdOf(b.bdate)) + " 주보를 보여 드립니다.</p>" : "";
    if (!order.length) return head + stale + '<p class="wl-hint">이 주보에는 예배 순서가 없습니다.</p>';
    var toc = '<nav class="wl-toc" aria-label="예배 순서"><p>예배 순서</p><ol>' + order.map(function (o, i) {
      return '<li><a href="javascript:void 0" data-go="wl-' + (i + 1) + '">' + esc(tidyName(o.name)) + "</a></li>";
    }).join("") + "</ol></nav>";
    hymnJobs = []; bibleSeen = false;
    return head + stale + toc + order.map(function (o, i) { return itemHtml(o, i, b); }).join("") +
      '<p class="wl-end">예배를 마칩니다. 함께 예배드려 주셔서 감사합니다.</p>';
  }

  // 악보: 새찬송가 NNN.webp 를 1시간짜리 서명 주소로(서버 규칙이 정회원은 주일 예배 시간에만 허락)
  function scoreTtl() { var left = secToClose(); return left > 0 ? Math.max(900, left + 900) : 3600; }   // 예배 시간이면 닫힐 때까지 넉넉히
  function signScore(no) {
    return sb.storage.from("hymns").createSignedUrl(("00" + no).slice(-3) + ".webp", scoreTtl()).then(function (r) {
      if (!r || r.error || !r.data || !r.data.signedUrl) throw new Error("no url");
      return r.data.signedUrl;
    });
  }
  function loadScores() {
    var figs = body.querySelectorAll(".wl-score[data-hymn]");
    if (!figs.length || !sb) return;
    figs.forEach(function (fig) {
      var no = +fig.getAttribute("data-hymn");
      signScore(no).then(function (url) {
        fig.innerHTML = '<img src="' + esc(url) + '" alt="새찬송가 ' + no + '장 악보">';
        var img = fig.querySelector("img"), retried = false;
        img.onerror = function () {                              // 주소가 낡았으면 한 번만 새로 받아 다시
          if (retried) { fig.innerHTML = '<p class="wl-hint">악보를 불러오지 못했습니다.</p>'; return; }
          retried = true;
          signScore(no).then(function (u2) { img.src = u2; }).catch(function () { fig.innerHTML = '<p class="wl-hint">악보를 불러오지 못했습니다.</p>'; });
        };
      }).catch(function () { fig.innerHTML = '<p class="wl-hint">악보를 불러오지 못했습니다.</p>'; });
    });
  }
  function loadBible() {
    body.querySelectorAll(".wl-bible[data-ref]").forEach(function (el) { bibleFill(el, el.getAttribute("data-ref")); });
  }

  // ── 예배 실황(유튜브) ──
  var videoBox = null, videoTimer = 0, videoSrc = "", videoId = null;
  function stopVideo() { clearInterval(videoTimer); videoTimer = 0; videoSrc = ""; videoId = null; videoBox = null; }
  function paintVideo(st) {
    if (!videoBox) return;
    var src = "";
    if (st && st.live) src = st.id ? "https://www.youtube.com/embed/" + encodeURIComponent(st.id) + "?autoplay=1&rel=0&playsinline=1"
      : "https://www.youtube.com/embed/live_stream?channel=" + YT_CHANNEL + "&autoplay=1&playsinline=1";
    if (src && src === videoSrc) return;                       // 같은 방송이면 틀어 둔 영상을 그대로 둔다
    if (!src && videoSrc) return;                              // 잠깐 '방송 아님'으로 읽혀도 보던 영상은 끊지 않는다
    if (src && videoSrc && !(videoId && st.id && videoId !== st.id)) return;   // 이미 실황이 나오는 중이면 번호를 몰라도·새로 알아도 그대로
    videoSrc = src; videoId = (st && st.id) || null;
    videoBox.innerHTML = src
      ? '<div class="wl-frame"><iframe src="' + esc(src) + '" title="예배 실황" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>'
      : '<div class="wl-frame wl-wait"><div><p class="wl-wait-t">예배 방송을 기다리고 있습니다</p><p>방송이 시작되면 여기에 저절로 나옵니다.</p>' +
        '<a class="wl-btn" href="https://www.youtube.com/channel/' + YT_CHANNEL + '/live" target="_blank" rel="noopener">유튜브에서 열기</a></div></div>';
  }
  function startVideo(el) {
    videoBox = el; videoSrc = "";
    var LS = window.LiveStatus;
    function tick() { (LS ? LS.get() : Promise.resolve({ live: true, id: null })).then(paintVideo).catch(function () { paintVideo({ live: true, id: null }); }); }
    tick();
    videoTimer = setInterval(tick, 60e3);
  }

  // ── 그리기 ──
  var shown = false, lastBulletin = null;
  function render(b, preview) {
    lastBulletin = b;
    var bul = '<article class="wl-bulletin">' + bulletinHtml(b, preview) + "</article>";
    var pv = preview ? '<p class="wl-preview">미리보기 — 성도님들께는 주일 ' + esc(timeTxt(SW.open)) + "부터 " + esc(timeTxt(SW.close)) + "까지만 열립니다.</p>" : "";
    stopVideo();
    if (MODE === "online") {
      body.innerHTML = pv + '<div class="wl-split"><div class="wl-video" id="wlVideo"></div>' + bul + "</div>";
      startVideo(document.getElementById("wlVideo"));
    } else {
      body.innerHTML = pv + '<div class="wl-wrap">' + bul + "</div>";
    }
    loadScores(); loadBible();
    body.querySelectorAll(".wl-toc a[data-go]").forEach(function (a) {
      a.onclick = function (e) {
        e.preventDefault();
        var t = document.getElementById(a.getAttribute("data-go"));
        if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
      };
    });
    shown = true;
  }

  // ── 들어올 수 있는지 확인 → 주보 불러오기 ──
  var markTimer = 0, checking = false, recheck = false, retryTimer = 0;
  function scheduleMark(isAdmin) {
    clearTimeout(markTimer);
    var ms = msToNextMark();
    if (ms != null && ms < 26 * 3600e3) markTimer = setTimeout(function () { check(); }, ms + 1500);
  }
  function check() {
    if (!sb) return;
    if (checking) { recheck = true; return; }
    checking = true;
    sb.auth.getSession().then(function (r) {
      var s = r && r.data && r.data.session;
      if (!s && r && r.error) { var ne = new Error("session"); ne.status = 0; throw ne; }   // 열쇠를 새로 받다 연결이 끊긴 것 — 로그아웃으로 보지 않는다
      if (!s) { shown = false; gate("정회원만 이용할 수 있습니다", "로그인한 정회원 성도님께 주일 " + timeTxt(SW.open) + "부터 " + timeTxt(SW.close) + "까지 열립니다.", { login: true, bulletin: true }); return; }
      return api("/rest/v1/rpc/my_perms", { method: "POST", body: "{}" }).then(function (p) {
        p = p || {};
        var admin = p.isAdmin === true, full = admin || p.status === "정회원", open = isOpenNow();
        isAdminView = admin;
        scheduleMark(admin);
        if (!full) { shown = false; gate("정회원만 이용할 수 있습니다", "교적 확인을 거쳐 정회원이 되시면 주일 예배 시간에 이용하실 수 있습니다.", { bulletin: true }); return; }
        if (!open && !admin) {
          shown = false;
          var k = kst(), m = k.getUTCHours() * 60 + k.getUTCMinutes();
          var closed = k.getUTCDay() === 0 && m >= CLOSE_M;
          gate(closed ? "오늘 예배 화면이 닫혔습니다" : "주일 " + timeTxt(SW.open) + "에 열립니다",
            closed ? "함께 예배드려 주셔서 감사합니다. 다음 주일 " + timeTxt(SW.open) + "에 다시 열립니다."
              : "예배 화면은 주일 " + timeTxt(SW.open) + "부터 " + timeTxt(SW.close) + "까지 열립니다.", { icon: closed ? "🙏" : "⏰" });
          return;
        }
        if (shown && lastBulletin) return;                     // 이미 그려 둔 화면은 다시 그리지 않는다(보던 자리·영상 유지)
        var gateNow = function () { return !admin && !isOpenNow(); };
        body.innerHTML = '<p class="wl-wait-line">이번 주 주보를 불러오는 중…</p>';
        return api("/rest/v1/bulletins_public?select=*&order=bdate.desc&limit=1").then(function (rows) {
          var b = rows && rows[0];
          if (!b) { gate("주보가 아직 없습니다", "이번 주 주보가 올라오면 여기에 나옵니다.", { icon: "📖" }); return; }
          if (gateNow()) { recheck = true; return; }             // 불러오는 사이 닫힐 시각이 지났으면 그리지 않고 다시 확인
          render(b, !open && admin);
        });
      });
    }).catch(function (e) {
      // 잠깐 연결이 끊긴 것: 보던 예배 화면은 그대로 두고 30초 뒤 다시 확인. 아직 아무것도 못 그렸을 때만 안내
      clearTimeout(retryTimer); retryTimer = setTimeout(check, 30e3);
      if (shown && lastBulletin) return;
      shown = false;
      gate("확인하지 못했습니다", "인터넷 연결을 확인해 주세요. 잠시 뒤 저절로 다시 확인합니다." + (e && e.status ? " (" + e.status + ")" : ""), { icon: "⚠️" });
    }).then(function () { checking = false; if (recheck) { recheck = false; setTimeout(check, 0); } });
  }
  var lastUid = null;
  function uidNow() { try { var ref = (window.SUPABASE_URL || "").match(/https:\/\/([^.]+)\./)[1]; var s = JSON.parse(sessionStorage.getItem("sb-" + ref + "-auth-token")); return (s && s.user && s.user.id) || ""; } catch (e) { return ""; } }
  function init(client) {
    if (sb) return; sb = client; lastUid = uidNow(); check();
    try {
      sb.auth.onAuthStateChange(function (ev, session) {
        var uid = (session && session.user && session.user.id) || "";
        if (uid === lastUid) return;                           // 같은 사람(처음 불러올 때 오는 알림 등)이면 그대로
        lastUid = uid; shown = false; lastBulletin = null; check();
      });
    } catch (e) {}
  }
  if (window.__sb) init(window.__sb);
  window.addEventListener("sb-ready", function (e) { init((e.detail && e.detail.sb) || window.__sb); });
  setTimeout(function () { if (!sb) gate("로그인 기능을 불러오지 못했습니다", "새로고침해 주세요.", { icon: "⚠️" }); }, 9000);
  // 휴대폰을 잠갔다가 다시 켰을 때 시간이 지났으면 다시 확인(닫힘 시각 등)
  document.addEventListener("visibilitychange", function () { if (!document.hidden && sb) check(); });
})();

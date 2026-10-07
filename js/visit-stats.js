/* 방문자 수 — 최고 운영자(목사님)에게만 (2026-10-07 목사님 요청: "방문자 수 확인할 수 있는 카운터 기능. 관리자인 나만 보면 돼")
   layout.js 가 로그인한 분일 때만 이 파일을 부른다. 숫자는 Supabase visit_stats()(최고 운영자만)에서 받고,
   운영자가 아니면 아무것도 그리지 않고 이 창(세션)에서는 다시 묻지 않는다(sessionStorage nojin_vc_owner=0).
   ① 모든 화면 맨 아래(푸터): 📊 방문자 오늘 ○ · 어제 ○ · 이번 달 ○ · 누적 ○ — 누르면 ②
   ② 자세히 창: 7일·30일·90일 — 날짜별 막대, 많이 본 화면, 들어온 곳, 휴대폰/컴퓨터, 로그인 회원/손님
   세는 방법: supabase/site_visits_20261007.sql — 개인을 알아볼 수 있는 정보는 남기지 않고, 목사님(관리자)·검색 로봇 방문은 세지 않는다.
   방문자 = 그날 서로 다른 브라우저 수(날마다 따로 셈. 같은 분이 휴대폰·컴퓨터로 오면 2), 조회 = 화면을 연 횟수. */
(function () {
  "use strict";
  if (window.__visitStats) return;
  window.__visitStats = true;
  var SB = (window.SUPABASE_URL || "").replace(/\/$/, "");
  if (!SB || !window.SUPABASE_ANON_KEY) return;

  var esc = function (t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]; }); };
  var fmt = function (n) { return Number(n || 0).toLocaleString("ko-KR"); };
  var PAGE_NAMES = {
    index: "첫 화면", word: "예배와 말씀", story: "공동체와 양육", world: "선교와 사역", welcome: "교회 안내", office: "행정",
    district: "교구사역", community: "나눔터", dashboard: "대시보드", admin: "내 정보", gyojeok: "교적관리", finance: "재정관리",
    affairs: "목회행정", "home-settings": "홈페이지 설정", privacy: "개인정보처리방침", terms: "이용약관", bylaws: "정관",
    sitemap: "사이트맵", library: "나의 도서관", prayer: "기도", share: "공유", reset: "비밀번호 재설정", withdraw: "회원탈퇴", "join-poster": "가입 안내"
  };

  function token() {
    try {
      var ref = new URL(SB).hostname.split(".")[0];
      var s = JSON.parse(sessionStorage.getItem("sb-" + ref + "-auth-token") || "null");
      s = s && s.currentSession ? s.currentSession : s;
      return (s && s.access_token) || "";
    } catch (e) { return ""; }
  }
  function stats(days) {
    return fetch(SB + "/rest/v1/rpc/visit_stats", {
      method: "POST",
      headers: { apikey: window.SUPABASE_ANON_KEY, Authorization: "Bearer " + token(), "Content-Type": "application/json" },
      body: JSON.stringify({ p_days: days })
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (d) {
        if (!r.ok) { var e = new Error((d && d.message) || ("HTTP " + r.status)); e.status = r.status; throw e; }
        return d;
      });
    });
  }

  // ① 푸터의 작은 숫자
  function paintFooter(st) {
    var host = document.querySelector(".footer .footer-meta") || document.querySelector(".footer .container") || document.querySelector(".footer");
    if (!host) return;
    var c = (st && st.counter) || {};
    var el = document.getElementById("vcFooter");
    if (!el) { el = document.createElement("div"); el.id = "vcFooter"; el.className = "vc-footer"; host.insertBefore(el, host.firstChild); }
    el.innerHTML = '<button type="button" class="vc-chip" id="vcOpen" aria-label="방문자 현황 자세히 보기">📊 방문자 <b>오늘 ' + fmt(c.today) + '명</b> · 어제 ' + fmt(c.yesterday) + ' · 이번 달 ' + fmt(c.month) + ' · 누적 ' + fmt(c.total) + ' <span class="vc-more">자세히 ›</span></button>' +
      ' <a class="vc-chip vc-scores" style="text-decoration:none;margin-left:6px" href="scores.html" title="새찬송가·모두의 찬양 악보(목사님만)">🎼 악보집 ›</a>' +
      '<span class="vc-only">목사님(최고 운영자)께만 보이는 숫자입니다</span>';
    el.querySelector("#vcOpen").onclick = function () { openModal(30); };
  }

  // ② 자세히 창
  var modal = null, body = null, isOpen = false;
  function build() {
    if (modal) return;
    document.body.insertAdjacentHTML("beforeend",
      '<div class="modal vc-modal" id="vcModal" hidden><div class="modal-backdrop" data-vclose></div>' +
        '<div class="modal-box vc-box" role="dialog" aria-modal="true" aria-labelledby="vcTitle">' +
          '<div class="vc-top"><b id="vcTitle">📊 방문자 현황</b><button type="button" class="vc-x" data-vclose aria-label="닫기">&times;</button></div>' +
          '<div class="vc-tabs" role="group" aria-label="기간"><button type="button" data-days="7">7일</button><button type="button" data-days="30">30일</button><button type="button" data-days="90">90일</button></div>' +
          '<div class="vc-body" id="vcBody"></div>' +
        '</div></div>');
    modal = document.getElementById("vcModal");
    body = document.getElementById("vcBody");
    modal.addEventListener("click", function (e) {
      if (e.target.closest("[data-vclose]")) { close(); return; }
      var b = e.target.closest("[data-days]");
      if (b) load(+b.getAttribute("data-days"));
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && isOpen) close(); });
  }
  function hideDom() { if (!isOpen) return; isOpen = false; modal.hidden = true; document.documentElement.classList.remove("pop-open"); }
  function close() { if (!isOpen) return; if (!(window.ModalNav && window.ModalNav.close())) hideDom(); }
  function openModal(days) {
    build();
    if (!isOpen) {
      modal.hidden = false; isOpen = true;
      document.documentElement.classList.add("pop-open");
      if (window.ModalNav) window.ModalNav.open(hideDom);
    }
    load(days || 30);
  }
  function load(days) {
    modal.querySelectorAll("[data-days]").forEach(function (b) { b.classList.toggle("on", +b.getAttribute("data-days") === days); });
    body.innerHTML = '<p class="qt-loading">불러오는 중…</p>';
    stats(days).then(function (st) { render(st); paintFooter(st); })
      .catch(function (e) { body.innerHTML = '<p class="vc-err">불러오지 못했습니다(' + esc(e.message) + '). 잠시 뒤 다시 열어 주세요.</p>'; });
  }

  function chart(daily, today) {
    var W = 640, H = 180, PL = 34, PR = 8, PT = 16, PB = 24, n = daily.length || 1;
    var max = Math.max.apply(null, daily.map(function (d) { return d.visitors; }).concat([1]));
    var step = (W - PL - PR) / n, bw = Math.max(2, Math.min(28, step * 0.72));
    var every = n <= 7 ? 1 : n <= 31 ? 5 : 15;
    var out = '<line x1="' + PL + '" y1="' + (H - PB) + '" x2="' + (W - PR) + '" y2="' + (H - PB) + '" class="vc-axis"/>' +
      '<text x="' + (PL - 6) + '" y="' + (PT + 4) + '" text-anchor="end" class="vc-t">' + max + '</text>' +
      '<text x="' + (PL - 6) + '" y="' + (H - PB) + '" text-anchor="end" class="vc-t">0</text>';
    daily.forEach(function (d, i) {
      var h = (d.visitors / max) * (H - PT - PB), x = PL + i * step + (step - bw) / 2;
      if (d.visitors) out += '<rect x="' + x.toFixed(1) + '" y="' + (H - PB - h).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(h, 1.5).toFixed(1) + '" rx="2" class="vc-b' + (d.day === today ? ' vc-b-today' : '') + '"><title>' + esc(d.day) + ' · 방문자 ' + d.visitors + '명 · 조회 ' + d.views + '번</title></rect>';
      if (n <= 14 && d.visitors) out += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - PB - h - 4).toFixed(1) + '" text-anchor="middle" class="vc-v">' + d.visitors + '</text>';
      if (i % every === 0 || i === n - 1) out += '<text x="' + (PL + i * step + step / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" class="vc-t">' + (+String(d.day).slice(5, 7)) + '/' + (+String(d.day).slice(8, 10)) + '</text>';
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="vc-chart" role="img" aria-label="날짜별 방문자 수">' + out + '</svg>';
  }
  function barRows(list, label, val, names) {
    if (!list || !list.length) return '<p class="vc-none">아직 기록이 없습니다.</p>';
    var max = Math.max.apply(null, list.map(function (x) { return x[val]; }).concat([1]));
    var total = list.reduce(function (a, x) { return a + (x[val] || 0); }, 0) || 1;
    return list.map(function (x) {
      var nm = (names && names[x[label]]) || x[label];
      return '<div class="vc-row"><span class="vc-l">' + esc(nm) + '</span><span class="vc-bar"><i style="width:' + Math.round((x[val] / max) * 100) + '%"></i></span><span class="vc-n">' + fmt(x[val]) + ' <small>' + Math.round((x[val] / total) * 100) + '%</small></span></div>';
    }).join("");
  }
  function render(st) {
    var c = st.counter || {}, daily = st.daily || [];
    var sumV = daily.reduce(function (a, d) { return a + d.visitors; }, 0), sumP = daily.reduce(function (a, d) { return a + d.views; }, 0);
    var m = st.members || {};
    var since = c.since ? String(c.since).replace(/-/g, ".") : "";
    body.innerHTML =
      '<div class="vc-cards">' +
        '<div class="vc-card vc-card-main"><span>오늘</span><b>' + fmt(c.today) + '명</b><small>화면 ' + fmt(c.today_views) + '번</small></div>' +
        '<div class="vc-card"><span>어제</span><b>' + fmt(c.yesterday) + '명</b></div>' +
        '<div class="vc-card"><span>이번 달</span><b>' + fmt(c.month) + '명</b></div>' +
        '<div class="vc-card"><span>누적</span><b>' + fmt(c.total) + '명</b>' + (since ? '<small>' + esc(since) + '부터</small>' : '') + '</div>' +
      '</div>' +
      '<h4 class="vc-h">날짜별 방문자 <small>최근 ' + st.days + '일 · 모두 ' + fmt(sumV) + '명 · 하루 평균 ' + fmt(Math.round(sumV / (daily.length || 1))) + '명 · 화면 ' + fmt(sumP) + '번</small></h4>' +
      chart(daily, st.today) +
      '<div class="vc-grid">' +
        '<section><h4 class="vc-h">많이 본 화면 <small>조회</small></h4>' + barRows(st.pages, "page", "views", PAGE_NAMES) + '</section>' +
        '<section><h4 class="vc-h">들어온 곳 <small>그날 처음 들어온 길</small></h4>' + barRows(st.sources, "src", "visitors") + '</section>' +
        '<section><h4 class="vc-h">기기</h4>' + barRows(st.devices, "device", "visitors") + '</section>' +
        '<section><h4 class="vc-h">로그인</h4>' + barRows([{ k: "로그인한 회원", v: m.member || 0 }, { k: "손님(로그인 안 함)", v: m.guest || 0 }], "k", "v") + '</section>' +
      '</div>' +
      '<p class="vc-note">방문자는 그날 서로 다른 휴대폰·컴퓨터의 수입니다(같은 분이 휴대폰과 컴퓨터로 오시면 2명). 이름·IP 등 개인을 알아볼 수 있는 정보는 남기지 않으며, 목사님(관리자)과 검색 로봇의 방문은 세지 않습니다.</p>';
  }

  // 시작: 최고 운영자인지 확인 → 맞으면 푸터에 숫자
  stats(1).then(paintFooter).catch(function (e) {
    // 운영자가 아니라는 답(400·403)이면 이 창에서는 다시 묻지 않는다. 열쇠가 낡았거나(401) 인터넷이 잠깐 끊긴 것은 다음 화면에서 다시
    if (e && (e.status === 400 || e.status === 403)) { try { sessionStorage.setItem("nojin_vc_owner", "0"); } catch (x) {} }
  });
  window.VisitStats = { open: openModal };
})();

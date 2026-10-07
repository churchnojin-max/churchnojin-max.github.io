/* ============================================================
   악보집 — 새찬송가·「모두의 찬양」 악보 (2026-10-07)
   목사님 말씀: "악보집을 들고 다닐 수가 없으니 홈페이지에서 나만 볼 수 있게, 필요하면 바로바로 열어서."
   - 누가 볼 수 있나: can_score() 가 참인 분 — 최고 운영자와 '악보' 권한을 받은 분(교적관리 ▸ 권한 관리 ▸ 악보, 반주자 등).
     들어오는 길은 대시보드의 '악보집' 단추(권한 있는 분께만 보임, js/dashboard.js).
     권한이 없는 분이 주소로 들어오면 아무 말 없이 첫 화면으로 보낸다(이런 화면이 있다는 것도 모르게).
     악보 그림은 비공개 보관함 hymns 에 있어 주소를 알아도 열리지 않고, 한 시간짜리 서명 주소로만 받는다.
   - 찾기: 번호(예: 305), 제목 낱말(띄어쓰기 무시), 첫소리(예: ㄴㅇㄱ → 나 같은 죄인…).
   - 크게 보기: 화면 가득. 옆으로 밀면 앞·뒤 곡, 두 번 톡 치거나 두 손가락으로 벌리면 크게, ‹ › 단추, 컴퓨터는 ← → 키.
   - ★ 즐겨찾기와 최근 본 곡은 이 기기에만 남는다(localStorage nojin_sc_fav · nojin_sc_recent — 번호만).
   ============================================================ */
(function () {
  "use strict";
  var body = document.getElementById("scBody");
  if (!body) return;

  var esc = function (t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]; }); };
  var pad3 = function (n) { return ("00" + n).slice(-3); };

  // ── 곡 목록 ──
  var BOOKS = {
    hymn: { name: "새찬송가", unit: "장", list: (window.HYMNS || []).map(function (h) { return { no: h.no, title: h.title, sub: "", key: "" }; }), path: function (n) { return pad3(n) + ".webp"; } },
    ccm:  { name: "모두의 찬양", unit: "번", list: (window.PRAISE || []).map(function (p) { return { no: p[0], title: p[1], sub: p[3] || "", key: p[2] || "" }; }), path: function (n) { return "ccm/" + pad3(n) + ".webp"; } }
  };
  ["hymn", "ccm"].forEach(function (b) { BOOKS[b].list.forEach(function (s) { s.book = b; s.id = b + ":" + s.no; }); BOOKS[b].max = BOOKS[b].list.length; });
  var byId = {};
  ["hymn", "ccm"].forEach(function (b) { BOOKS[b].list.forEach(function (s) { byId[s.id] = s; }); });

  // 첫소리(초성)
  var CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
  function cho(str) {
    var out = "";
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xAC00 && c <= 0xD7A3) out += CHO[Math.floor((c - 0xAC00) / 588)];
      else out += str[i];
    }
    return out;
  }
  var norm = function (s) { return String(s || "").replace(/[\s·,.!?~'"’‘“”()\-]/g, "").toLowerCase(); };
  ["hymn", "ccm"].forEach(function (b) {
    BOOKS[b].list.forEach(function (s) { s.n = norm(s.title + s.sub); s.c = cho(s.n); });
  });

  // ── 이 기기에 남기는 것(번호만) ──
  function load(k) { try { var v = JSON.parse(localStorage.getItem(k) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function keep(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var fav = load("nojin_sc_fav").filter(function (id) { return byId[id]; });
  var recent = load("nojin_sc_recent").filter(function (id) { return byId[id]; });
  function toggleFav(id) {
    var i = fav.indexOf(id);
    if (i >= 0) fav.splice(i, 1); else fav.unshift(id);
    keep("nojin_sc_fav", fav);
  }
  function addRecent(id) {
    recent = [id].concat(recent.filter(function (x) { return x !== id; })).slice(0, 12);
    keep("nojin_sc_recent", recent);
  }

  // ── 권한 확인 ──
  var sb = null, ready = false;
  function deny(text, login) {
    body.innerHTML = '<div class="sc-deny"><p>' + esc(text) + '</p>' + (login ? '<button type="button" class="sc-btn" id="scLogin">로그인하기</button>' : '') + '</div>';
    var b = document.getElementById("scLogin");
    if (b) b.onclick = function () { var l = document.getElementById("loginBtn"); if (l) l.click(); };
  }
  function check() {
    if (!sb) return;
    sb.auth.getSession().then(function (r) {
      if (!(r && r.data && r.data.session)) { ready = false; deny("로그인해 주세요.", true); return; }
      return sb.rpc("can_score").then(function (res) {
        if (res && res.data === true) { if (!ready) { ready = true; start(); } }
        else { ready = false; location.replace("index.html"); }
      });
    }).catch(function () { deny("확인하지 못했습니다. 잠시 뒤 새로고침해 주세요.", false); });
  }
  function init(client) {
    if (sb) return;
    sb = client;
    check();
    try { sb.auth.onAuthStateChange(function (ev) { if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") check(); }); } catch (e) {}
  }
  if (window.__sb) init(window.__sb);
  window.addEventListener("sb-ready", function (e) { init((e.detail && e.detail.sb) || window.__sb); });
  setTimeout(function () { if (!sb) deny("로그인 기능을 불러오지 못했습니다. 새로고침해 주세요.", false); }, 8000);

  // ── 목록 화면 ──
  var tab = "hymn", query = "";
  try { var t0 = sessionStorage.getItem("nojin_sc_tab"); if (t0 === "ccm" || t0 === "hymn" || t0 === "fav") tab = t0; } catch (e) {}

  function start() {
    body.innerHTML =
      '<div class="sc-tabs" role="tablist">' +
        '<button type="button" data-tab="hymn">새찬송가 <small>645</small></button>' +
        '<button type="button" data-tab="ccm">모두의 찬양 <small>684</small></button>' +
        '<button type="button" data-tab="fav">★ 즐겨찾기</button>' +
      '</div>' +
      '<div class="sc-search"><input type="search" id="scQ" autocomplete="off" enterkeyhint="go" placeholder="번호, 제목, 첫소리(ㄴㅇㄱ)로 찾기" aria-label="악보 찾기" />' +
        '<button type="button" class="sc-clear" id="scClear" aria-label="지우기" hidden>×</button></div>' +
      '<div id="scRecent"></div>' +
      '<ul class="sc-list" id="scList"></ul>';
    var q = document.getElementById("scQ"), clr = document.getElementById("scClear");
    q.addEventListener("input", function () { query = q.value; clr.hidden = !query; paint(); });
    q.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { var first = document.querySelector("#scList li[data-id]"); if (first) { q.blur(); openSong(first.getAttribute("data-id")); } }
    });
    clr.onclick = function () { q.value = ""; query = ""; clr.hidden = true; paint(); q.focus(); };
    body.querySelector(".sc-tabs").addEventListener("click", function (e) {
      var b = e.target.closest("[data-tab]"); if (!b) return;
      tab = b.getAttribute("data-tab");
      try { sessionStorage.setItem("nojin_sc_tab", tab); } catch (x) {}
      paint();
    });
    body.addEventListener("click", function (e) {
      var st = e.target.closest(".sc-star");
      if (st) { e.stopPropagation(); toggleFav(st.getAttribute("data-id")); paint(); return; }
      var li = e.target.closest("[data-id]");
      if (li) openSong(li.getAttribute("data-id"));
    });
    paint();
  }

  function search(list, qv) {
    var raw = qv.trim();
    if (!raw) return list;
    var num = raw.replace(/[^0-9]/g, "");
    if (/^\s*\d+\s*(장|번)?\s*$/.test(raw)) {
      var exact = list.filter(function (s) { return String(s.no) === String(+num); });
      var starts = list.filter(function (s) { return String(s.no).indexOf(num) === 0 && String(s.no) !== String(+num); });
      return exact.concat(starts).slice(0, 60);
    }
    var nq = norm(raw);
    if (!nq) return list;
    var onlyCho = /^[ㄱ-ㅎ]+$/.test(nq);
    var a = [], b = [];
    list.forEach(function (s) {
      var hay = onlyCho ? s.c : s.n;
      var i = hay.indexOf(nq);
      if (i === 0) a.push(s); else if (i > 0) b.push(s);
    });
    return a.concat(b);
  }
  function row(s, showBook) {
    var on = fav.indexOf(s.id) >= 0;
    return '<li data-id="' + s.id + '">' +
      '<span class="sc-no">' + s.no + '<small>' + BOOKS[s.book].unit + '</small></span>' +
      '<span class="sc-t"><b>' + esc(s.title) + '</b>' +
        (s.sub || s.key || showBook ? '<small>' + [showBook ? BOOKS[s.book].name : "", s.sub, s.key ? s.key + "조" : ""].filter(Boolean).map(esc).join(" · ") + '</small>' : '') +
      '</span>' +
      '<button type="button" class="sc-star' + (on ? ' is-on' : '') + '" data-id="' + s.id + '" aria-label="즐겨찾기' + (on ? ' 빼기' : '') + '">' + (on ? '★' : '☆') + '</button></li>';
  }
  function paint() {
    body.querySelectorAll(".sc-tabs [data-tab]").forEach(function (b) { b.classList.toggle("is-on", b.getAttribute("data-tab") === tab); });
    var list, showBook = false;
    if (tab === "fav") { list = fav.map(function (id) { return byId[id]; }).filter(Boolean); showBook = true; }
    else list = BOOKS[tab].list;
    if (query.trim() && tab === "fav") list = search(list, query);
    else if (query.trim()) list = search(list, query);
    var ul = document.getElementById("scList");
    if (!list.length) {
      ul.innerHTML = '<li class="sc-none">' + (tab === "fav" && !query.trim() ? '아직 즐겨찾기가 없습니다. 곡 옆의 ☆ 를 누르면 여기에 모입니다.' : '찾는 곡이 없습니다.') + '</li>';
    } else {
      var cap = query.trim() ? 120 : list.length;
      ul.innerHTML = list.slice(0, cap).map(function (s) { return row(s, showBook); }).join("");
    }
    // 최근 본 곡(찾는 글이 없을 때만)
    var rc = document.getElementById("scRecent");
    var rl = recent.map(function (id) { return byId[id]; }).filter(function (s) { return s && (tab === "fav" || s.book === tab); }).slice(0, 8);
    rc.innerHTML = !query.trim() && rl.length
      ? '<div class="sc-recent"><span>최근 본 곡</span>' + rl.map(function (s) { return '<button type="button" data-id="' + s.id + '">' + s.no + ' ' + esc(s.title) + '</button>'; }).join("") + '</div>'
      : "";
  }

  // ── 악보 주소(한 시간짜리 서명 주소, 50분 동안 다시 쓰기) ──
  var urls = {};
  function urlsFor(ids) {
    var need = ids.filter(function (id) { var h = urls[id]; return !(h && h.until > Date.now()); });
    if (!need.length) return Promise.resolve();
    var paths = need.map(function (id) { var s = byId[id]; return BOOKS[s.book].path(s.no); });
    return sb.storage.from("hymns").createSignedUrls(paths, 3600).then(function (res) {
      if (res.error) throw res.error;
      (res.data || []).forEach(function (d, i) {
        if (d && d.signedUrl) urls[need[i]] = { url: d.signedUrl, until: Date.now() + 50 * 60 * 1000 };
      });
    });
  }
  function neighbor(id, step) {
    var s = byId[id]; if (!s) return null;
    var n = s.no + step;
    if (n < 1 || n > BOOKS[s.book].max) return null;
    return s.book + ":" + n;
  }

  // ── 크게 보기 ──
  var view = null, cur = null, zoom = 1;
  function buildView() {
    if (view) return;
    view = document.createElement("div");
    view.className = "sc-view";
    view.hidden = true;
    view.setAttribute("role", "dialog");
    view.setAttribute("aria-modal", "true");
    view.innerHTML =
      '<div class="sv-top"><button type="button" class="sv-x" data-act="close" aria-label="닫기">‹ 목록</button>' +
        '<div class="sv-title" id="svTitle"></div>' +
        '<button type="button" class="sv-fav" data-act="fav" aria-label="즐겨찾기">☆</button></div>' +
      '<div class="sv-stage" id="svStage"><img class="sv-img" id="svImg" alt="" draggable="false" /><p class="sv-msg" id="svMsg"></p></div>' +
      '<div class="sv-bot">' +
        '<button type="button" data-act="prev" aria-label="앞 곡">‹</button>' +
        '<button type="button" data-act="zout" aria-label="작게">−</button>' +
        '<span class="sv-no" id="svNo"></span>' +
        '<button type="button" data-act="zin" aria-label="크게">+</button>' +
        '<button type="button" data-act="next" aria-label="다음 곡">›</button></div>';
    document.body.appendChild(view);
    view.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return;
      var a = b.getAttribute("data-act");
      if (a === "close") closeView();
      else if (a === "prev") step(-1);
      else if (a === "next") step(1);
      else if (a === "zin") setZoom(zoom * 1.35);
      else if (a === "zout") setZoom(zoom / 1.35);
      else if (a === "fav") { toggleFav(cur); paintFav(); paint(); }
    });
    document.addEventListener("keydown", function (e) {
      if (view.hidden) return;
      if (e.key === "Escape") closeView();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "+" || e.key === "=") setZoom(zoom * 1.35);
      else if (e.key === "-") setZoom(zoom / 1.35);
    });
    touchControls(document.getElementById("svStage"));
    window.addEventListener("popstate", function () { if (!view.hidden) closeView(true); });
  }
  function paintFav() {
    var b = view.querySelector(".sv-fav"), on = fav.indexOf(cur) >= 0;
    b.textContent = on ? "★" : "☆";
    b.classList.toggle("is-on", on);
  }
  function setZoom(z) {
    var stage = document.getElementById("svStage"), img = document.getElementById("svImg");
    var old = zoom;
    zoom = Math.max(1, Math.min(4, z));
    // 가운데를 기준으로 크게·작게
    var cx = stage.scrollLeft + stage.clientWidth / 2, cy = stage.scrollTop + stage.clientHeight / 2;
    img.style.width = zoom > 1.01 ? (zoom * 100) + "%" : "";
    stage.classList.toggle("is-zoom", zoom > 1.01);
    stage.scrollLeft = cx * (zoom / old) - stage.clientWidth / 2;
    stage.scrollTop = cy * (zoom / old) - stage.clientHeight / 2;
  }
  function openSong(id) {
    if (!byId[id] || !ready) return;
    buildView();
    var wasHidden = view.hidden;
    cur = id;
    addRecent(id);
    var s = byId[id];
    document.getElementById("svTitle").innerHTML = '<b>' + esc(s.title) + '</b><small>' + esc(BOOKS[s.book].name + " " + s.no + BOOKS[s.book].unit + (s.key ? " · " + s.key + "조" : "")) + '</small>';
    document.getElementById("svNo").textContent = s.no + " / " + BOOKS[s.book].max;
    paintFav();
    var img = document.getElementById("svImg"), msg = document.getElementById("svMsg");
    img.removeAttribute("src");
    img.style.visibility = "hidden";
    msg.textContent = "악보를 불러오는 중…";
    zoom = 1; img.style.width = "";
    var stage = document.getElementById("svStage");
    stage.classList.remove("is-zoom"); stage.scrollTop = 0; stage.scrollLeft = 0;
    if (wasHidden) {
      view.hidden = false;
      document.documentElement.classList.add("sc-lock");
      try { history.pushState({ sc: 1 }, ""); } catch (e) {}
    }
    var want = id;
    var around = [id, neighbor(id, 1), neighbor(id, -1)].filter(Boolean);
    urlsFor(around).then(function () {
      if (cur !== want) return;
      var h = urls[id];
      if (!h) { msg.textContent = "악보를 찾지 못했습니다."; return; }
      img.onload = function () { if (cur === want) { img.style.visibility = ""; msg.textContent = ""; } };
      img.onerror = function () { if (cur === want) msg.textContent = "악보를 불러오지 못했습니다. 다시 눌러 주세요."; };
      img.alt = s.title + " 악보";
      img.src = h.url;
      // 앞뒤 곡을 미리 받아 둔다
      around.slice(1).forEach(function (n) { if (urls[n]) { var p = new Image(); p.src = urls[n].url; } });
    }).catch(function () { if (cur === want) msg.textContent = "악보를 불러오지 못했습니다. 로그인이 풀렸다면 다시 로그인해 주세요."; });
    if (!wasHidden) return;
    paint();
  }
  function step(d) { var n = cur && neighbor(cur, d); if (n) openSong(n); }
  function closeView(fromPop) {
    if (!view || view.hidden) return;
    view.hidden = true;
    document.documentElement.classList.remove("sc-lock");
    if (!fromPop) { try { if (history.state && history.state.sc) history.back(); } catch (e) {} }
    paint();
  }

  // 손가락: 옆으로 밀기(크게 보고 있지 않을 때) · 두 번 톡 · 두 손가락 벌리기
  function touchControls(stage) {
    var sx = 0, sy = 0, st = 0, moved = false, lastTap = 0, pinch = null;
    stage.addEventListener("touchstart", function (e) {
      if (e.touches.length === 2) {
        var a = e.touches[0], b = e.touches[1];
        pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: zoom };
        return;
      }
      var t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); moved = false;
    }, { passive: true });
    stage.addEventListener("touchmove", function (e) {
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        var a = e.touches[0], b = e.touches[1];
        setZoom(pinch.z * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.d);
        return;
      }
      var t = e.touches[0];
      if (Math.abs(t.clientX - sx) > 10 || Math.abs(t.clientY - sy) > 10) moved = true;
    }, { passive: false });
    stage.addEventListener("touchend", function (e) {
      if (pinch) { if (e.touches.length < 2) pinch = null; return; }
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (zoom <= 1.01 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4 && Date.now() - st < 700) { step(dx < 0 ? 1 : -1); return; }
      if (!moved) {
        var now = Date.now();
        if (now - lastTap < 320) { setZoom(zoom > 1.01 ? 1 : 2); lastTap = 0; } else lastTap = now;
      }
    });
    stage.addEventListener("dblclick", function () { setZoom(zoom > 1.01 ? 1 : 2); });
  }
})();

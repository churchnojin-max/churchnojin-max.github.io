/* 위임식 준비 점검판 (tf.html) — 2026-10-20, 10-21 고침
 * 할 일: data/tf-tasks.json (D:\클코저장소\위임식_20261031\단톡방\점검판_자료_만들기.py 로 만듦)
 * 상태·건의: Supabase tf_checks / tf_suggestions (supabase/tf_checks_20261020.sql). 표가 없거나 내 PC 미리보기면 이 기기(localStorage)에만 저장.
 * 보는 범위: rpc tf_me() → see_all(담임목사·문명수 장로)은 전체, 나머지는 팀 제목에 자기 이름이 든 팀만.
 */
(function () {
  "use strict";
  var PREVIEW = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.protocol === "file:";
  var LS_KEY = "tf-checks-20261031", LS_SUG = "tf-sug-20261031";
  var EVENT = new Date(2026, 9, 31);
  var allGroups = [], groups = [], tasks = [], state = {}, sugs = [], useLocal = PREVIEW;
  var me = { name: "", see_all: false };
  var teamFilter = null, simple = false;

  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]; }); }

  // ---------- Supabase ----------
  function session() {
    try {
      var ref = new URL(window.SUPABASE_URL).hostname.split(".")[0];
      var raw = sessionStorage.getItem("sb-" + ref + "-auth-token");
      if (!raw) return null;
      var s0 = JSON.parse(raw);
      return s0 && s0.currentSession ? s0.currentSession : s0;
    } catch (e) { return null; }
  }
  function api(method, path, body, prefer) {
    var sess = session();
    var headers = { apikey: window.SUPABASE_ANON_KEY, "Content-Type": "application/json" };
    if (sess && sess.access_token) headers.Authorization = "Bearer " + sess.access_token;
    if (prefer) headers.Prefer = prefer;
    return fetch(window.SUPABASE_URL + "/rest/v1/" + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined })
      .then(function (res) {
        if (!res.ok) return res.text().then(function (t) { var e = new Error(t || res.status); e.status = res.status; throw e; });
        return res.status === 204 ? null : res.json().catch(function () { return null; });
      });
  }

  // ---------- 날짜 ----------
  function today() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function parseDate(s) { if (!s) return null; var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function isLate(t) { var d = parseDate(t.date); return d && d < today() && (state[t.code] || {}).status !== "done"; }
  function fmtTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  // ---------- 보는 범위 ----------
  function myGroups() {
    if (me.see_all || !me.name) return allGroups.slice();
    var key = me.name.replace(/\s+/g, "").replace(/(권사|집사|장로|목사|전도사)$/, "");
    return allGroups.filter(function (g) { return g.title.replace(/\s+/g, "").indexOf(key) >= 0; });
  }
  function applyScope() {
    groups = myGroups();
    tasks = []; groups.forEach(function (g) { g.items.forEach(function (t) { tasks.push(t); }); });
    teamFilter = null;
    setMode(!me.see_all);               // 팀원은 쉽게 보기, 전체 보는 분은 자세히 보기(단추로 바꿀 수 있음)
    renderHello();
    // 건의 사항 팀 고르기
    var sel = $("tfSugTeam");
    sel.innerHTML = '<option value="">어느 팀 이야기인지 (선택)</option>' + allGroups.map(function (g) { return '<option value="' + esc(g.role) + '">' + esc(g.role) + " — " + esc(g.title) + "</option>"; }).join("");
  }

  function setMode(on) {
    simple = on;
    document.body.classList.toggle("tf-simple", on);
    var b = $("tfModeBtn"); b.hidden = false; b.textContent = on ? "자세히 보기" : "쉽게 보기";
    $("tfHowto").hidden = !on;
    if (on) { $("tfView").value = "due"; $("tfState").value = "all"; $("tfLateOnly").checked = false; teamFilter = null; }
  }
  function renderHello() {
    var h = $("tfHello"), c = counts(tasks), nm = esc(me.name);
    if (me.see_all) h.innerHTML = "<b>" + nm + "</b>님 — 모든 팀의 점검 상황을 보고 있습니다. 끝난 일 " + c.done + " / " + c.all + (c.late ? ', <span style="color:#c0392b">마감 지난 일 ' + c.late + "</span>" : "") + ".";
    else if (groups.length) h.innerHTML = "<b>" + nm + "</b>님, 안녕하세요.<br>맡으신 일 <b>" + c.all + "개</b> 가운데 <b>" + c.done + "개</b>를 끝내셨어요." + (c.all - c.done ? " 남은 일 " + (c.all - c.done) + "개예요." : " 모두 끝내셨어요. 감사합니다!");
    else h.innerHTML = "<b>" + nm + "</b>님 이름이 붙은 일이 아직 없습니다. 목사님께 말씀해 주세요.";
  }

  // ---------- 저장 ----------
  function loadLocal(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function saveLocal(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function flash(text) { var el = $("tfSave"); el.textContent = text || "저장했습니다"; el.classList.add("show"); setTimeout(function () { el.classList.remove("show"); }, 1400); }

  function save(code, patch) {
    var cur = state[code] || { status: "todo", note: "" };
    var next = Object.assign({}, cur, patch, { updated_name: me.name, updated_at: new Date().toISOString() });
    if (patch.status === "done" && cur.status !== "done") next.done_at = next.updated_at;
    if (patch.status && patch.status !== "done") next.done_at = null;
    state[code] = next;
    render();
    if (useLocal) { saveLocal(LS_KEY, state); flash(PREVIEW ? "이 기기에 저장(미리보기)" : "이 기기에 저장"); return; }
    api("POST", "tf_checks?on_conflict=code",
      { code: code, status: next.status, note: next.note || null, done_at: next.done_at || null, updated_name: me.name, updated_at: next.updated_at },
      "resolution=merge-duplicates,return=minimal")
      .then(function () { flash(); })
      .catch(function (e) { flash("저장 실패 — 다시 눌러 주세요"); console.warn(e); });
  }
  function sendSuggestion() {
    var body = $("tfSugText").value.trim(); if (!body) { $("tfSugText").focus(); return; }
    var row = { by_name: me.name, team: $("tfSugTeam").value || null, body: body, created_at: new Date().toISOString() };
    $("tfSugText").value = "";
    if (useLocal) { sugs.unshift(row); saveLocal(LS_SUG, sugs); renderSugs(); flash("이 기기에 저장(미리보기)"); return; }
    api("POST", "tf_suggestions", { by_name: row.by_name, team: row.team, body: row.body }, "return=representation")
      .then(function (r) { sugs.unshift((r && r[0]) || row); renderSugs(); flash("보냈습니다"); })
      .catch(function (e) { flash("보내지 못했습니다 — 다시 눌러 주세요"); console.warn(e); });
  }

  // ---------- 그리기 ----------
  function counts(list) {
    var c = { all: list.length, done: 0, doing: 0, late: 0 };
    list.forEach(function (t) { var s = (state[t.code] || {}).status; if (s === "done") c.done++; else if (s === "doing") c.doing++; if (isLate(t)) c.late++; });
    return c;
  }
  function renderSummary() {
    var c = counts(tasks);
    var days = Math.round((EVENT - today()) / 86400000);
    $("tfDday").textContent = days > 0 ? "D-" + days : days === 0 ? "오늘" : "끝남";
    $("tfDone").textContent = c.done + " / " + c.all;
    $("tfBarAll").style.width = (c.all ? Math.round(c.done / c.all * 100) : 0) + "%";
    $("tfLate").textContent = c.late;
    $("tfDoing").textContent = c.doing;
    $("tfTeams").innerHTML = groups.map(function (g, k) {
      var cc = counts(g.items);
      return '<button type="button" class="tf-team' + (teamFilter === k ? " on" : "") + '" data-team="' + k + '"><b>' + esc(g.title) + "</b>" +
        "<span>" + esc(g.role) + "</span><div class=\"tf-bar\"><i style=\"width:" + (cc.all ? Math.round(cc.done / cc.all * 100) : 0) + '%"></i></div>' +
        "<span>" + cc.done + " / " + cc.all + " 끝남</span>" + (cc.late ? "<em>마감 지남 " + cc.late + "</em>" : "") + "</button>";
    }).join("");
    $("tfAllTeams").hidden = teamFilter === null;
    $("tfTeams").hidden = groups.length < 2;
  }
  function itemHtml(t) {
    var st = state[t.code] || { status: "todo", note: "" };
    var late = isLate(t);
    var who = st.updated_at ? (esc(st.updated_name || "") + " · " + fmtTime(st.updated_at) + (st.status === "done" ? " 끝냄" : st.status === "doing" ? " 하는 중" : "")) : "";
    return '<div class="tf-item' + (st.status === "done" ? " done" : "") + (late ? " late" : "") + '" data-code="' + esc(t.code) + '">' +
      '<div class="tf-code">' + esc(t.code) + "</div>" +
      '<div class="tx">' + esc(t.text) + "</div>" +
      '<div class="tf-meta"><span class="due' + (late ? " late" : "") + '">마감 ' + esc(t.due) + (late ? " · 지남" : "") + "</span><span>" + esc(t.who) + "</span></div>" +
      '<div class="tf-st">' +
      ["todo", "doing", "done"].map(function (s) {
        var label = simple ? { todo: "아직 안 했어요", doing: "하는 중", done: "끝냈어요 ✓" }[s] : { todo: "안 함", doing: "하는 중", done: "끝남 ✓" }[s];
        return '<button type="button" data-s="' + s + '" class="' + (st.status === s ? "on" : "") + '">' + label + "</button>";
      }).join("") + "</div>" +
      '<div class="tf-memo"><input type="text" placeholder="' + (simple ? "메모 (안 적어도 돼요)" : "메모 (예: 90명 예약, 선결제)") + '" value="' + esc(st.note || "") + '" /></div>' +
      (who ? '<div class="tf-who">' + who + "</div>" : "") + "</div>";
  }
  function visible(t) {
    var s = (state[t.code] || {}).status || "todo";
    var f = $("tfState").value;
    if (f === "open" && s === "done") return false;
    if (f === "done" && s !== "done") return false;
    if ($("tfLateOnly").checked && !isLate(t)) return false;
    if (teamFilter !== null && groups[teamFilter].items.indexOf(t) < 0) return false;
    return true;
  }
  function renderSimple() {
    var open = [], done = [];
    tasks.forEach(function (t) { ((state[t.code] || {}).status === "done" ? done : open).push(t); });
    var key = function (t) { return (t.date || "9999") + t.code; };
    open.sort(function (a, b) { return key(a) < key(b) ? -1 : 1; });
    var html = "", last = null;
    open.forEach(function (t) {
      var d = parseDate(t.date);
      var label = !d ? t.due : d < today() ? "마감이 지났어요 — 먼저 해 주세요" : (d.getMonth() + 1) + "월 " + d.getDate() + "일(" + "일월화수목금토"[d.getDay()] + ")까지";
      if (t.date === "2026-10-31") label = "10월 31일(토) 당일에 할 일";
      if (label !== last) { html += '<div class="tf-grp"><span>' + esc(label) + "</span></div>"; last = label; }
      html += itemHtml(t);
    });
    if (!open.length) html += '<div class="tf-empty">남은 일이 없어요. 수고하셨습니다!</div>';
    if (done.length) html += '<div class="tf-donehead">끝낸 일 ' + done.length + "개</div>" + done.map(itemHtml).join("");
    $("tfList").innerHTML = html;
  }
  function renderList() {
    if (simple) return renderSimple();
    var view = $("tfView").value, html = "";
    if (view === "team") {
      groups.forEach(function (g) {
        var items = g.items.filter(visible);
        if (!items.length) return;
        html += '<div class="tf-grp"><span>' + esc(g.title) + " — " + esc(g.role) + "</span><small>" + items.length + "개</small></div>";
        if (g.note) html += '<div class="tf-grp-note">※ ' + esc(g.note) + "</div>";
        html += items.map(itemHtml).join("");
      });
    } else {
      var buckets = {};
      tasks.filter(visible).forEach(function (t) { var k = t.date || "9999-" + t.due; (buckets[k] = buckets[k] || { label: t.due, date: t.date, items: [] }).items.push(t); });
      Object.keys(buckets).sort().forEach(function (k) {
        var b = buckets[k], label = b.date ? (function (d) { return (d.getMonth() + 1) + "/" + d.getDate() + "(" + "일월화수목금토"[d.getDay()] + ")"; })(parseDate(b.date)) : b.label;
        if (b.date === "2026-10-31") label = "10/31(토) 당일";
        html += '<div class="tf-grp"><span>' + esc(label) + "</span><small>" + b.items.length + "개</small></div>" + b.items.map(itemHtml).join("");
      });
    }
    $("tfList").innerHTML = html || '<div class="tf-empty">보여 줄 일이 없습니다.</div>';
  }
  function renderSugs() {
    $("tfSugCount").textContent = sugs.length ? "(" + sugs.length + ")" : "";
    $("tfSugList").innerHTML = sugs.length ? sugs.map(function (r) {
      return '<div class="tf-sug"><div class="m">' + esc(r.by_name || "") + (r.team ? " · " + esc(r.team) : "") + " · " + fmtTime(r.created_at) + "</div>" +
        '<div class="b">' + esc(r.body) + "</div>" + (r.reply ? '<div class="r">답: ' + esc(r.reply) + "</div>" : "") + "</div>";
    }).join("") : '<div class="tf-empty">아직 건의 사항이 없습니다.</div>';
  }
  function render() { renderSummary(); renderHello(); renderList(); }

  // ---------- 이벤트 ----------
  function bind() {
    ["tfView", "tfState", "tfLateOnly"].forEach(function (id) { $(id).addEventListener("change", renderList); });
    $("tfAllTeams").addEventListener("click", function () { teamFilter = null; render(); });
    $("tfTeams").addEventListener("click", function (e) {
      var b = e.target.closest(".tf-team"); if (!b) return;
      var k = +b.getAttribute("data-team"); teamFilter = teamFilter === k ? null : k; render();
    });
    $("tfList").addEventListener("click", function (e) {
      var b = e.target.closest(".tf-st button"); if (!b) return;
      save(b.closest(".tf-item").getAttribute("data-code"), { status: b.getAttribute("data-s") });
    });
    $("tfList").addEventListener("change", function (e) {
      if (e.target.tagName !== "INPUT") return;
      save(e.target.closest(".tf-item").getAttribute("data-code"), { note: e.target.value.trim() });
    });
    $("tfSugSend").addEventListener("click", sendSuggestion);
    $("tfModeBtn").addEventListener("click", function () { setMode(!simple); render(); });
    document.querySelectorAll(".tf-tabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll(".tf-tabs button").forEach(function (x) { x.classList.toggle("on", x === b); });
        var tab = b.getAttribute("data-tab");
        $("tabList").hidden = tab !== "list"; $("tabGuide").hidden = tab !== "guide"; $("tabSug").hidden = tab !== "sug";
      });
    });
    $("tfViewer").addEventListener("change", function () {
      var v = this.value;
      if (v === "*") me = { name: "손병민 목사", see_all: true };
      else if (v === "문명수") me = { name: "문명수 장로", see_all: true };
      else me = { name: v, see_all: false };
      applyScope(); render();
    });
  }

  // ---------- 시작 ----------
  function loadTasks() {
    return fetch("data/tf-tasks.json?v=" + Date.now()).then(function (r) { return r.json(); }).then(function (d) { allGroups = d.groups || []; });
  }
  function loadState() {
    if (useLocal) { state = loadLocal(LS_KEY) || {}; sugs = loadLocal(LS_SUG) || []; return Promise.resolve(); }
    return Promise.all([
      api("GET", "tf_checks?select=code,status,note,done_at,updated_name,updated_at"),
      api("GET", "tf_suggestions?select=id,by_name,team,body,reply,created_at&order=created_at.desc")
    ]).then(function (r) {
      state = {}; (r[0] || []).forEach(function (x) { state[x.code] = x; });
      sugs = r[1] || [];
    }).catch(function (e) {
      useLocal = true; state = loadLocal(LS_KEY) || {}; sugs = loadLocal(LS_SUG) || [];
      var n = $("tfNote"); n.hidden = false;
      n.textContent = "저장소 표가 아직 없어 이 기기에만 저장됩니다. supabase/tf_checks_20261020.sql 을 실행하면 여러 사람이 함께 봅니다.";
      console.warn(e);
    });
  }
  function fillViewer() {
    var names = {};
    allGroups.forEach(function (g) { g.title.split("·").forEach(function (n) { n = n.trim(); if (n) names[n] = 1; }); });
    var sel = $("tfViewer");
    sel.innerHTML = '<option value="*">손병민 목사 (전체)</option><option value="문명수">문명수 장로 (전체)</option>' +
      Object.keys(names).filter(function (n) { return n.indexOf("손병민") < 0 && n.indexOf("문명수") < 0; }).map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + "</option>"; }).join("");
    $("tfViewerBox").hidden = false;
  }
  function start() {
    $("tfLoading").hidden = true; $("tfBody").hidden = false;
    bind();
    loadTasks().then(loadState).then(function () {
      if (PREVIEW) { fillViewer(); me = { name: "손병민 목사", see_all: true }; }
      applyScope(); render(); renderSugs();
    }).catch(function (e) { $("tfList").innerHTML = '<div class="tf-empty">할 일 목록을 불러오지 못했습니다.</div>'; console.warn(e); });
  }
  function lock(title, msg, showLogin) {
    $("tfLoading").hidden = true; $("tfLock").hidden = false; $("tfLockTitle").textContent = title; $("tfLockMsg").textContent = msg;
    var b = $("tfLoginBtn"), h = $("tfLockHelp");
    b.hidden = h.hidden = !showLogin;
    if (showLogin && !b.__bound) {
      b.__bound = true;
      b.addEventListener("click", function () {
        // 사이트 공통 로그인 창 열기 (layout.js/auth.js 와 같은 방식). 로그인되면 auth.js 가 새로고침 → 점검판이 열린다.
        if (window.__authSetMode) window.__authSetMode("login"); else window.__authPendingMode = "login";
        var m = document.getElementById("authModal");
        if (m) { m.hidden = false; document.body.style.overflow = "hidden"; }
        else alert("로그인 창을 열지 못했습니다. 화면 오른쪽 위 '로그인'을 눌러 주세요.");
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (PREVIEW) {
      var n = $("tfNote"); n.hidden = false;
      n.textContent = "내 PC 미리보기입니다 — 로그인 없이 열리고, 누른 것은 이 기기에만 저장됩니다. '보는 사람'을 바꿔 각 사람 화면을 확인할 수 있습니다.";
      start(); return;
    }
    var sess = session(), uid = sess && sess.user && sess.user.id;
    if (!uid) { lock("준비위원 전용", "위임식 준비위원만 보는 화면입니다. 먼저 로그인해 주세요.", true); return; }
    api("POST", "rpc/tf_me", {})
      .catch(function () { return api("POST", "rpc/am_owner", {}).then(function (ok) { return ok === true ? { allowed: true, name: "손병민", see_all: true } : { allowed: false }; }); })
      .then(function (info) {
        if (info && info.allowed) { me = { name: info.name || "", see_all: !!info.see_all }; start(); }
        else lock("권한 없음", "이 점검판은 위임식 준비위원만 볼 수 있습니다. 목사님께 말씀해 주세요.");
      })
      .catch(function () { lock("확인 오류", "새로고침 후 다시 시도해 주세요."); });
  });
})();

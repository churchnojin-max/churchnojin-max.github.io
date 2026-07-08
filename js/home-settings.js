/* ============================================================
   홈페이지 설정 (관리자 전용)
   - 교회 로고 업로드(압축 → dataURL)
   - 섬기는 사람들(목회자 카드 · 직분자 · 기관 부서)
   - 월별 봉사자(연 단위) — church_settings 'committees' 와 통합
   저장 위치: church_settings (key='homepage', key='committees')
   ============================================================ */
(function () {
  "use strict";

  var DEFAULT_LOGO = "images/icon-192.png?v=20260625e";

  // 처음 편집 시 채워질 기본값(현재 welcome.html 내용과 동일)
  var DEFAULT_SERVANTS = {
    cards: [
      { role: "원로목사", name: "", highlight: false },
      { role: "담임목사", name: "손병민", highlight: true },
      { role: "협동목사", name: "", highlight: false },
    ],
    rows: [
      { label: "원로장로", names: "조용상" },
      { label: "시무장로", names: "신용화" },
      { label: "안수집사", names: "서재필 · 임수만 · 이상돈" },
      { label: "시무권사", names: "한춘택 · 이국휘 · 조희숙 · 최영자 · 유영자 · 이은숙 · 권술이 · 차영선 · 고영례 · 이삼순 · 조혜영 · 하경순 · 김애자 · 박경자 · 석만순" },
      { label: "은퇴권사", names: "홍영숙 · 양재순 · 이기월" },
      { label: "명예권사", names: "조용순 · 한분수" },
    ],
    org: [
      { label: "구제선교위원장", names: "이은숙" },
      { label: "남전도회장", names: "조용상" },
      { label: "마리아회장", names: "석만순" },
      { label: "권사회장", names: "조희숙" },
      { label: "주일학교부장", names: "김보라" },
      { label: "중고등부부장", names: "김애자" },
      { label: "피아노 반주", names: "김보라 · 신은경" },
    ],
  };

  // ---------- Supabase 세션 · REST 헬퍼 ----------
  function session() {
    try {
      var ref = new URL(window.SUPABASE_URL).hostname.split(".")[0];
      var raw = localStorage.getItem("sb-" + ref + "-auth-token");
      if (!raw) return null;
      var s0 = JSON.parse(raw);
      return s0 && s0.currentSession ? s0.currentSession : s0;
    } catch (e) { return null; }
  }
  function api(method, path, body, prefer) {
    var sess = session();
    var token = sess && sess.access_token;
    var headers = { apikey: window.SUPABASE_ANON_KEY, "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    if (prefer) headers.Prefer = prefer;
    return fetch(window.SUPABASE_URL + "/rest/v1/" + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (t) { throw new Error(t || res.status); });
      return res.status === 204 ? null : res.json().catch(function () { return null; });
    });
  }
  function saveSetting(key, data) {
    return api("POST", "church_settings?on_conflict=key",
      { key: key, data: data, updated_at: new Date().toISOString() },
      "resolution=merge-duplicates,return=minimal");
  }

  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]; }); }
  function $(id) { return document.getElementById(id); }
  function msg(el, text, ok) { if (el) { el.textContent = text; el.style.color = ok ? "#1e874b" : "#c0392b"; } }

  // ---------- 진입: 관리자 확인 ----------
  document.addEventListener("DOMContentLoaded", function () {
    var lock = $("hsLock"), loading = $("hsLoading"), bodyEl = $("hsBody");
    var sess = session();
    var uid = sess && sess.user && sess.user.id;
    if (!uid) {
      loading.hidden = true; lock.hidden = false;
      $("hsLockMsg").textContent = "관리자 계정으로 로그인한 뒤 다시 열어 주세요.";
      return;
    }
    api("GET", "admins?uid=eq." + uid + "&select=uid")
      .then(function (rows) {
        var isAdmin = Array.isArray(rows) && rows.length > 0;
        loading.hidden = true;
        if (!isAdmin) {
          lock.hidden = false;
          $("hsLockTitle").textContent = "권한 없음";
          $("hsLockMsg").textContent = "이 페이지는 관리자만 사용할 수 있습니다.";
          return;
        }
        bodyEl.hidden = false;
        initSettings();
      })
      .catch(function () {
        loading.hidden = true; lock.hidden = false;
        $("hsLockMsg").textContent = "확인 중 오류가 발생했습니다. 새로고침 후 다시 시도해 주세요.";
      });
  });

  // ---------- 설정 로드 + 각 편집기 초기화 ----------
  function initSettings() {
    api("GET", "church_settings?key=eq.homepage&select=data")
      .then(function (rows) {
        var hp = (rows && rows[0] && rows[0].data) || {};
        initLogo(hp.logo || null);
        initServants(hp.servants || DEFAULT_SERVANTS);
      })
      .catch(function () { initLogo(null); initServants(DEFAULT_SERVANTS); });

    api("GET", "church_settings?key=eq.committees&select=data")
      .then(function (rows) {
        var months = (rows && rows[0] && rows[0].data && rows[0].data.months) || [];
        initCommittees(months);
      })
      .catch(function () { initCommittees([]); });
  }

  // ====================== 1) 로고 ======================
  var currentLogo = null; // dataURL 또는 null(기본)
  function initLogo(logo) {
    currentLogo = logo || null;
    if (currentLogo) $("hsLogoImg").src = currentLogo;

    $("hsLogoFile").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      msg($("hsLogoNote"), "최적화 중…", true);
      compressImage(file, 256, function (dataUrl) {
        if (dataUrl.length > 600000) {
          msg($("hsLogoNote"), "이미지가 너무 큽니다. 더 단순한/작은 로고를 사용해 주세요.", false);
          return;
        }
        currentLogo = dataUrl;
        $("hsLogoImg").src = dataUrl;
        saveLogo();
      });
      e.target.value = "";
    });

    $("hsLogoReset").addEventListener("click", function () {
      if (!confirm("로고를 기본 로고로 되돌릴까요?")) return;
      currentLogo = null;
      $("hsLogoImg").src = DEFAULT_LOGO;
      saveLogo();
    });
  }
  function saveLogo() {
    // homepage 설정을 읽어 logo 만 갱신(섬기는 사람들 유지)
    api("GET", "church_settings?key=eq.homepage&select=data").then(function (rows) {
      var hp = (rows && rows[0] && rows[0].data) || {};
      hp.logo = currentLogo;
      return saveSetting("homepage", hp);
    }).then(function () {
      msg($("hsLogoNote"), "✓ 로고가 저장되었습니다. (방문자 화면은 새로고침 후 반영)", true);
    }).catch(function (e) {
      msg($("hsLogoNote"), "저장 실패: " + e.message, false);
    });
  }
  function compressImage(file, maxSize, cb) {
    var reader = new FileReader();
    reader.onload = function (ev) {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        var canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        var isPng = file.type === "image/png" || file.type === "image/webp";
        cb(canvas.toDataURL(isPng ? "image/png" : "image/jpeg", isPng ? undefined : 0.85));
      };
      img.onerror = function () { msg($("hsLogoNote"), "이미지를 읽지 못했습니다.", false); };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ====================== 2) 섬기는 사람들 ======================
  var cards = [], rows = [], org = [];

  function initServants(s) {
    cards = (s.cards || []).map(function (c) { return { role: c.role || "", name: c.name || "", highlight: !!c.highlight }; });
    rows = (s.rows || []).map(function (r) { return { label: r.label || "", names: r.names || "" }; });
    org = (s.org || []).map(function (r) { return { label: r.label || "", names: r.names || "" }; });
    renderCards(); renderRows(); renderOrg();

    $("hsCardAdd").addEventListener("click", function () { cards.push({ role: "", name: "", highlight: false }); renderCards(); });
    $("hsRowAdd").addEventListener("click", function () { rows.push({ label: "", names: "" }); renderRows(); });
    $("hsOrgAdd").addEventListener("click", function () { org.push({ label: "", names: "" }); renderOrg(); });
    $("hsServSave").addEventListener("click", saveServants);
  }

  function renderCards() {
    var box = $("hsCards");
    box.innerHTML = cards.map(function (c, i) {
      return '<div class="hs-item">' +
        '<input type="text" class="hs-in hs-c-role" data-i="' + i + '" value="' + esc(c.role) + '" placeholder="직분(예: 담임목사)" style="max-width:150px" />' +
        '<input type="text" class="hs-in hs-c-name" data-i="' + i + '" value="' + esc(c.name) + '" placeholder="성함" />' +
        '<label class="hs-chk"><input type="checkbox" class="hs-c-hl" data-i="' + i + '"' + (c.highlight ? " checked" : "") + ' /> 강조</label>' +
        '<button type="button" class="hs-del" data-i="' + i + '" title="삭제">✕</button>' +
        '</div>';
    }).join("");
    bind(box, ".hs-c-role", "input", function (i, v) { cards[i].role = v; });
    bind(box, ".hs-c-name", "input", function (i, v) { cards[i].name = v; });
    Array.prototype.forEach.call(box.querySelectorAll(".hs-c-hl"), function (el) {
      el.addEventListener("change", function () { cards[Number(el.dataset.i)].highlight = el.checked; });
    });
    bindDel(box, cards, renderCards);
  }
  function renderRows() { renderLabelNames($("hsRows"), rows, renderRows); }
  function renderOrg() { renderLabelNames($("hsOrg"), org, renderOrg); }
  function renderLabelNames(box, arr, rerender) {
    box.innerHTML = arr.map(function (r, i) {
      return '<div class="hs-item">' +
        '<input type="text" class="hs-in hs-l" data-i="' + i + '" value="' + esc(r.label) + '" placeholder="직분/부서" style="max-width:150px" />' +
        '<input type="text" class="hs-in hs-n" data-i="' + i + '" value="' + esc(r.names) + '" placeholder="이름 · 이름" />' +
        '<button type="button" class="hs-del" data-i="' + i + '" title="삭제">✕</button>' +
        '</div>';
    }).join("");
    bind(box, ".hs-l", "input", function (i, v) { arr[i].label = v; });
    bind(box, ".hs-n", "input", function (i, v) { arr[i].names = v; });
    bindDel(box, arr, rerender);
  }
  function bind(box, sel, evt, fn) {
    Array.prototype.forEach.call(box.querySelectorAll(sel), function (el) {
      el.addEventListener(evt, function () { fn(Number(el.dataset.i), el.value); });
    });
  }
  function bindDel(box, arr, rerender) {
    Array.prototype.forEach.call(box.querySelectorAll(".hs-del"), function (b) {
      b.addEventListener("click", function () { arr.splice(Number(b.dataset.i), 1); rerender(); });
    });
  }

  function saveServants() {
    var servants = {
      cards: cards.filter(function (c) { return c.role || c.name; }),
      rows: rows.filter(function (r) { return r.label || r.names; }),
      org: org.filter(function (r) { return r.label || r.names; }),
    };
    $("hsServSave").disabled = true;
    api("GET", "church_settings?key=eq.homepage&select=data").then(function (rs) {
      var hp = (rs && rs[0] && rs[0].data) || {};
      hp.servants = servants;
      return saveSetting("homepage", hp);
    }).then(function () {
      msg($("hsServMsg"), "✓ 저장되었습니다. (방문자 화면은 새로고침 후 반영)", true);
    }).catch(function (e) {
      msg($("hsServMsg"), "저장 실패: " + e.message, false);
    }).then(function () { $("hsServSave").disabled = false; });
  }

  // ====================== 3) 월별 봉사자(연 단위) ======================
  var allMonths = {}; // { 'YYYY-MM': {month, offering, guide, parking, prayer?} }
  function initCommittees(months) {
    allMonths = {};
    (months || []).forEach(function (m) { if (m && m.month) allMonths[m.month] = m; });

    var years = {};
    Object.keys(allMonths).forEach(function (k) { years[k.split("-")[0]] = 1; });
    var thisYear = new Date().getFullYear();
    years[String(thisYear)] = 1;
    years[String(thisYear + 1)] = 1;
    var yearList = Object.keys(years).sort();

    var sel = $("hsYear");
    sel.innerHTML = yearList.map(function (y) { return '<option value="' + y + '">' + y + "년</option>"; }).join("");
    sel.value = String(thisYear);
    sel.addEventListener("change", function () { renderComBody(sel.value); });
    renderComBody(sel.value);

    $("hsComSave").addEventListener("click", saveCommittees);
  }
  function renderComBody(year) {
    var body = $("hsComBody");
    var html = "";
    for (var m = 1; m <= 12; m++) {
      var ym = year + "-" + (m < 10 ? "0" + m : m);
      var cur = allMonths[ym] || {};
      html += '<tr data-ym="' + ym + '">' +
        '<td style="white-space:nowrap;font-weight:600">' + m + "월</td>" +
        '<td><input type="text" class="hs-in com-off" value="' + esc(cur.offering || "") + '" placeholder="이름 · 이름" /></td>' +
        '<td><input type="text" class="hs-in com-guide" value="' + esc(cur.guide || "") + '" placeholder="이름 · 이름" /></td>' +
        '<td><input type="text" class="hs-in com-park" value="' + esc(cur.parking || "") + '" placeholder="이름 · 이름" /></td>' +
        "</tr>";
    }
    body.innerHTML = html;
  }
  function collectCurrentYear() {
    var rowsEl = $("hsComBody").querySelectorAll("tr");
    Array.prototype.forEach.call(rowsEl, function (tr) {
      var ym = tr.dataset.ym;
      var off = tr.querySelector(".com-off").value.trim();
      var guide = tr.querySelector(".com-guide").value.trim();
      var park = tr.querySelector(".com-park").value.trim();
      var prev = allMonths[ym] || {};
      if (off || guide || park) {
        allMonths[ym] = { month: ym, offering: off, guide: guide, parking: park };
        if (prev.prayer) allMonths[ym].prayer = prev.prayer; // 주보용 기도자 정보 보존
      } else if (prev.prayer) {
        allMonths[ym] = { month: ym, prayer: prev.prayer };
      } else {
        delete allMonths[ym];
      }
    });
  }
  function saveCommittees() {
    collectCurrentYear();
    var months = Object.keys(allMonths).sort().map(function (k) { return allMonths[k]; });
    $("hsComSave").disabled = true;
    saveSetting("committees", { months: months })
      .then(function () { msg($("hsComMsg"), "✓ 저장되었습니다. (홈 화면은 새로고침 후 반영)", true); })
      .catch(function (e) { msg($("hsComMsg"), "저장 실패: " + e.message, false); })
      .then(function () { $("hsComSave").disabled = false; });
  }
})();

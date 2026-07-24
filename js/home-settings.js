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

  // 주보 기준 기본값(welcome.html 폴백과 동일). '주보 기준으로 채우기'로 불러올 수 있음.
  var DEFAULT_SERVANTS = {
    cards: [
      { role: "원로목사", name: "신동열", highlight: false },
      { role: "담임목사", name: "손병민", highlight: true },
    ],
    rows: [
      { label: "시무장로", names: "문명수" },
      { label: "안수집사", names: "김종학" },
      { label: "시무권사", names: "최지연 · 유금순 · 오성자 · 이경순" },
      { label: "은퇴권사", names: "장정숙" },
      { label: "협동권사", names: "박성애" },
    ],
    org: [
      { label: "루디아전도회", names: "회장 김은희 · 총무 고은성" },
      { label: "에스더전도회", names: "회장 문선경 · 총무 장한주" },
      { label: "바울전도회", names: "회장 김종학 · 총무 신성찬 · 지도 문명수" },
      { label: "엘림회", names: "지도 이수현" },
      { label: "찬양대", names: "지휘 신성찬 · 총무 임혜은 · 인도 최명철 · 반주 양유정" },
      { label: "주일학교", names: "부장 신성호 · 총무 황귀순" },
      { label: "식당", names: "총책임 오성자 · 부책임 최지연" },
      { label: "차량 운행", names: "김종학 · 임희순" },
      { label: "꽃꽂이", names: "김교선" },
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

  function initServantsData(s) {
    cards = (s.cards || []).map(function (c) { return { role: c.role || "", name: c.name || "", highlight: !!c.highlight }; });
    rows = (s.rows || []).map(function (r) { return { label: r.label || "", names: r.names || "" }; });
    org = (s.org || []).map(function (r) { return { label: r.label || "", names: r.names || "" }; });
    renderCards(); renderRows(); renderOrg();
  }
  function initServants(s) {
    initServantsData(s);

    $("hsCardAdd").addEventListener("click", function () { cards.push({ role: "", name: "", highlight: false }); renderCards(); });
    $("hsRowAdd").addEventListener("click", function () { rows.push({ label: "", names: "" }); renderRows(); });
    $("hsOrgAdd").addEventListener("click", function () { org.push({ label: "", names: "" }); renderOrg(); });
    $("hsServSave").addEventListener("click", saveServants);
    var def = $("hsServDefault");
    if (def) def.addEventListener("click", function () {
      if (!confirm("현재 입력 내용을 주보 기준 기본값으로 바꿀까요? (저장을 눌러야 실제 반영됩니다)")) return;
      initServantsData(JSON.parse(JSON.stringify(DEFAULT_SERVANTS)));
      msg($("hsServMsg"), "주보 기준 기본값을 불러왔습니다. 확인 후 저장을 눌러 주세요.", true);
    });
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
    initSchedule();
  }
  function renderComBody(year) {
    var body = $("hsComBody");
    var html = "";
    for (var m = 1; m <= 12; m++) {
      var ym = year + "-" + (m < 10 ? "0" + m : m);
      var cur = allMonths[ym] || {};
      var uploadedBadge = (cur.roles && cur.roles.length)
        ? ' <span class="hs-badge-uploaded" title="예배 봉사 스케줄표 업로드로 자동 반영됨(아래 입력칸에 값을 넣고 저장하면 이 값으로 대체됩니다)">📄 자동반영</span>'
        : "";
      html += '<tr data-ym="' + ym + '">' +
        '<td style="white-space:nowrap;font-weight:600">' + m + "월" + uploadedBadge + "</td>" +
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
      } else if (prev.roles && prev.roles.length) {
        // 예배 봉사 스케줄표 업로드로 자동 반영된 달은, 표 입력칸이 비어 있어도 보존
        allMonths[ym] = prev;
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

  // ====================== 4) 예배 봉사 스케줄표 업로드(엑셀 → 월별 자동 반영) ======================
  var SCHED_SKIP_HEADERS = ["월", "주", "주차", "날짜", "일자"];
  function initSchedule() {
    var fileInput = $("hsSchedFile");
    if (!fileInput) return;
    fileInput.addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      handleScheduleFile(file);
    });
  }

  function handleScheduleFile(file) {
    var note = $("hsSchedNote");
    var preview = $("hsSchedPreview");
    preview.hidden = true;
    preview.innerHTML = "";
    if (typeof XlsxLite === "undefined") {
      msg(note, "엑셀 리더를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.", false);
      return;
    }
    msg(note, "읽는 중…", true);
    XlsxLite.readSheet(file)
      .then(function (book) {
        if (!book.sheetNames.length) throw new Error("시트를 찾을 수 없습니다.");
        return book.getSheetGrid(0).then(function (grid) {
          return { sheetName: book.sheetNames[0], grid: grid };
        });
      })
      .then(function (r) { renderSchedulePreview(r.sheetName, r.grid, file.name); msg(note, "", true); })
      .catch(function (e) { msg(note, "파일을 읽지 못했습니다: " + e.message, false); });
  }

  // 연도 추출: 시트명 → 파일명 → 사용자에게 직접 확인
  function resolveYear(sheetName, fileName) {
    var m = /(20\d{2})/.exec(sheetName || "") || /(20\d{2})/.exec(fileName || "");
    var guess = m ? Number(m[1]) : new Date().getFullYear();
    var input = window.prompt("이 스케줄표는 몇 년도 기준인가요? (시트명: " + sheetName + ")", String(guess));
    if (input === null) return null; // 취소
    var y = Number(String(input).trim());
    return (y >= 2000 && y < 2100) ? y : guess;
  }

  function parseScheduleGrid(grid, year) {
    var header = (grid[0] || []).map(function (h) { return String(h == null ? "" : h).trim(); });
    var monthCol = -1, dateCol = -1;
    var roleCols = []; // [{idx, role}]
    header.forEach(function (h, i) {
      if (!h) return;
      if (monthCol < 0 && /^월$/.test(h)) { monthCol = i; return; }
      if (dateCol < 0 && /날짜|일자/.test(h)) { dateCol = i; return; }
      if (/^주\d*차?$/.test(h) || h === "주차") return; // 참고용 열은 역할로 취급하지 않음
      roleCols.push({ idx: i, role: h });
    });

    var monthly = {};   // { 'YYYY-MM': { role: [names...] } }
    var warnings = [];  // [{ label, message }]
    var weekday = ["일", "월", "화", "수", "목", "금", "토"];

    for (var r = 1; r < grid.length; r++) {
      var row = grid[r] || [];
      var monthText = monthCol >= 0 ? String(row[monthCol] == null ? "" : row[monthCol]).trim() : "";
      if (!monthText) continue; // 빈 행 · 하단 메모 행은 건너뜀
      var monthMatch = /^(\d{1,2})\s*월$/.exec(monthText);
      if (!monthMatch) continue; // "노란행: ..." 같은 하단 메모 줄은 건너뜀
      var monthNum = Number(monthMatch[1]);
      if (monthNum < 1 || monthNum > 12) continue;

      var dateText = dateCol >= 0 ? String(row[dateCol] == null ? "" : row[dateCol]).trim() : "";
      var rowLabel = monthText + (dateText ? " (" + dateText + ")" : "");
      var day = null;
      if (dateText) {
        var dm = /^(\d{1,2})\s*[\/.\-]\s*(\d{1,2})$/.exec(dateText);
        if (dm) {
          var dMonth = Number(dm[1]), dDay = Number(dm[2]);
          if (dMonth !== monthNum) {
            warnings.push({ label: rowLabel, message: "‘월’ 열(" + monthNum + "월)과 날짜의 월(" + dMonth + "월)이 서로 다릅니다." });
          }
          day = dDay;
          var dt = new Date(year, dMonth - 1, dDay);
          if (dt.getMonth() !== dMonth - 1 || dt.getDate() !== dDay) {
            warnings.push({ label: rowLabel, message: "존재하지 않는 날짜입니다(" + year + "년 기준)." });
          } else if (dt.getDay() !== 0) {
            warnings.push({ label: rowLabel, message: year + "년 " + dMonth + "월 " + dDay + "일은 주일(일요일)이 아니라 " + weekday[dt.getDay()] + "요일입니다." });
          }
        } else {
          warnings.push({ label: rowLabel, message: "날짜 형식을 이해하지 못했습니다(‘" + dateText + "’). 예: 7/5" });
        }
      }

      var ym = String(year) + "-" + (monthNum < 10 ? "0" + monthNum : String(monthNum));
      if (!monthly[ym]) monthly[ym] = {};
      roleCols.forEach(function (rc) {
        var v = row[rc.idx];
        var name = v == null ? "" : String(v).trim();
        if (!name) return;
        if (!monthly[ym][rc.role]) monthly[ym][rc.role] = [];
        if (monthly[ym][rc.role].indexOf(name) < 0) monthly[ym][rc.role].push(name);
      });
    }

    return { monthly: monthly, warnings: warnings, roleCols: roleCols };
  }

  var pendingSchedule = null; // 반영 대기 중인 { months: {ym: roles[]} }

  function renderSchedulePreview(sheetName, grid, fileName) {
    var preview = $("hsSchedPreview");
    if (!grid.length) { msg($("hsSchedNote"), "빈 파일입니다.", false); return; }

    var year = resolveYear(sheetName, fileName);
    if (year === null) return; // 사용자 취소

    var parsed = parseScheduleGrid(grid, year);
    var yms = Object.keys(parsed.monthly).sort();
    if (!yms.length) {
      msg($("hsSchedNote"), "인식할 수 있는 데이터를 찾지 못했습니다. 첫 행이 항목명(월/날짜/역할…)인지 확인해 주세요.", false);
      return;
    }

    pendingSchedule = { months: {} };
    yms.forEach(function (ym) {
      var rolesObj = parsed.monthly[ym];
      var roles = parsed.roleCols
        .map(function (rc) { return { role: rc.role, names: (rolesObj[rc.role] || []).join(" · ") }; })
        .filter(function (r) { return r.names; });
      pendingSchedule.months[ym] = roles;
    });

    var html = "";
    if (parsed.warnings.length) {
      html += '<div class="hs-sched-warn">⚠️ 확인이 필요한 항목 ' + parsed.warnings.length + '건<ul>' +
        parsed.warnings.map(function (w) { return "<li>" + esc(w.label) + " — " + esc(w.message) + "</li>"; }).join("") +
        "</ul></div>";
    }
    yms.forEach(function (ym) {
      var mm = Number(ym.split("-")[1]);
      html += '<div class="hs-sched-month"><h5>' + mm + "월</h5>" +
        pendingSchedule.months[ym].map(function (r) {
          return '<div class="hs-sched-role"><span class="role">' + esc(r.role) + '</span><span class="names">' + esc(r.names) + "</span></div>";
        }).join("") +
        "</div>";
    });
    html += '<div class="hs-sched-actions">' +
      '<button type="button" class="btn btn-solid" id="hsSchedApply">이 내용으로 월별 봉사자에 반영</button>' +
      '<button type="button" class="btn btn-line" id="hsSchedCancel">취소</button>' +
      '<span class="profile-msg" id="hsSchedApplyMsg"></span>' +
      "</div>";
    preview.innerHTML = html;
    preview.hidden = false;

    $("hsSchedCancel").addEventListener("click", function () {
      pendingSchedule = null;
      preview.hidden = true;
      preview.innerHTML = "";
    });
    $("hsSchedApply").addEventListener("click", applySchedule);
  }

  function applySchedule() {
    if (!pendingSchedule) return;
    var applyMsg = $("hsSchedApplyMsg");
    var yms = Object.keys(pendingSchedule.months);
    var overwriteCount = yms.filter(function (ym) { return allMonths[ym]; }).length;
    if (overwriteCount > 0 && !confirm(overwriteCount + "개월은 이미 입력된 값이 있습니다. 업로드한 스케줄표 내용으로 덮어쓸까요?")) return;

    yms.forEach(function (ym) {
      allMonths[ym] = { month: ym, roles: pendingSchedule.months[ym] };
    });

    $("hsSchedApply").disabled = true;
    var months = Object.keys(allMonths).sort().map(function (k) { return allMonths[k]; });
    saveSetting("committees", { months: months })
      .then(function () {
        msg(applyMsg, "✓ 반영되었습니다. (홈 화면은 새로고침 후 반영)", true);
        // 연도 선택 목록에 새 연도가 없으면 추가하고 표 다시 그리기
        var sel = $("hsYear");
        var newYears = {};
        yms.forEach(function (ym) { newYears[ym.split("-")[0]] = 1; });
        Array.prototype.forEach.call(sel.options, function (o) { delete newYears[o.value]; });
        Object.keys(newYears).sort().forEach(function (y) {
          var opt = document.createElement("option");
          opt.value = y; opt.textContent = y + "년";
          sel.appendChild(opt);
        });
        renderComBody(sel.value);
        pendingSchedule = null;
      })
      .catch(function (e) { msg(applyMsg, "저장 실패: " + e.message, false); })
      .then(function () { $("hsSchedApply").disabled = false; });
  }
})();

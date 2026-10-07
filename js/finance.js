/* finance.js — 재정관리(오직 스타일): 전표입력·장부관리·결산보고서·예산
 * 콘솔: [finance.js] v20260701di
 */
console.log('[finance.js] v20260701di');

(function () {
  var root = document.getElementById('finRoot');
  if (!root) return;

  var M = { members: [], accounts: [], services: [], budget: [], vouchers: [], loaded: false };
  var won = function (n) { return (Number(n) || 0).toLocaleString('ko-KR'); };
  var parseNum = function (s) { return Number(String(s == null ? '' : s).replace(/[^\d-]/g, '')) || 0; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var pad2 = function (n) { return ('0' + n).slice(-2); };
  var fmtD = function (d) { return String(d == null ? '' : d).slice(0, 10); }; // 'YYYY-MM-DDT..Z' → 'YYYY-MM-DD'
  var today = function () { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
  // ── 헌금 날짜 도우미 ──
  // 헌금은 주일에 드리므로, 입력 칸의 처음 값은 '오늘'이 아니라 '가장 가까운 지난 주일(오늘이 주일이면 오늘)'.
  // (예전에 목요일에 입력하면서 날짜를 못 바꿔 8/9 헌금이 8/13로 들어간 일이 있었다)
  var ymdOf0 = function (d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
  var lastSunday = function () { var d = new Date(); d.setDate(d.getDate() - d.getDay()); return ymdOf0(d); };
  var DOW_KO = ['주일', '월', '화', '수', '목', '금', '토'];
  var dowOf = function (ds) { var d = new Date(String(ds) + 'T00:00:00'); return isNaN(d) ? '' : DOW_KO[d.getDay()]; };
  var isSunday = function (ds) { var d = new Date(String(ds) + 'T00:00:00'); return !isNaN(d) && d.getDay() === 0; };
  var validYmd = function (y, m, d) { var x = new Date(y, m - 1, d); return x.getFullYear() === y && x.getMonth() === m - 1 && x.getDate() === d ? ymdOf0(x) : ''; };
  // 글 한 줄(또는 파일 이름)에서 날짜 찾기. 기간(시작 ~ 끝)이면 끝 날짜(주일).
  //   "2026년 8월 9일" · "2026.08.09" · "2026-8-9" · "2026/08/09" · "20260809" · "8월 9일"(연도 없으면 올해, 앞날이면 작년)
  function findDate(t, opts) {
    t = String(t == null ? '' : t); opts = opts || {};
    var Y = '(\\d{4})\\s*(?:년\\s*|[.\\-\\/]\\s*)(\\d{1,2})\\s*(?:월\\s*|[.\\-\\/]\\s*)(\\d{1,2})\\s*일?';
    var range = t.match(new RegExp(Y + '[^~∼～\\d]{0,12}[~∼～]\\s*' + Y));
    if (range) return validYmd(+range[4], +range[5], +range[6]);
    var m = t.match(new RegExp(Y + '(?!\\d)'));
    if (m) return validYmd(+m[1], +m[2], +m[3]);
    if (opts.compact) { var c = t.match(/(?:^|\D)(20\d{2})(\d{2})(\d{2})(?!\d)/); if (c) return validYmd(+c[1], +c[2], +c[3]); }
    if (opts.noYear) {
      var n = t.match(/^\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
      if (n) {
        var y = new Date().getFullYear(), ds = validYmd(y, +n[1], +n[2]);
        if (ds && ds > today()) ds = validYmd(y - 1, +n[1], +n[2]);
        return ds;
      }
    }
    return '';
  }
  // 날짜 칸 옆에 '(주일)' / '(목) ⚠ 주일이 아닙니다' 표시
  function dateBadge(input, span) {
    function upd() {
      var v = input.value;
      if (!v) { span.innerHTML = ''; return; }
      span.innerHTML = isSunday(v) ? '<span style="color:#1e874b">(주일)</span>' : '<span style="color:#c0392b;font-weight:700">(' + dowOf(v) + ') ⚠ 주일이 아닙니다</span>';
    }
    input.addEventListener('input', upd); input.addEventListener('change', upd); upd();
    return upd;
  }

  // ── 회계연도 ──
  // 회계연도 시작 월 — 교회 전체가 같은 값을 쓰도록 서버(app_settings.fy_start_month)에 둔다. 없으면 1월(1/1~12/31).
  // (예전에는 브라우저마다 따로 저장돼, 어떤 기기는 8월 시작으로 잡혀 '26년도=5·6·7월, 27년도=8·9·10월'처럼 갈라져 보였다)
  try { localStorage.removeItem('wpf_fy_start'); } catch (e) { }
  function fyStartMonth() { var v = Number((M.settings || {}).fy_start_month); return (v >= 1 && v <= 12) ? v : 1; }
  function lastDay(y, m) { return new Date(y, m, 0).getDate(); }
  // 회계연도 명명: 시작월이 8월 이상(하반기)이면 '종료 연도'로 부른다.
  //  예) 시작월 12월 → 2025-12 ~ 2026-11 회계연도는 "2026년도".
  function fyRange(year) {
    var sm = fyStartMonth();
    var startYear = (sm >= 8) ? year - 1 : year;          // 하반기 시작이면 라벨연도-1에서 시작
    var from = startYear + '-' + pad2(sm) + '-01';
    var endY = (sm === 1) ? year : startYear + 1, endM = (sm === 1) ? 12 : sm - 1;
    return { from: from, to: endY + '-' + pad2(endM) + '-' + pad2(lastDay(endY, endM)) };
  }
  function curFY() {
    var d = new Date(), y = d.getFullYear(), m = d.getMonth() + 1, sm = fyStartMonth();
    if (sm === 1) return y;
    if (sm >= 8) return (m >= sm) ? y + 1 : y;             // 하반기 시작 → 종료연도로 명명
    return (m >= sm) ? y : y - 1;
  }
  // 회계연도의 12달 ['2026-01', …]
  function fyMonthsOf(fy) { var r = fyRange(fy), a = [], y = +r.from.slice(0, 4), mo = +r.from.slice(5, 7); for (var k = 0; k < 12; k++) { a.push(y + '-' + pad2(mo)); mo++; if (mo > 12) { mo = 1; y++; } } return a; }
  // 날짜가 들어 있는 회계연도(이름 연도)
  function fyOfDate(ds) { var y = +String(ds).slice(0, 4); for (var k = y - 1; k <= y + 1; k++) { var r = fyRange(k); if (ds >= r.from && ds <= r.to) return k; } return y; }
  function inFY(x) { var r = fyRange(M.fy), d = String(x['일자']).slice(0, 10); return d >= r.from && d <= r.to; }
  function vouchersFY() { return M.vouchers.filter(inFY); }
  M.fy = curFY();
  // 지출 계정 표시: 항-목 (예: 전도비-선물비). 저장·집계는 목(계정명) 그대로.
  function expHang(name) { for (var i = 0; i < M.accounts.length; i++) { var a = M.accounts[i]; if (String(a['구분']) === '지출' && a['계정명'] === name) return a['분류'] || a['상위'] || ''; } return ''; }
  function accLabelExp(name) { var h = expHang(name); return (h && h !== '(미분류)') ? (h + '-' + name) : name; }
  // 감사 표기(입력자·수정자/수정일시). 화면 확인용 — 출력물에는 표기하지 않음.
  function dtMin(d) { if (!d) return ''; var s = String(d); return s.slice(0, 10) + (s.length > 10 ? ' ' + s.slice(11, 16) : ''); }
  function auditText(x) {
    var s = x['입력자'] ? ('입력: ' + esc(x['입력자'])) : '';
    if (x['수정자'] || x['수정일']) s += (s ? ' · ' : '') + '<span style="color:#c0392b">수정: ' + esc(x['수정자'] || '') + (x['수정일'] ? ' (' + esc(dtMin(x['수정일'])) + ')' : '') + '</span>';
    return s || '—';
  }

  var tries = 0;
  function boot() {
    if (!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY)) { root.innerHTML = msgCard('준비 중', '재정 기능을 사용하려면 Supabase 연결이 필요합니다.'); return; }
    if (!(window.WPF && WPF.token())) {
      if (tries++ < 20) { setTimeout(boot, 400); return; }
      root.innerHTML = msgCard('로그인이 필요합니다', '아래 버튼을 눌러 로그인해 주세요.');
      var lb = document.createElement('button');
      lb.type = 'button'; lb.className = 'btn btn-line'; lb.style.marginTop = '12px'; lb.textContent = '로그인';
      lb.onclick = function () { var m = document.getElementById('authModal'); if (m) { m.hidden = false; document.body.style.overflow = 'hidden'; } };
      root.querySelector('.fin-card').appendChild(lb);
      return;
    }
    root.innerHTML = '<p class="qt-loading">권한 확인 중입니다…</p>';
    WPF.call('me').then(function (me) {
      if (!me.canFinance) { root.innerHTML = msgCard('접근 권한이 없습니다', '재정관리는 관리자 승인을 받은 회원만 이용할 수 있습니다.'); return; }
      WPF.call('masters').then(function (m) {
        M.members = m.members || []; M.accounts = m.accounts || []; M.services = m.services || [];
        ensureSettings().then(function () { M.fy = curFY(); render(); });   // 설정(회계연도 시작 월·로고 등)을 먼저 읽은 뒤 회계연도를 정한다
      }).catch(function (e) { root.innerHTML = msgCard('불러오기 실패', e.message); });
    }).catch(function (e) { root.innerHTML = msgCard('확인 실패', e.message); });
  }
  function msgCard(t, x) { return '<div class="fin-card" style="text-align:center;padding:40px 18px;"><h3 style="margin:0 0 8px;color:var(--accent,#1A3A2F);">' + esc(t) + '</h3><p style="color:var(--ink-soft,#7b8794);">' + esc(x) + '</p></div>'; }

  // 인쇄 창에 그려 넣기 — 직인·고유번호증·로고처럼 비공개 보관함에 있는 그림은
  // 인쇄 창이 스스로 열 수 없으므로, '1시간짜리 주소'로 바꾼 뒤에 그린다(js/upload.js ChurchUpload.resolve).
  function writePrint(w, html) {
    var U = window.ChurchUpload;
    var found = (U && U.resolve) ? (html.match(/https?:\/\/[^"'\s<>]+\/storage\/v1\/object\/authenticated\/private_files\/[^"'\s<>?#]+/g) || []) : [];
    var urls = found.filter(function (u, i) { return found.indexOf(u) === i; });
    Promise.all(urls.map(function (u) { return U.resolve(u).catch(function () { return u; }); })).then(function (signed) {
      urls.forEach(function (u, i) { html = html.split(u).join(esc(signed[i])); });
      w.document.write(html); w.document.close(); w.focus();
    });
  }

  // ── 보고서 인쇄/PDF (회의 배포용 전문 양식) ──
  function printDoc(title, inner, sub) {
    var r = fyRange(M.fy);
    var logo = orgInfo().imgLogo;
    var subLine = sub || (M.fy + '년도 회계연도 (' + r.from + ' ~ ' + r.to + ')');
    var w = window.open('', '_blank', 'width=960,height=820');
    if (!w) { alert('팝업이 차단되었습니다. 브라우저에서 팝업을 허용한 뒤 다시 시도해 주세요.'); return; }
    var dt = today();
    var css = [
      '*{box-sizing:border-box}',
      'body{font-family:"Noto Sans KR","Malgun Gothic","맑은 고딕",sans-serif;color:#1a1a1a;margin:0;padding:20px 26px;font-size:11px;line-height:1.32}',
      '.doc{max-width:780px;margin:0 auto}',
      '.head{display:flex;align-items:flex-start;gap:14px;margin-bottom:12px}',
      '.head .spacer{flex:1}',
      '.head .rt{text-align:center;padding-top:4px}',
      '.head .rt h1{font-family:"Noto Serif KR",serif;font-size:19px;margin:0;letter-spacing:.12em;color:#122A22}',
      '.head .rt .period{color:#555;font-size:11.5px;margin-top:5px}',
      '.head .rt .meta{color:#9aa5b1;font-size:10px;margin-top:3px}',
      '.signwrap{flex:1;display:flex;justify-content:flex-end}',
      '.sign{border-collapse:collapse}',
      '.sign td{border:1px solid #b9c2cf;text-align:center;padding:0;width:62px}',
      '.sign .role{background:#eef2f7;font-weight:600;font-size:10px;padding:3px 0;border-bottom:1px solid #b9c2cf}',
      '.sign .role small{font-weight:400;color:#778;font-size:8px}',
      '.sign .box{height:40px}',
      '.fin-card{margin-bottom:4px}',
      '.fin-card>b{display:block;font-size:12px;font-weight:700;color:#1f3a5f;margin:11px 0 5px;padding-left:8px;border-left:3px solid #c9a227}',
      'table{width:100%;border-collapse:collapse;font-size:11px;margin:0 0 9px}',
      'th{background:#1f3a5f;color:#fff;font-weight:600;padding:5px 8px;text-align:left;border:1px solid #1f3a5f}',
      'td{padding:4px 8px;border:1px solid #d4dae3}',
      'tbody tr:nth-child(even){background:#f6f8fb}',
      '.num{text-align:right!important;font-variant-numeric:tabular-nums}',
      'tfoot td,tr[style*="bold"] td,tr[style*="700"] td{font-weight:700;background:#eef2f7}',
      '.fin-pill{font-size:9px;padding:1px 5px;border-radius:7px;border:1px solid #ccd}',
      '.help{font-size:9px;color:#9aa5b1}',
      '.issuer{text-align:center;margin-top:18px;padding-top:11px;border-top:2px solid #1f3a5f}',
      '.issuer .ilogo{height:44px;display:block;margin:0 auto 6px}',
      '.issuer .kr{font-family:"Noto Serif KR",serif;font-size:18px;font-weight:700;letter-spacing:.2em;color:#1f3a5f;margin:0}',
      '.issuer .en{font-size:8px;letter-spacing:.32em;color:#8a93a0;margin-top:3px}',
      '.issuer .gen{font-size:9px;color:#aab2bd;margin-top:5px}',
      '.mng{display:none!important}',
      '@page{size:A4;margin:14mm 13mm}',
      '@media print{body{padding:0}.noprint{display:none}}'
    ].join('');
    var sign = '<table class="sign"><tr>' +
      '<td class="role">작성<br><small>회계</small></td><td class="role">검토<br><small>재정부장</small></td><td class="role">승인<br><small>담임목사</small></td></tr>' +
      '<tr><td class="box"></td><td class="box"></td><td class="box"></td></tr></table>';
    var html = '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>' + esc(churchInfo().name) + ' ' + esc(title) + '</title>' +
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&family=Noto+Serif+KR:wght@600;700&display=swap" rel="stylesheet">' +
      '<style>' + css + '</style></head><body><div class="doc">' +
      '<div class="head"><div class="spacer"></div>' +
      '<div class="rt"><h1>' + esc(title) + '</h1><div class="period">' + esc(subLine) + '</div><div class="meta">출력일 ' + dt + '</div></div>' +
      '<div class="signwrap">' + sign + '</div></div>' +
      inner +
      '<div class="issuer">' + (logo ? '<img class="ilogo" src="' + esc(logo) + '" alt="로고">' : '') + '<p class="kr">' + esc(churchInfo().name) + '</p><div class="en">' + esc(churchInfo().nameEn) + '</div><div class="gen">재정부 · 교회 회계시스템 생성 (' + dt + ')</div></div>' +
      '<div class="noprint" style="text-align:center;margin-top:22px"><button onclick="window.print()" style="padding:9px 24px;font-size:14px;cursor:pointer;border:0;background:#1f3a5f;color:#fff;border-radius:8px">🖨 인쇄 / PDF 저장</button></div>' +
      '<scr' + 'ipt>window.addEventListener("load",function(){setTimeout(function(){try{window.print()}catch(e){}},450)});</scr' + 'ipt>' +
      '</div></body></html>';
    writePrint(w, html);
  }
  // 선택 일괄 삭제
  function bulkDelete(ids, after) {
    if (!ids.length) { alert('선택된 항목이 없습니다. 삭제할 항목을 체크해 주세요.'); return; }
    if (!confirm('선택한 ' + ids.length + '건을 삭제할까요?')) return;
    Promise.all(ids.map(function (id) { return WPF.call('deleteVoucher', { id: id }); }))
      .then(function () { M.loaded = false; after(); })
      .catch(function (e) { alert('삭제 중 오류: ' + e.message); M.loaded = false; after(); });
  }
  // 체크박스 목록 공통 배선(전체선택 + 선택삭제)
  function wireChecks(box, reload) {
    var allck = box.querySelector('[data-all]');
    if (allck) allck.onclick = function () { Array.prototype.forEach.call(box.querySelectorAll('.rowck'), function (c) { c.checked = allck.checked; }); };
    var bulk = box.querySelector('[data-bulk]');
    if (bulk) bulk.onclick = function () { bulkDelete(Array.prototype.map.call(box.querySelectorAll('.rowck:checked'), function (c) { return c.value; }), reload); };
  }

  // 보고서 패널에 인쇄 버튼을 얹고 본문을 감싼다
  function withPrint(el, title, contentHTML, sub, csvData) {
    el.innerHTML = '<div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:10px;"><button class="btn btn-line" data-xls>⬇ 엑셀</button><button class="btn btn-line" data-print>🖨 인쇄 / PDF</button></div><div class="rep-body">' + contentHTML + '</div>';
    el.querySelector('[data-print]').onclick = function () { printDoc(title, el.querySelector('.rep-body').innerHTML, sub); };
    el.querySelector('[data-xls]').onclick = function () { exportBodyToCSV(el.querySelector('.rep-body'), title, sub, csvData); };
  }
  // ── 엑셀(CSV) 내보내기 공통 ──
  function safeFile(s) { return String(s == null ? 'export' : s).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_'); }
  function csvCell(v) { v = String(v == null ? '' : v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function downloadCSV(filename, matrix) {
    var csv = '﻿' + matrix.map(function (r) { return (r || []).map(csvCell).join(','); }).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  // DOM <table> → 행렬 (체크박스·관리 열 제외)
  function tableToCSV(table) {
    var out = [], skip = {}, headTexts = [];
    var thead = table.querySelector('thead');
    if (thead) {
      var hrows = thead.querySelectorAll('tr'), hrow = hrows[hrows.length - 1];
      if (hrow) Array.prototype.forEach.call(hrow.children, function (c, i) { var t = (c.textContent || '').replace(/\s+/g, ' ').trim(); headTexts[i] = t; if (!t || t === '관리') skip[i] = 1; });
    }
    function rowArr(tr) { var a = []; Array.prototype.forEach.call(tr.children, function (c, i) { if (skip[i]) return; a.push((c.textContent || '').replace(/\s+/g, ' ').trim()); }); return a; }
    if (headTexts.length) { var h = []; headTexts.forEach(function (t, i) { if (!skip[i]) h.push(t); }); out.push(h); }
    Array.prototype.forEach.call(table.querySelectorAll('tbody tr'), function (tr) { out.push(rowArr(tr)); });
    Array.prototype.forEach.call(table.querySelectorAll('tfoot tr'), function (tr) { out.push(rowArr(tr)); });
    return out;
  }
  // 보고서 본문을 CSV로. csvData={headers,rows} 가 있으면 우선(전체 데이터), 없으면 화면의 표를 추출.
  function exportBodyToCSV(body, title, sub, csvData) {
    var matrix = [[title + (sub ? (' (' + sub + ')') : '')], []];
    if (csvData && csvData.rows) {
      if (csvData.headers) matrix.push(csvData.headers);
      csvData.rows.forEach(function (r) { matrix.push(r); });
    } else {
      var tables = body ? body.querySelectorAll('table') : [];
      if (!tables.length) { alert('내보낼 표가 없습니다.'); return; }
      Array.prototype.forEach.call(tables, function (t, idx) { if (idx) matrix.push([]); tableToCSV(t).forEach(function (r) { matrix.push(r); }); });
    }
    downloadCSV(safeFile(title) + '_' + today() + '.csv', matrix);
  }
  // 주(週) 범위: 일요일~토요일
  function ymdOf(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function weekRange(dateStr) {
    var d = new Date((dateStr || today()) + 'T00:00:00'); var day = d.getDay();
    var s = new Date(d); s.setDate(d.getDate() - day);
    var e = new Date(s); e.setDate(s.getDate() + 6);
    return { from: ymdOf(s), to: ymdOf(e) };
  }

  function ensureVouchers() {
    if (M.loaded) return Promise.resolve();
    return WPF.call('listVouchers', {}).then(function (r) { M.vouchers = r.vouchers || []; M.loaded = true; });
  }
  function ensureBudget() {
    if (M._b) return Promise.resolve();
    return WPF.call('budget').then(function (r) { M.budget = r.budget || []; M._b = true; }).catch(function () { M.budget = []; M._b = true; });
  }
  function ensureSettings() {
    if (M._s) return Promise.resolve();
    return WPF.call('getSettings').then(function (r) { M.settings = r.settings || {}; M._s = true; }).catch(function () { M.settings = {}; M._s = true; });
  }
  function carryover(fy) { return parseNum((M.settings || {})['carryover_' + (fy || M.fy)]); } // 회계연도별 전기 이월금
  // ── 계정(항·목) 표: 모든 보고서가 같은 순서·같은 소계로 보이게 하는 공용 도우미 ──
  function isGrpCode(c) { return String(c || '').slice(-4) === '0000'; }
  function parCode(c) { return String(c || '').slice(0, 3) + '0000'; }
  // 전표 목록 → { 계정이름: {c:건수, s:금액} }
  function sumByAccount(list, gubun) {
    var m = {};
    list.forEach(function (v) { if (String(v['구분']) !== gubun) return; var a = v['계정'] || '(계정 없음)'; if (!m[a]) m[a] = { c: 0, s: 0 }; m[a].c++; m[a].s += Number(v['금액']) || 0; });
    return m;
  }
  // 계정표(예산 탭의 항·목) 순서대로 줄을 만든다. 하위 목이 있는 항은 소계 줄 + 목 줄, 목이 없는 항은 그 자체가 계정.
  // 계정표에 없는 이름으로 들어간 전표는 맨 아래 '(계정표에 없음)' 표시로 따로 보여 준다 — 빠지지 않게.
  function accountRows(gubun, accMap) {
    var all = (M.budget || []).filter(function (b) { return String(b['구분']) === gubun; }).sort(function (a, b) { return String(a['계정코드']).localeCompare(String(b['계정코드'])); });
    var kids = {}; all.filter(function (b) { return !isGrpCode(b['계정코드']); }).forEach(function (b) { (kids[parCode(b['계정코드'])] = kids[parCode(b['계정코드'])] || []).push(b); });
    var rows = [], seen = {};
    all.filter(function (b) { return isGrpCode(b['계정코드']); }).forEach(function (g) {
      var gn = g['계정이름'], ks = kids[g['계정코드']] || [];
      if (!ks.length) { seen[gn] = 1; if (accMap[gn]) rows.push({ label: gn, level: 0, c: accMap[gn].c, s: accMap[gn].s }); return; }
      var sub = { c: 0, s: 0 }, kr = [];
      if (accMap[gn]) { seen[gn] = 1; sub.c += accMap[gn].c; sub.s += accMap[gn].s; kr.push({ label: gn + ' (항으로 바로 입력)', level: 1, c: accMap[gn].c, s: accMap[gn].s }); }
      ks.forEach(function (k) { var kn = k['계정이름']; seen[kn] = 1; if (accMap[kn]) { sub.c += accMap[kn].c; sub.s += accMap[kn].s; kr.push({ label: kn, level: 1, c: accMap[kn].c, s: accMap[kn].s }); } });
      if (sub.c) { rows.push({ label: gn, level: 0, group: true, c: sub.c, s: sub.s }); rows = rows.concat(kr); }
    });
    // 항이 없어진 목, 계정표에 없는 이름
    all.filter(function (b) { return !isGrpCode(b['계정코드']) && !seen[b['계정이름']]; }).forEach(function (b) { var n = b['계정이름']; seen[n] = 1; if (accMap[n]) rows.push({ label: n, level: 0, c: accMap[n].c, s: accMap[n].s }); });
    Object.keys(accMap).forEach(function (n) { if (!seen[n]) rows.push({ label: n, level: 0, unknown: true, c: accMap[n].c, s: accMap[n].s }); });
    return rows;
  }
  function accountTable(gubun, accMap, emptyText) {
    var rows = accountRows(gubun, accMap);
    var tot = 0, cnt = 0; rows.forEach(function (r) { if (r.level === 0) { tot += r.s; cnt += r.c; } });
    if (!rows.length) return '<p class="help" style="padding:6px 2px">' + esc(emptyText || '내역이 없습니다.') + '</p>';
    var unk = rows.some(function (r) { return r.unknown; });
    return '<table class="fin-table"><thead><tr><th>' + gubun + ' 항목</th><th class="num">건수</th><th class="num">금액</th><th class="num">비율</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var lab = r.level ? '<span style="padding-left:16px;color:#48576b">' + esc(r.label) + '</span>' : (r.group ? '<b>' + esc(r.label) + '</b>' : esc(r.label));
        if (r.unknown) lab += ' <span class="fin-pill out" title="예산·계정 탭의 계정표에 없는 이름입니다">계정표에 없음</span>';
        return '<tr' + (r.group ? ' style="background:#f5f8fc"' : '') + '><td>' + lab + '</td><td class="num">' + r.c + '</td><td class="num">' + (r.group ? '<b>' + won(r.s) + '</b>' : won(r.s)) + '</td><td class="num">' + (tot ? (r.s / tot * 100).toFixed(1) + '%' : '-') + '</td></tr>';
      }).join('') +
      '</tbody><tfoot><tr style="font-weight:700;background:#eef2f7"><td>합계</td><td class="num">' + cnt + '</td><td class="num">' + won(tot) + '</td><td class="num">' + (tot ? '100%' : '-') + '</td></tr></tfoot></table>' +
      (unk ? '<p class="help" style="color:#c0392b;margin-top:4px">「계정표에 없음」은 예산·계정 탭에 없는 이름으로 들어간 전표입니다. 합계에는 들어가 있습니다. 계정표에 그 이름을 추가하거나 전표의 계정을 고치면 제자리에 나옵니다.</p>' : '');
  }
  // 헌금자 이름: 교적과 이어진 전표는 교적 이름으로(예: '김동배·이경순' → 이경순 교적이면 '이경순'), 아니면 적힌 그대로
  function memberName(key) { if (!key) return ''; for (var i = 0; i < M.members.length; i++) if (M.members[i].key === key) return M.members[i].name; return ''; }
  // 사람이 아닌 헌금(구역·주일헌금·주일학교·무명 등)
  function isGroupGiver(name) { return /^\d+\s*구역$|구역헌금$|^주일헌금$|^주일학교|^무명$|^무기명$|헌금$|수입$/.test(String(name || '').replace(/\s+/g, '')); }
  function ensureReceipts() {
    if (M._rc) return Promise.resolve();
    return WPF.call('listReceipts', {}).then(function (r) { M.receipts = r.receipts || []; M._rc = true; }).catch(function () { M.receipts = []; M._rc = true; });
  }
  // 발급기관(교회) — 기부금영수증 수령인 정보. 설정 탭에서 편집.
  // 기본값은 js/church.js(교회 이름표)에서. 고유번호는 지어 넣지 않는다 — 비어 있으면 영수증 화면이 먼저 알려 준다.
  function churchInfo() {
    var c = window.CHURCH || {};
    var rep = (c.pastors || []).filter(function (p) { return p && p.role === '담임목사'; })[0];
    return { name: c.name || '교회', nameEn: c.nameEn || '', addr: c.address || '', rep: rep ? rep.name : '' };
  }
  function orgInfo() {
    var s = M.settings || {}, c = churchInfo();
    return {
      name: s.rcp_org || c.name,
      bizno: s.rcp_bizno || '',
      addr: s.rcp_addr || c.addr,
      rep: s.rcp_rep || c.rep,
      law: s.rcp_law || '「소득세법」 제34조제3항제1호',
      imgLogo: s.rcp_img_logo || '',   // 교회 로고
      imgUid: s.rcp_img_uid || '',     // 고유번호증
      imgAssoc: s.rcp_img_assoc || '', // 총회소속증명서
      imgSeal: s.rcp_img_seal || ''    // 직인
    };
  }

  var TABS = [
    ['home', '🏠 홈'], ['offering', '헌금입력'], ['bulk', '엑셀 자동입력'], ['expense', '지출입력'], ['ledger', '거래장부'],
    ['givers', '헌금자통계'], ['gl', '총계정원장'], ['report', '결산보고서'],
    ['finrep', '재정보고서'], ['bulletin', '헌금명단'], ['receipt', '기부금영수증'], ['receiptlog', '영수증 발급대장'],
    ['budget', '예산'], ['settings', '설정']
  ];
  var tab = 'home';
  function fyBar() {
    var d = new Date(), y = d.getFullYear(), opts = '';
    for (var yr = y + 1; yr >= y - 4; yr--) opts += '<option value="' + yr + '"' + (yr === M.fy ? ' selected' : '') + '>' + yr + '년도</option>';
    var r = fyRange(M.fy);
    return '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;padding:10px 14px;background:#f5f8fc;border:1px solid #e3ebf5;border-radius:10px;">' +
      '<b style="color:var(--accent,#1A3A2F)">📅 회계연도</b>' +
      '<select id="fySel" style="padding:6px 10px;border:1px solid #cdd7e3;border-radius:8px;font:inherit;background:#fff;">' + opts + '</select>' +
      '<span style="color:#7b8794;font-size:.86rem;">' + r.from + ' ~ ' + r.to + '</span>' +
      '<span style="color:#9aa5b1;font-size:.8rem;margin-left:auto;">시작월·범위는 <b>설정</b> 탭에서</span></div>';
  }
  // 상위 카테고리(호버 드롭다운). 항목은 위 TABS의 키.
  var GROUPS = [
    { label: '🏠 홈', tab: 'home' },
    { label: '전표입력', items: ['offering', 'bulk', 'expense'] },
    { label: '장부관리', items: ['ledger', 'givers', 'gl', 'bulletin'] },
    { label: '결산·보고서', items: ['report', 'finrep', 'receipt', 'receiptlog'] },
    { label: '예산·계정', items: ['budget'] },
    { label: '설정', tab: 'settings' }
  ];
  function tabLabel(k) { for (var i = 0; i < TABS.length; i++) if (TABS[i][0] === k) return TABS[i][1]; return k; }
  var menuBound = false;
  function menuHTML() {
    return '<div class="fin-menu">' + GROUPS.map(function (grp) {
      var active = grp.tab ? (tab === grp.tab) : grp.items.indexOf(tab) >= 0;
      if (grp.tab) return '<button class="fm-top' + (active ? ' active' : '') + '" data-t="' + grp.tab + '">' + grp.label + '</button>';
      return '<div class="fm-group"><button class="fm-top fm-toggle' + (active ? ' active' : '') + '">' + grp.label + ' ▾</button>' +
        '<div class="fm-drop">' + grp.items.map(function (it) { return '<button data-t="' + it + '"' + (tab === it ? ' class="active"' : '') + '>' + tabLabel(it) + '</button>'; }).join('') + '</div></div>';
    }).join('') + '</div>';
  }
  function render() {
    root.innerHTML = fyBar() + menuHTML() + '<div id="finPanel"></div>';
    var sel = document.getElementById('fySel');
    if (sel) sel.onchange = function () { M.fy = Number(sel.value); render(); };
    Array.prototype.forEach.call(root.querySelectorAll('.fin-menu [data-t]'), function (b) {
      b.onclick = function () { tab = b.dataset.t; render(); };
    });
    // 모바일: 상위 메뉴 탭하면 하위 펼침(데스크톱은 호버로도 열림)
    Array.prototype.forEach.call(root.querySelectorAll('.fin-menu .fm-toggle'), function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var grp = b.parentNode, wasOpen = grp.classList.contains('open');
        Array.prototype.forEach.call(root.querySelectorAll('.fm-group.open'), function (g) { g.classList.remove('open'); });
        if (!wasOpen) grp.classList.add('open');
      };
    });
    if (!menuBound) {
      menuBound = true;
      document.addEventListener('click', function (e) {
        if (!(e.target.closest && e.target.closest('.fm-group'))) Array.prototype.forEach.call(root.querySelectorAll('.fm-group.open'), function (g) { g.classList.remove('open'); });
      });
    }
    var p = document.getElementById('finPanel');
    if (tab === 'home') renderHome(p);
    else if (tab === 'offering') renderOffering(p);
    else if (tab === 'bulk') renderBulk(p);
    else if (tab === 'expense') renderExpense(p);
    else if (tab === 'ledger') renderLedger(p);
    else if (tab === 'givers') renderGivers(p);
    else if (tab === 'gl') renderGL(p);
    else if (tab === 'report') renderReport(p);
    else if (tab === 'finrep') renderFinReport(p);
    else if (tab === 'bulletin') renderGiverList(p);
    else if (tab === 'receipt') renderReceipt(p);
    else if (tab === 'receiptlog') renderReceiptLog(p);
    else if (tab === 'budget') renderBudget(p);
    else if (tab === 'settings') renderSettings(p);
  }

  /* ── 홈 대시보드 ── */
  function renderHome(panel) {
    loading(panel);
    Promise.all([ensureVouchers(), ensureBudget(), ensureSettings()]).then(function () {
      function p2(n) { return ('0' + n).slice(-2); }
      function ymd(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
      function shift(ds, n) { var d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); }
      function isGrp(c) { return String(c || '').slice(-4) === '0000'; }
      function parOf(c) { return String(c || '').slice(0, 3) + '0000'; }
      var fyR = fyRange(M.fy);
      // 주간은 다른 화면(헌금명단·재정보고서)과 같이 주일~토요일. (월~일로 하면 평일에 '이번주'가 늘 비어 보였다)
      var thisWk = weekRange(today()), lastWk = weekRange(shift(today(), -7));

      var fy = vouchersFY(), ti = 0, te = 0, months = {}, order = [];
      fy.forEach(function (v) { var amt = Number(v['금액']) || 0, m = String(v['일자']).slice(0, 7); if (!months[m]) { months[m] = { inc: 0, exp: 0 }; order.push(m); } if (String(v['구분']) === '수입') { ti += amt; months[m].inc += amt; } else { te += amt; months[m].exp += amt; } });
      order.sort();
      var carry = carryover(), bal = carry + ti - te;

      function sumByAcc(gubun, from, to) { var m = {}; M.vouchers.forEach(function (v) { if (String(v['구분']) !== gubun) return; var d = fmtD(v['일자']); if (d < from || d > to) return; var a = v['계정'] || ''; m[a] = (m[a] || 0) + (Number(v['금액']) || 0); }); return m; }

      // 항/목 상태표 (cols = [{label, from, to}, …]) — 결산보고서와 같은 계정표 순서·소계(accountRows).
      // (예전에는 하위 목이 없는 항(십일조·감사…)을 빼먹어 모든 금액이 '기타' 한 줄로 몰렸다)
      function statusTable(gubun, cols) {
        var maps = cols.map(function (c) { return sumByAccount(M.vouchers.filter(function (v) { var d = fmtD(v['일자']); return d >= c.from && d <= c.to; }), gubun); });
        var merged = {};
        maps.forEach(function (mp) { Object.keys(mp).forEach(function (k) { if (!merged[k]) merged[k] = { c: 0, s: 0 }; merged[k].c += mp[k].c; merged[k].s += mp[k].s; }); });
        var struct = accountRows(gubun, merged);
        var per = maps.map(function (mp) { var o = {}; accountRows(gubun, mp).forEach(function (r) { o[r.label] = r.s; }); return o; });
        var totals = maps.map(function (mp) { var t = 0; Object.keys(mp).forEach(function (k) { t += mp[k].s; }); return t; });
        var body = struct.map(function (r) {
          var lab = r.level ? '<span style="padding-left:16px;color:#48576b">' + esc(r.label) + '</span>' : esc(r.label);
          if (r.unknown) lab += ' <span class="fin-pill out">계정표에 없음</span>';
          return '<tr' + (r.group ? ' style="font-weight:700;background:#f5f8fc"' : '') + '><td>' + lab + '</td>' + per.map(function (o) { return '<td class="num">' + won(o[r.label] || 0) + '</td>'; }).join('') + '</tr>';
        }).join('');
        if (!body) body = '<tr><td colspan="' + (cols.length + 1) + '" style="color:#9aa5b1;padding:14px;text-align:center">내역 없음</td></tr>';
        return '<div style="overflow:auto;max-height:430px;margin-top:10px"><table class="fin-table"><thead><tr><th>' + gubun + ' 항목</th>' + cols.map(function (c) { return '<th class="num">' + c.label + '</th>'; }).join('') + '</tr></thead>' +
          '<tbody><tr style="font-weight:700;color:' + (gubun === '수입' ? '#1e874b' : '#c0392b') + '"><td>' + gubun + ' 합계</td>' + totals.map(function (v) { return '<td class="num">' + won(v) + '</td>'; }).join('') + '</tr>' + body + '</tbody></table></div>';
      }

      function stat(label, val, color) { return '<div style="flex:1;min-width:150px;background:#fff;border:1px solid #e8edf3;border-radius:12px;padding:14px 16px"><div style="color:#7b8794;font-size:.78rem;margin-bottom:6px">' + label + '</div><div style="font-size:1.3rem;font-weight:700;color:' + color + '">' + won(val) + '<span style="font-size:.8rem;font-weight:400">원</span></div></div>'; }

      // 월별 차트 — 회계연도 12달을 늘 다 보여 준다(기록 없는 달은 빈칸, 앞으로 올 달은 흐리게).
      // 화면 폭(wpx)에 맞춰 그 픽셀 크기 그대로 그려 휴대폰에서도 글씨가 작아지지 않게 한다.
      var fyMonths = fyMonthsOf(M.fy);
      var nowYM = today().slice(0, 7);
      function shortWon(v) { return v >= 100000000 ? (Math.round(v / 10000000) / 10) + '억' : v >= 10000 ? Math.round(v / 10000).toLocaleString('ko-KR') + '만' : String(v); }
      function monthChart(wpx) {
        if (!order.length) return '<p style="color:#9aa5b1;margin-top:14px">내역 없음</p>';
        var n = fyMonths.length, W = Math.max(280, Math.round(wpx || 560)), H = 230, PT = 16, PB = 28, PL = 54, PR = 8;
        var ph = H - PT - PB, pw = W - PL - PR, baseY = PT + ph, slot = pw / n;
        var maxV = Math.max.apply(null, fyMonths.map(function (m) { var x = months[m]; return x ? Math.max(x.inc, x.exp) : 0; }).concat([1]));
        // 눈금: 1·2·5 단위로 보기 좋게 3~4칸
        var raw = maxV / 3, p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), stepV = [1, 2, 5, 10].map(function (k) { return k * p; }).filter(function (s) { return s >= raw; })[0] || raw;
        var top = Math.ceil(maxV / stepV) * stepV;
        function cx(i) { return PL + (i + 0.5) * slot; }
        function yv(v) { return PT + ph - (v / top) * ph; }
        var INC = '#34C759', EXP = '#FF3B30';
        var bw = Math.max(4, Math.min(12, slot * 0.28)), gap = Math.max(1, bw * 0.15);
        var grid = '', rects = '', incSeg = [[]], expSeg = [[]], dots = '', hits = '', labels = '';
        for (var g = 0; g <= top + 1e-9; g += stepV) {
          var gy = yv(g).toFixed(1);
          grid += '<line x1="' + PL + '" x2="' + (W - PR) + '" y1="' + gy + '" y2="' + gy + '" stroke="#e8edf3" stroke-width="1"' + (g ? ' stroke-dasharray="3 3"' : '') + '></line>' +
            '<text x="' + (PL - 6) + '" y="' + (+gy + 4) + '" text-anchor="end" font-size="10.5" fill="#9aa5b1">' + (g ? shortWon(g) : '0') + '</text>';
        }
        fyMonths.forEach(function (m, i) {
          var c = cx(i), x = months[m], future = m > nowYM;
          var col = future ? '#c9ced6' : (m === nowYM ? '#1A3A2F' : '#6b7480');
          labels += '<text x="' + c + '" y="' + (H - 9) + '" text-anchor="middle" font-size="' + (slot < 30 ? 10.5 : 12) + '"' + (m === nowYM ? ' font-weight="700"' : '') + ' fill="' + col + '">' + (+m.slice(5)) + (slot >= 34 ? '월' : '') + '</text>';
          hits += '<rect class="mc-hit" data-m="' + m + '" x="' + (c - slot / 2) + '" y="' + PT + '" width="' + slot + '" height="' + ph + '" fill="transparent" style="cursor:pointer"></rect>';
          if (!x) { if (incSeg[incSeg.length - 1].length) { incSeg.push([]); expSeg.push([]); } return; }   // 기록 없는 달: 선을 끊는다
          var xi = c - bw - gap / 2, xe = c + gap / 2;
          rects += '<rect x="' + xi.toFixed(1) + '" y="' + yv(x.inc).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (baseY - yv(x.inc)).toFixed(1) + '" rx="2.5" fill="' + INC + '" opacity="0.42"></rect>';
          rects += '<rect x="' + xe.toFixed(1) + '" y="' + yv(x.exp).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (baseY - yv(x.exp)).toFixed(1) + '" rx="2.5" fill="' + EXP + '" opacity="0.42"></rect>';
          incSeg[incSeg.length - 1].push((xi + bw / 2).toFixed(1) + ',' + yv(x.inc).toFixed(1));
          expSeg[expSeg.length - 1].push((xe + bw / 2).toFixed(1) + ',' + yv(x.exp).toFixed(1));
          dots += '<circle cx="' + (xi + bw / 2).toFixed(1) + '" cy="' + yv(x.inc).toFixed(1) + '" r="3.2" fill="' + INC + '" stroke="#fff" stroke-width="1.4"></circle><circle cx="' + (xe + bw / 2).toFixed(1) + '" cy="' + yv(x.exp).toFixed(1) + '" r="3.2" fill="' + EXP + '" stroke="#fff" stroke-width="1.4"></circle>';
        });
        function lines(segs, color) { return segs.filter(function (s) { return s.length > 1; }).map(function (s) { return '<polyline points="' + s.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></polyline>'; }).join(''); }
        return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" style="display:block;max-width:100%;height:auto">' +
          grid + rects + lines(incSeg, INC) + lines(expSeg, EXP) + dots + labels + hits + '</svg>';
      }

      // 헌금 항목별 도넛(연간 수입) — 클릭 상세
      var incFY = sumByAcc('수입', fyR.from, fyR.to);
      var PAL = ['#0A84FF', '#30D158', '#FF9F0A', '#FF453A', '#BF5AF2', '#FF375F', '#64D2FF', '#FF9500', '#5E5CE6', '#AC8E68', '#66D4CF', '#FFD60A', '#FF6482', '#32ADE6', '#A2845E', '#34C759'];
      var dnEnts = Object.keys(incFY).map(function (k) { return { k: k, v: incFY[k] }; }).filter(function (e) { return e.v > 0; }).sort(function (a, b) { return b.v - a.v; });
      var dnTotal = dnEnts.reduce(function (s, e) { return s + e.v; }, 0);
      var dnCount = {}; M.vouchers.forEach(function (v) { if (String(v['구분']) !== '수입') return; var d = fmtD(v['일자']); if (d < fyR.from || d > fyR.to) return; var a = v['계정'] || ''; dnCount[a] = (dnCount[a] || 0) + 1; });
      function donut() {
        if (!dnTotal) return '<p style="color:#9aa5b1;margin-top:12px">내역 없음</p>';
        var R = 68, SW = 22, C = 2 * Math.PI * R, GAP = dnEnts.length > 1 ? 2.5 : 0, off = 0;
        var segs = dnEnts.map(function (e, i) { var frac = e.v / dnTotal * C, len = Math.max(0.5, frac - GAP); var s = '<circle class="dn-seg" data-i="' + i + '" r="' + R + '" cx="90" cy="90" fill="none" stroke="' + PAL[i % PAL.length] + '" stroke-width="' + SW + '" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 90 90)" style="cursor:pointer;transition:opacity .15s"></circle>'; off += frac; return s; }).join('');
        var svg = '<svg viewBox="0 0 180 180" width="230" height="230" style="flex:0 0 auto;max-width:64vw">' + segs + '<text x="90" y="85" text-anchor="middle" font-size="11" fill="#8a8a8e">헌금 합계</text><text x="90" y="107" text-anchor="middle" font-size="14" font-weight="700" fill="#1d1d1f">' + won(dnTotal) + '</text></svg>';
        var legend = '<div style="flex:1;min-width:220px;display:flex;flex-direction:column;gap:2px">' + dnEnts.map(function (e, i) { return '<div class="dn-leg" data-i="' + i + '" style="display:flex;align-items:center;gap:8px;font-size:.85rem;cursor:pointer;padding:3px 7px;border-radius:7px"><span style="width:10px;height:10px;border-radius:50%;background:' + PAL[i % PAL.length] + ';flex:0 0 auto"></span><span style="flex:1;color:#1d1d1f">' + esc(e.k) + '</span><b style="font-variant-numeric:tabular-nums">' + won(e.v) + '</b><span style="color:#9aa5b1;width:42px;text-align:right">' + (e.v / dnTotal * 100).toFixed(0) + '%</span></div>'; }).join('') + '</div>';
        return '<div><div style="display:flex;gap:22px;flex-wrap:wrap;align-items:center;justify-content:center;margin-top:12px">' + svg + legend + '</div>' +
          '<div id="dnDetail" style="margin-top:14px;padding:11px 14px;background:#f6f8fb;border:1px solid #eef1f5;border-radius:10px;font-size:.9rem;color:#7b8794">항목(도넛·범례)을 클릭하면 금액·비율·건수가 표시됩니다.</div></div>';
      }

      var wkCols = [{ label: '지난주', from: lastWk.from, to: lastWk.to }, { label: '이번주', from: thisWk.from, to: thisWk.to }];
      function totMap(m) { var s = 0; for (var k in m) s += m[k]; return s; }
      var incLT = totMap(sumByAcc('수입', lastWk.from, lastWk.to)), incTT = totMap(sumByAcc('수입', thisWk.from, thisWk.to));
      var expLT = totMap(sumByAcc('지출', lastWk.from, lastWk.to)), expTT = totMap(sumByAcc('지출', thisWk.from, thisWk.to));
      var incFYt = totMap(incFY), expFYt = totMap(sumByAcc('지출', fyR.from, fyR.to));
      function wkRight(l, t) { return '<span style="color:#9aa5b1">지난주</span> <b>' + won(l) + '</b> <span style="color:#9aa5b1">· 이번주</span> <b>' + won(t) + '</b>'; }
      function cardHead(title, color, right) { return '<div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px"><b style="color:' + color + '">' + title + '</b><span style="font-size:.85rem">' + right + '</span></div>'; }
      panel.innerHTML =
        // 월별 차트 + 도넛 (상단)
        '<div class="fin-card"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(330px,100%),1fr));gap:24px">' +
          '<div style="min-width:0"><b>📊 월별 수입·지출</b> <span style="font-size:.76rem"><span style="color:#34C759">● 수입</span> <span style="color:#FF3B30">● 지출</span> <span style="color:#9aa5b1">· ' + esc(fyMonths[0]) + ' ~ ' + esc(fyMonths[11]) + ' · 막대를 누르면 금액</span></span>' +
            '<div id="mcWrap" style="position:relative;margin-top:14px">' + monthChart() + '<div id="mcTip" style="position:absolute;display:none;background:#1A3A2F;color:#fff;font-size:.76rem;line-height:1.45;padding:6px 9px;border-radius:7px;pointer-events:none;white-space:nowrap;z-index:5;box-shadow:0 4px 12px rgba(0,0,0,.25)"></div></div></div>' +
          '<div><b>🍩 헌금 항목별 (연간)</b>' + donut() + '</div>' +
        '</div></div>' +
        // KPI 요약
        '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px">' + stat('전기 이월금', carry, '#7b8794') + stat('당기 수입', ti, '#1e874b') + stat('당기 지출', te, '#c0392b') + stat('현재 잔액', bal, '#1A3A2F') + '</div>' +
        // 주간 수입/지출 현황
        '<h3 style="margin:6px 0 10px;color:var(--accent,#1A3A2F)">주간 현황 <span style="font-size:.8rem;font-weight:400;color:#9aa5b1">지난주 ' + esc(lastWk.from) + '~' + esc(lastWk.to) + ' · 이번주 ' + esc(thisWk.from) + '~' + esc(thisWk.to) + '</span></h3>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(330px,100%),1fr));gap:16px;margin-bottom:8px">' +
          '<div class="fin-card">' + cardHead('＋ 수입 현황', '#1e874b', wkRight(incLT, incTT)) + statusTable('수입', wkCols) + '</div>' +
          '<div class="fin-card">' + cardHead('－ 지출 현황', '#c0392b', wkRight(expLT, expTT)) + statusTable('지출', wkCols) + '</div>' +
        '</div>' +
        // 연간 현황
        '<h3 style="margin:22px 0 10px;color:var(--accent,#1A3A2F)">' + M.fy + '년 현황 <span style="font-size:.8rem;font-weight:400;color:#9aa5b1">' + esc(fyR.from) + ' ~ ' + esc(fyR.to) + '</span></h3>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(330px,100%),1fr));gap:16px">' +
          '<div class="fin-card">' + cardHead('수입 (연간 누계)', '#1e874b', '<b style="color:#1e874b">' + won(incFYt) + '원</b>') + statusTable('수입', [{ label: '금액', from: fyR.from, to: fyR.to }]) + '</div>' +
          '<div class="fin-card">' + cardHead('지출 (연간 누계)', '#c0392b', '<b style="color:#c0392b">' + won(expFYt) + '원</b>') + statusTable('지출', [{ label: '금액', from: fyR.from, to: fyR.to }]) + '</div>' +
        '</div>';
      var mcWrap = panel.querySelector('#mcWrap'), mcTip = panel.querySelector('#mcTip');
      // 그래프를 실제 칸 폭에 맞춰 다시 그리고, 막대에 마우스를 올리거나(PC) 누르면(휴대폰) 금액을 보여 준다
      function drawChart() {
        if (!mcWrap || !mcWrap.isConnected) return false;
        var old = mcWrap.querySelector('svg, p'); var w = mcWrap.clientWidth;
        if (!w) return true;
        var tmp = document.createElement('div'); tmp.innerHTML = monthChart(w);
        if (old) mcWrap.replaceChild(tmp.firstChild, old); else mcWrap.insertBefore(tmp.firstChild, mcTip);
        Array.prototype.forEach.call(mcWrap.querySelectorAll('.mc-hit'), function (h) {
          function show(e) {
            var m = h.getAttribute('data-m'), x = months[m];
            mcTip.innerHTML = '<b>' + (+m.slice(0, 4)) + '년 ' + (+m.slice(5)) + '월</b><br>' + (x ? '수입 ' + won(x.inc) + '원<br>지출 ' + won(x.exp) + '원<br>차액 ' + won(x.inc - x.exp) + '원' : (m > nowYM ? '아직 오지 않은 달' : '기록 없음'));
            var r = mcWrap.getBoundingClientRect(), px = e.clientX - r.left + 12, py = e.clientY - r.top + 10;
            if (px > r.width - 140) px = e.clientX - r.left - 140;
            if (px < 0) px = 0;
            mcTip.style.left = px + 'px'; mcTip.style.top = py + 'px'; mcTip.style.display = 'block';
          }
          h.addEventListener('mousemove', show); h.addEventListener('mouseenter', show); h.addEventListener('click', show);
          h.addEventListener('mouseleave', function () { mcTip.style.display = 'none'; });
        });
        return true;
      }
      if (mcWrap && mcTip) {
        drawChart();
        var rsT = null, lastW = mcWrap.clientWidth;
        var onRs = function () { clearTimeout(rsT); rsT = setTimeout(function () { if (!mcWrap.isConnected) { window.removeEventListener('resize', onRs); return; } if (mcWrap.clientWidth !== lastW) { lastW = mcWrap.clientWidth; drawChart(); } }, 150); };
        window.addEventListener('resize', onRs);
      }
      // 도넛 클릭 → 상세(금액·비율·건수) + 선택 강조
      var dnDetail = panel.querySelector('#dnDetail');
      function selDonut(i) {
        var e = dnEnts[i]; if (!e || !dnDetail) return;
        dnDetail.innerHTML = '<span style="display:inline-block;width:13px;height:13px;border-radius:50%;background:' + PAL[i % PAL.length] + ';margin-right:9px;vertical-align:middle"></span><b style="color:#1d1d1f">' + esc(e.k) + '</b> &nbsp;·&nbsp; <b style="color:#1e874b">' + won(e.v) + '원</b> &nbsp;·&nbsp; ' + (e.v / dnTotal * 100).toFixed(1) + '% &nbsp;·&nbsp; ' + (dnCount[e.k] || 0) + '건';
        Array.prototype.forEach.call(panel.querySelectorAll('.dn-seg'), function (s) { s.style.opacity = (+s.getAttribute('data-i') === i) ? '1' : '0.25'; });
        Array.prototype.forEach.call(panel.querySelectorAll('.dn-leg'), function (l) { l.style.background = (+l.getAttribute('data-i') === i) ? '#eef4fb' : 'transparent'; });
      }
      Array.prototype.forEach.call(panel.querySelectorAll('.dn-seg,.dn-leg'), function (x) { x.addEventListener('click', function () { selDonut(+x.getAttribute('data-i')); }); });
    }).catch(function (e) { panel.innerHTML = msgCard('조회 실패', e.message); });
  }

  function accOptions(type, group) {
    return M.accounts.filter(function (a) { return String(a['구분']) === type && (!group || String(a['분류']) === group); })
      .map(function (a) { return '<option value="' + esc(a['계정명']) + '">' + esc(a['계정명']) + '</option>'; }).join('');
  }
  function svcOptions() { return M.services.map(function (s) { return '<option value="' + esc(s['예배명']) + '">' + esc(s['예배명']) + '</option>'; }).join(''); }
  function loading(el) { el.innerHTML = '<p class="qt-loading">불러오는 중…</p>'; }

  /* ── 헌금입력 (입력/조회 서브탭) ── */
  function renderOffering(panel) {
    panel.innerHTML =
      '<div style="display:flex;gap:8px;margin-bottom:14px">' +
      '<button type="button" class="btn os2" data-s="input">＋ 입력</button>' +
      '<button type="button" class="btn os2" data-s="lookup">🔍 조회</button>' +
      '</div><div id="o_sub"></div>';
    var sub = panel.querySelector('#o_sub');
    var tabs = panel.querySelectorAll('.os2');
    function setA(b) { Array.prototype.forEach.call(tabs, function (x) { x.style.background = '#fff'; x.style.color = 'var(--accent,#1A3A2F)'; x.style.border = '1px solid #cdd7e3'; }); b.style.background = 'var(--accent,#1A3A2F)'; b.style.color = '#fff'; b.style.border = '1px solid var(--accent,#1A3A2F)'; }
    function show(s, b) { setA(b); if (s === 'lookup') renderOfferingLookup(sub); else renderOfferingInput(sub); }
    Array.prototype.forEach.call(tabs, function (b) { b.onclick = function () { show(b.dataset.s, b); }; });
    show('input', tabs[0]);
  }

  // 조회: 이름·기간으로 헌금 즉시 검색
  function renderOfferingLookup(panel) {
    panel.innerHTML =
      '<div class="fin-card"><div class="fin-grid">' +
      '<div class="form-field"><label>헌금자 이름</label><input type="text" id="oq_name" placeholder="이름 일부"></div>' +
      '<div class="form-field"><label>시작일</label><input type="date" id="oq_from"></div>' +
      '<div class="form-field"><label>종료일</label><input type="date" id="oq_to"></div>' +
      '<div class="form-field" style="align-self:end"><button class="btn btn-solid" id="oq_go">조회</button></div>' +
      '</div></div><div id="oq_out"></div>';
    var out = panel.querySelector('#oq_out');
    function draw() {
      loading(out);
      ensureVouchers().then(function () {
        var nm = panel.querySelector('#oq_name').value.trim();
        var f = panel.querySelector('#oq_from').value, t = panel.querySelector('#oq_to').value;
        var list = M.vouchers.filter(function (x) {
          if (String(x['종류']) !== '헌금') return false;
          var d = fmtD(x['일자']);
          if (f && d < f) return false; if (t && d > t) return false;
          if (nm && String(x['헌금자'] || '').indexOf(nm) < 0) return false;
          return true;
        }).sort(function (a, b) { return fmtD(b['일자']).localeCompare(fmtD(a['일자'])); });
        var tot = list.reduce(function (s, x) { return s + (Number(x['금액']) || 0); }, 0);
        if (!list.length) { out.innerHTML = '<div class="fin-card">조회된 헌금이 없습니다.</div>'; return; }
        out.innerHTML = '<div class="fin-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b>' + list.length + '건</b><b style="color:#1e874b">' + won(tot) + '원</b></div><div style="overflow:auto;max-height:520px"><table class="fin-table"><thead><tr><th>일자</th><th>항목</th><th>헌금자</th><th class="num">금액</th></tr></thead><tbody>' +
          list.map(function (x) { return '<tr><td style="white-space:nowrap">' + esc(fmtD(x['일자'])) + '</td><td>' + esc(x['계정'] || '') + '</td><td>' + esc(x['헌금자'] || '') + '</td><td class="num">' + won(x['금액']) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
      }).catch(function (e) { out.innerHTML = msgCard('조회 실패', e.message); });
    }
    panel.querySelector('#oq_go').onclick = draw;
    panel.querySelector('#oq_name').addEventListener('keydown', function (e) { if (e.key === 'Enter') draw(); });
    draw();
  }

  // 입력 폼
  function renderOfferingInput(panel) {
    panel.innerHTML =
      '<div class="fin-card"><div class="fin-grid">' +
      '<div class="form-field"><label>일자 <span id="o_dow" style="font-weight:400;font-size:.82rem"></span></label><input type="date" id="o_date" value="' + lastSunday() + '"></div>' +
      '<div class="form-field"><label>예배</label><select id="o_svc">' + svcOptions() + '</select></div>' +
      '<div class="form-field"><label>헌금 항목</label><select id="o_acc">' + accOptions('수입', '헌금') + '</select></div>' +
      '<div class="form-field"><label>수단</label><select id="o_method"><option>현금</option><option>통장</option></select></div>' +
      '</div><div class="fin-grid">' +
      '<div class="form-field"><label>헌금자(교적 검색)</label><div style="position:relative"><input type="text" id="o_payer" autocomplete="off" lang="ko" inputmode="text" placeholder="이름 입력 → 선택"></div><input type="hidden" id="o_key"><input type="hidden" id="o_spouseKey"></div>' +
      '<div class="form-field"><label>배우자(선택)</label><div style="position:relative"><input type="text" id="o_spouse" autocomplete="off" lang="ko" inputmode="text" placeholder="부부 함께 시 자동 · 직접 선택 가능"></div><input type="hidden" id="o_spouse_key"><label class="sw" style="font-size:.8rem;display:inline-flex;align-items:center;gap:5px;margin-top:5px;color:#1e874b;cursor:pointer"><input type="checkbox" id="o_couple_top" style="width:auto;margin:0"> 💑 부부 함께(자동 채움)</label></div>' +
      '<div class="form-field"><label>금액</label><input type="text" id="o_amt" lang="ko" placeholder="0" style="text-align:right;font-weight:700"></div>' +
      '<div class="form-field"><label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="o_memo_on" style="width:auto;margin:0"> 적요 입력(선택)</label><input type="text" id="o_memo" disabled placeholder="체크하면 입력"></div>' +
      '</div><div style="margin-top:6px;display:flex;gap:10px;align-items:center;"><button class="btn btn-solid" id="o_add">＋ 헌금 추가</button><span class="fin-msg" id="o_msg"></span></div></div><div id="o_today"></div>';
    dateBadge(panel.querySelector('#o_date'), panel.querySelector('#o_dow'));
    var payerEl = panel.querySelector('#o_payer'), spouseEl = panel.querySelector('#o_spouse'), coupleTop = panel.querySelector('#o_couple_top');
    var lastPick = null;
    function focusAmt() { setTimeout(function () { var a = panel.querySelector('#o_amt'); if (a) { a.focus(); a.select(); } }, 0); }
    setupMemberSearch(payerEl, panel.querySelector('#o_key'), function (m) {
      panel.querySelector('#o_spouseKey').value = (m && m.spouseKey) || '';
      lastPick = m ? { name: m.name, spouse: m.spouse || '' } : null;
      if (coupleTop.checked && m && m.spouse) spouseEl.value = m.spouse;  // 부부 함께 → 배우자칸 자동 채움
      focusAmt();
    });
    setupMemberSearch(spouseEl, panel.querySelector('#o_spouse_key'), function () { focusAmt(); }); // 배우자 직접 검색/선택
    coupleTop.addEventListener('change', function () { if (coupleTop.checked && lastPick && lastPick.spouse && !spouseEl.value.trim()) spouseEl.value = lastPick.spouse; });
    var amt = panel.querySelector('#o_amt');
    amt.addEventListener('input', function () { var n = parseNum(amt.value); amt.value = n ? won(n) : ''; });
    function doAddOffering(v) {
      var msg = panel.querySelector('#o_msg');
      msg.style.color = '#7b8794'; msg.textContent = '저장 중…';
      WPF.call('addVoucher', { voucher: v }).then(function () { msg.style.color = 'green'; msg.textContent = '✓ 추가됨'; panel.querySelector('#o_payer').value = ''; panel.querySelector('#o_key').value = ''; panel.querySelector('#o_spouseKey').value = ''; panel.querySelector('#o_spouse').value = ''; panel.querySelector('#o_spouse_key').value = ''; amt.value = ''; panel.querySelector('#o_memo').value = ''; M.loaded = false; loadToday(v.date); panel.querySelector('#o_payer').focus(); }).catch(function (e) { msg.style.color = '#c0392b'; msg.textContent = e.message; });
    }
    function submitOffering() {
      var base = panel.querySelector('#o_payer').value.trim().replace(/\s*\([^)]*\)\s*$/, '');
      var spouse = panel.querySelector('#o_spouse').value.trim();
      var payerName = base + (spouse ? ' (' + spouse + ')' : '');
      var v = { date: panel.querySelector('#o_date').value, type: '수입', kind: '헌금', account: panel.querySelector('#o_acc').value, service: panel.querySelector('#o_svc').value, payer: payerName, memberKey: panel.querySelector('#o_key').value, amount: parseNum(amt.value), method: panel.querySelector('#o_method').value, memo: panel.querySelector('#o_memo').value.trim() };
      var msg = panel.querySelector('#o_msg');
      if (!v.date || !v.amount) { msg.style.color = '#c0392b'; msg.textContent = '일자와 금액을 입력하세요.'; return; }
      // 주일이 아닌 날짜는 한 번 묻는다(같은 날짜로 이어서 넣을 때는 한 번만)
      if (!isSunday(v.date) && panel._dateOk !== v.date) {
        if (!confirm('일자가 ' + v.date + '(' + dowOf(v.date) + ')입니다. 주일이 아닙니다.\n\n이 날짜로 넣을까요?\n(주일 헌금이면 [취소]를 누르고 일자를 고쳐 주세요)')) { msg.style.color = '#c0392b'; msg.textContent = '일자를 확인해 주세요.'; return; }
        panel._dateOk = v.date;
      }
      // 교적 매칭 확인: 선택(매칭키)도 없고 이름이 교적에 없으면 → 등록 팝업
      if (!v.memberKey && base) {
        var hits = M.members.filter(function (m) { return m.name === base; });
        if (hits.length === 1) { v.memberKey = hits[0].key; doAddOffering(v); return; }
        if (hits.length === 0) {
          askRegister(base, function (res) {
            if (!res) { msg.style.color = '#c0392b'; msg.textContent = '취소되었습니다.'; return; }
            if (res.key) { v.memberKey = res.key; v.payer = res.name + (spouse ? ' (' + spouse + ')' : ''); }
            doAddOffering(v);
          });
          return;
        }
      }
      doAddOffering(v);
    }
    panel.querySelector('#o_add').onclick = submitOffering;
    // 빠른 입력: 적요 체크박스 토글 + 금액에서 Enter/Tab 즉시 추가
    var memoOn = panel.querySelector('#o_memo_on'), memoEl = panel.querySelector('#o_memo');
    memoOn.addEventListener('change', function () { memoEl.disabled = !memoOn.checked; if (memoOn.checked) memoEl.focus(); else memoEl.value = ''; });
    amt.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); if (memoOn.checked) memoEl.focus(); else submitOffering(); }
      else if (e.key === 'Tab' && !e.shiftKey && !memoOn.checked) { e.preventDefault(); submitOffering(); }
    });
    memoEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submitOffering(); } });
    var box = panel.querySelector('#o_today');
    function loadToday(d) {
      loading(box);
      ensureVouchers().then(function () {
        var list = M.vouchers.filter(function (x) { return fmtD(x['일자']) === d && String(x['종류']) === '헌금'; });
        var tot = list.reduce(function (s, x) { return s + (Number(x['금액']) || 0); }, 0);
        if (!list.length) { box.innerHTML = '<div class="fin-card"><b>' + esc(d) + '</b> 헌금 내역이 없습니다.</div>'; return; }
        var byId = {}; list.forEach(function (x) { byId[x['전표ID']] = x; });
        box.innerHTML = '<div class="fin-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b>' + esc(d) + ' 헌금</b><div style="display:flex;gap:10px;align-items:center"><button class="btn btn-line" style="padding:4px 12px;font-size:.8rem" data-bulk>🗑 선택 삭제</button><b style="color:#1e874b">' + won(tot) + '원</b></div></div><div style="overflow:auto"><table class="fin-table"><thead><tr><th style="width:30px;text-align:center"><input type="checkbox" data-all></th><th>예배</th><th>항목</th><th>헌금자</th><th class="num">금액</th><th>입력/수정</th><th>관리</th></tr></thead><tbody>' +
          list.map(function (x) { return '<tr><td style="text-align:center"><input type="checkbox" class="rowck" value="' + esc(x['전표ID']) + '"></td><td>' + esc(x['예배'] || '') + '</td><td>' + esc(x['계정']) + '</td><td>' + esc(x['헌금자'] || '') + '</td><td class="num">' + won(x['금액']) + '</td><td style="font-size:.74rem;color:#7b8794;white-space:nowrap">' + auditText(x) + '</td><td style="white-space:nowrap"><button class="btn btn-line" style="padding:3px 9px;font-size:.78rem" data-edit="' + esc(x['전표ID']) + '">수정</button> <button class="btn btn-line" style="padding:3px 9px;font-size:.78rem" data-del="' + esc(x['전표ID']) + '">삭제</button></td></tr>'; }).join('') + '</tbody></table></div></div>';
        wireChecks(box, function () { loadToday(d); });
        Array.prototype.forEach.call(box.querySelectorAll('[data-edit]'), function (b) { b.onclick = function () { openEditor(byId[b.dataset.edit], function () { loadToday(d); }); }; });
        Array.prototype.forEach.call(box.querySelectorAll('[data-del]'), function (b) { b.onclick = function () { if (!confirm('삭제할까요?')) return; WPF.call('deleteVoucher', { id: b.dataset.del }).then(function () { M.loaded = false; loadToday(d); }); }; });
      }).catch(function (e) { box.innerHTML = msgCard('조회 실패', e.message); });
    }
    panel.querySelector('#o_date').addEventListener('change', function () { loadToday(this.value); });
    loadToday(panel.querySelector('#o_date').value);
  }
  function setupMemberSearch(input, hidden, onPick) {
    var pop = null, hi = -1, matches = [];
    function close() { if (pop) { pop.remove(); pop = null; hi = -1; } }
    input.addEventListener('input', function () {
      hidden.value = ''; var q = input.value.trim().toLowerCase(); close(); if (!q) return;
      matches = M.members.filter(function (m) { return (m.name || '').toLowerCase().indexOf(q) >= 0; }).slice(0, 8); if (!matches.length) return;
      pop = document.createElement('div'); pop.className = 'fin-sugg';
      pop.style.top = '100%'; pop.style.left = '0'; pop.style.right = '0'; pop.style.marginTop = '4px'; pop.style.minWidth = '0';
      matches.forEach(function (m) { var bd = (String(m.key || '').split('|')[1]) || ''; var bs = bd.length === 8 ? bd.slice(0, 4) + '-' + bd.slice(4, 6) + '-' + bd.slice(6, 8) : String(m.birth || '').slice(0, 10); var d = document.createElement('div'); d.innerHTML = esc(m.name) + ' <span style="color:#9aa5b1;font-size:.78rem">' + esc(bs) + ' · ' + esc(m.group || '') + '</span>'; d.onmousedown = function (e) { e.preventDefault(); pick(m); }; pop.appendChild(d); });
      input.parentElement.appendChild(pop);
    });
    input.addEventListener('keydown', function (e) { if (!pop) return; var rows = pop.querySelectorAll('div'); if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hi + 1, rows.length - 1); } else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(hi - 1, 0); } else if (e.key === 'Enter') { if (matches.length) { e.preventDefault(); pick(matches[hi >= 0 ? hi : 0]); } return; } else if (e.key === 'Escape') { close(); return; } else return; Array.prototype.forEach.call(rows, function (r, i) { r.classList.toggle('hi', i === hi); }); });
    input.addEventListener('blur', function () { setTimeout(close, 180); });
    function pick(m) { input.value = m.name; hidden.value = m.key || ''; close(); if (onPick) onPick(m); }
  }
  // 계정 검색 자동완성: 🔍 클릭→전체, 입력→계정명/항으로 필터·추천
  function setupAccountSearch(input, hidden, accs, container, btn, onPick) {
    var pop = null, hi = -1, matches = [];
    function close() { if (pop) { pop.remove(); pop = null; hi = -1; } }
    function hangOf(a) { return a['분류'] || a['상위'] || '(미분류)'; }
    function open(q) {
      close(); q = String(q || '').trim().toLowerCase();
      matches = accs.filter(function (a) {
        if (!q) return true;
        return String(a['계정명'] || '').toLowerCase().indexOf(q) >= 0 || String(hangOf(a)).toLowerCase().indexOf(q) >= 0;
      }).slice(0, 300);
      if (!matches.length) { return; }
      pop = document.createElement('div'); pop.className = 'fin-sugg';
      pop.style.maxHeight = '300px'; pop.style.top = '100%'; pop.style.left = '0'; pop.style.right = '0'; pop.style.marginTop = '4px'; pop.style.minWidth = '0';
      matches.forEach(function (a) {
        var d = document.createElement('div');
        d.innerHTML = '<b>' + esc(a['계정명']) + '</b> <span style="color:#9aa5b1;font-size:.78rem;float:right">' + esc(hangOf(a)) + '</span>';
        d.addEventListener('mousedown', function (e) { e.preventDefault(); pick(a); });
        pop.appendChild(d);
      });
      (container || input.parentElement).appendChild(pop);
    }
    function pick(a) { var h = a['분류'] || a['상위'] || ''; input.value = (h && h !== '(미분류)') ? (h + '-' + a['계정명']) : a['계정명']; hidden.value = a['계정명']; close(); if (onPick) onPick(a); }
    input.addEventListener('input', function () { hidden.value = ''; open(input.value); });
    input.addEventListener('focus', function () { if (!pop) open(input.value); });
    input.addEventListener('keydown', function (e) {
      if (!pop) { if (e.key === 'ArrowDown') open(input.value); return; }
      var rows = pop.querySelectorAll('div');
      if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hi + 1, rows.length - 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(hi - 1, 0); }
      else if (e.key === 'Enter') { if (matches.length) { e.preventDefault(); pick(matches[hi >= 0 ? hi : 0]); } return; }
      else if (e.key === 'Escape') { close(); return; }
      else return;
      Array.prototype.forEach.call(rows, function (r, i) { r.classList.toggle('hi', i === hi); if (i === hi) r.scrollIntoView({ block: 'nearest' }); });
    });
    input.addEventListener('blur', function () { setTimeout(close, 180); });
    if (btn) btn.onclick = function () { input.focus(); if (pop) close(); else open(''); };
  }

  var ymdStr = function (v) { return String(v == null ? '' : v).slice(0, 10); };

  /* ── 교적 등록 팝업(헌금 입력 중 새 이름) ── */
  function askRegister(name, cb) {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px';
    ov.innerHTML = '<div class="fin-card" style="max-width:420px;width:100%;background:#fff">' +
      '<h3 style="margin:0 0 8px;color:var(--accent,#1A3A2F)">교적에 등록할까요?</h3>' +
      '<p style="color:var(--ink-soft);font-size:.88rem;margin-bottom:14px"><b>' + esc(name) + '</b>님은 교적에 없습니다. 등록하면 다음부터 검색·헌금 집계가 연결됩니다. <b>생년월일은 비워도 됩니다.</b></p>' +
      '<div class="form-field"><label>이름</label><input type="text" id="rg_name" value="' + esc(name) + '"></div>' +
      '<div class="form-field" style="margin-top:8px"><label>생년월일 (선택)</label><input type="text" id="rg_birth" maxlength="10" placeholder="예: 1981-08-19 (없으면 비움)" inputmode="numeric"></div>' +
      '<div style="display:flex;gap:8px;align-items:center;margin-top:16px;flex-wrap:wrap"><button class="btn btn-solid" id="rg_save">교적 등록 후 추가</button><button class="btn btn-line" id="rg_skip">등록 없이 추가</button><button class="btn btn-line" id="rg_cancel">취소</button></div>' +
      '<span class="fin-msg" id="rg_msg" style="display:block;margin-top:8px"></span></div>';
    document.body.appendChild(ov);
    function close() { ov.remove(); }
    ov.addEventListener('click', function (e) { if (e.target === ov) { close(); cb(null); } });
    ov.querySelector('#rg_cancel').onclick = function () { close(); cb(null); };
    ov.querySelector('#rg_skip').onclick = function () { close(); cb({ key: '', name: name }); };
    ov.querySelector('#rg_save').onclick = function () {
      var nm = ov.querySelector('#rg_name').value.trim();
      var birth = ov.querySelector('#rg_birth').value.replace(/[^0-9]/g, '');
      var msg = ov.querySelector('#rg_msg');
      if (!nm) { msg.style.color = '#c0392b'; msg.textContent = '이름을 입력하세요.'; return; }
      if (birth && birth.length !== 8) { msg.style.color = '#c0392b'; msg.textContent = '생년월일은 8자리(예: 19810819)로 입력하거나 비워 두세요.'; return; }
      msg.style.color = '#7b8794'; msg.textContent = '교적 등록 중…';
      WPF.call('addGyojeok', { name: nm, birth: birth }).then(function (r) {
        WPF.call('masters').then(function (m) { M.members = m.members || M.members; }).catch(function () { });
        close(); cb({ key: r.key, name: nm });
      }).catch(function (e) {
        if (/unknown action/i.test(e.message)) { msg.style.color = '#c0392b'; msg.textContent = '교적 등록은 Apps Script 재배포 후 가능합니다. 우선 "등록 없이 추가"를 눌러 주세요.'; }
        else { msg.style.color = '#c0392b'; msg.textContent = '등록 실패: ' + e.message; }
      });
    };
  }

  /* ── 전표 수정 모달(헌금/지출 공용) ── */
  function openEditor(x, onSaved) {
    if (!x) return;
    var isExp = String(x['구분']) === '지출';
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px';
    ov.innerHTML = '<div class="fin-card" style="max-width:460px;width:100%;background:#fff;max-height:90vh;overflow:auto">' +
      '<h3 style="margin:0 0 14px;color:var(--accent,#1A3A2F)">' + (isExp ? '지출' : '헌금') + ' 전표 수정</h3>' +
      '<div class="form-field"><label>일자</label><input type="date" id="ed_date" value="' + esc(ymdStr(x['일자'])) + '"></div>' +
      '<div class="form-field"><label>계정</label><select id="ed_acc">' + (isExp ? accOptions('지출') : accOptions('수입', '헌금')) + '</select></div>' +
      (isExp ? '' : '<div class="form-field"><label>예배</label><select id="ed_svc">' + svcOptions() + '</select></div>') +
      '<div class="form-field"><label>' + (isExp ? '거래처/수령인' : '헌금자') + '</label><input type="text" id="ed_payer" value="' + esc(x['헌금자'] || '') + '"></div>' +
      '<div class="form-field"><label>금액</label><input type="text" id="ed_amt" inputmode="numeric" value="' + won(x['금액']) + '" style="text-align:right;font-weight:700"></div>' +
      '<div class="form-field"><label>수단</label><select id="ed_method"><option>현금</option><option>통장</option></select></div>' +
      '<div class="form-field"><label>적요</label><input type="text" id="ed_memo" value="' + esc(x['적요'] || '') + '"></div>' +
      '<div style="display:flex;gap:10px;align-items:center;margin-top:16px"><button class="btn btn-solid" id="ed_save">저장</button><button class="btn btn-line" id="ed_cancel">취소</button><span class="fin-msg" id="ed_msg"></span></div>' +
      '<p style="margin:12px 0 0;font-size:.76rem;color:#9aa5b1;border-top:1px solid #eef1f5;padding-top:8px">' + auditText(x) + '</p></div>';
    document.body.appendChild(ov);
    ov.querySelector('#ed_acc').value = x['계정'] || '';
    if (!isExp) ov.querySelector('#ed_svc').value = x['예배'] || '';
    ov.querySelector('#ed_method').value = x['수단'] || '현금';
    var amtI = ov.querySelector('#ed_amt');
    amtI.addEventListener('input', function () { var n = parseNum(amtI.value); amtI.value = n ? won(n) : ''; });
    function close() { ov.remove(); }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('#ed_cancel').onclick = close;
    ov.querySelector('#ed_save').onclick = function () {
      var v = {
        date: ov.querySelector('#ed_date').value, type: x['구분'], kind: x['종류'],
        account: ov.querySelector('#ed_acc').value, service: isExp ? '' : ov.querySelector('#ed_svc').value,
        payer: ov.querySelector('#ed_payer').value.trim(), memberKey: x['매칭키'] || '',
        amount: parseNum(amtI.value), method: ov.querySelector('#ed_method').value, memo: ov.querySelector('#ed_memo').value.trim()
      };
      var msg = ov.querySelector('#ed_msg');
      if (!v.date || !v.amount) { msg.style.color = '#c0392b'; msg.textContent = '일자·금액을 확인하세요.'; return; }
      msg.style.color = '#7b8794'; msg.textContent = '저장 중…';
      WPF.call('updateVoucher', { id: x['전표ID'], voucher: v }).then(function () { M.loaded = false; close(); if (onSaved) onSaved(); }).catch(function (e) { msg.style.color = '#c0392b'; msg.textContent = e.message; });
    };
  }

  /* ── 엑셀(.xlsx) → 2차원 배열(행×열, 문자열). JSZip으로 압축 해제 후 XML 파싱 ── */
  function xlsxColToIdx(ref) { var s = String(ref).replace(/[0-9]+$/, ''); var n = 0; for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64); return n - 1; }
  function sheetXmlToRows(xml, shared) {
    var doc = new DOMParser().parseFromString(xml, 'application/xml');
    var rowEls = doc.getElementsByTagName('row'), rows = [];
    for (var r = 0; r < rowEls.length; r++) {
      var cEls = rowEls[r].getElementsByTagName('c'), arr = [];
      for (var c = 0; c < cEls.length; c++) {
        var cell = cEls[c], idx = xlsxColToIdx(cell.getAttribute('r') || ''), t = cell.getAttribute('t'), val = '';
        if (t === 's') { var vEl = cell.getElementsByTagName('v')[0]; if (vEl) val = shared[Number(vEl.textContent)] || ''; }
        else if (t === 'inlineStr') { var isEls = cell.getElementsByTagName('t'); for (var k = 0; k < isEls.length; k++) val += isEls[k].textContent; }
        else { var vE = cell.getElementsByTagName('v')[0]; if (vE) val = vE.textContent; }
        if (idx >= 0) { while (arr.length < idx) arr.push(''); arr[idx] = String(val == null ? '' : val).trim(); }
      }
      rows.push(arr);
    }
    return rows;
  }
  function parseXlsx(arrayBuffer) {
    if (!window.JSZip) return Promise.reject(new Error('압축 해제 모듈(JSZip)이 로드되지 않았습니다. 새로고침 후 다시 시도해 주세요.'));
    return window.JSZip.loadAsync(arrayBuffer).then(function (zip) {
      var ssFile = zip.file('xl/sharedStrings.xml');
      return (ssFile ? ssFile.async('string') : Promise.resolve('')).then(function (ssXml) {
        var shared = [];
        if (ssXml) {
          var sdoc = new DOMParser().parseFromString(ssXml, 'application/xml'), sis = sdoc.getElementsByTagName('si');
          for (var i = 0; i < sis.length; i++) { var ts = sis[i].getElementsByTagName('t'), txt = ''; for (var j = 0; j < ts.length; j++) txt += ts[j].textContent; shared.push(txt); }
        }
        var sheetNames = Object.keys(zip.files).filter(function (n) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(n); }).sort();
        if (!sheetNames.length) return [];
        return Promise.all(sheetNames.map(function (n) { return zip.file(n).async('string'); })).then(function (xmls) {
          var best = [], bestCount = -1;   // 셀이 가장 많은 시트를 데이터 시트로 채택(빈 'Worksheet' 시트 제외)
          xmls.forEach(function (xml) { var rows = sheetXmlToRows(xml, shared); var cnt = rows.reduce(function (s, r) { return s + r.filter(function (c) { return c !== ''; }).length; }, 0); if (cnt > bestCount) { bestCount = cnt; best = rows; } });
          return best;
        });
      });
    });
  }
  // 헌금 항목(계정) 후보 — 파일 종류 자동판별·항목 인식에 사용
  var OFFER_CATS = { '십일조': 1, '감사헌금': 1, '주일헌금': 1, '생일감사': 1, '맥추절': 1, '맥추감사': 1, '추수감사': 1, '건축헌금': 1, '선교헌금': 1, '유년부': 1, '차량헌금': 1, '일천번기도': 1, '절기헌금': 1, '임직헌금': 1, '특별헌금': 1, '주정헌금': 1, '심방헌금': 1, '장학헌금': 1 };

  /* ── 엑셀 자동입력 (헌금자 리스트/재정보고서 드래그&드롭 → 자동분류 → 미리보기 → 저장) ── */
  function renderBulk(panel) {
    // 헌금자 칸에 두 사람 이상이 적혔을 때 교적을 찾을 기준이 되는 '맨 앞 이름'.
    //   "홍길동 김영희" · "홍길동·김영희" · "홍길동, 김영희" · "홍길동 외 1명" → "홍길동"
    //   "홍길동 집사" 처럼 직분이 붙은 경우도 "홍길동" 으로 찾는다.
    function firstName(s) {
      var n = String(s == null ? '' : s).replace(/\(.*\)$/, '').trim();
      n = n.split(/[·・,、/／&＆]|\s+외\s*|\s+/)[0] || '';
      return n.trim();
    }
    function normName(s) { return String(s == null ? '' : s).replace(/\s+/g, ''); }
    function isAmount(s) { return /^[\d,]+$/.test(String(s).trim()) && parseNum(s) > 0; }
    function offeringAccounts() {
      return M.accounts.filter(function (a) { return String(a['구분']) === '수입' && String(a['분류']) === '헌금'; })
        .map(function (a) { return String(a['계정명']); });
    }
    panel.innerHTML =
      '<div class="fin-card" style="border-color:#cfe0f5;background:#fbfdff">' +
      '<div id="b_drop" style="border:2px dashed #cdd7e3;border-radius:12px;padding:22px 16px;text-align:center;color:#5a6b82;cursor:pointer;transition:background .15s,border-color .15s">' +
      '<div style="font-size:1.5rem;margin-bottom:6px">📂 엑셀 파일 자동 입력</div>' +
      '<div style="font-size:.92rem"><b>헌금자 리스트</b> 또는 <b>재정보고서(지출)</b> 엑셀(.xlsx)을 여기로 <b>끌어다 놓거나</b> 클릭해서 선택하세요.</div>' +
      '<div style="font-size:.78rem;color:#9aa5b1;margin-top:6px">파일 종류를 자동 판별해 항목별로 분류하고, 헌금은 교적까지 매칭해 미리보기로 보여줍니다. (저장 전 반드시 확인)</div>' +
      '<input type="file" id="b_file" accept=".xlsx" style="display:none">' +
      '</div></div>' +
      '<div class="fin-card"><div class="fin-grid" style="align-items:end">' +
      '<div class="form-field"><label>일자(주일) <span id="b_dow" style="font-weight:400;font-size:.82rem"></span></label><input type="date" id="b_date" value="' + lastSunday() + '"><div id="b_datesrc" style="font-size:.78rem;color:#7b8794;margin-top:4px">자료에 날짜가 있으면 그 날짜로 저절로 바뀝니다.</div></div>' +
      '<div class="form-field"><label>예배</label><select id="b_svc">' + svcOptions() + '</select></div>' +
      '<div class="form-field"><label>수단</label><select id="b_method"><option>현금</option><option>통장</option></select></div>' +
      '</div>' +
      '<div class="form-field" style="margin-top:10px"><label>헌금자 명단 붙여넣기 <span style="font-weight:400;color:var(--ink-soft);font-size:.82rem">— 엑셀(헌금자 리스트)에서 항목·이름·금액 영역을 그대로 복사해 붙여넣으세요</span></label>' +
      '<textarea id="b_text" style="width:100%;min-height:190px;padding:10px;border:1px solid #dfe5ee;border-radius:8px;font:inherit;white-space:pre;overflow:auto" placeholder="십일조&#9;&#10;신용화(차영선)&#9;100000&#9;임수만(정춘란)&#9;50000&#10;감사헌금&#10;구성호&#9;50000&#9;김가엘&#9;5000 ..."></textarea></div>' +
      '<div style="display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap"><button class="btn btn-line" id="b_prev">미리보기 · 교적매칭</button><button class="btn btn-solid" id="b_save" disabled>일괄 저장</button><span class="fin-msg" id="b_msg"></span></div>' +
      '<p class="help" style="margin-top:8px">· 항목명만 있는 줄(예: 십일조, 감사헌금)은 <b>항목 구분</b>으로 인식하고, 그 아래 「이름〔탭〕금액」들을 해당 항목 헌금으로 읽습니다.<br>· 「신용화(차영선)」처럼 괄호가 있으면 <b>부부 합산</b>으로 보고 대표자(신용화)로 교적 매칭합니다. · 제목·기간·누계·합계 줄은 자동 무시됩니다.<br>· 「2026년 5월 31일(주일) 헌금 명세」처럼 <b>날짜 머리글이 있는 여러 주일을 한꺼번에</b> 붙여넣어도 각 주일 날짜로 나누어 저장합니다. 「[감사헌금] 16명 / 350000원」·「■ 총합계」가 있으면 읽은 결과와 대조해 다른 곳을 알려 줍니다.<br>· <b>이미 저장된 같은 내역은 건너뜁니다</b>(저장을 두 번 눌러도 두 번 계산되지 않습니다).</p>' +
      '</div>' +
      '<div class="fin-card" style="border-color:#f3dfb0;background:#fffdf7">' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b style="color:#8a5a00">🔍 겹쳐 저장된 전표 찾기</b>' +
      '<button class="btn btn-line" id="b_dupfind" style="padding:4px 12px;font-size:.84rem">찾기</button><span class="fin-msg" id="b_dupmsg"></span></div>' +
      '<p class="help" style="margin-top:6px">같은 날짜·항목·헌금자·금액의 수입 전표가 2건 이상이면(저장을 두 번 눌렀을 때) 여기서 찾아 <b>처음 것만 남기고</b> 나머지를 지울 수 있습니다. 지출은 보지 않습니다.</p>' +
      '<div id="b_dupout"></div></div>' +
      '<div id="b_out"></div>';

    var parsed = [];
    var mode = 'offer', parsedExp = [];   // 'offer'(헌금) | 'exp'(지출)
    var saving = false;                    // 저장 중 두 번 눌림 방지
    var expect = {};                       // 붙여넣은 글의 "[항목] N명 / 금액원"·"■ 총합계" 를 기억해 두고 읽은 결과와 대조
    // "십일조헌금"/"십일조" 처럼 "헌금·기도·제" 같은 흔한 접미어를 떼고 핵심 단어만 비교하기 위한 정규화
    function coreName(s) {
      var n = normName(s);
      var SUF = ['헌금', '기도', '제', '금'];
      var changed = true;
      while (changed) {
        changed = false;
        for (var i = 0; i < SUF.length; i++) {
          var suf = SUF[i];
          if (n.length > suf.length && n.slice(-suf.length) === suf) { n = n.slice(0, -suf.length); changed = true; }
        }
      }
      return n;
    }
    // 날짜 머리글: "2026년 5월 31일(주일) 헌금 명세" · "2026-05-31" · "2026.5.31"
    // 한 줄이 '날짜 머리글'이면 그 날짜. 헌금 내역 줄(이름(금액), 이름〔탭〕금액)은 날짜로 보지 않는다.
    function lineDate(t) {
      if (/\([\d,]+\)/.test(t) || /\t\s*[\d,]{4,}\s*$/.test(t)) return '';
      return findDate(t, { noYear: true });
    }
    var dateEl = panel.querySelector('#b_date'), dateSrc = panel.querySelector('#b_datesrc');
    var updDow = dateBadge(dateEl, panel.querySelector('#b_dow'));
    var fileDate = '', fileName = '';   // 엑셀 파일(기간·파일 이름)에서 찾은 날짜
    var autoDate = false;   // 일자 칸이 자료에서 저절로 맞춘 날짜인지(직접 고치면 false)
    function setDate(ds, src) {
      if (!ds) return;
      dateEl.value = ds; updDow(); autoDate = true;
      dateSrc.innerHTML = '📅 <b>' + esc(src) + '</b>에서 찾은 날짜로 맞췄습니다.';
      dateSrc.style.color = '#1b4b8f';
    }
    // 새 자료에 날짜가 없을 때: 앞 자료에서 저절로 맞춘 날짜가 남아 있지 않게 지난 주일로 되돌린다(직접 고친 날짜는 그대로)
    function noDataDate() {
      if (autoDate) { dateEl.value = lastSunday(); updDow(); }
      dateSrc.style.color = '#8a5a00';
      dateSrc.textContent = autoDate || !dateEl.value ? '자료에 날짜가 없어 지난 주일로 맞췄습니다. 다른 주일이면 고쳐 주세요.' : '자료에 날짜가 없어 이 칸의 날짜로 저장합니다.';
    }
    dateEl.addEventListener('change', function () { autoDate = false; dateSrc.style.color = '#7b8794'; dateSrc.textContent = '직접 고친 날짜입니다. (붙여넣은 글에 날짜 머리글이 있으면 그 날짜가 먼저입니다)'; });
    // 헌금자 칸의 이름으로 교적 찾기. 맨 앞 이름(가장)으로 먼저 찾고, 교적에 없으면 함께 적힌 다음 이름으로 찾는다.
    //   "김동배·이경순" → 김동배가 교적에 없으면 이경순으로 연결(via=1 → 미리보기에 표시)
    //   "손병민(채애리)" → 손병민, 없으면 괄호 속 채애리 / "주정일(심방)" → 심방은 이름이 아니므로 그냥 넘어감
    function matchMember(payer) {
      var s = String(payer == null ? '' : payer).trim();
      var inParen = [];
      s = s.replace(/\(([^)]*)\)/g, function (_, x) { inParen.push(x); return ' '; });
      var parts = s.split(/[·・,、/／&＆]|\s+외\s*|\s+/).concat(inParen).map(function (p) { return p.trim(); }).filter(Boolean);
      for (var i = 0; i < parts.length; i++) {
        var hits = M.members.filter(function (m) { return m.name === parts[i]; });
        if (hits.length === 1) return { key: hits[0].key, match: 'ok', matchName: hits[0].name, via: i };
        if (hits.length > 1) return { key: '', match: 'dup', matchName: '', via: i };
      }
      return { key: '', match: 'none', matchName: '', via: -1 };
    }
    function parse() {
      var accSet = {}, coreSet = {};
      offeringAccounts().forEach(function (a) { accSet[normName(a)] = a; if (!coreSet[coreName(a)]) coreSet[coreName(a)] = a; });
      var text = panel.querySelector('#b_text').value || '';
      var dEl = panel.querySelector('#b_date');
      var lines = text.split(/\r?\n/);
      var cat = '', items = [], curDate = '', firstDate = '';
      expect = {};
      lines.forEach(function (raw) {
        var t = raw.trim();
        if (!t) return;
        if (/^[\s─—\-=_·•*~]+$/.test(t)) return;                     // "────" 같은 구분선
        var ld = lineDate(t);
        if (ld && !/\t\s*[\d,]{4,}\s*$/.test(raw)) { curDate = ld; if (!firstDate) firstDate = ld; cat = ''; return; }   // 날짜 머리글(주일이 바뀜) · 엑셀의 '기간 … ~ …' 줄도 여기서 끝 날짜로
        // "[항목명] N명 / 금액원" 형식의 항목 구분 줄(헌금 명세 리포트 붙여넣기) — 사람 수·금액은 대조용으로 기억
        var bracket = t.match(/^\[(.+?)\]\s*(?:(\d+)\s*명\s*\/\s*)?([\d,]+)?\s*원?/);
        if (bracket) {
          cat = bracket[1].trim();
          if (bracket[3]) expect[curDate + '|' + normName(cat)] = { n: bracket[2] ? Number(bracket[2]) : null, sum: parseNum(bracket[3]) };
          return;
        }
        var tot = t.match(/^■\s*총\s*합\s*계\s*[:：]?\s*([\d,]+)/);
        if (tot) { expect[curDate + '|■'] = { sum: parseNum(tot[1]) }; return; }
        if (/^■/.test(t)) return;
        if (/^\(/.test(t) && /\+/.test(t)) return; // "(십일조 1200000 + 주일 180000 + ...)" 합계 내역 줄
        var cells = raw.split(/[\t ]+/).map(function (c) { return c.trim(); }).filter(function (c) { return c !== ''; });
        if (!cells.length) return;
        var joined = cells.join(' ');
        if (/^헌금자\s*리스트/.test(joined) || /^기간/.test(joined) || /누\s*계/.test(joined) || /합\s*계/.test(joined)) return;
        if (cells.length === 1 && !isAmount(cells[0]) && !/^.+\([\d,]+\)$/.test(cells[0])) { cat = cells[0]; return; } // 항목 구분 줄(단, "이름(금액)" 인라인 한 건짜리 줄은 제외)
        for (var i = 0; i < cells.length;) {
          var c = cells[i];
          var inline = c.match(/^(.+)\(([\d,]+)\)$/); // "이름(금액)" 인라인 형식
          if (inline && isAmount(inline[2])) {
            var nm = inline[1].trim();
            items.push({ date: curDate, cat: cat, rawCat: cat, payer: nm, base: firstName(nm), amount: parseNum(inline[2]) });
            i += 1;
            continue;
          }
          if (isAmount(cells[i])) { i++; continue; }
          // 금액이 나올 때까지 이어지는 낱말을 한 사람의 이름으로 본다.
          // "홍길동 김영희 50000" 처럼 두 사람이 적힌 경우, 예전에는 뒤 이름만
          // 남고 앞 이름이 버려졌다. 이제 전체를 헌금자로 적고 맨 앞 이름으로 교적을 찾는다.
          var parts = [];
          while (i < cells.length && !isAmount(cells[i])) { parts.push(cells[i]); i++; }
          if (i >= cells.length || !isAmount(cells[i])) break;   // 금액이 없으면 그 줄은 버린다
          var payer = parts.join(' ');
          items.push({ date: curDate, cat: cat, rawCat: cat, payer: payer, base: firstName(payer), amount: parseNum(cells[i]) });
          i += 1;
        }
      });
      // 자료 속 날짜로 위의 일자 칸을 맞춘다: 붙여넣은 글의 날짜 머리글 > 엑셀 파일의 기간·파일 이름 > (없으면) 지난 주일 그대로
      if (firstDate) setDate(firstDate, fileName ? '엑셀 파일 「' + fileName + '」의 날짜' : '붙여넣은 글의 날짜 머리글');
      else if (fileDate) setDate(fileDate, '엑셀 파일 「' + fileName + '」 이름');
      else noDataDate();
      items.forEach(function (it) {
        var mm = matchMember(it.payer);
        it.key = mm.key; it.match = mm.match; it.matchName = mm.matchName; it.via = mm.via;
        var exact = accSet[normName(it.cat)];
        var core = coreSet[coreName(it.cat)];
        if (exact) { it.cat = exact; it.accountKnown = true; }      // 계정과목 마스터의 표기("일천번헌금")로 통일해 결산에서 빠지지 않게
        else if (core) { it.cat = core; it.accountKnown = true; } // "십일조헌금" → 계정과목 마스터의 "십일조"처럼 핵심 단어로 매칭해 그 이름으로 정정
        else { it.accountKnown = false; }
      });
      parsed = items;
      return items;
    }
    function itemDate(i) { return i.date || panel.querySelector('#b_date').value || ''; }
    // 붙여넣은 글의 "[항목] N명 / 금액원"·"■ 총합계"와 읽은 결과가 맞는지 대조 → 다른 곳 목록
    function checkExpect(items) {
      var got = {}, bad = [];
      items.forEach(function (i) {
        var k = (i.date || '') + '|' + normName(i.rawCat), kt = (i.date || '') + '|■';
        (got[k] = got[k] || { n: 0, sum: 0 }); got[k].n++; got[k].sum += i.amount;
        (got[kt] = got[kt] || { n: 0, sum: 0 }); got[kt].n++; got[kt].sum += i.amount;
      });
      Object.keys(expect).forEach(function (k) {
        var e = expect[k], g = got[k] || { n: 0, sum: 0 };
        var p = k.split('|'), label = (p[0] ? p[0] + ' ' : '') + (p[1] === '■' ? '총합계' : p[1]);
        if (e.sum !== g.sum) bad.push(label + ': 적힌 금액 ' + won(e.sum) + '원 ≠ 읽은 금액 ' + won(g.sum) + '원');
        else if (e.n != null && e.n !== g.n) bad.push(label + ': 적힌 사람 수 ' + e.n + '명 ≠ 읽은 건수 ' + g.n + '건');
      });
      return bad;
    }

    function preview() {
      mode = 'offer';
      var items = parse();
      var out = panel.querySelector('#b_out');
      var saveBtn = panel.querySelector('#b_save');
      if (!items.length) { out.innerHTML = '<div class="fin-card">인식된 헌금 내역이 없습니다. 붙여넣은 형식을 확인해 주세요.</div>'; saveBtn.disabled = true; return; }
      var tot = items.reduce(function (s, i) { return s + i.amount; }, 0);
      var nMatch = items.filter(function (i) { return i.match === 'ok'; }).length;
      var nNone = items.filter(function (i) { return i.match === 'none'; }).length;
      var nDup = items.filter(function (i) { return i.match === 'dup'; }).length;
      var nVia = items.filter(function (i) { return i.match === 'ok' && i.via > 0; }).length;
      var unk = {}; items.forEach(function (i) { if (!i.accountKnown) unk[i.cat] = 1; });
      var unkList = Object.keys(unk);
      // 날짜별·항목별 소계
      var byDate = {}, dateOrder = [];
      items.forEach(function (i) { var d = itemDate(i) || '(일자 없음)'; if (!byDate[d]) { byDate[d] = { c: 0, s: 0 }; dateOrder.push(d); } byDate[d].c++; byDate[d].s += i.amount; });
      var byCat = {}; var catOrder = [];
      items.forEach(function (i) { if (!byCat[i.cat]) { byCat[i.cat] = { c: 0, s: 0 }; catOrder.push(i.cat); } byCat[i.cat].c++; byCat[i.cat].s += i.amount; });
      var multi = dateOrder.length > 1;
      var bad = checkExpect(items);
      var noDate = items.some(function (i) { return !itemDate(i); });
      var notSun = dateOrder.filter(function (d) { return d !== '(일자 없음)' && !isSunday(d); });
      var fromData = items.some(function (i) { return !!i.date; }) || !!fileDate;
      out.innerHTML = '<div class="fin-card">' +
        '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-bottom:10px"><b>' + items.length + '건</b><b style="color:#1e874b">' + won(tot) + '원</b>' +
        '<span class="fin-pill in">교적매칭 ' + nMatch + '</span>' + (nVia ? '<span class="fin-pill" style="background:#fff4e0;color:#8a5a00">뒤 이름으로 연결 ' + nVia + '</span>' : '') + (nNone ? '<span class="fin-pill out">미등록 ' + nNone + '</span>' : '') + (nDup ? '<span class="fin-pill out">동명이인 ' + nDup + '</span>' : '') + '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' + dateOrder.map(function (d) { var ok = isSunday(d); return '<span class="fin-pill" style="background:' + (ok ? '#e7f1ff;color:#1b4b8f' : '#fdecea;color:#c0392b') + '">📅 ' + esc(d) + (dowOf(d) ? '(' + dowOf(d) + ')' : '') + ' · ' + byDate[d].c + '건 · ' + won(byDate[d].s) + '원</span>'; }).join('') + '</div>' +
        (notSun.length ? '<p class="help" style="color:#c0392b;font-weight:700">⚠ 주일이 아닌 날짜가 있습니다: ' + esc(notSun.map(function (d) { return d + '(' + dowOf(d) + ')'; }).join(', ')) + ' — 맞는지 확인하세요. 저장할 때 한 번 더 묻습니다.</p>' : '') +
        (!fromData && !noDate ? '<p class="help" style="color:#8a5a00">자료에 날짜가 없어 위 일자 칸의 날짜(' + esc(panel.querySelector('#b_date').value) + ', ' + esc(dowOf(panel.querySelector('#b_date').value)) + ')로 저장합니다. 다른 주일이면 일자 칸을 고친 뒤 다시 미리보기를 누르세요.</p>' : '') +
        (multi ? '<p class="help" style="color:#1b4b8f">날짜 머리글이 ' + dateOrder.length + '개 있어 <b>각 주일 날짜로 나누어</b> 저장합니다. (위의 일자 칸은 날짜 머리글이 없는 줄에만 쓰입니다)</p>' : '') +
        (noDate ? '<p class="help" style="color:#c0392b">⚠ 날짜가 없는 내역이 있습니다. 위의 일자 칸을 확인하세요.</p>' : '') +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">' + catOrder.map(function (c) { return '<span class="fin-pill" style="background:#eef2f7;color:#3a4a63">' + esc(c) + ' ' + byCat[c].c + '건 · ' + won(byCat[c].s) + '</span>'; }).join('') + '</div>' +
        (bad.length ? '<div class="fin-card" style="border-color:#f1c9c4;background:#fffaf9;padding:10px 14px;margin-bottom:10px"><b style="color:#c0392b">⚠ 붙여넣은 글의 합계와 읽은 결과가 다른 곳이 있습니다</b><ul style="margin:6px 0 0 18px;padding:0;font-size:.88rem;color:#7a2e26">' + bad.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul><p class="help" style="margin-top:6px">붙여넣은 글을 확인하고 고친 뒤 다시 미리보기를 누르세요. 그대로 저장할 수도 있습니다.</p></div>' : (Object.keys(expect).length ? '<p class="help" style="color:#1e874b">✓ 붙여넣은 글에 적힌 항목별 사람 수·금액, 총합계와 모두 일치합니다.</p>' : '')) +
        (unkList.length ? '<p class="help" style="color:#c0392b">⚠ 계정과목 마스터에 없는 항목: <b>' + esc(unkList.join(', ')) + '</b> — 그대로 저장되며 거래장부엔 보이지만, 결산 분류에서 빠질 수 있습니다. 필요하면 설정에서 계정 추가 후 다시 하세요.</p>' : '') +
        '<div style="overflow:auto;max-height:420px"><table class="fin-table"><thead><tr>' + (multi ? '<th>일자</th>' : '') + '<th>항목</th><th>헌금자</th><th class="num">금액</th><th>교적</th></tr></thead><tbody>' +
        items.map(function (i) {
          var badge = i.match === 'ok'
            ? (i.via > 0 ? '<span class="fin-pill" style="background:#fff4e0;color:#8a5a00">⚠ ' + esc(i.base) + ' 없음 → ' + esc(i.matchName) + '</span>' : '<span class="fin-pill in">✓ ' + esc(i.matchName) + '</span>')
            : i.match === 'dup' ? '<span class="fin-pill out">동명이인(수동확인)</span>' : '<span style="color:#9aa5b1">미등록</span>';
          return '<tr>' + (multi ? '<td style="white-space:nowrap">' + esc(itemDate(i)) + '</td>' : '') + '<td>' + esc(i.cat) + '</td><td>' + esc(i.payer) + '</td><td class="num">' + won(i.amount) + '</td><td>' + badge + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        (nNone || nDup ? '<p class="help">미등록·동명이인 건도 헌금자 이름은 그대로 저장됩니다(헌금자통계엔 표시). 다만 개인 "내 헌금 조회"에는 교적 매칭된 건만 잡히므로, 저장 후 <b>거래장부</b>에서 해당 건을 열어 헌금자를 교적과 연결하면 됩니다.</p>' : '') +
        (nVia ? '<p class="help">"뒤 이름으로 연결"은 앞 이름이 교적에 없어 함께 적힌 다음 이름의 교적으로 연결한 것입니다. 다르게 하려면 저장 후 거래장부에서 고치세요.</p>' : '') +
        '</div>';
      saveBtn.disabled = false;
    }

    function save() {
      if (saving) return;
      if (!parsed.length) { preview(); }
      if (!parsed.length) return;
      var dateDefault = panel.querySelector('#b_date').value;
      var svc = panel.querySelector('#b_svc').value;
      var method = panel.querySelector('#b_method').value;
      var msg = panel.querySelector('#b_msg');
      var saveBtn = panel.querySelector('#b_save');
      var vouchers = parsed.map(function (i) {
        return { date: i.date || dateDefault, type: '수입', kind: '헌금', account: i.cat, service: svc, payer: i.payer, memberKey: i.key || '', amount: i.amount, method: method, memo: '' };
      });
      if (vouchers.some(function (v) { return !v.date; })) { msg.style.color = '#c0392b'; msg.textContent = '일자를 선택하세요.'; return; }
      saving = true; saveBtn.disabled = true; msg.style.color = '#7b8794'; msg.textContent = '이미 저장된 내역이 있는지 확인하는 중…';
      function stop(color, text) { saving = false; msg.style.color = color; msg.textContent = text; }
      M.loaded = false;   // 지금 저장돼 있는 전표를 새로 읽어 와서 겹치는지 본다
      ensureVouchers().then(function () {
        // 같은 날짜·항목·헌금자·금액이 이미 있으면 그 수만큼 건너뛴다(두 번 눌러도 두 번 계산되지 않도록)
        var have = {};
        M.vouchers.forEach(function (v) {
          if (String(v['구분']) !== '수입') return;
          var k = fmtD(v['일자']) + '|' + (v['계정'] || '') + '|' + (v['헌금자'] || '') + '|' + (Number(v['금액']) || 0);
          have[k] = (have[k] || 0) + 1;
        });
        var fresh = [], skipped = 0;
        vouchers.forEach(function (v) {
          var k = v.date + '|' + v.account + '|' + v.payer + '|' + v.amount;
          if (have[k] > 0) { have[k]--; skipped++; } else fresh.push(v);
        });
        if (!fresh.length) { stop('#c0392b', '이미 모두 저장되어 있는 내역입니다(' + skipped + '건). 다시 저장하지 않았습니다 — 거래장부에서 확인하세요.'); return; }
        var dates = [], sum = 0;
        fresh.forEach(function (v) { if (dates.indexOf(v.date) < 0) dates.push(v.date); sum += v.amount; });
        dates.sort();
        var odd = dates.filter(function (d) { return !isSunday(d); });
        var q = (dates.length > 1 ? dates.length + '개 주일(' + dates[0] + ' ~ ' + dates[dates.length - 1] + ')' : dates[0] + '(' + dowOf(dates[0]) + ')') + ' 헌금 ' + fresh.length + '건, ' + won(sum) + '원을 저장할까요?' +
          (odd.length ? '\n\n⚠ 주일이 아닌 날짜: ' + odd.map(function (d) { return d + '(' + dowOf(d) + ')'; }).join(', ') + '\n주일 헌금이면 [취소]를 누르고 날짜를 고쳐 주세요.' : '') +
          (skipped ? '\n\n이미 저장돼 있는 ' + skipped + '건은 건너뜁니다(두 번 계산되지 않도록).' : '');
        if (!confirm(q)) { stop('#7b8794', '저장하지 않았습니다.'); saveBtn.disabled = false; return; }
        msg.textContent = '저장 중… (' + fresh.length + '건)';
        function done(n) {
          parsed = [];           // 다시 저장하려면 미리보기부터(그래도 겹치는 건 위에서 걸러진다)
          M.loaded = false;
          stop('green', '✓ ' + n + '건 저장 완료' + (skipped ? ' (이미 있던 ' + skipped + '건은 건너뜀)' : '') + ' — ' + dates.join(', ') + '. 거래장부·결산보고서에서 확인하세요.');
        }
        function seq(i) {
          if (i >= fresh.length) { done(i); return; }
          msg.textContent = '저장 중… (' + (i + 1) + '/' + fresh.length + ')';
          WPF.call('addVoucher', { voucher: fresh[i] }).then(function () { seq(i + 1); })
            .catch(function (e) { stop('#c0392b', (i) + '건 저장 후 실패: ' + e.message + ' — 다시 저장하면 이미 들어간 건은 건너뜁니다.'); saveBtn.disabled = false; });
        }
        return WPF.call('addVouchersBulk', { vouchers: fresh }).then(function (r) { done(r.count || fresh.length); })
          .catch(function (e) {
            if (/unknown action/i.test(e.message)) { msg.textContent = '저장 중… (개별 저장 모드)'; seq(0); }
            else { stop('#c0392b', '저장 실패: ' + e.message + ' — 다시 저장하면 이미 들어간 건은 건너뜁니다.'); saveBtn.disabled = false; }
          });
      }).catch(function (e) { stop('#c0392b', '저장 전 확인에 실패했습니다: ' + e.message); saveBtn.disabled = false; });
    }

    // ── 지출(재정보고서) 파싱·미리보기·저장 ──
    var EXP_SKIP = { '지출합계': 1, '차인잔액': 1, '합계': 1, '수입합계': 1, '지출항목': 1, '이월잔액': 1, '전잔액': 1 };
    function parseExpRows(rows) {
      var accCol = -1, amtCol = -1, memoCol = -1;
      for (var r = 0; r < rows.length; r++) { var ai = rows[r].indexOf('지출항목'); if (ai >= 0) { accCol = ai; amtCol = rows[r].indexOf('금액'); memoCol = rows[r].indexOf('적요'); break; } }
      if (accCol < 0) { accCol = 3; amtCol = 5; memoCol = 4; }   // 헤더 못 찾으면 기본 열 위치
      if (amtCol < 0) amtCol = accCol + 2;
      var items = [];
      rows.forEach(function (row) {
        var acc = (row[accCol] || '').trim();
        if (!acc || EXP_SKIP[acc] || EXP_SKIP[acc.replace(/\s+/g, '')]) return;
        var amt = parseNum(row[amtCol]);
        if (!amt) return;
        items.push({ account: acc, amount: amt, memo: (memoCol >= 0 ? (row[memoCol] || '') : '').trim() });
      });
      return items;
    }
    function previewExp(items) {
      mode = 'exp'; parsedExp = items;
      var out = panel.querySelector('#b_out'), saveBtn = panel.querySelector('#b_save');
      if (!items.length) { out.innerHTML = '<div class="fin-card">인식된 지출 내역이 없습니다. 파일 형식을 확인해 주세요.</div>'; saveBtn.disabled = true; return; }
      var tot = items.reduce(function (s, i) { return s + i.amount; }, 0);
      var known = {}; M.accounts.filter(function (a) { return String(a['구분']) === '지출'; }).forEach(function (a) { known[normName(a['계정명'])] = 1; });
      var unk = items.filter(function (i) { return !known[normName(i.account)]; });
      out.innerHTML = '<div class="fin-card">' +
        '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-bottom:10px"><b>지출 ' + items.length + '건</b><b style="color:#c0392b">' + won(tot) + '원</b><span class="fin-pill out">지출</span></div>' +
        (unk.length ? '<p class="help" style="color:#c0392b">⚠ 계정과목 마스터에 없는 항목: <b>' + esc(unk.map(function (i) { return i.account; }).join(', ')) + '</b> — 그대로 저장되며 거래장부엔 보이지만, 결산 분류에서 빠질 수 있습니다. 필요하면 설정에서 계정 추가 후 다시 하세요.</p>' : '') +
        '<div style="overflow:auto;max-height:420px"><table class="fin-table"><thead><tr><th>계정</th><th>적요</th><th class="num">금액</th></tr></thead><tbody>' +
        items.map(function (i) { return '<tr><td>' + esc(i.account) + '</td><td>' + esc(i.memo || '') + '</td><td class="num">' + won(i.amount) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
      saveBtn.disabled = false;
    }
    function saveExp() {
      var date = panel.querySelector('#b_date').value, method = panel.querySelector('#b_method').value;
      var msg = panel.querySelector('#b_msg'), saveBtn = panel.querySelector('#b_save');
      if (!date) { msg.style.color = '#c0392b'; msg.textContent = '일자를 선택하세요.'; return; }
      if (!parsedExp.length) return;
      if (!confirm(date + '(' + dowOf(date) + ') 지출 ' + parsedExp.length + '건을 저장할까요?')) return;
      var vouchers = parsedExp.map(function (i) { return { date: date, type: '지출', account: i.account, payer: '', amount: i.amount, method: method, memo: i.memo || '' }; });
      saveBtn.disabled = true; msg.style.color = '#7b8794'; msg.textContent = '저장 중… (' + vouchers.length + '건)';
      WPF.call('addVouchersBulk', { vouchers: vouchers })
        .then(function (r) { msg.style.color = 'green'; msg.textContent = '✓ 지출 ' + (r.count || vouchers.length) + '건 저장 완료. 거래장부에서 확인하세요.'; M.loaded = false; saveBtn.disabled = false; })
        .catch(function (e) { msg.style.color = '#c0392b'; msg.textContent = '저장 실패: ' + e.message; saveBtn.disabled = false; });
    }

    // ── 드롭된/선택된 엑셀 파일 처리: 종류 자동 판별 → 미리보기 ──
    function handleFile(file) {
      var msg = panel.querySelector('#b_msg');
      if (!file || !/\.xlsx$/i.test(file.name)) { msg.style.color = '#c0392b'; msg.textContent = '엑셀(.xlsx) 파일만 지원합니다. (헌금자 리스트 / 재정보고서)'; return; }
      msg.style.color = '#7b8794'; msg.textContent = '📄 ' + file.name + ' 읽는 중…';
      file.arrayBuffer().then(parseXlsx).then(function (rows) {
        if (!rows || !rows.length) throw new Error('빈 파일이거나 데이터를 찾지 못했습니다.');
        var flat = rows.map(function (r) { return r.join(' '); }).join('\n');
        // 날짜: 파일 안의 기간(예: 2026.06.29 ~ 2026.07.05 → 끝 날짜 주일)이나 날짜 > 파일 이름의 날짜(20260809, 2026-08-09 …)
        fileName = file.name;
        var inFile = '';
        rows.some(function (r) { inFile = findDate(r.join(' ')); return !!inFile; });
        fileDate = findDate(file.name.replace(/\.xlsx$/i, ''), { compact: true });
        if (inFile) setDate(inFile, '엑셀 파일 「' + file.name + '」 안의 날짜');
        else if (fileDate) setDate(fileDate, '엑셀 파일 「' + file.name + '」 이름');
        else noDataDate();
        var isExp = /재정\s*보고서/.test(flat) || rows.some(function (r) { return r.indexOf('지출항목') >= 0; });
        var isOff = /헌금자\s*리스트/.test(flat) || rows.some(function (r) { return r.some(function (c) { return OFFER_CATS[String(c).replace(/\s+/g, '')]; }); });
        if (isExp && !isOff) {
          var items = parseExpRows(rows);
          msg.style.color = '#7b8794'; msg.textContent = '✓ 재정보고서(지출) 인식 — ' + items.length + '건. 아래 미리보기를 확인하고 [일괄 저장]을 누르세요.';
          previewExp(items);
        } else if (isOff) {
          panel.querySelector('#b_text').value = rowsToTsv(rows);
          msg.style.color = '#7b8794'; msg.textContent = '✓ 헌금자 리스트 인식 — 아래 미리보기·교적매칭 결과를 확인하고 [일괄 저장]을 누르세요.';
          preview();
        } else {
          msg.style.color = '#c0392b'; msg.textContent = '파일 형식을 알 수 없습니다. 헌금자 리스트 또는 재정보고서 엑셀인지 확인해 주세요.';
        }
      }).catch(function (e) { msg.style.color = '#c0392b'; msg.textContent = '엑셀을 읽지 못했습니다: ' + (e.message || e); });
    }
    // 엑셀 행 → 붙여넣기 파서가 읽는 탭 구분 텍스트(항목/이름·금액 구조 그대로)
    function rowsToTsv(rows) { return rows.map(function (r) { return r.join('\t').replace(/\t+$/, ''); }).filter(function (l) { return l.replace(/\t/g, '').trim() !== ''; }).join('\n'); }

    // ── 드래그&드롭 + 클릭 선택 ──
    var drop = panel.querySelector('#b_drop'), fileInp = panel.querySelector('#b_file');
    if (drop && fileInp) {
      drop.onclick = function () { fileInp.click(); };
      fileInp.onchange = function () { if (fileInp.files && fileInp.files[0]) handleFile(fileInp.files[0]); fileInp.value = ''; };
      ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); drop.style.background = '#eef5ff'; drop.style.borderColor = '#7fa3d8'; }); });
      ['dragleave', 'dragend'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); drop.style.background = ''; drop.style.borderColor = '#cdd7e3'; }); });
      drop.addEventListener('drop', function (e) { e.preventDefault(); e.stopPropagation(); drop.style.background = ''; drop.style.borderColor = '#cdd7e3'; var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handleFile(f); });
    }

    panel.querySelector('#b_prev').onclick = preview;
    panel.querySelector('#b_save').onclick = function () { (mode === 'exp' ? saveExp : save)(); };
    panel.querySelector('#b_text').addEventListener('input', function () { mode = 'offer'; fileName = ''; fileDate = ''; panel.querySelector('#b_save').disabled = true; });

    // 겹쳐 저장된 수입 전표 찾기 → 처음 것만 남기고 지우기(목사님이 직접 누름, 두 번 확인)
    var dupBtn = panel.querySelector('#b_dupfind'), dupOut = panel.querySelector('#b_dupout'), dupMsg = panel.querySelector('#b_dupmsg');
    var dupExtra = [];   // 지울 전표 [{id, ...}]
    function findDup() {
      dupBtn.disabled = true; dupMsg.style.color = '#7b8794'; dupMsg.textContent = '전표를 읽는 중…'; dupOut.innerHTML = '';
      M.loaded = false;
      ensureVouchers().then(function () {
        var groups = {}, order = [];
        M.vouchers.forEach(function (v) {
          if (String(v['구분']) !== '수입') return;
          var k = fmtD(v['일자']) + '|' + (v['계정'] || '') + '|' + (v['헌금자'] || '') + '|' + (Number(v['금액']) || 0);
          if (!groups[k]) { groups[k] = []; order.push(k); }
          groups[k].push(v);
        });
        dupExtra = [];
        var rows = [];
        order.forEach(function (k) {
          var g = groups[k]; if (g.length < 2) return;
          g.sort(function (a, b) { return String(a['입력일'] || '').localeCompare(String(b['입력일'] || '')) || (parseNum(String(a['전표ID']).slice(1)) - parseNum(String(b['전표ID']).slice(1))); });
          g.slice(1).forEach(function (v) { dupExtra.push(v); });
          rows.push({ v: g[0], n: g.length });
        });
        dupBtn.disabled = false;
        if (!rows.length) { dupMsg.style.color = 'green'; dupMsg.textContent = '✓ 겹쳐 저장된 전표가 없습니다.'; return; }
        var sum = dupExtra.reduce(function (t, v) { return t + (Number(v['금액']) || 0); }, 0);
        var byDate = {}; dupExtra.forEach(function (v) { var d = fmtD(v['일자']); byDate[d] = (byDate[d] || 0) + 1; });
        dupMsg.style.color = '#c0392b'; dupMsg.textContent = '겹친 묶음 ' + rows.length + '개 — 더 들어간 전표 ' + dupExtra.length + '건, ' + won(sum) + '원이 두 번 계산되고 있습니다.';
        dupOut.innerHTML = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 8px">' + Object.keys(byDate).sort().map(function (d) { return '<span class="fin-pill out">' + esc(d) + ' · 더 들어간 ' + byDate[d] + '건</span>'; }).join('') + '</div>' +
          '<div style="overflow:auto;max-height:300px"><table class="fin-table"><thead><tr><th>일자</th><th>항목</th><th>헌금자</th><th class="num">금액</th><th class="num">저장된 수</th></tr></thead><tbody>' +
          rows.map(function (r) { return '<tr><td style="white-space:nowrap">' + esc(fmtD(r.v['일자'])) + '</td><td>' + esc(r.v['계정'] || '') + '</td><td>' + esc(r.v['헌금자'] || '') + '</td><td class="num">' + won(r.v['금액']) + '</td><td class="num"><b style="color:#c0392b">' + r.n + '</b></td></tr>'; }).join('') +
          '</tbody></table></div>' +
          '<div style="display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap"><button class="btn btn-solid" id="b_dupfix" style="background:#c0392b;border-color:#c0392b">처음 것만 남기고 ' + dupExtra.length + '건 지우기</button><span class="fin-msg" id="b_dupfixmsg"></span></div>' +
          '<p class="help" style="margin-top:6px">같은 사람이 같은 날 같은 항목에 같은 금액을 <b>정말 두 번</b> 드린 경우도 여기에 잡힙니다. 그런 건이 있으면 지우지 말고 그대로 두세요.</p>';
        dupOut.querySelector('#b_dupfix').onclick = fixDup;
      }).catch(function (e) { dupBtn.disabled = false; dupMsg.style.color = '#c0392b'; dupMsg.textContent = '읽기 실패: ' + e.message; });
    }
    function fixDup() {
      var fb = dupOut.querySelector('#b_dupfix'), fm = dupOut.querySelector('#b_dupfixmsg');
      if (!dupExtra.length) return;
      var sum = dupExtra.reduce(function (t, v) { return t + (Number(v['금액']) || 0); }, 0);
      if (!confirm('겹쳐 저장된 수입 전표 ' + dupExtra.length + '건(' + won(sum) + '원)을 지웁니다.\n각 묶음의 처음 것 1건은 남습니다. 되돌릴 수 없습니다. 계속할까요?')) return;
      var t = prompt('정말 지우려면 "정리" 라고 입력하세요.');
      if (t !== '정리') { fm.style.color = '#7b8794'; fm.textContent = '취소되었습니다.'; return; }
      fb.disabled = true; fm.style.color = '#7b8794';
      var n = 0;
      function next(i) {
        if (i >= dupExtra.length) { fm.style.color = 'green'; fm.textContent = '✓ ' + n + '건 지웠습니다. 다시 찾기를 눌러 확인하세요.'; M.loaded = false; dupExtra = []; return; }
        fm.textContent = '지우는 중… (' + (i + 1) + '/' + dupExtra.length + ')';
        WPF.call('deleteVoucher', { id: dupExtra[i]['전표ID'] }).then(function () { n++; next(i + 1); })
          .catch(function (e) { fb.disabled = false; fm.style.color = '#c0392b'; fm.textContent = n + '건 지운 뒤 실패: ' + e.message; M.loaded = false; });
      }
      next(0);
    }
    if (dupBtn) dupBtn.onclick = findDup;
  }

  /* ── 지출입력 ── */
  function renderExpense(panel) {
    var expAccs = M.accounts.filter(function (a) { return String(a['구분']) === '지출'; });
    function hangOf(a) { return a['분류'] || a['상위'] || '(미분류)'; }
    function hangList() { var seen = {}, out = []; expAccs.forEach(function (a) { var h = hangOf(a); if (!seen[h]) { seen[h] = 1; out.push(h); } }); return out; }
    function mokOptions(hang) { return expAccs.filter(function (a) { return hangOf(a) === hang; }).map(function (a) { return '<option value="' + esc(a['계정명']) + '">' + esc(a['계정명']) + '</option>'; }).join(''); }
    var firstHang = hangList()[0] || '';
    panel.innerHTML =
      '<div class="fin-card"><div class="fin-grid">' +
      '<div class="form-field"><label>일자 <span id="e_dow" style="font-weight:400;font-size:.82rem;color:#7b8794"></span></label><input type="date" id="e_date" value="' + today() + '"></div>' +
      '<div class="form-field" style="grid-column:span 2"><label>지출 계정 (검색)</label><div id="e_acc_wrap" style="display:flex;gap:6px;position:relative"><input type="text" id="e_acc_name" autocomplete="off" lang="ko" inputmode="text" placeholder="계정명·항 입력 → 선택 (🔍 전체보기)" style="flex:1"><button type="button" class="btn btn-line" id="e_acc_btn" style="padding:0 13px;font-size:1rem">🔍</button></div><input type="hidden" id="e_acc"></div>' +
      '<div class="form-field"><label>수단</label><select id="e_method"><option>계좌</option><option>법인카드</option><option>현금</option></select></div>' +
      '</div><div class="fin-grid">' +
      '<div class="form-field"><label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="e_memo_on" style="width:auto;margin:0"> 적요 입력</label><input type="text" id="e_memo" disabled placeholder="체크하면 입력"></div>' +
      '<div class="form-field"><label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="e_payer_on" style="width:auto;margin:0"> 수령인 입력</label><input type="text" id="e_payer" disabled placeholder="체크하면 입력"></div>' +
      '<div class="form-field"><label>금액</label><input type="text" id="e_amt" lang="ko" placeholder="0" style="text-align:right;font-weight:700"></div>' +
      '</div><div style="margin-top:6px;display:flex;gap:10px;align-items:center;"><button class="btn btn-solid" id="e_add">＋ 지출 추가</button><span class="fin-msg" id="e_msg"></span></div></div><div id="e_today"></div>';
    if (!expAccs.length) panel.insertAdjacentHTML('afterbegin', '<div class="fin-card" style="border-color:#f3dfb0;background:#fffdf7"><b style="color:#8a5a00">지출 계정이 아직 하나도 없습니다.</b><p class="help" style="margin-top:4px">지출을 넣으려면 먼저 <b>예산·계정 ▸ 예산 ▸ ✏️ 계정·예산 수정</b>에서 지출 항(예: 예배비)과 목(예: 꽃꽂이)을 만들어 주세요. 계정이 있어야 결산보고서에 항목별로 정리됩니다.</p></div>');
    (function () { var de = panel.querySelector('#e_date'), dw = panel.querySelector('#e_dow'); function u() { dw.textContent = de.value ? '(' + dowOf(de.value) + ')' : ''; } de.addEventListener('change', u); u(); })();
    var amt = panel.querySelector('#e_amt');
    amt.addEventListener('input', function () { var n = parseNum(amt.value); amt.value = n ? won(n) : ''; });
    var accName = panel.querySelector('#e_acc_name'), accHidden = panel.querySelector('#e_acc'), accWrap = panel.querySelector('#e_acc_wrap');
    setupAccountSearch(accName, accHidden, expAccs, accWrap, panel.querySelector('#e_acc_btn'), function () { setTimeout(function () { amt.focus(); amt.select(); }, 0); });
    var emOn = panel.querySelector('#e_memo_on'), emEl = panel.querySelector('#e_memo');
    emOn.addEventListener('change', function () { emEl.disabled = !emOn.checked; if (emOn.checked) emEl.focus(); else emEl.value = ''; });
    var epOn = panel.querySelector('#e_payer_on'), epEl = panel.querySelector('#e_payer');
    epOn.addEventListener('change', function () { epEl.disabled = !epOn.checked; if (epOn.checked) epEl.focus(); else epEl.value = ''; });
    function submitExpense() {
      var v = { date: panel.querySelector('#e_date').value, type: '지출', kind: '일반', account: accHidden.value, service: '', payer: epEl.value.trim(), memberKey: '', amount: parseNum(amt.value), method: panel.querySelector('#e_method').value, memo: emEl.value.trim() };
      var msg = panel.querySelector('#e_msg');
      if (!v.date || !v.account || !v.amount) { msg.style.color = '#c0392b'; msg.textContent = '일자·계정·금액을 입력하세요. (계정은 목록에서 선택)'; return; }
      msg.style.color = '#7b8794'; msg.textContent = '저장 중…';
      WPF.call('addVoucher', { voucher: v }).then(function () { msg.style.color = 'green'; msg.textContent = '✓ 추가됨'; emEl.value = ''; epEl.value = ''; amt.value = ''; accName.value = ''; accHidden.value = ''; M.loaded = false; loadExp(v.date); accName.focus(); }).catch(function (e) { msg.style.color = '#c0392b'; msg.textContent = e.message; });
    }
    amt.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submitExpense(); } else if (e.key === 'Tab' && !e.shiftKey && !emOn.checked && !epOn.checked) { e.preventDefault(); submitExpense(); } });
    panel.querySelector('#e_add').onclick = submitExpense;
    var ebox = panel.querySelector('#e_today');
    function loadExp(d) {
      loading(ebox);
      ensureVouchers().then(function () {
        var list = M.vouchers.filter(function (x) { return fmtD(x['일자']) === d && String(x['구분']) === '지출'; });
        var tot = list.reduce(function (s, x) { return s + (Number(x['금액']) || 0); }, 0);
        if (!list.length) { ebox.innerHTML = '<div class="fin-card"><b>' + esc(d) + '</b> 지출 내역이 없습니다.</div>'; return; }
        var byId = {}; list.forEach(function (x) { byId[x['전표ID']] = x; });
        ebox.innerHTML = '<div class="fin-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b>' + esc(d) + ' 지출</b><div style="display:flex;gap:10px;align-items:center"><button class="btn btn-line" style="padding:4px 12px;font-size:.8rem" data-bulk>🗑 선택 삭제</button><b style="color:#c0392b">' + won(tot) + '원</b></div></div><div style="overflow:auto"><table class="fin-table"><thead><tr><th style="width:30px;text-align:center"><input type="checkbox" data-all></th><th>계정</th><th>적요</th><th>거래처</th><th class="num">금액</th><th>입력/수정</th><th>관리</th></tr></thead><tbody>' +
          list.map(function (x) { return '<tr><td style="text-align:center"><input type="checkbox" class="rowck" value="' + esc(x['전표ID']) + '"></td><td>' + esc(accLabelExp(x['계정'])) + '</td><td>' + esc(x['적요'] || '') + '</td><td>' + esc(x['헌금자'] || '') + '</td><td class="num">' + won(x['금액']) + '</td><td style="font-size:.74rem;color:#7b8794;white-space:nowrap">' + auditText(x) + '</td><td style="white-space:nowrap"><button class="btn btn-line" style="padding:3px 9px;font-size:.78rem" data-edit="' + esc(x['전표ID']) + '">수정</button> <button class="btn btn-line" style="padding:3px 9px;font-size:.78rem" data-del="' + esc(x['전표ID']) + '">삭제</button></td></tr>'; }).join('') + '</tbody></table></div></div>';
        wireChecks(ebox, function () { loadExp(d); });
        Array.prototype.forEach.call(ebox.querySelectorAll('[data-edit]'), function (b) { b.onclick = function () { openEditor(byId[b.dataset.edit], function () { loadExp(d); }); }; });
        Array.prototype.forEach.call(ebox.querySelectorAll('[data-del]'), function (b) { b.onclick = function () { if (!confirm('삭제할까요?')) return; WPF.call('deleteVoucher', { id: b.dataset.del }).then(function () { M.loaded = false; loadExp(d); }); }; });
      }).catch(function (e) { ebox.innerHTML = msgCard('조회 실패', e.message); });
    }
    panel.querySelector('#e_date').addEventListener('change', function () { loadExp(this.value); });
    loadExp(panel.querySelector('#e_date').value);
  }

  /* ── 거래장부 ── */
  function renderLedger(panel) {
    var _r = fyRange(M.fy);
    panel.innerHTML = '<div class="fin-card"><div class="fin-grid"><div class="form-field"><label>시작일</label><input type="date" id="l_from" value="' + _r.from + '"></div><div class="form-field"><label>종료일</label><input type="date" id="l_to" value="' + _r.to + '"></div><div class="form-field"><label>검색(계정/이름/적요)</label><input type="text" id="l_q"></div><div class="form-field" style="align-self:end"><button class="btn btn-solid" id="l_go">조회</button></div></div></div><div id="l_out"></div>';
    var out = panel.querySelector('#l_out');
    function draw() {
      loading(out);
      ensureVouchers().then(function () {
        var f = panel.querySelector('#l_from').value, t = panel.querySelector('#l_to').value, q = panel.querySelector('#l_q').value.trim().toLowerCase();
        var list = M.vouchers.filter(function (x) { var dd = fmtD(x['일자']); return (!f || dd >= f) && (!t || dd <= t) && (!q || (String(x['계정']) + x['헌금자'] + x['적요']).toLowerCase().indexOf(q) >= 0); }).slice().sort(function (a, b) { return fmtD(b['일자']).localeCompare(fmtD(a['일자'])); });
        var inc = 0, exp = 0; list.forEach(function (x) { if (String(x['구분']) === '수입') inc += Number(x['금액']) || 0; else exp += Number(x['금액']) || 0; });
        withPrint(out, '거래장부', '<div class="fin-card" style="display:flex;gap:24px;flex-wrap:wrap;align-items:center"><div>수입 <b style="color:#1e874b">' + won(inc) + '</b></div><div>지출 <b style="color:#c0392b">' + won(exp) + '</b></div><div>차액 <b>' + won(inc - exp) + '</b></div><div style="margin-left:auto">' + list.length + '건</div><button class="btn btn-line mng" style="padding:4px 12px;font-size:.8rem" data-bulk>🗑 선택 삭제</button></div>' +
          '<div class="fin-card" style="overflow:auto;max-height:560px"><table class="fin-table"><thead><tr><th class="mng" style="width:30px;text-align:center"><input type="checkbox" data-all></th><th>일자</th><th>구분</th><th>계정</th><th>상대/적요</th><th class="num">수입</th><th class="num">지출</th><th class="mng">입력/수정</th><th class="mng">관리</th></tr></thead><tbody>' +
          list.slice(0, 1500).map(function (x) { var isIn = String(x['구분']) === '수입'; return '<tr><td class="mng" style="text-align:center"><input type="checkbox" class="rowck" value="' + esc(x['전표ID']) + '"></td><td>' + esc(fmtD(x['일자'])) + '</td><td><span class="fin-pill ' + (isIn ? 'in' : 'out') + '">' + esc(x['구분']) + '</span></td><td>' + esc(isIn ? x['계정'] : accLabelExp(x['계정'])) + '</td><td>' + esc(x['헌금자'] || x['적요'] || '') + '</td><td class="num">' + (isIn ? won(x['금액']) : '') + '</td><td class="num">' + (!isIn ? won(x['금액']) : '') + '</td><td class="mng" style="font-size:.74rem;color:#7b8794;white-space:nowrap">' + auditText(x) + '</td><td class="mng" style="white-space:nowrap"><button class="btn btn-line" style="padding:3px 8px;font-size:.76rem" data-edit="' + esc(x['전표ID']) + '">수정</button> <button class="btn btn-line" style="padding:3px 8px;font-size:.76rem" data-del="' + esc(x['전표ID']) + '">삭제</button></td></tr>'; }).join('') + '</tbody></table>' + (list.length > 1500 ? '<p class="help" style="padding:8px">최근 1,500건만 표시(합계·엑셀은 전체 기준).</p>' : '') + '</div>',
          null,
          { headers: ['일자', '구분', '계정', '상대/적요', '수입', '지출'], rows: list.map(function (x) { var isIn = String(x['구분']) === '수입'; return [fmtD(x['일자']), x['구분'], x['계정'], (x['헌금자'] || x['적요'] || ''), (isIn ? (Number(x['금액']) || 0) : ''), (!isIn ? (Number(x['금액']) || 0) : '')]; }) });
        var byId = {}; list.forEach(function (x) { byId[x['전표ID']] = x; });
        wireChecks(out, draw);
        Array.prototype.forEach.call(out.querySelectorAll('[data-edit]'), function (b) { b.onclick = function () { openEditor(byId[b.dataset.edit], draw); }; });
        Array.prototype.forEach.call(out.querySelectorAll('[data-del]'), function (b) { b.onclick = function () { if (!confirm('삭제할까요?')) return; WPF.call('deleteVoucher', { id: b.dataset.del }).then(function () { M.loaded = false; draw(); }); }; });
      }).catch(function (e) { out.innerHTML = msgCard('조회 실패', e.message); });
    }
    panel.querySelector('#l_go').onclick = draw; draw();
  }

  /* ── 헌금자 가정 찾기 ──
   * 교적과 이어진 전표 → 그 교인, 가정 = 세대주(없으면 본인).
   * 교적에 없는 이름 → 교인들의 '가족사항'(예: "배우자: 김성조, 아들: 찬영 / 찬익")에서 찾아 그 가정으로 묶는다.
   *   두 글자 이름(찬영)은 그 교인·배우자의 성을 붙여(최찬영·김찬영) 찾는다.
   * 그래도 없으면 '교적부에 등록되지 않은 성도', 구역·주일헌금 같은 것은 '구역·단체·무기명'. */
  var FAM_WORDS = { '배우자': 1, '남편': 1, '아내': 1, '자녀': 1, '장녀': 1, '차녀': 1, '삼녀': 1, '장남': 1, '차남': 1, '삼남': 1, '아들': 1, '딸': 1, '부': 1, '모': 1, '사진': 1, '집사': 1, '권사': 1, '장로': 1, '성도': 1, '타교회': 1, '손자': 1, '손녀': 1, '며느리': 1, '사위': 1, '형제': 1, '자매': 1 };
  function householdOf(m) { var h = m && m.head && String(m.head).trim(); return h || (m ? m.name : ''); }
  function memberByKey(k) { for (var i = 0; i < M.members.length; i++) if (M.members[i].key === k) return M.members[i]; return null; }
  function famIndex() {
    if (M._famIdx && M._famIdxN === M.members.length) return M._famIdx;
    var idx = {}, reg = {};
    M.members.forEach(function (m) { reg[m.name] = 1; });
    M.members.forEach(function (m) {
      var fn = String(m.family || ''); if (!fn || !m.name) return;
      var sp = (fn.match(/(?:배우자|남편|아내)\s*[:：]?\s*([가-힣]{2,4})/) || [])[1] || m.spouse || '';
      var surs = [m.name.charAt(0)]; if (sp && sp.length >= 3 && surs.indexOf(sp.charAt(0)) < 0) surs.push(sp.charAt(0));
      var re = /([가-힣]{1,4})/g, mm, prevLabel = '';
      while ((mm = re.exec(fn))) {
        var w = mm[1];
        if (FAM_WORDS[w]) { prevLabel = w; continue; }
        if (w.length < 2) continue;
        var pri = /배우자|남편|아내/.test(prevLabel) ? 2 : 1;
        (w.length >= 3 ? [w] : surs.map(function (s) { return s + w; })).forEach(function (c) {
          if (reg[c]) return;
          if (!idx[c] || idx[c].pri < pri) idx[c] = { owner: m, household: householdOf(m), rel: prevLabel, pri: pri };
        });
      }
    });
    M._famIdx = idx; M._famIdxN = M.members.length;
    return idx;
  }
  function cleanGiver(s) { return String(s == null ? '' : s).replace(/\((?:생일|심방|감사|헌신|기념)[^)]*\)/g, '').replace(/(?:생일|심방)$/, '').trim(); }
  function giverInfo(v) {
    var key = v['매칭키'] || '';
    if (key) { var m = memberByKey(key); if (m) return { kind: 'member', id: 'K:' + key, name: m.name, household: householdOf(m) }; }
    var raw = v['헌금자'] || '무명', nm = cleanGiver(raw) || raw;
    if (isGroupGiver(nm)) return { kind: 'group', id: 'G:' + nm, name: nm, household: '' };
    var s = nm, inParen = [];
    s = s.replace(/\(([^)]*)\)/g, function (_, x) { inParen.push(x); return ' '; });
    var parts = s.split(/[·・,、/／&＆]|\s+외\s*|\s+/).concat(inParen).map(function (p) { return p.trim(); }).filter(Boolean);
    var idx = famIndex();
    for (var i = 0; i < parts.length; i++) {
      var hits = M.members.filter(function (m) { return m.name === parts[i]; });
      if (hits.length === 1) return { kind: 'loose', id: 'N:' + nm, name: nm, household: householdOf(hits[0]), note: hits[0].name + ' 님 이름으로 적혔지만 교적과 이어지지 않은 기록' };
      if (idx[parts[i]]) return { kind: 'family', id: 'N:' + nm, name: nm, household: idx[parts[i]].household, note: idx[parts[i]].owner.name + ' 님 가족사항' + (idx[parts[i]].rel ? '(' + idx[parts[i]].rel + ')' : '') };
    }
    return { kind: 'none', id: 'N:' + nm, name: nm, household: '' };
  }

  /* ── 헌금자통계 — 사람별 / 가정별, 이름을 누르면 그 분의 헌금 내역 ── */
  function renderGivers(panel) {
    loading(panel);
    ensureVouchers().then(function () {
      var map = {};
      vouchersFY().filter(function (x) { return String(x['구분']) === '수입'; }).forEach(function (v) {
        var gi = giverInfo(v);
        if (!map[gi.id]) map[gi.id] = { id: gi.id, name: gi.name, kind: gi.kind, household: gi.household, note: gi.note || '', count: 0, total: 0, list: [], names: {} };
        var g = map[gi.id]; g.count++; g.total += Number(v['금액']) || 0; g.list.push(v); g.names[v['헌금자'] || ''] = 1;
      });
      var all = Object.keys(map).map(function (k) { return map[k]; });
      var KIND = {
        member: '<span class="fin-pill in">교인</span>',
        family: '<span class="fin-pill" style="background:#e7f1ff;color:#1b4b8f">교적 미등록 · 가족 확인</span>',
        loose: '<span class="fin-pill" style="background:#e7f1ff;color:#1b4b8f">교인 · 교적 미연결</span>',
        none: '<span class="fin-pill" style="background:#fff4e0;color:#8a5a00">교적부에 등록되지 않은 성도</span>',
        group: '<span class="fin-pill" style="background:#eef2f7;color:#3a4a63">구역·단체·무기명</span>'
      };
      var KIND_T = { member: '교인', loose: '교인(교적 미연결)', family: '교적 미등록(가족 확인)', none: '교적부에 등록되지 않은 성도', group: '구역·단체·무기명' };
      var r0 = fyRange(M.fy);
      panel.innerHTML =
        '<div class="fin-card"><div class="fin-grid" style="align-items:end">' +
        '<div class="form-field"><label>이름 찾기</label><input type="text" id="gv_q" placeholder="이름 일부" autocomplete="off"></div>' +
        '<div class="form-field"><label>묶어 보기</label><select id="gv_mode"><option value="person">사람별</option><option value="house">가정별</option></select></div>' +
        '<div class="form-field"><label>보기</label><select id="gv_kind"><option value="person">사람만(구역·단체 빼고)</option><option value="member">교인만</option><option value="unreg">교적에 없는 분만</option><option value="group">구역·단체·무기명만</option><option value="all">모두</option></select></div>' +
        '<div class="form-field"><label>정렬</label><select id="gv_sort"><option value="total">금액 많은 순</option><option value="name">이름 순</option></select></div>' +
        '</div><p class="help" style="margin-top:4px">' + M.fy + '년도(' + esc(r0.from) + ' ~ ' + esc(r0.to) + ') 수입 전표 기준. 이름을 누르면 그 분의 헌금 내역이 펼쳐집니다.<br>교적에 없는 이름은 교인들의 <b>가족사항</b>에서 찾아 그 가정으로 묶고(「가족 확인」), 찾지 못하면 「교적부에 등록되지 않은 성도」로 따로 둡니다. 교적과 이어지지 않은 이름은 성도 본인의 「내 헌금 조회」에 나오지 않습니다.</p></div>' +
        '<div id="gv_out"></div>';
      var out = panel.querySelector('#gv_out');
      function pass(r, kind, q) {
        if (kind === 'person' && r.kind === 'group') return false;
        if (kind === 'member' && r.kind !== 'member') return false;
        if (kind === 'unreg' && !(r.kind === 'family' || r.kind === 'none' || r.kind === 'loose')) return false;
        if (kind === 'group' && r.kind !== 'group') return false;
        if (q && r.name.indexOf(q) < 0 && r.household.indexOf(q) < 0 && !Object.keys(r.names).some(function (n) { return n.indexOf(q) >= 0; })) return false;
        return true;
      }
      function personRow(r, rank, indent) {
        var other = Object.keys(r.names).filter(function (n) { return n && n !== r.name; });
        var sub = [];
        if (other.length) sub.push('적힌 이름: ' + other.join(', '));
        if (r.kind === 'family' || r.kind === 'loose') sub.push((r.household ? r.household + ' 가정' : '') + (r.note ? ' · ' + r.note : ''));
        return '<tr class="gv-row" data-id="' + esc(r.id) + '" style="cursor:pointer"><td class="num">' + (rank || '') + '</td><td' + (indent ? ' style="padding-left:22px"' : '') + '><b style="color:var(--accent,#1A3A2F);text-decoration:underline dotted">' + esc(r.name) + '</b>' + (sub.length ? '<div style="font-size:.74rem;color:#9aa5b1;white-space:normal">' + esc(sub.join(' · ')) + '</div>' : '') + '</td><td>' + KIND[r.kind] + '</td><td class="num">' + r.count + '</td><td class="num"><b>' + won(r.total) + '</b></td></tr>';
      }
      function draw() {
        var q = panel.querySelector('#gv_q').value.trim(), kind = panel.querySelector('#gv_kind').value, sort = panel.querySelector('#gv_sort').value, mode = panel.querySelector('#gv_mode').value;
        var rows = all.filter(function (r) { return pass(r, kind, q); });
        function cmp(a, b) { return sort === 'name' ? a.name.localeCompare(b.name, 'ko') : (b.total - a.total || a.name.localeCompare(b.name, 'ko')); }
        var tot = rows.reduce(function (s, r) { return s + r.total; }, 0), cnt = rows.reduce(function (s, r) { return s + r.count; }, 0);
        var body = '', csv = [], title;
        if (mode === 'house') {
          var hs = {}, horder = [];
          rows.forEach(function (r) {
            var hk = r.kind === 'none' ? '~none' : r.kind === 'group' ? '~group' : 'H:' + r.household;
            if (!hs[hk]) { hs[hk] = { key: hk, label: hk === '~none' ? '교적부에 등록되지 않은 성도' : hk === '~group' ? '구역·단체·무기명' : r.household + ' 가정', rows: [], total: 0, count: 0 }; horder.push(hk); }
            hs[hk].rows.push(r); hs[hk].total += r.total; hs[hk].count += r.count;
          });
          var list = horder.map(function (k) { return hs[k]; }).sort(function (a, b) {
            var sa = a.key.charAt(0) === '~' ? 1 : 0, sb = b.key.charAt(0) === '~' ? 1 : 0;   // 따로 둔 묶음은 맨 아래
            return sa - sb || (sort === 'name' ? a.label.localeCompare(b.label, 'ko') : b.total - a.total);
          });
          body = list.map(function (h, i) {
            h.rows.sort(cmp);
            csv.push([h.key.charAt(0) === '~' ? '' : i + 1, h.label, '', h.count, h.total]);
            h.rows.forEach(function (r) { csv.push(['', '  ' + r.name, KIND_T[r.kind], r.count, r.total]); });
            return '<tr style="background:#f5f8fc;font-weight:700"><td class="num">' + (h.key.charAt(0) === '~' ? '' : i + 1) + '</td><td>' + esc(h.label) + ' <span style="font-weight:400;color:#9aa5b1;font-size:.8rem">' + h.rows.length + '명</span></td><td></td><td class="num">' + h.count + '</td><td class="num">' + won(h.total) + '</td></tr>' +
              h.rows.map(function (r) { return personRow(r, '', true); }).join('');
          }).join('');
          title = list.filter(function (h) { return h.key.charAt(0) !== '~'; }).length + '가정' + (hs['~none'] ? ' + 미등록 성도 ' + hs['~none'].rows.length + '명' : '') + (hs['~group'] ? ' + 구역·단체 ' + hs['~group'].rows.length + '곳' : '');
        } else {
          rows.sort(cmp);
          body = rows.map(function (r, i) { csv.push([i + 1, r.name, KIND_T[r.kind], r.count, r.total]); return personRow(r, i + 1, false); }).join('');
          title = rows.length + '명(곳)';
        }
        withPrint(out, '헌금자 통계', '<div class="fin-card"><div style="display:flex;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px"><b>' + esc(title) + ' · ' + cnt + '건</b><b style="color:#1e874b">' + won(tot) + '원</b></div>' +
          '<div style="overflow:auto;max-height:680px"><table class="fin-table"><thead><tr><th class="num">순위</th><th>' + (mode === 'house' ? '가정 / 헌금자' : '헌금자') + '</th><th>구분</th><th class="num">건수</th><th class="num">헌금 합계</th></tr></thead><tbody>' + body +
          '</tbody><tfoot><tr style="font-weight:700;background:#eef2f7"><td></td><td>합계</td><td></td><td class="num">' + cnt + '</td><td class="num">' + won(tot) + '</td></tr></tfoot></table></div></div>',
          null, { headers: ['순위', mode === 'house' ? '가정/헌금자' : '헌금자', '구분', '건수', '헌금합계'], rows: csv });
        Array.prototype.forEach.call(out.querySelectorAll('.gv-row'), function (tr) {
          tr.onclick = function () {
            var nx = tr.nextElementSibling;
            if (nx && nx.classList.contains('gv-detail')) { nx.remove(); return; }
            var r = map[tr.getAttribute('data-id')];
            var byAcc = {}; r.list.forEach(function (v) { var a = v['계정'] || ''; byAcc[a] = (byAcc[a] || 0) + (Number(v['금액']) || 0); });
            var lst = r.list.slice().sort(function (a, b) { return fmtD(b['일자']).localeCompare(fmtD(a['일자'])); });
            var d = document.createElement('tr'); d.className = 'gv-detail';
            d.innerHTML = '<td colspan="5" style="background:#fbfcfe;white-space:normal;padding:10px 12px">' +
              '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' + Object.keys(byAcc).sort(function (a, b) { return byAcc[b] - byAcc[a]; }).map(function (a) { return '<span class="fin-pill" style="background:#eef2f7;color:#3a4a63">' + esc(a) + ' ' + won(byAcc[a]) + '</span>'; }).join('') + '</div>' +
              '<table class="fin-table" style="font-size:.84rem"><thead><tr><th>일자</th><th>항목</th><th>적힌 이름</th><th class="num">금액</th></tr></thead><tbody>' +
              lst.map(function (v) { return '<tr><td>' + esc(fmtD(v['일자'])) + '</td><td>' + esc(v['계정'] || '') + '</td><td>' + esc(v['헌금자'] || '') + '</td><td class="num">' + won(v['금액']) + '</td></tr>'; }).join('') + '</tbody></table></td>';
            tr.parentNode.insertBefore(d, tr.nextSibling);
          };
        });
      }
      panel.querySelector('#gv_q').addEventListener('input', draw);
      ['#gv_kind', '#gv_sort', '#gv_mode'].forEach(function (id) { panel.querySelector(id).onchange = draw; });
      draw();
    }).catch(function (e) { panel.innerHTML = msgCard('조회 실패', e.message); });
  }

  /* ── 총계정원장 — 계정별 합계 + 계정을 누르면 그 계정의 전표(일자순, 누계) ── */
  function renderGL(panel) {
    loading(panel);
    Promise.all([ensureVouchers(), ensureBudget()]).then(function () {
      var list = vouchersFY();
      var content = ['수입', '지출'].map(function (type) {
        var accMap = sumByAccount(list, type);
        var tot = 0; Object.keys(accMap).forEach(function (k) { tot += accMap[k].s; });
        var rows = accountRows(type, accMap).filter(function (r) { return !r.group; });
        var ledgers = rows.map(function (r) {
          var name = r.label.replace(/ \(항으로 바로 입력\)$/, '');
          var vs = list.filter(function (v) { return String(v['구분']) === type && (v['계정'] || '(계정 없음)') === name; }).sort(function (a, b) { return fmtD(a['일자']).localeCompare(fmtD(b['일자'])); });
          var run = 0;
          return '<details style="border-top:1px solid #eef1f5;padding:6px 0"><summary style="cursor:pointer;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span><b>' + esc(type === '지출' ? accLabelExp(name) : name) + '</b> <span style="color:#9aa5b1;font-size:.82rem">' + r.c + '건</span>' + (r.unknown ? ' <span class="fin-pill out">계정표에 없음</span>' : '') + '</span><b>' + won(r.s) + '원</b></summary>' +
            '<div style="overflow:auto;margin-top:6px"><table class="fin-table" style="font-size:.84rem"><thead><tr><th>일자</th><th>' + (type === '수입' ? '헌금자' : '거래처/적요') + '</th><th class="num">금액</th><th class="num">누계</th></tr></thead><tbody>' +
            vs.map(function (v) { run += Number(v['금액']) || 0; return '<tr><td>' + esc(fmtD(v['일자'])) + '</td><td>' + esc(v['헌금자'] || v['적요'] || '') + '</td><td class="num">' + won(v['금액']) + '</td><td class="num">' + won(run) + '</td></tr>'; }).join('') +
            '</tbody></table></div></details>';
        }).join('');
        return '<div class="fin-card" style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><b>' + type + ' 계정별 합계</b><b style="color:' + (type === '수입' ? '#1e874b' : '#c0392b') + '">' + won(tot) + '원</b></div>' +
          '<div style="overflow:auto">' + accountTable(type, accMap, type + ' 기록이 없습니다.') + '</div>' +
          (ledgers ? '<div class="mng" style="margin-top:12px"><b style="font-size:.9rem">계정별 원장</b> <span class="help">— 계정을 누르면 전표가 날짜순으로 펼쳐집니다</span>' + ledgers + '</div>' : '') + '</div>';
      }).join('');
      withPrint(panel, '총계정원장', content);
    }).catch(function (e) { panel.innerHTML = msgCard('조회 실패', e.message); });
  }

  /* ── 결산보고서 — 회계연도 12달 전체 · 계정표 순서 · 예산 대비(예산이 있을 때) ── */
  function renderReport(panel) {
    loading(panel);
    Promise.all([ensureVouchers(), ensureBudget(), ensureSettings()]).then(function () {
      var fyR = fyRange(M.fy), list = vouchersFY(), carry = carryover();
      var fyMonths = fyMonthsOf(M.fy), nowYM = today().slice(0, 7);
      var months = {}; fyMonths.forEach(function (m) { months[m] = { inc: 0, exp: 0, n: 0 }; });
      list.forEach(function (v) { var m = fmtD(v['일자']).slice(0, 7), x = months[m]; if (!x) return; var a = Number(v['금액']) || 0; x.n++; if (String(v['구분']) === '수입') x.inc += a; else x.exp += a; });
      var ti = 0, te = 0, bal = carry;
      var monthRows = fyMonths.map(function (m) {
        var x = months[m], future = m > nowYM;
        ti += x.inc; te += x.exp; bal += x.inc - x.exp;
        var lab = (+m.slice(5)) + '월' + (m.slice(0, 4) !== fyMonths[0].slice(0, 4) ? ' <span style="font-size:.75em;color:#9aa5b1">(' + m.slice(0, 4) + ')</span>' : '');
        if (!x.n) return '<tr style="color:#aab2bd"><td>' + lab + '</td><td class="num">' + (future ? '' : '0') + '</td><td class="num">' + (future ? '' : '0') + '</td><td class="num hide-m">' + (future ? '' : '0') + '</td><td class="num">' + (future ? '' : won(bal)) + '</td></tr>';
        return '<tr><td>' + lab + '</td><td class="num">' + won(x.inc) + '</td><td class="num">' + won(x.exp) + '</td><td class="num hide-m"><b>' + won(x.inc - x.exp) + '</b></td><td class="num">' + won(bal) + '</td></tr>';
      }).join('');
      var accIn = sumByAccount(list, '수입'), accEx = sumByAccount(list, '지출');
      var hasBudget = (M.budget || []).some(function (b) { return Number(b['예산']) > 0; });
      var dataMonths = fyMonths.filter(function (m) { return months[m].n; }).length;

      // 예산 대비 실적: 계정표 순서, 예산이나 실적이 있는 줄만
      function budgetTable(gubun, accMap) {
        var all = (M.budget || []).filter(function (b) { return String(b['구분']) === gubun; }).sort(function (a, b) { return String(a['계정코드']).localeCompare(String(b['계정코드'])); });
        var kids = {}; all.filter(function (b) { return !isGrpCode(b['계정코드']); }).forEach(function (b) { (kids[parCode(b['계정코드'])] = kids[parCode(b['계정코드'])] || []).push(b); });
        var seen = {}, body = '', TB = 0, TA = 0;
        function line(name, bud, act, lvl, strong) {
          return '<tr' + (strong ? ' style="background:#f5f8fc;font-weight:700"' : '') + '><td>' + (lvl ? '<span style="padding-left:16px;color:#48576b">' + esc(name) + '</span>' : esc(name)) + '</td><td class="num">' + won(bud) + '</td><td class="num">' + won(act) + '</td><td class="num">' + won(bud - act) + '</td><td class="num">' + (bud ? (act / bud * 100).toFixed(1) + '%' : '-') + '</td></tr>';
        }
        all.filter(function (b) { return isGrpCode(b['계정코드']); }).forEach(function (g) {
          var gn = g['계정이름'], ks = kids[g['계정코드']] || [];
          if (!ks.length) { seen[gn] = 1; var bud = Number(g['예산']) || 0, act = (accMap[gn] || {}).s || 0; TB += bud; TA += act; if (bud || act) body += line(gn, bud, act, 0, false); return; }
          var sb = 0, sa = (accMap[gn] || {}).s || 0, kr = ''; seen[gn] = 1;
          ks.forEach(function (k) { var kn = k['계정이름'], b2 = Number(k['예산']) || 0, a2 = (accMap[kn] || {}).s || 0; seen[kn] = 1; sb += b2; sa += a2; if (b2 || a2) kr += line(kn, b2, a2, 1, false); });
          TB += sb; TA += sa; if (sb || sa) body += line(gn, sb, sa, 0, true) + kr;
        });
        var other = 0; Object.keys(accMap).forEach(function (n) { if (!seen[n]) other += accMap[n].s; });
        if (other) { TA += other; body += line('계정표에 없는 항목', 0, other, 0, false); }
        if (!body) return '<p class="help">' + gubun + ' 예산·실적이 없습니다.</p>';
        return '<table class="fin-table"><thead><tr><th>' + gubun + ' 항목</th><th class="num">예산</th><th class="num">실적</th><th class="num">' + (gubun === '수입' ? '예산−실적' : '남은 예산') + '</th><th class="num">' + (gubun === '수입' ? '달성률' : '집행률') + '</th></tr></thead><tbody>' + body +
          '</tbody><tfoot><tr style="font-weight:700;background:#eef2f7"><td>합계</td><td class="num">' + won(TB) + '</td><td class="num">' + won(TA) + '</td><td class="num">' + won(TB - TA) + '</td><td class="num">' + (TB ? (TA / TB * 100).toFixed(1) + '%' : '-') + '</td></tr></tfoot></table>';
      }

      function box(label, val, color) { return '<div style="flex:1;min-width:140px"><div style="color:#7b8794;font-size:.8rem">' + label + '</div><div style="font-size:1.15rem;font-weight:700;color:' + color + '">' + won(val) + '<span style="font-size:.78rem;font-weight:400">원</span></div></div>'; }
      var content =
        '<div class="fin-card"><div style="display:flex;gap:14px;flex-wrap:wrap">' +
          box('전기 이월금', carry, '#7b8794') + box('당기 수입', ti, '#1e874b') + box('당기 지출', te, '#c0392b') + box('기말 잔액', carry + ti - te, '#1A3A2F') +
        '</div><p class="help" style="margin-top:8px">' + esc(fyR.from) + ' ~ ' + esc(fyR.to) + ' · 기록이 있는 달 ' + dataMonths + '개월 · 전표 ' + list.length + '건' +
          (carry ? '' : ' · 전기 이월금이 0원입니다(설정 탭에서 넣을 수 있습니다)') + '</p></div>' +
        '<div class="fin-card"><b>월별 수입·지출 현황</b><div style="overflow:auto;margin-top:8px"><table class="fin-table"><thead><tr><th>월</th><th class="num">수입</th><th class="num">지출</th><th class="num hide-m">차액</th><th class="num">잔액</th></tr></thead><tbody>' + monthRows +
          '</tbody><tfoot><tr style="font-weight:700;background:#eef2f7"><td>합계</td><td class="num">' + won(ti) + '</td><td class="num">' + won(te) + '</td><td class="num hide-m">' + won(ti - te) + '</td><td class="num">' + won(carry + ti - te) + '</td></tr></tfoot></table></div>' +
          '<p class="help" style="margin-top:4px">잔액 = 전기 이월금 + 그 달까지의 수입 − 지출. 흐린 줄은 기록이 없는 달입니다.</p></div>' +
        '<div class="fin-card"><b>수입 항목별</b><div style="overflow:auto;margin-top:8px">' + accountTable('수입', accIn, '수입 기록이 없습니다.') + '</div></div>' +
        '<div class="fin-card"><b>지출 항목별</b><div style="overflow:auto;margin-top:8px">' + accountTable('지출', accEx, '지출 기록이 아직 없습니다.') + '</div></div>' +
        (hasBudget
          ? '<div class="fin-card"><b>예산 대비 실적</b><div style="overflow:auto;margin-top:8px">' + budgetTable('수입', accIn) + '</div><div style="overflow:auto;margin-top:14px">' + budgetTable('지출', accEx) + '</div>' +
            '<p class="help" style="margin-top:4px">예산은 1년 전체 금액이고, 실적은 지금까지 들어온 ' + dataMonths + '개월치입니다.</p></div>'
          : '<div class="fin-card"><b>예산 대비 실적</b><p class="help" style="margin-top:6px">' + M.fy + '년도 예산이 아직 입력되지 않아 이 표는 비워 두었습니다. 예산·계정 탭에서 예산을 넣으면 여기에 나옵니다.</p></div>');
      withPrint(panel, '결산보고서', content);
    }).catch(function (e) { panel.innerHTML = msgCard('조회 실패', e.message); });
  }

  /* ── 재정보고서 (월별/주별/분기별/직접 기간) — 달·분기는 고른 회계연도 안에서 ── */
  function renderFinReport(panel) {
    var fyMonths = fyMonthsOf(M.fy), nowYM = today().slice(0, 7);
    var defM = fyMonths.indexOf(nowYM) >= 0 ? nowYM : fyMonths[fyMonths.length - 1];
    if (nowYM < fyMonths[0]) defM = fyMonths[0];
    function ymLabel(m) { return (+m.slice(0, 4)) + '년 ' + (+m.slice(5)) + '월'; }
    var qOpts = [0, 1, 2, 3].map(function (q) { var a = fyMonths[q * 3], b = fyMonths[q * 3 + 2]; return '<option value="' + q + '"' + (fyMonths.slice(q * 3, q * 3 + 3).indexOf(defM) >= 0 ? ' selected' : '') + '>' + (q + 1) + '분기 (' + ymLabel(a) + ' ~ ' + ymLabel(b) + ')</option>'; }).join('');
    panel.innerHTML =
      '<div class="fin-card"><div class="fin-grid" style="align-items:end">' +
      '<div class="form-field"><label>기간 구분</label><select id="fr_type"><option value="month">월별</option><option value="week">주별</option><option value="quarter">분기별</option><option value="year">회계연도 전체</option><option value="custom">직접 선택</option></select></div>' +
      '<div class="form-field" id="fr_month_wrap"><label>월</label><select id="fr_month">' + fyMonths.map(function (m) { return '<option value="' + m + '"' + (m === defM ? ' selected' : '') + '>' + ymLabel(m) + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-field" id="fr_quarter_wrap" style="display:none"><label>분기</label><select id="fr_quarter">' + qOpts + '</select></div>' +
      '<div class="form-field" id="fr_week_wrap" style="display:none"><label>기준일(해당 주, 주일~토요일)</label><input type="date" id="fr_week" value="' + lastSunday() + '"></div>' +
      '<div class="form-field" id="fr_from_wrap" style="display:none"><label>시작일</label><input type="date" id="fr_from" value="' + fyRange(M.fy).from + '"></div>' +
      '<div class="form-field" id="fr_to_wrap" style="display:none"><label>종료일</label><input type="date" id="fr_to" value="' + today() + '"></div>' +
      '<div class="form-field"><button class="btn btn-solid" id="fr_go">조회</button></div>' +
      '</div></div><div id="fr_out"></div>';
    var typeSel = panel.querySelector('#fr_type');
    function toggle() {
      var t = typeSel.value;
      panel.querySelector('#fr_month_wrap').style.display = t === 'month' ? '' : 'none';
      panel.querySelector('#fr_quarter_wrap').style.display = t === 'quarter' ? '' : 'none';
      panel.querySelector('#fr_week_wrap').style.display = t === 'week' ? '' : 'none';
      panel.querySelector('#fr_from_wrap').style.display = t === 'custom' ? '' : 'none';
      panel.querySelector('#fr_to_wrap').style.display = t === 'custom' ? '' : 'none';
    }
    typeSel.onchange = function () { toggle(); go(); }; toggle();
    function monthRange(m) { var y = +m.slice(0, 4), mo = +m.slice(5); return { from: m + '-01', to: m + '-' + pad2(lastDay(y, mo)) }; }
    function range() {
      var t = typeSel.value;
      if (t === 'month') { var m = panel.querySelector('#fr_month').value, r = monthRange(m); r.label = ymLabel(m); return r; }
      if (t === 'quarter') { var q = +panel.querySelector('#fr_quarter').value, a = fyMonths[q * 3], b = fyMonths[q * 3 + 2]; return { from: monthRange(a).from, to: monthRange(b).to, label: M.fy + '년도 ' + (q + 1) + '분기 (' + ymLabel(a) + ' ~ ' + ymLabel(b) + ')' }; }
      if (t === 'year') { var fr = fyRange(M.fy); return { from: fr.from, to: fr.to, label: M.fy + '년도 전체' }; }
      if (t === 'week') { var w = weekRange(panel.querySelector('#fr_week').value); return { from: w.from, to: w.to, label: w.from + '(주일) ~ ' + w.to + '(토) 주간' }; }
      var f = panel.querySelector('#fr_from').value, tt = panel.querySelector('#fr_to').value; return { from: f, to: tt, label: (f || '?') + ' ~ ' + (tt || '?') };
    }
    var out = panel.querySelector('#fr_out');
    function go() {
      var rg = range();
      if (!rg.from || !rg.to) { out.innerHTML = msgCard('기간 확인', '시작일과 종료일을 선택하세요.'); return; }
      if (rg.from > rg.to) { out.innerHTML = msgCard('기간 확인', '시작일이 종료일보다 늦습니다.'); return; }
      loading(out);
      Promise.all([ensureVouchers(), ensureSettings(), ensureBudget()]).then(function () {
        var list = M.vouchers.filter(function (x) { var d = fmtD(x['일자']); return d >= rg.from && d <= rg.to; });
        var accIn = sumByAccount(list, '수입'), accEx = sumByAccount(list, '지출');
        var inc = 0, exp = 0; list.forEach(function (v) { var a = Number(v['금액']) || 0; if (String(v['구분']) === '수입') inc += a; else exp += a; });
        // 기초 잔액 = 시작일이 속한 회계연도의 이월금 + (그 회계연도 시작 ~ 시작일 전날) 수입 − 지출
        var ofy = fyOfDate(rg.from), fyStart = fyRange(ofy).from, priorNet = 0;
        M.vouchers.forEach(function (v) { var d = fmtD(v['일자']); if (d >= fyStart && d < rg.from) { var a = Number(v['금액']) || 0; priorNet += (String(v['구분']) === '수입') ? a : -a; } });
        var opening = carryover(ofy) + priorNet, ending = opening + inc - exp;
        var crossFY = fyOfDate(rg.to) !== ofy;
        var content = '<div class="fin-card"><b>' + esc(rg.label) + '</b> <span class="help">' + esc(rg.from) + ' ~ ' + esc(rg.to) + ' · 전표 ' + list.length + '건</span>' +
          '<table class="fin-table" style="margin-top:8px;max-width:520px"><tbody>' +
          '<tr><td>기초 잔액 (시작일 전까지)</td><td class="num">' + won(opening) + '</td></tr>' +
          '<tr><td>수입</td><td class="num" style="color:#1e874b">＋ ' + won(inc) + '</td></tr>' +
          '<tr><td>지출</td><td class="num" style="color:#c0392b">－ ' + won(exp) + '</td></tr>' +
          '<tr style="font-weight:700;background:#eef2f7"><td>기말 잔액</td><td class="num">' + won(ending) + '</td></tr></tbody></table>' +
          (crossFY ? '<p class="help" style="color:#c0392b">⚠ 기간이 회계연도를 넘어갑니다. 기초 잔액은 시작일이 속한 ' + ofy + '년도 기준입니다.</p>' : '') + '</div>' +
          '<div class="fin-card"><b>수입 항목별</b><div style="overflow:auto;margin-top:8px">' + accountTable('수입', accIn, '이 기간 수입 기록이 없습니다.') + '</div></div>' +
          '<div class="fin-card"><b>지출 항목별</b><div style="overflow:auto;margin-top:8px">' + accountTable('지출', accEx, '이 기간 지출 기록이 없습니다.') + '</div></div>';
        withPrint(out, '재정보고서', content, rg.label + ' (' + rg.from + ' ~ ' + rg.to + ')');
      }).catch(function (e) { out.innerHTML = msgCard('조회 실패', e.message); });
    }
    ['#fr_month', '#fr_quarter', '#fr_week', '#fr_from', '#fr_to'].forEach(function (id) { panel.querySelector(id).addEventListener('change', go); });
    panel.querySelector('#fr_go').onclick = go; go();
  }

  /* ── 헌금명단 (주보용: 주간·항목별 명단) ── */
  function renderGiverList(panel) {
    function ck(id, label, on) { return '<label class="sw" style="display:inline-flex;gap:5px;align-items:center;margin-right:14px;font-size:.86rem"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '> ' + label + '</label>'; }
    panel.innerHTML =
      '<div class="fin-card"><div class="fin-grid" style="align-items:end">' +
      '<div class="form-field"><label>기준일(해당 주)</label><input type="date" id="gl2_date" value="' + today() + '"></div>' +
      '<div class="form-field"><label>주간 선택</label><div style="display:flex;gap:6px"><button class="btn btn-line" id="gl2_this">이번주</button><button class="btn btn-line" id="gl2_last">지난주</button></div></div>' +
      '<div class="form-field"><button class="btn btn-solid" id="gl2_go">조회</button></div>' +
      '</div>' +
      '<div style="margin-top:12px;padding-top:12px;border-top:1px solid #eef1f5"><b style="font-size:.85rem;color:var(--ink-soft);margin-right:10px">출력 항목</b>' +
      ck('opt_name', '이름', true) + ck('opt_role', '직분', false) + ck('opt_memo', '헌금 사유', false) + ck('opt_spouse', '배우자 함께 표시', false) +
      '</div><p class="help" style="margin-top:8px">주보용 헌금자 명단 — 항목별 명단을 <b>한 칸에 모아</b> 표시합니다(드래그 복사용). 금액은 표기하지 않습니다. ‘배우자 함께 표시’ 체크 시 <b>홍길동 (김영희)</b> 형식으로 나옵니다.</p></div><div id="gl2_out"></div>';
    var dateInp = panel.querySelector('#gl2_date');
    panel.querySelector('#gl2_this').onclick = function () { dateInp.value = today(); go(); };
    panel.querySelector('#gl2_last').onclick = function () { var d = new Date(today() + 'T00:00:00'); d.setDate(d.getDate() - 7); dateInp.value = ymdOf(d); go(); };
    ['opt_name', 'opt_role', 'opt_memo', 'opt_spouse'].forEach(function (id) { panel.querySelector('#' + id).onchange = go; });
    var out = panel.querySelector('#gl2_out');
    function go() {
      var w = weekRange(dateInp.value);
      var oName = panel.querySelector('#opt_name').checked, oRole = panel.querySelector('#opt_role').checked,
        oMemo = panel.querySelector('#opt_memo').checked, oSpouse = panel.querySelector('#opt_spouse').checked;
      loading(out);
      Promise.all([ensureVouchers(), ensureBudget()]).then(function () {
        var list = M.vouchers.filter(function (x) { var d = fmtD(x['일자']); return d >= w.from && d <= w.to && String(x['종류']) === '헌금'; });
        if (!list.length) { out.innerHTML = '<div class="fin-card">해당 주(' + w.from + ' ~ ' + w.to + ') 헌금 내역이 없습니다.</div>'; return; }
        var mp = {}; M.members.forEach(function (m) { if (m.key) mp[m.key] = m; });
        var roleByName = {}; M.members.forEach(function (m) { if (m.name && m.role) roleByName[m.name] = m.role; });
        function baseName(s) { return String(s || '').replace(/\(.*\)$/, '').trim(); }
        function roleOf(v) { var m = v['매칭키'] && mp[v['매칭키']]; return (m && m.role) || roleByName[baseName(v['헌금자'])] || ''; }
        function spouseOf(v) { var m = v['매칭키'] && mp[v['매칭키']]; return (m && m.spouse) || (String(v['헌금자']).match(/\(([^)]+)\)/) || [])[1] || ''; }
        function nameOf(v) {
          var base = baseName(v['헌금자']) || (v['헌금자'] || '무명');
          if (oSpouse) { var sp = spouseOf(v); if (sp && sp !== base) base += ' (' + sp + ')'; }
          var t = oName ? base : '';
          if (oRole && roleOf(v)) t += (t ? ' ' : '') + roleOf(v);
          if (oMemo && v['적요']) t += ' (' + v['적요'] + ')';
          return t.trim() || base;
        }
        var byAcc = {}, order = [];
        list.forEach(function (v) { var a = v['계정'] || '기타'; if (!byAcc[a]) { byAcc[a] = []; order.push(a); } byAcc[a].push(v); });
        function accSum(a) { return byAcc[a].reduce(function (s, v) { return s + (Number(v['금액']) || 0); }, 0); }
        var codeOf = {}; (M.budget || []).forEach(function (b) { codeOf[b['계정이름']] = String(b['계정코드']); });
        order.sort(function (a, b) { return (codeOf[a] || '9' + a).localeCompare(codeOf[b] || '9' + b) || accSum(b) - accSum(a); });

        // 항목별 명단을 한 칸(카드)에 모두 — 드래그 복사 편의
        var blocks = order.map(function (a) {
          var names = byAcc[a].map(nameOf);
          // 이름 사이에 '실제 공백 문자'를 넣어 복사·붙여넣기 해도 이름이 붙지 않도록 한다(margin은 화면 여백용).
          return '<div style="margin-bottom:12px"><b style="color:var(--accent,#1A3A2F)">' + esc(a) + ' (' + names.length + '명)</b>' +
            '<div style="line-height:2;font-size:.95rem;margin-top:2px">' + names.map(function (n) { return '<span style="margin-right:12px">' + esc(n) + '</span>'; }).join(' ') + '</div></div>';
        }).join('');
        var content = '<div class="fin-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b>' + w.from + ' ~ ' + w.to + ' 헌금자 명단</b><span style="color:var(--ink-soft);font-size:.9rem">총 ' + list.length + '건</span></div>' + blocks + '</div>';
        withPrint(out, '헌금자 명단', content, w.from + ' ~ ' + w.to + ' 주간');
      }).catch(function (e) { out.innerHTML = msgCard('조회 실패', e.message); });
    }
    panel.querySelector('#gl2_go').onclick = go; go();
  }

  /* ── 기부금영수증 발급 ── */
  function birthFromKey(k) { var bd = (k || '').split('|')[1] || ''; return bd ? bd.slice(0, 4) + '-' + bd.slice(4, 6) + '-' + bd.slice(6, 8) : ''; }
  function birthDigits(k) { return (k || '').split('|')[1] || ''; }
  function memByKey(k) { for (var i = 0; i < M.members.length; i++) if (M.members[i].key === k) return M.members[i]; return null; }
  // 키 집합의 회계연도 헌금 전표
  // 기부금영수증은 연말정산 기준이라 회계연도 시작 월과 관계없이 늘 그 해 1월 1일 ~ 12월 31일
  function rcpRange() { return { from: M.fy + '-01-01', to: M.fy + '-12-31' }; }
  function rcpVouchers() { var r = rcpRange(); return M.vouchers.filter(function (x) { var d = fmtD(x['일자']); return d >= r.from && d <= r.to && String(x['구분']) === '수입'; }); }
  function receiptVouchers(keys) { return rcpVouchers().filter(function (x) { return keys.indexOf(x['매칭키']) >= 0; }); }
  // 명세방식별 기부내용 행 [{date,content,amount}]
  function detailRowsFor(vs, mode) {
    var rows = [];
    if (mode === 'month') {
      var byM = {}, ord = [];
      vs.forEach(function (v) { var m = fmtD(v['일자']).slice(0, 7); if (!byM[m]) { byM[m] = 0; ord.push(m); } byM[m] += Number(v['금액']) || 0; });
      ord.sort();
      ord.forEach(function (m) { rows.push({ date: m, content: '헌금(' + m.slice(5) + '월)', amount: byM[m] }); });
    } else if (mode === 'account') {
      var byA = {}, oa = [];
      vs.forEach(function (v) { var a = v['계정'] || '헌금'; if (!byA[a]) { byA[a] = 0; oa.push(a); } byA[a] += Number(v['금액']) || 0; });
      oa.sort(function (a, b) { return byA[b] - byA[a]; });
      oa.forEach(function (a) { rows.push({ date: String(M.fy), content: a, amount: byA[a] }); });
    } else {
      var t = vs.reduce(function (s, v) { return s + (Number(v['금액']) || 0); }, 0);
      rows.push({ date: String(M.fy), content: '헌금(종교단체)', amount: t });
    }
    return rows;
  }
  // 활성 영수증으로 커버된 매칭키 → 영수증
  function coveredMap() {
    var map = {};
    (M.receipts || []).filter(function (r) { return r.status === 'issued' && r.fy === M.fy; }).forEach(function (r) {
      var ks = (r.includedKeys && r.includedKeys.length) ? r.includedKeys : [r.key];
      ks.forEach(function (k) { if (k) map[k] = r; });
    });
    return map;
  }
  function renderReceipt(panel) {
    loading(panel);
    Promise.all([ensureVouchers(), ensureSettings(), ensureReceipts()]).then(function () {
      var map = {};
      rcpVouchers().filter(function (x) { return x['매칭키']; }).forEach(function (v) { var k = v['매칭키']; if (!map[k]) map[k] = { name: memberName(k) || v['헌금자'], key: k, total: 0, count: 0 }; map[k].total += Number(v['금액']) || 0; map[k].count++; });
      var rows = Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.total - a.total; });
      var tot = rows.reduce(function (s, r) { return s + r.total; }, 0);
      var cov = coveredMap();
      var org = orgInfo();
      panel.innerHTML =
        (org.bizno ? '' : '<div style="background:#fdecea;border:1px solid #f5b7b1;color:#922b21;padding:9px 13px;border-radius:8px;font-size:.83rem;margin-bottom:10px">⚠ 발급기관 <b>고유번호(사업자등록번호)</b>가 비어 있습니다. <b>설정 → 기부금영수증 발급기관</b>에서 먼저 입력하세요. (영수증 효력에 필요)</div>') +
        '<div class="fin-card"><div style="background:#fff8e8;border:1px solid #f0d98c;color:#8a6512;padding:10px 14px;border-radius:9px;font-size:.85rem;margin-bottom:12px">연말정산 기부금영수증 — <b>' + M.fy + '년 1월 1일 ~ 12월 31일</b>, 교적과 이어진 교인의 헌금 누계입니다. <b>발급</b> 버튼으로 공식 양식(소득세법 시행규칙 별지 제45호의2서식) 영수증을 출력/PDF 저장합니다. (미등록 헌금자 제외)</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px"><b>교인별 헌금 누계 (' + rows.length + '명) · ' + M.fy + '년 1~12월</b><span><b style="color:#1e874b;margin-right:12px">' + won(tot) + '원</b><button class="btn btn-line" id="rcp_xls">⬇ 엑셀</button></span></div>' +
        '<div style="overflow:auto;max-height:640px"><table class="fin-table"><thead><tr><th>이름</th><th>생년월일</th><th class="num">건수</th><th class="num">헌금 누계</th><th>발급</th></tr></thead><tbody>' +
        rows.map(function (r, i) {
          var rc = cov[r.key];
          var st;
          if (rc) {
            var byOther = (rc.key && rc.key !== r.key);
            st = '<span class="rcp-badge ok">✓ 발급완료 · ' + (rc.method === 'pdf' ? 'PDF' : '출력') + (rc.spouse ? (byOther ? ' · 배우자합산' : ' · 부부합산') : '') + '</span>' +
              (byOther ? '' : ' <button class="btn btn-line rcp-cancel" data-cancel="' + rc.id + '" style="padding:3px 9px;font-size:.76rem">발급취소</button>');
          } else {
            st = '<button class="btn btn-solid rcp-issue" data-idx="' + i + '" style="padding:4px 12px;font-size:.8rem">발급</button>';
          }
          return '<tr><td><b>' + esc(r.name) + '</b></td><td>' + esc(birthFromKey(r.key)) + '</td><td class="num">' + r.count + '</td><td class="num"><b>' + won(r.total) + '</b></td><td style="white-space:nowrap">' + st + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
      panel.querySelector('#rcp_xls').onclick = function () {
        downloadCSV('교인별_헌금누계_' + M.fy + '_' + today() + '.csv',
          [['교인별 헌금 누계 · ' + M.fy + '년도'], [], ['이름', '생년월일', '건수', '헌금누계', '발급상태']].concat(
            rows.map(function (r) { var rc = cov[r.key]; var stat = rc ? ('발급완료(' + (rc.method === 'pdf' ? 'PDF' : '출력') + (rc.spouse ? (rc.key && rc.key !== r.key ? '·배우자합산' : '·부부합산') : '') + ')') : '미발급'; return [r.name, birthFromKey(r.key), r.count, r.total, stat]; })
          ));
      };
      Array.prototype.forEach.call(panel.querySelectorAll('.rcp-issue'), function (b) {
        b.onclick = function () { openReceiptModal(rows[Number(b.dataset.idx)], function () { renderReceipt(panel); }); };
      });
      Array.prototype.forEach.call(panel.querySelectorAll('.rcp-cancel'), function (b) {
        b.onclick = function () {
          if (!confirm('이 영수증 발급을 취소할까요? (발급대장에서 취소 상태로 기록됩니다)')) return;
          b.disabled = true; b.textContent = '취소 중…';
          WPF.call('cancelReceipt', { id: Number(b.dataset.cancel) }).then(function () { M._rc = false; ensureReceipts().then(function () { renderReceipt(panel); }); })
            .catch(function (e) { alert('취소 실패: ' + e.message); b.disabled = false; b.textContent = '발급취소'; });
        };
      });
    }).catch(function (e) { panel.innerHTML = msgCard('조회 실패', e.message); });
  }

  // 발급 팝업
  function openReceiptModal(member, after) {
    var me = memByKey(member.key) || {};
    var spouseKey = me.spouseKey || '';
    var spouseMem = spouseKey ? memByKey(spouseKey) : null;
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,25,.55);z-index:9000;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 14px';
    var addr = me.address || '';
    ov.innerHTML =
      '<div style="background:#fff;border-radius:14px;max-width:680px;width:100%;box-shadow:0 18px 50px rgba(0,0,0,.35);padding:22px 24px 26px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><h3 style="margin:0;color:var(--accent,#1A3A2F)">기부금영수증 발급 — ' + esc(member.name) + '</h3><button id="rc_x" style="border:0;background:none;font-size:1.5rem;cursor:pointer;color:#98a2af">&times;</button></div>' +
      '<p style="color:var(--ink-soft);font-size:.84rem;margin:0 0 14px">' + M.fy + '년(1/1~12/31) 헌금 누계 <b>' + won(member.total) + '원</b> · ' + member.count + '건. 발급 옵션을 선택하면 미리보기가 갱신됩니다.</p>' +
      '<div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:12px">' +
      '<div><div style="font-size:.78rem;color:var(--ink-soft);margin-bottom:4px">명세 방식</div>' +
      '<label class="rc-r"><input type="radio" name="rc_detail" value="sum" checked> 합계(1줄)</label> ' +
      '<label class="rc-r"><input type="radio" name="rc_detail" value="month"> 월별</label> ' +
      '<label class="rc-r"><input type="radio" name="rc_detail" value="account"> 항목별</label></div>' +
      (spouseKey ? '<div><div style="font-size:.78rem;color:var(--ink-soft);margin-bottom:4px">부부합산</div><label class="rc-r"><input type="checkbox" id="rc_spouse"> 배우자(' + esc(spouseMem ? spouseMem.name : (me.spouse || '')) + ') 헌금 합산</label></div>' : '') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">' +
      '<div class="form-field" style="margin:0"><label>주민등록번호 <span style="color:#98a2af;font-weight:400">(선택)</span></label><input type="text" id="rc_rrn" placeholder="앞 6자리 또는 전체" autocomplete="off"></div>' +
      '<div class="form-field" style="margin:0"><label>주소</label><input type="text" id="rc_addr" value="' + esc(addr) + '" placeholder="기부자 주소"></div>' +
      '</div>' +
      '<div id="rc_prev" style="border:1px solid #e3e7ee;border-radius:10px;padding:12px;background:#fafbfd;margin-bottom:14px;max-height:230px;overflow:auto"></div>' +
      '<div style="display:flex;gap:9px;justify-content:flex-end;flex-wrap:wrap;align-items:center"><span id="rc_msg" style="font-size:.82rem;color:#c0392b;margin-right:auto"></span>' +
      '<button class="btn btn-line" id="rc_print">🖨 인쇄(출력)</button><button class="btn btn-solid" id="rc_pdf">📄 PDF로 저장</button></div>' +
      '</div>';
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    function close() { ov.remove(); document.body.style.overflow = ''; }
    ov.querySelector('#rc_x').onclick = close;
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    function opts() {
      var mode = (ov.querySelector('input[name="rc_detail"]:checked') || {}).value || 'sum';
      var sp = ov.querySelector('#rc_spouse'); var spOn = !!(sp && sp.checked);
      return { mode: mode, spouse: spOn };
    }
    function gather() {
      var o = opts();
      var keys = [member.key]; if (o.spouse && spouseKey) keys.push(spouseKey);
      var vs = receiptVouchers(keys);
      var rows = detailRowsFor(vs, o.mode);
      var total = vs.reduce(function (s, v) { return s + (Number(v['금액']) || 0); }, 0);
      return { mode: o.mode, spouse: o.spouse, keys: keys, vs: vs, rows: rows, total: total };
    }
    function refresh() {
      var g = gather();
      var prev = ov.querySelector('#rc_prev');
      prev.innerHTML = '<div style="font-size:.8rem;color:var(--ink-soft);margin-bottom:6px">기부내용 미리보기 · 합계 <b style="color:#1e874b">' + won(g.total) + '원</b> (' + g.vs.length + '건)</div>' +
        '<table class="fin-table" style="font-size:.84rem"><thead><tr><th>연월일</th><th>내용</th><th class="num">금액</th></tr></thead><tbody>' +
        g.rows.map(function (r) { return '<tr><td>' + esc(r.date) + '</td><td>' + esc(r.content) + '</td><td class="num">' + won(r.amount) + '</td></tr>'; }).join('') +
        '</tbody></table>';
      // 배우자 이미 발급 경고
      var cov = coveredMap();
      var msg = ov.querySelector('#rc_msg');
      if (g.spouse && spouseKey && cov[spouseKey]) msg.textContent = '⚠ 배우자에게 이미 발급된 영수증이 있습니다. 합산 발급 시 중복될 수 있습니다.';
      else if (!orgInfo().bizno) msg.textContent = '⚠ 설정에서 발급기관 고유번호를 먼저 입력하세요.';
      else msg.textContent = '';
    }
    Array.prototype.forEach.call(ov.querySelectorAll('input[name="rc_detail"]'), function (r) { r.onchange = refresh; });
    if (ov.querySelector('#rc_spouse')) ov.querySelector('#rc_spouse').onchange = refresh;
    refresh();

    function issue(method) {
      var g = gather();
      if (!g.total) { ov.querySelector('#rc_msg').textContent = '발급할 헌금 내역이 없습니다.'; return; }
      var rrn = ov.querySelector('#rc_rrn').value.trim();
      var addrV = ov.querySelector('#rc_addr').value.trim();
      var r = rcpRange();
      var no = nextReceiptNo();
      var rec = {
        no: no, fy: M.fy, key: member.key, name: member.name, birth: birthDigits(member.key),
        rrn: rrn, addr: addrV, includedKeys: g.keys, detail: g.mode, spouse: g.spouse,
        period: M.fy + '년 귀속(' + r.from + '~' + r.to + ')', amount: g.total, cnt: g.vs.length, method: method
      };
      var btnP = ov.querySelector('#rc_print'), btnD = ov.querySelector('#rc_pdf');
      btnP.disabled = btnD.disabled = true; ov.querySelector('#rc_msg').style.color = '#7b8794'; ov.querySelector('#rc_msg').textContent = '발급 기록 중…';
      WPF.call('addReceipt', { receipt: rec }).then(function (res) {
        printReceipt(rec, orgInfo(), g.rows);
        M._rc = false;
        ensureReceipts().then(function () { close(); if (after) after(); });
      }).catch(function (e) { btnP.disabled = btnD.disabled = false; ov.querySelector('#rc_msg').style.color = '#c0392b'; ov.querySelector('#rc_msg').textContent = '발급 실패: ' + e.message; });
    }
    ov.querySelector('#rc_print').onclick = function () { issue('print'); };
    ov.querySelector('#rc_pdf').onclick = function () { issue('pdf'); };
  }

  // 다음 일련번호 (회계연도-순번4자리)
  function nextReceiptNo() {
    var pre = M.fy + '-';
    var max = 0;
    (M.receipts || []).forEach(function (r) { if (String(r.no || '').indexOf(pre) === 0) { var n = parseInt(String(r.no).slice(pre.length), 10) || 0; if (n > max) max = n; } });
    return pre + ('000' + (max + 1)).slice(-4);
  }

  // 공식 기부금영수증 인쇄 (별지 제45호의2서식)
  function printReceipt(rec, org, rows) {
    var w = window.open('', '_blank', 'width=900,height=940');
    if (!w) { alert('팝업이 차단되었습니다. 브라우저에서 팝업을 허용한 뒤 다시 시도해 주세요.'); return; }
    var dt = today(); var d = new Date(dt + 'T00:00:00');
    var dateK = d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
    var rrn = rec.rrn ? esc(rec.rrn) : (birthDigits(rec.key) ? birthDigits(rec.key).slice(2) + '-*******' : '');
    var bodyRows = rows.map(function (r) {
      return '<tr><td class="c">종교단체기부금</td><td class="c">41</td><td class="c">금전</td><td class="c">' + esc(r.date) + '</td><td>' + esc(r.content) + '</td><td class="r">' + won(r.amount) + '</td></tr>';
    }).join('');
    var css = [
      '*{box-sizing:border-box}',
      'body{font-family:"Noto Sans KR","Malgun Gothic",sans-serif;color:#111;margin:0;padding:24px 30px;font-size:12px;line-height:1.4}',
      '.doc{max-width:760px;margin:0 auto}',
      '.no{font-size:11px;color:#333;margin-bottom:2px}',
      '.lh{display:flex;align-items:center;justify-content:center;gap:12px;margin:0 0 6px;padding-bottom:10px;border-bottom:2px solid #1f3a5f}',
      '.lh img{height:50px}',
      '.lh .lh-kr{font-family:"Noto Serif KR",serif;font-size:21px;font-weight:700;letter-spacing:.14em;color:#1f3a5f}',
      'h1{text-align:center;font-size:24px;letter-spacing:.5em;margin:6px 0 4px;font-weight:700}',
      '.law-top{text-align:center;font-size:10.5px;color:#444;margin:0 0 14px}',
      'table{width:100%;border-collapse:collapse;margin-bottom:6px}',
      'td,th{border:1px solid #555;padding:5px 7px;vertical-align:middle}',
      '.sec{background:#f0f0f0;font-weight:700;text-align:center;width:96px}',
      '.lbl{background:#f7f7f7;font-weight:600;text-align:center;width:104px;font-size:11px}',
      '.c{text-align:center}.r{text-align:right;font-variant-numeric:tabular-nums}',
      'thead th{background:#eaeef3;text-align:center;font-weight:700;font-size:11.5px}',
      'tfoot td{background:#f3f3f3;font-weight:700}',
      '.subt{font-weight:700;margin:12px 0 4px;font-size:12.5px}',
      '.stmt{font-size:11.5px;margin:16px 0 4px;line-height:1.6}',
      '.dt{text-align:center;margin:14px 0 6px;font-size:12.5px}',
      '.sign{text-align:right;margin:4px 0;font-size:12.5px}',
      '.ul{display:inline-block;min-width:120px;border-bottom:1px solid #111;text-align:center;font-weight:700}',
      '.ul.big{min-width:180px;font-size:15px;font-family:"Noto Serif KR",serif}',
      '.foot{margin-top:18px;font-size:9.5px;color:#888;border-top:1px solid #ddd;padding-top:8px}',
      '.seal{height:58px;vertical-align:middle;margin-left:-6px;position:relative;top:-2px}',
      '.attach{page-break-before:always;break-before:page;padding-top:6px}',
      '.attach-t{font-size:12.5px;font-weight:700;color:#1f3a5f;margin:0 0 8px;border-left:3px solid #c9a227;padding-left:8px}',
      '.attach img{display:block;max-width:100%;max-height:245mm;margin:0 auto;border:1px solid #ccc}',
      '@page{size:A4;margin:16mm 14mm}',
      '@media print{body{padding:0}.noprint{display:none}}'
    ].join('');
    var html = '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>기부금영수증 ' + esc(rec.no) + '</title>' +
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&family=Noto+Serif+KR:wght@600;700&display=swap" rel="stylesheet">' +
      '<style>' + css + '</style></head><body><div class="doc">' +
      (org.imgLogo ? '<div class="lh"><img src="' + esc(org.imgLogo) + '" alt="로고"><span class="lh-kr">' + esc(org.name) + '</span></div>' : '') +
      '<div class="no">※ 일련번호 &nbsp;<b>' + esc(rec.no) + '</b></div>' +
      '<h1>기부금영수증</h1>' +
      '<p class="law-top">「소득세법」 제34조ㆍ제59조의4, 「조세특례제한법」 제76조ㆍ제88조의4 및 「법인세법」 제24조에 따른 기부금</p>' +
      '<table>' +
      '<tr><td class="sec" rowspan="2">① 기부자</td><td class="lbl">성명(법인명)</td><td>' + esc(rec.name) + '</td><td class="lbl">주민등록번호<br>(사업자등록번호)</td><td>' + rrn + '</td></tr>' +
      '<tr><td class="lbl">주소(소재지)</td><td colspan="3">' + esc(rec.addr || '') + '</td></tr>' +
      '</table>' +
      '<table>' +
      '<tr><td class="sec" rowspan="2">② 기부금<br>단체</td><td class="lbl">단체명</td><td>' + esc(org.name) + '</td><td class="lbl">사업자등록번호<br>(고유번호)</td><td>' + esc(org.bizno || '') + '</td></tr>' +
      '<tr><td class="lbl">소재지</td><td>' + esc(org.addr) + '</td><td class="lbl">기부금공제대상<br>근거법령</td><td>' + esc(org.law) + '</td></tr>' +
      '</table>' +
      '<div class="subt">③ 기부내용</div>' +
      '<table><thead><tr><th>유형</th><th>코드</th><th>구분</th><th>연월일</th><th>내용</th><th>금액</th></tr></thead>' +
      '<tbody>' + bodyRows + '</tbody>' +
      '<tfoot><tr><td class="c" colspan="5">합 계</td><td class="r">' + won(rec.amount) + '</td></tr></tfoot></table>' +
      '<p class="stmt">「소득세법」 제34조, 「조세특례제한법」 제76조ㆍ제88조의4 및 「법인세법」 제24조에 따른 기부금을 위와 같이 기부하였음을 확인하여 주시기 바랍니다.</p>' +
      '<p class="dt">' + dateK + '</p>' +
      '<p class="sign">신청인(기부자) &nbsp; <span class="ul">' + esc(rec.name) + '</span> &nbsp;(서명 또는 인)</p>' +
      '<p class="stmt">위와 같이 기부금을 기부받았음을 증명합니다.</p>' +
      '<p class="dt">' + dateK + '</p>' +
      '<p class="sign">기부금 수령인 &nbsp; <span class="ul big">' + esc(org.name) + '</span>' + (org.imgSeal ? '<img class="seal" src="' + esc(org.imgSeal) + '" alt="직인">' : ' &nbsp;(직인)') + '</p>' +
      '<div class="foot">발급방식: ' + (rec.method === 'pdf' ? 'PDF 저장' : '인쇄 출력') + ' · 기간: ' + esc(rec.period || (M.fy + '년')) + ' · 발급일 ' + dt + ' · ' + esc(org.name) + ' 회계시스템</div>' +
      (org.imgUid ? '<div class="attach"><div class="attach-t">[붙임 1] 고유번호증</div><img src="' + esc(org.imgUid) + '" alt="고유번호증"></div>' : '') +
      (org.imgAssoc ? '<div class="attach"><div class="attach-t">[붙임 2] 총회소속증명서</div><img src="' + esc(org.imgAssoc) + '" alt="총회소속증명서"></div>' : '') +
      '<div class="noprint" style="text-align:center;margin-top:20px"><button onclick="window.print()" style="padding:9px 24px;font-size:14px;cursor:pointer;border:0;background:#1f3a5f;color:#fff;border-radius:8px">🖨 인쇄 / PDF 저장</button></div>' +
      '<scr' + 'ipt>window.addEventListener("load",function(){setTimeout(function(){try{window.print()}catch(e){}},500)});</scr' + 'ipt>' +
      '</div></body></html>';
    writePrint(w, html);
  }

  /* ── 기부금영수증 발급대장 ── */
  function renderReceiptLog(panel) {
    loading(panel);
    Promise.all([ensureReceipts(), ensureSettings()]).then(function () {
      var list = (M.receipts || []).slice().sort(function (a, b) { return String(b.no).localeCompare(String(a.no)); });
      var issued = list.filter(function (r) { return r.status === 'issued'; });
      var totAmt = issued.reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0);
      var detailK = { sum: '합계', month: '월별', account: '항목별' };
      panel.innerHTML = '<div class="fin-card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px"><b>기부금영수증 발급대장 (전체 ' + list.length + '건 · 유효 ' + issued.length + '건)</b>' +
        '<span><b style="color:#1e874b;margin-right:12px">' + won(totAmt) + '원</b><button class="btn btn-line" id="rcl_xls">⬇ 엑셀(세무서 보고용)</button></span></div>' +
        '<div style="overflow:auto;max-height:640px"><table class="fin-table"><thead><tr><th>일련번호</th><th>발급일</th><th>기부자</th><th>생년월일</th><th>회계연도</th><th>명세</th><th>합산</th><th class="num">금액</th><th>방식</th><th>상태</th><th>관리</th></tr></thead><tbody>' +
        (list.length ? list.map(function (r) {
          var cancelled = r.status === 'cancelled';
          return '<tr' + (cancelled ? ' style="color:#aab2bd;text-decoration:line-through"' : '') + '><td>' + esc(r.no) + '</td><td>' + esc(fmtD(r.issuedAt)) + '</td><td><b>' + esc(r.name) + '</b></td><td>' + esc(r.birth ? (r.birth.slice(0, 4) + '-' + r.birth.slice(4, 6) + '-' + r.birth.slice(6, 8)) : '') + '</td><td>' + esc(String(r.fy)) + '년</td><td>' + esc(detailK[r.detail] || r.detail) + '</td><td>' + (r.spouse ? '부부' : '-') + '</td><td class="num"><b>' + won(r.amount) + '</b></td><td>' + (r.method === 'pdf' ? 'PDF' : '출력') + '</td><td>' + (cancelled ? '취소됨' : '<span style="color:#1e874b">유효</span>') + '</td><td>' + (cancelled ? '' : '<button class="btn btn-line" data-cancel="' + r.id + '" style="padding:3px 9px;font-size:.76rem">발급취소</button>') + '</td></tr>';
        }).join('') : '<tr><td colspan="11" style="text-align:center;color:#9aa5b1;padding:24px">발급된 영수증이 없습니다.</td></tr>') +
        '</tbody></table></div></div>';
      Array.prototype.forEach.call(panel.querySelectorAll('[data-cancel]'), function (b) {
        b.onclick = function () {
          if (!confirm('이 영수증 발급을 취소할까요?')) return;
          b.disabled = true; b.textContent = '취소 중…';
          WPF.call('cancelReceipt', { id: Number(b.dataset.cancel) }).then(function () { M._rc = false; ensureReceipts().then(function () { renderReceiptLog(panel); }); })
            .catch(function (e) { alert('취소 실패: ' + e.message); b.disabled = false; b.textContent = '발급취소'; });
        };
      });
      panel.querySelector('#rcl_xls').onclick = function () { exportReceiptCSV(list, detailK); };
    }).catch(function (e) { panel.innerHTML = msgCard('조회 실패', e.message); });
  }

  function exportReceiptCSV(list, detailK) {
    var head = ['일련번호', '발급일', '기부자성명', '생년월일', '주민등록번호', '주소', '회계연도', '명세방식', '부부합산', '헌금건수', '금액', '발급방식', '상태'];
    function q(v) { v = String(v == null ? '' : v); return '"' + v.replace(/"/g, '""') + '"'; }
    var lines = [head.map(q).join(',')];
    list.forEach(function (r) {
      lines.push([r.no, fmtD(r.issuedAt), r.name, r.birth || '', r.rrn || '', r.addr || '', r.fy + '년', (detailK[r.detail] || r.detail), (r.spouse ? '부부합산' : ''), r.cnt, r.amount, (r.method === 'pdf' ? 'PDF' : '출력'), (r.status === 'cancelled' ? '취소' : '유효')].map(q).join(','));
    });
    var csv = '﻿' + lines.join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '기부금영수증_발급대장_' + M.fy + '_' + today() + '.csv';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ── 예산(앱 내 직접 편집 → 구글시트 저장) ── */
  function renderBudget(panel) {
    var editing = false;
    function pad2(n) { return ('0' + n).slice(-2); }
    function isGroup(c) { return String(c || '').slice(-4) === '0000'; }      // 항(상위)
    function parentOf(c) { return String(c || '').slice(0, 3) + '0000'; }
    function reload() { M._b = false; ensureBudget().then(draw); }
    function nextGroup(prefix, g) {
      var codes = M.budget.filter(function (b) { return String(b['구분']) === g && isGroup(b['계정코드']) && String(b['계정코드']).charAt(0) === prefix; }).map(function (b) { return parseInt(String(b['계정코드']).slice(1, 3), 10) || 0; });
      return prefix + pad2((codes.length ? Math.max.apply(null, codes) : 0) + 1) + '0000';
    }
    function nextDetail(groupCode, g) {
      var base3 = String(groupCode).slice(0, 3);
      var codes = M.budget.filter(function (b) { return String(b['구분']) === g && !isGroup(b['계정코드']) && String(b['계정코드']).slice(0, 3) === base3; }).map(function (b) { return parseInt(String(b['계정코드']).slice(3, 5), 10) || 0; });
      return base3 + pad2((codes.length ? Math.max.apply(null, codes) : 0) + 1) + '00';
    }
    function draw() {
      panel.innerHTML = '';
      var bar = document.createElement('div'); bar.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:10px';
      bar.innerHTML = '<span id="bud_msg" style="font-size:.85rem;color:var(--ink-soft)"></span><span style="display:flex;gap:8px"><button class="btn btn-line" id="bud_xls">⬇ 엑셀</button><button class="btn ' + (editing ? 'btn-solid' : 'btn-line') + '" id="bud_edit">' + (editing ? '✓ 편집 완료' : '✏️ 계정·예산 수정') + '</button></span>';
      panel.appendChild(bar);
      var msg = bar.querySelector('#bud_msg');
      function flash(t, ok) { msg.textContent = t; msg.style.color = ok === false ? '#c0392b' : (ok ? 'green' : 'var(--ink-soft)'); }
      bar.querySelector('#bud_edit').onclick = function () { editing = !editing; draw(); };
      bar.querySelector('#bud_xls').onclick = function () {
        var rows = M.budget.slice().sort(function (a, b) { return String(a['계정코드']).localeCompare(String(b['계정코드'])); }).map(function (b) {
          return [b['구분'], b['계정코드'], b['계정이름'], (isGroup(b['계정코드']) ? '항' : '목'), Number(b['예산']) || 0, Number(b['전년예산']) || 0, Number(b['전년결산']) || 0];
        });
        downloadCSV('예산_' + M.fy + '_' + today() + '.csv', [['예산서 · ' + M.fy + '년도'], [], ['구분', '계정코드', '계정이름', '항/목', '금년예산', '전년예산', '전년결산']].concat(rows));
      };
      if (editing) { var hint = document.createElement('p'); hint.className = 'help'; hint.style.marginBottom = '12px'; hint.textContent = '편집 모드: 항(분류)·목(계정)을 추가·이름수정·삭제할 수 있습니다. 금년예산 칸은 언제든 클릭해 바로 저장됩니다. ※ 하위 목(하위 계정)을 하나도 만들지 않은 항은 그 항목 자체가 계정으로 사용됩니다 — 전표 입력 시 이 항 이름으로 바로 기록하세요.'; panel.appendChild(hint); }

      ['수입', '지출'].forEach(function (g) {
        var prefix = g === '수입' ? '1' : '2';
        var all = M.budget.filter(function (b) { return String(b['구분']) === g; });
        var groups = all.filter(function (b) { return isGroup(b['계정코드']); }).sort(function (a, b) { return String(a['계정코드']).localeCompare(String(b['계정코드'])); });
        var byParent = {}; all.filter(function (b) { return !isGroup(b['계정코드']); }).forEach(function (b) { var p = parentOf(b['계정코드']); (byParent[p] = byParent[p] || []).push(b); });
        function total() { return all.filter(function (b) { return !isGroup(b['계정코드']); }).reduce(function (s, b) { return s + (Number(b['예산']) || 0); }, 0); }
        var card = document.createElement('div'); card.className = 'fin-card'; card.style.marginBottom = '16px';
        var head = document.createElement('div'); head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px';
        head.innerHTML = '<b>' + g + ' 예산</b><b class="g-total">' + won(total()) + '원</b>';
        card.appendChild(head);
        var wrap = document.createElement('div'); wrap.style.overflow = 'auto';
        var tbl = document.createElement('table'); tbl.className = 'fin-table';
        tbl.innerHTML = '<thead><tr><th>코드</th><th>계정(항/목)</th><th class="num">전년예산</th><th class="num">전년결산</th><th class="num">금년예산</th>' + (editing ? '<th>관리</th>' : '') + '</tr></thead><tbody></tbody>';
        var tb = tbl.querySelector('tbody');
        function budgetInput(b) {
          var inp = document.createElement('input'); inp.type = 'text'; inp.inputMode = 'numeric'; inp.value = won(b['예산']);
          inp.style.cssText = 'width:120px;text-align:right;border:1px solid #dfe5ee;border-radius:6px;padding:4px 7px;font:inherit';
          inp.addEventListener('input', function () { var n = parseNum(inp.value); inp.value = n ? won(n) : ''; });
          inp.addEventListener('change', function () {
            var n = parseNum(inp.value), prev = Number(b['예산']) || 0; if (n === prev) return;
            WPF.call('updateBudget', { code: b['계정코드'], amount: n }).then(function () { b['예산'] = n; M._b = false; inp.style.borderColor = '#1e874b'; head.querySelector('.g-total').textContent = won(total()) + '원'; flash('✓ 저장됨', true); setTimeout(function () { inp.style.borderColor = '#dfe5ee'; }, 1000); })
              .catch(function (e) { inp.style.borderColor = '#c0392b'; inp.value = won(prev); flash('저장 실패: ' + e.message, false); });
          });
          return inp;
        }
        function mng(actions) { var td = document.createElement('td'); td.style.whiteSpace = 'nowrap'; actions.forEach(function (a) { var x = document.createElement('button'); x.className = 'btn btn-line'; x.style.cssText = 'padding:2px 8px;font-size:.75rem;margin-right:4px'; x.textContent = a.label; x.onclick = a.fn; td.appendChild(x); }); return td; }
        function detailRows(parentCode) {
          (byParent[parentCode] || []).sort(function (a, b) { return String(a['계정코드']).localeCompare(String(b['계정코드'])); }).forEach(function (b) {
            var tr = document.createElement('tr');
            tr.innerHTML = '<td style="color:#9aa5b1">' + esc(b['계정코드']) + '</td><td>' + esc(b['계정이름']) + '</td><td class="num">' + won(b['전년예산']) + '</td><td class="num">' + won(b['전년결산']) + '</td>';
            var td = document.createElement('td'); td.className = 'num'; td.appendChild(budgetInput(b)); tr.appendChild(td);
            if (editing) tr.appendChild(mng([
              { label: '✏ 수정', fn: function () { var nm = prompt('목(계정) 이름 수정', b['계정이름']); if (nm && nm.trim()) WPF.call('updateAccount', { code: b['계정코드'], fields: { name: nm.trim() } }).then(reload).catch(function (e) { flash(e.message, false); }); } },
              { label: '🗑 삭제', fn: function () { if (confirm('「' + b['계정이름'] + '」 목(계정)을 삭제할까요?')) WPF.call('deleteAccount', { code: b['계정코드'] }).then(reload).catch(function (e) { flash(e.message, false); }); } }
            ]));
            tb.appendChild(tr);
          });
        }
        groups.forEach(function (gr) {
          var sub = (byParent[gr['계정코드']] || []).reduce(function (s, b) { return s + (Number(b['예산']) || 0); }, 0);
          var tr = document.createElement('tr'); tr.style.cssText = 'font-weight:700;background:#f5f8fc';
          tr.innerHTML = '<td>' + esc(gr['계정코드']) + '</td><td>' + esc(gr['계정이름']) + ' <span style="color:#9aa5b1;font-weight:400">(항)</span></td><td class="num"></td><td class="num"></td><td class="num">' + won(sub) + '</td>';
          if (editing) tr.appendChild(mng([
            { label: '＋ 목 추가', fn: function () { var nm = prompt('「' + gr['계정이름'] + '」에 추가할 목(계정) 이름'); if (nm && nm.trim()) WPF.call('addAccount', { code: nextDetail(gr['계정코드'], g), atype: g, name: nm.trim(), budget: 0 }).then(reload).catch(function (e) { flash(e.message, false); }); } },
            { label: '✏ 수정', fn: function () { var nm = prompt('항(분류) 이름 수정', gr['계정이름']); if (nm && nm.trim()) WPF.call('updateAccount', { code: gr['계정코드'], fields: { name: nm.trim() } }).then(reload).catch(function (e) { flash(e.message, false); }); } },
            { label: '🗑 삭제', fn: function () { var kids = byParent[gr['계정코드']] || []; if (!confirm('「' + gr['계정이름'] + '」 항' + (kids.length ? '과 하위 목 ' + kids.length + '개를 모두' : '을') + ' 삭제할까요?')) return; flash('삭제 중…'); WPF.call('deleteAccountTree', { code: gr['계정코드'] }).then(function (r) { flash('✓ ' + (r.deleted || 0) + '개 삭제됨', true); reload(); }).catch(function (e) { flash('삭제 실패: ' + e.message, false); }); } }
          ]));
          tb.appendChild(tr);
          detailRows(gr['계정코드']);
        });
        Object.keys(byParent).filter(function (p) { return !groups.some(function (gr) { return gr['계정코드'] === p; }); }).forEach(detailRows);
        wrap.appendChild(tbl);
        if (editing) {
          var addG = document.createElement('button'); addG.className = 'btn btn-solid'; addG.style.cssText = 'margin-bottom:12px;padding:6px 14px;font-size:.85rem'; addG.textContent = '＋ 새 ' + g + ' 항(분류) 추가';
          addG.onclick = function () { var nm = prompt('새 ' + g + ' 항(분류) 이름'); if (nm && nm.trim()) WPF.call('addAccount', { code: nextGroup(prefix, g), atype: g, name: nm.trim(), budget: 0 }).then(reload).catch(function (e) { flash(e.message, false); }); };
          card.appendChild(addG);
        }
        card.appendChild(wrap);
        panel.appendChild(card);
      });
    }
    loading(panel);
    ensureBudget().then(draw).catch(function (e) { panel.innerHTML = msgCard('조회 실패', e.message); });
  }

  /* ── 설정(회계연도 시작 월) ── */
  function renderSettings(panel) {
    loading(panel);
    Promise.all([ensureSettings(), ensureVouchers()]).then(function () {
      var sm = fyStartMonth();
      var mopts = '';
      for (var i = 1; i <= 12; i++) mopts += '<option value="' + i + '"' + (i === sm ? ' selected' : '') + '>' + i + '월</option>';
      var r = fyRange(M.fy);
      var carry = carryover();
      // 회계연도 마감용 집계
      var incFY = 0, expFY = 0;
      vouchersFY().forEach(function (x) { if (String(x['구분']) === '수입') incFY += Number(x['금액']) || 0; else expFY += Number(x['금액']) || 0; });
      var ending = carry + incFY - expFY;           // 기말 잔액 = 이월금 + 수입 - 지출
      var nextFY = M.fy + 1;
      var closedAt = (M.settings || {})['fy_closed_' + M.fy] || '';
      panel.innerHTML = '<div class="fin-card" style="max-width:560px">' +
        '<h3 style="margin:0 0 6px;color:var(--accent,#1A3A2F)">회계연도 설정</h3>' +
        '<p style="color:var(--ink-soft);font-size:.88rem;margin-bottom:16px">회계연도가 시작하는 월을 정합니다. 거래장부·통계·결산보고서·기부금영수증이 선택한 회계연도 범위로 집계됩니다.</p>' +
        '<div class="form-field" style="max-width:220px"><label>회계연도 시작 월</label><select id="set_sm">' + mopts + '</select></div>' +
        '<p class="help" style="margin-top:10px">예) <b>1월</b> → 1/1 ~ 12/31 · <b>12월</b> → 12/1 ~ 다음 해 11/30 · <b>3월</b> → 3/1 ~ 다음 해 2월 말. 8월 이후에 시작하면 끝나는 해의 이름으로 부릅니다(예: 12월 시작 → 2025-12 ~ 2026-11 이 「2026년도」).</p>' +
        '<p style="margin-top:6px;font-size:.86rem">현재 <b>' + M.fy + '년도</b> 범위: <b>' + r.from + ' ~ ' + r.to + '</b></p>' +
        '<div style="margin-top:14px;display:flex;gap:10px;align-items:center"><button class="btn btn-solid" id="set_save">저장</button><span class="fin-msg" id="set_msg"></span></div>' +
        '<p style="color:#9aa5b1;font-size:.78rem;margin-top:12px">※ 시작 월은 교회 전체에 하나로 저장되어, 재정 권한이 있는 모든 분의 화면에 똑같이 적용됩니다. 기부금영수증은 시작 월과 관계없이 언제나 1월 1일~12월 31일(연말정산 기준)로 계산합니다.</p></div>' +
        '<div class="fin-card" style="max-width:560px">' +
        '<h3 style="margin:0 0 6px;color:var(--accent,#1A3A2F)">전기 이월금 — ' + M.fy + '년도</h3>' +
        '<p style="color:var(--ink-soft);font-size:.88rem;margin-bottom:14px">회계연도 시작 시점의 <b>이월 잔액</b>입니다. 결산보고서의 기말 잔액(이월금＋수입－지출) 계산에 반영됩니다. 회계연도마다 따로 저장됩니다.</p>' +
        '<div class="form-field" style="max-width:260px"><label>이월금 (원)</label><input type="text" id="set_carry" inputmode="numeric" value="' + (carry ? won(carry) : '') + '" placeholder="0" style="text-align:right;font-weight:700"></div>' +
        '<div style="margin-top:14px;display:flex;gap:10px;align-items:center"><button class="btn btn-solid" id="set_carry_save">이월금 저장</button><span class="fin-msg" id="set_carry_msg"></span></div></div>' +
        '<div class="fin-card" style="max-width:560px">' +
        '<h3 style="margin:0 0 6px;color:var(--accent,#1A3A2F)">회계연도 마감 — ' + M.fy + '년도</h3>' +
        '<p style="color:var(--ink-soft);font-size:.88rem;margin-bottom:12px">현재 회계연도를 마감하면 <b>기말 잔액이 다음 연도(' + nextFY + '년도) 전기 이월금으로 자동 이월</b>되고, 화면이 ' + nextFY + '년도로 전환됩니다. 이월된 금액은 위 <b>전기 이월금</b>에서 수정할 수 있습니다.</p>' +
        '<table class="fin-table" style="margin-bottom:12px"><tbody>' +
        '<tr><td>전기 이월금</td><td class="num">' + won(carry) + '</td></tr>' +
        '<tr><td>당기 수입</td><td class="num" style="color:#1e874b">＋ ' + won(incFY) + '</td></tr>' +
        '<tr><td>당기 지출</td><td class="num" style="color:#c0392b">－ ' + won(expFY) + '</td></tr>' +
        '<tr style="font-weight:700;background:#f5f8fc"><td>기말 잔액 (다음 연도 이월액)</td><td class="num">' + won(ending) + '</td></tr>' +
        '</tbody></table>' +
        (closedAt ? '<p style="font-size:.82rem;color:#1e874b;margin-bottom:8px">✓ 이미 마감됨 (' + esc(fmtD(closedAt)) + ') — 다시 마감하면 ' + nextFY + '년도 이월금이 재계산되어 덮어쓰입니다.</p>' : '') +
        '<div style="display:flex;gap:10px;align-items:center"><button class="btn btn-solid" id="set_close" style="background:#1f3a5f">▶ ' + M.fy + '년도 마감하고 ' + nextFY + '년도로 이월</button><span class="fin-msg" id="set_close_msg"></span></div></div>' +
        (function () {
          var o = orgInfo();
          return '<div class="fin-card" style="max-width:560px">' +
            '<h3 style="margin:0 0 6px;color:var(--accent,#1A3A2F)">기부금영수증 발급기관</h3>' +
            '<p style="color:var(--ink-soft);font-size:.88rem;margin-bottom:14px">공식 기부금영수증(별지 제45호의2서식)에 인쇄되는 <b>기부금 수령인(교회)</b> 정보입니다. 특히 <b>고유번호(사업자등록번호)</b>는 영수증 효력에 필요합니다.</p>' +
            '<div class="form-field"><label>단체명</label><input type="text" id="org_name" value="' + esc(o.name) + '"></div>' +
            '<div class="form-field"><label>고유번호(사업자등록번호)</label><input type="text" id="org_bizno" value="' + esc(o.bizno) + '" placeholder="000-00-00000"></div>' +
            '<div class="form-field"><label>소재지</label><input type="text" id="org_addr" value="' + esc(o.addr) + '"></div>' +
            '<div class="form-field"><label>대표자(담임목사)</label><input type="text" id="org_rep" value="' + esc(o.rep) + '"></div>' +
            '<div class="form-field"><label>기부금공제대상 근거법령</label><input type="text" id="org_law" value="' + esc(o.law) + '"></div>' +
            '<div style="margin-top:6px;display:flex;gap:10px;align-items:center"><button class="btn btn-solid" id="org_save">발급기관 저장</button><span class="fin-msg" id="org_msg"></span></div></div>';
        })() +
        (function () {
          var o = orgInfo();
          var slots = [
            { key: 'rcp_img_logo', label: '교회 로고', url: o.imgLogo, hint: '영수증 상단에 교회명과 함께 출력 (투명 PNG 권장)' },
            { key: 'rcp_img_uid', label: '고유번호증', url: o.imgUid, hint: '영수증 출력 시 [붙임 1]로 첨부' },
            { key: 'rcp_img_assoc', label: '총회소속증명서', url: o.imgAssoc, hint: '영수증 출력 시 [붙임 2]로 첨부' },
            { key: 'rcp_img_seal', label: '직인', url: o.imgSeal, hint: '영수증의 교회 이름 옆에 날인 (투명 PNG 권장)' }
          ];
          function slotHTML(s) {
            return '<div class="rcp-up" data-key="' + s.key + '" style="border:1px solid #e3e7ee;border-radius:10px;padding:12px;margin-bottom:10px;display:flex;gap:12px;align-items:center">' +
              '<div class="rcp-up-prev" style="width:96px;height:72px;flex:0 0 auto;border:1px dashed #cdd7e3;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#f8fafc;font-size:.72rem;color:#9aa5b1">' +
              (s.url ? '<img src="' + esc(s.url) + '" style="max-width:100%;max-height:100%">' : '미등록') + '</div>' +
              '<div style="flex:1;min-width:0"><div style="font-weight:700">' + s.label + '</div><div style="font-size:.78rem;color:var(--ink-soft)">' + s.hint + '</div>' +
              '<div style="margin-top:7px;display:flex;gap:7px;align-items:center;flex-wrap:wrap">' +
              '<label class="btn btn-line" style="padding:4px 12px;font-size:.8rem;cursor:pointer;margin:0">' + (s.url ? '교체' : '업로드') + '<input type="file" accept="image/*" hidden></label>' +
              (s.url ? '<button class="btn btn-line rcp-up-del" style="padding:4px 12px;font-size:.8rem">삭제</button>' : '') +
              '<span class="rcp-up-msg" style="font-size:.78rem"></span></div></div></div>';
          }
          return '<div class="fin-card" style="max-width:560px">' +
            '<h3 style="margin:0 0 6px;color:var(--accent,#1A3A2F)">기부금영수증 증빙 이미지</h3>' +
            '<p style="color:var(--ink-soft);font-size:.88rem;margin-bottom:14px">고유번호증·총회소속증명서·직인 이미지를 업로드하면 기부금영수증 출력 시 자동으로 반영됩니다. (고유번호증·총회소속증명서는 뒷장에 첨부, 직인은 교회명 옆에 날인)</p>' +
            slots.map(slotHTML).join('') +
            (window.ChurchUpload && ChurchUpload.isReady() ? '' : '<p style="color:#c0392b;font-size:.8rem">⚠ 업로드 서버가 설정되지 않아 업로드를 사용할 수 없습니다.</p>') +
            '</div>';
        })();
      panel.querySelector('#set_save').onclick = function () {
        var v = Number(panel.querySelector('#set_sm').value);
        var msg = panel.querySelector('#set_msg');
        if (v === fyStartMonth()) { msg.style.color = '#7b8794'; msg.textContent = '바뀐 것이 없습니다.'; return; }
        if (!confirm('회계연도 시작 월을 ' + fyStartMonth() + '월 → ' + v + '월로 바꿉니다.\n\n결산보고서·통계·그래프의 기간이 모두 바뀌고, 재정 권한이 있는 모든 분의 화면에 똑같이 적용됩니다.\n바꿀까요?')) return;
        msg.style.color = '#7b8794'; msg.textContent = '저장 중…';
        WPF.call('setSetting', { key: 'fy_start_month', value: v }).then(function () {
          M.settings.fy_start_month = String(v);
          M.fy = curFY();
          msg.style.color = 'green'; msg.textContent = '✓ 저장됨';
          setTimeout(render, 700);
        }).catch(function (e) { msg.style.color = '#c0392b'; msg.textContent = '저장 실패: ' + e.message; });
      };
      var carryEl = panel.querySelector('#set_carry');
      carryEl.addEventListener('input', function () { var n = parseNum(carryEl.value); carryEl.value = n ? won(n) : ''; });
      panel.querySelector('#set_carry_save').onclick = function () {
        var amt = parseNum(carryEl.value);
        var msg = panel.querySelector('#set_carry_msg'); msg.style.color = '#7b8794'; msg.textContent = '저장 중…';
        WPF.call('setSetting', { key: 'carryover_' + M.fy, value: amt }).then(function () {
          M.settings['carryover_' + M.fy] = String(amt);
          msg.style.color = 'green'; msg.textContent = '✓ 저장됨';
        }).catch(function (e) { msg.style.color = '#c0392b'; msg.textContent = '저장 실패: ' + e.message; });
      };
      panel.querySelector('#set_close').onclick = function () {
        if (!confirm(M.fy + '년도를 마감합니다.\n\n기말 잔액 ' + won(ending) + '원이 ' + nextFY + '년도 전기 이월금으로 이월되고, 화면이 ' + nextFY + '년도로 전환됩니다.\n\n진행할까요?')) return;
        var cmsg = panel.querySelector('#set_close_msg'); cmsg.style.color = '#7b8794'; cmsg.textContent = '마감 처리 중…';
        Promise.all([
          WPF.call('setSetting', { key: 'carryover_' + nextFY, value: ending }),
          WPF.call('setSetting', { key: 'fy_closed_' + M.fy, value: today() })
        ]).then(function () {
          M.settings['carryover_' + nextFY] = String(ending);
          M.settings['fy_closed_' + M.fy] = today();
          cmsg.style.color = 'green'; cmsg.textContent = '✓ 마감 완료 — ' + nextFY + '년도로 이월되었습니다.';
          M.fy = nextFY;
          setTimeout(render, 800);
        }).catch(function (e) { cmsg.style.color = '#c0392b'; cmsg.textContent = '마감 실패: ' + e.message; });
      };
      var orgSave = panel.querySelector('#org_save');
      if (orgSave) orgSave.onclick = function () {
        var omsg = panel.querySelector('#org_msg'); omsg.style.color = '#7b8794'; omsg.textContent = '저장 중…';
        var fields = { rcp_org: '#org_name', rcp_bizno: '#org_bizno', rcp_addr: '#org_addr', rcp_rep: '#org_rep', rcp_law: '#org_law' };
        var jobs = Object.keys(fields).map(function (k) { var v = panel.querySelector(fields[k]).value.trim(); return WPF.call('setSetting', { key: k, value: v }).then(function () { M.settings[k] = v; }); });
        Promise.all(jobs).then(function () { omsg.style.color = 'green'; omsg.textContent = '✓ 저장됨'; })
          .catch(function (e) { omsg.style.color = '#c0392b'; omsg.textContent = '저장 실패: ' + e.message; });
      };
      // 증빙 이미지 업로드/삭제
      Array.prototype.forEach.call(panel.querySelectorAll('.rcp-up'), function (slot) {
        var key = slot.dataset.key;
        var seal = (key === 'rcp_img_seal' || key === 'rcp_img_logo'); // 직인·로고는 투명 PNG 보존(무압축)
        var prev = slot.querySelector('.rcp-up-prev');
        var msg = slot.querySelector('.rcp-up-msg');
        var file = slot.querySelector('input[type="file"]');
        function setPrev(url) {
          prev.innerHTML = url ? '<img src="' + esc(url) + '" style="max-width:100%;max-height:100%">' : '미등록';
        }
        file.addEventListener('change', function () {
          var f = file.files && file.files[0]; if (!f) return;
          if (!(window.ChurchUpload && ChurchUpload.isReady())) { msg.style.color = '#c0392b'; msg.textContent = '업로드 서버 미설정'; return; }
          msg.style.color = '#7b8794'; msg.textContent = '업로드 중…';
          // 직인은 투명 PNG 보존 위해 압축하지 않음
          ChurchUpload.upload(f, { folder: 'finance/receipt', compress: !seal }).then(function (res) {
            var url = res.url;
            return WPF.call('setSetting', { key: key, value: url }).then(function () {
              M.settings[key] = url; setPrev(url);
              msg.style.color = 'green'; msg.textContent = '✓ 저장됨';
              setTimeout(function () { renderSettings(panel); }, 600);
            });
          }).catch(function (e) { msg.style.color = '#c0392b'; msg.textContent = '실패: ' + e.message; });
          file.value = '';
        });
        var del = slot.querySelector('.rcp-up-del');
        if (del) del.onclick = function () {
          if (!confirm('이 이미지를 삭제할까요?')) return;
          msg.style.color = '#7b8794'; msg.textContent = '삭제 중…';
          WPF.call('setSetting', { key: key, value: '' }).then(function () {
            M.settings[key] = ''; setPrev(''); renderSettings(panel);
          }).catch(function (e) { msg.style.color = '#c0392b'; msg.textContent = '실패: ' + e.message; });
        };
      });
    }).catch(function (e) { panel.innerHTML = msgCard('설정 조회 실패', e.message); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

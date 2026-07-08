/* dashboard.js — 대시보드(dashboard.html): 정회원 전용 개인 홈
 * 오늘의 큐티(아멘 체크)·이번주 설교·주보·진행중인 교육·헌금·가계도·QT 진행표
 * 콘솔: [dashboard.js] v20260701da
 */
console.log('[dashboard.js] v20260705qtfallback');

(function () {
  var root = document.getElementById('dashRoot');
  if (!root) return;

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var won = function (n) { return (Number(n) || 0).toLocaleString('ko-KR'); };
  function pad2(n) { return ('0' + n).slice(-2); }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

  // 성경 본문(줄마다 "번호 내용")을 절 목록으로 정돈
  function bibleVersesHTML(text) {
    var lines = String(text || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    return lines.map(function (ln) {
      var m = ln.match(/^(\d+)\s*(.*)$/);
      if (m) return '<div class="qtc-verse"><span class="qtc-vn">' + m[1] + '</span><span>' + esc(m[2]) + '</span></div>';
      return '<div class="qtc-verse"><span>' + esc(ln) + '</span></div>';
    }).join('');
  }
  // ── 갓피아(GODpia) 성경 듣기 딥링크 (main.js의 QT 위젯 내부 스코프라 접근 불가 → 자체 보유) ──
  var GODPIA_BASE = 'https://www.godpia.com/read/reading.asp';
  var GODPIA_VOL = {
    '창세기':'gen','출애굽기':'exo','레위기':'lev','민수기':'num','신명기':'deu',
    '여호수아':'jos','사사기':'jdg','룻기':'rut','사무엘상':'1sa','사무엘하':'2sa',
    '열왕기상':'1ki','열왕기하':'2ki','역대상':'1ch','역대하':'2ch','에스라':'ezr',
    '느헤미야':'neh','에스더':'est','욥기':'job','시편':'psa','잠언':'pro',
    '전도서':'ecc','아가':'sng','이사야':'isa','예레미야':'jer','예레미야애가':'lam',
    '에스겔':'ezk','다니엘':'dan','호세아':'hos','요엘':'jol','아모스':'amo',
    '오바댜':'oba','요나':'jnh','미가':'mic','나훔':'nam','하박국':'hab',
    '스바냐':'zep','학개':'hag','스가랴':'zec','말라기':'mal','마태복음':'mat',
    '마가복음':'mrk','누가복음':'luk','요한복음':'jhn','사도행전':'act','로마서':'rom',
    '고린도전서':'1co','고린도후서':'2co','갈라디아서':'gal','에베소서':'eph','빌립보서':'php',
    '골로새서':'col','데살로니가전서':'1th','데살로니가후서':'2th','디모데전서':'1ti','디모데후서':'2ti',
    '디도서':'tit','빌레몬서':'phm','히브리서':'heb','야고보서':'jas','베드로전서':'1pe',
    '베드로후서':'2pe','요한일서':'1jn','요한이서':'2jn','요한삼서':'3jn','유다서':'jud','요한계시록':'rev',
    '창':'gen','출':'exo','레':'lev','민':'num','신':'deu','수':'jos','삿':'jdg','룻':'rut',
    '삼상':'1sa','삼하':'2sa','왕상':'1ki','왕하':'2ki','대상':'1ch','대하':'2ch','스':'ezr',
    '느':'neh','에':'est','욥':'job','시':'psa','잠':'pro','전':'ecc','아':'sng','사':'isa',
    '렘':'jer','애':'lam','겔':'ezk','단':'dan','호':'hos','욜':'jol','암':'amo','옵':'oba',
    '욘':'jnh','미':'mic','나':'nam','합':'hab','습':'zep','학':'hag','슥':'zec','말':'mal',
    '마':'mat','막':'mrk','눅':'luk','요':'jhn','행':'act','롬':'rom','고전':'1co','고후':'2co',
    '갈':'gal','엡':'eph','빌':'php','골':'col','살전':'1th','살후':'2th','딤전':'1ti','딤후':'2ti',
    '딛':'tit','몬':'phm','히':'heb','약':'jas','벧전':'1pe','벧후':'2pe','요일':'1jn','요이':'2jn',
    '요삼':'3jn','유':'jud','계':'rev'
  };
  function godpiaUrl(ref) {
    if (!ref) return GODPIA_BASE;
    var m = String(ref).replace(/\s+/g, ' ').trim().match(/([가-힣]+)\s*(\d+)\s*[:：]/);
    if (!m) return GODPIA_BASE;
    var code = GODPIA_VOL[m[1]];
    return code ? (GODPIA_BASE + '?vol=' + code + '&chap=' + m[2]) : GODPIA_BASE;
  }

  // 묵상/기도(HTML 또는 줄바꿈 텍스트)를 문단 블록으로 변환
  function toParaHTML(text) {
    var s = String(text || '');
    if (!s.trim()) return '';
    if (/<[a-z][\s\S]*>/i.test(s)) return s; // 이미 HTML(리치텍스트)이면 그대로
    return s.split(/\n{2,}/).map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('');
  }

  function sbUser() {
    try {
      var ref = new URL(window.SUPABASE_URL).hostname.split('.')[0];
      var raw = localStorage.getItem('sb-' + ref + '-auth-token');
      if (!raw) return null;
      var s = JSON.parse(raw); s = s.currentSession || s;
      return (s && s.user) || null;
    } catch (e) { return null; }
  }

  // ── 로그인 대기 → 정회원 확인 ──
  var tries = 0;
  function waitLogin() {
    if (!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY)) { showLocked('준비 중', '대시보드를 사용하려면 Supabase 연결이 필요합니다.'); return; }
    if (window.WPF && WPF.token()) { boot(); return; }
    if (tries++ < 20) { setTimeout(waitLogin, 400); return; }
    showLocked('로그인이 필요합니다', '대시보드는 정회원 로그인 후 이용할 수 있습니다.', true);
  }
  function showLocked(title, msg, offerProfileLink) {
    root.innerHTML = '<div class="member-lock"><div class="lock-icon">🔒</div><h3>' + esc(title) + '</h3><p>' + esc(msg) + '</p></div>';
    var lock = root.querySelector('.member-lock');
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'btn btn-line'; b.style.marginTop = '12px';
    if (offerProfileLink) {
      b.textContent = '로그인';
      b.onclick = function () { var m = document.getElementById('authModal'); if (m) { m.hidden = false; document.body.style.overflow = 'hidden'; } };
    } else {
      b.textContent = '내 정보로 이동 →';
      b.onclick = function () { location.href = 'admin.html'; };
    }
    lock.appendChild(b);
  }

  function boot() {
    root.innerHTML = '<p class="qt-loading">확인 중입니다…</p>';
    WPF.call('me').then(function (me) {
      if (me.status !== '정회원') { showLocked('정회원 전용 페이지입니다', '교적 인증 후 정회원이 되면 대시보드를 이용할 수 있습니다.'); return; }
      renderDashboard(me);
    }).catch(function (e) { showLocked('오류가 발생했습니다', e.message); });
  }

  function renderDashboard(me) {
    var grp = 'font-family:"Noto Serif KR",serif;font-size:1.05rem;font-weight:700;color:var(--accent,#223350);margin:32px 0 16px;padding-bottom:8px;border-bottom:2px solid var(--accent,#223350);';
    root.innerHTML =
      '<div class="form-card" style="margin-bottom:22px;padding:16px 18px;">' +
      '<h2 id="dashWelcome" style="margin:0;font-size:1.15rem;color:var(--accent,#223350);">' + esc(me.memberName || '') + '님, 환영합니다 🙏</h2>' +
      '</div>' +
      '<h2 style="' + grp + 'margin-top:6px;">🕊 나의 신앙생활</h2>' +
      '<div id="dashQt" style="margin-bottom:22px;"></div>' +
      '<div id="bibleRead" style="margin-bottom:22px;"></div>' +
      '<div id="qtProgress" style="margin-bottom:22px;"></div>' +
      '<div id="myEdu" style="margin-bottom:22px;"></div>' +
      '<h2 style="' + grp + '">💒 나의 교회생활</h2>' +
      '<div class="form-card" style="margin-bottom:22px;padding:16px 18px;"><h3 style="margin:0 0 10px;font-size:1rem;color:var(--accent,#223350);">💝 헌금</h3><div id="offeringList"><p class="qt-loading">불러오는 중…</p></div></div>' +
      '<div id="myDocs" style="margin-bottom:22px;"></div>' +
      '<div id="familyTree" style="margin-bottom:22px;"></div>' +
      '<p style="text-align:center;margin-top:14px;"><a class="btn btn-line" href="index.html#qt">이번 주 말씀·주보는 홈에서 보기 →</a></p>';
    loadWelcomeName(me);
    loadTodayQt(me);
    loadBibleReading(me);
    loadQtProgress(me);
    loadMyEdu(me);
    loadOfferings(me);
    loadMyDocs(me);
    loadFamily(me);
  }

  /* ================= 나의 성경읽기 (구속사 365 · 우리말성경) ================= */
  var BR = { rows: [], readers: null };   // rows: [{day_no, done_at}] (본인 진도)
  function brFetch(path, opt) {
    var url = window.SUPABASE_URL, ak = window.SUPABASE_ANON_KEY, tok = (window.WPF && WPF.token && WPF.token());
    if (!url || !ak || !tok) return Promise.reject(new Error('no-auth'));
    var o = opt || {};
    var h = { apikey: ak, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' };
    if (o.headers) { for (var k in o.headers) h[k] = o.headers[k]; }
    o.headers = h;
    return fetch(url + '/rest/v1/' + path, o).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t || ('HTTP ' + r.status)); });
      return r.text().then(function (t) { return t ? JSON.parse(t) : null; });
    });
  }
  function brP2(n) { return String(n).padStart(2, '0'); }
  function brDayKey(dt) { return dt.getFullYear() + '-' + brP2(dt.getMonth() + 1) + '-' + brP2(dt.getDate()); }
  // 연속일: 읽은 '날짜'가 오늘(또는 오늘 아직 안 읽었으면 어제)부터 며칠 이어졌는지
  function brStreak(rows) {
    var days = {};
    rows.forEach(function (r) { var d = new Date(r.done_at); if (!isNaN(d)) days[brDayKey(d)] = 1; });
    var cur = new Date(), n = 0;
    if (!days[brDayKey(cur)]) cur.setDate(cur.getDate() - 1);   // 오늘 미체크는 아직 끊긴 게 아님
    while (days[brDayKey(cur)]) { n++; cur.setDate(cur.getDate() - 1); }
    return n;
  }
  // 완주 예상일: 시작일부터의 평균 속도(일차/일)로 남은 분량을 나눔
  function brEta(rows) {
    if (rows.length < 3 || rows.length >= 365) return '';
    var first = Infinity;
    rows.forEach(function (r) { var t = new Date(r.done_at).getTime(); if (t && t < first) first = t; });
    if (!isFinite(first)) return '';
    var elapsed = Math.max(1, (Date.now() - first) / 86400000);
    var rate = rows.length / elapsed;
    if (!(rate > 0)) return '';
    var eta = new Date(Date.now() + Math.ceil((365 - rows.length) / rate) * 86400000);
    return eta.getFullYear() + '.' + brP2(eta.getMonth() + 1) + '.' + brP2(eta.getDate());
  }
  function loadBibleReading(me) {
    var el = document.getElementById('bibleRead'); if (!el) return;
    if (!window.BIBLE_PLAN) { el.innerHTML = ''; return; }
    var head = '<div class="form-card" style="padding:16px 18px"><h3 style="margin:0 0 10px;font-size:1rem;color:var(--accent,#223350)">📖 나의 성경읽기 <span style="font-weight:400;font-size:.76rem;color:#9aa5b1">구속사 365 · 우리말성경</span></h3>';
    el.innerHTML = head + '<p class="qt-loading">불러오는 중…</p></div>';
    Promise.all([
      brFetch('bible_reading?select=day_no,done_at&order=day_no'),
      brFetch('rpc/bible_readers_count', { method: 'POST', body: '{}' }).catch(function () { return null; })
    ]).then(function (rs) {
      BR.rows = rs[0] || []; BR.readers = rs[1];
      paintBibleCard(el, head);
    }).catch(function (e) {
      var m = (e && e.message) || '';
      el.innerHTML = head + (/42P01|does not exist|schema cache|Could not find/i.test(m)
        ? '<p style="color:#9aa5b1;font-size:.88rem;margin:0">성경읽기 표가 아직 준비되지 않았습니다 — 관리자가 supabase/bible_reading.sql 을 실행하면 열립니다.</p>'
        : '<p style="color:#9aa5b1;font-size:.88rem;margin:0">성경읽기 진도를 불러오지 못했습니다.</p>') + '</div>';
    });
  }
  function paintBibleCard(el, head) {
    var P = window.BIBLE_PLAN, rows = BR.rows;
    var done = {}; rows.forEach(function (r) { done[r.day_no] = 1; });
    var cnt = rows.length, next = 0;
    for (var i = 1; i <= 365; i++) { if (!done[i]) { next = i; break; } }
    var pct = Math.round(cnt / 365 * 100);
    var day = next ? P.days[next - 1] : null;
    var streak = brStreak(rows), eta = brEta(rows);
    var meta = [];
    if (streak > 0) meta.push('🔥 연속 ' + streak + '일');
    if (eta) meta.push('이 속도면 <b>' + eta + '</b> 완주');
    if (BR.readers != null && BR.readers > 0) meta.push('🙌 함께 읽는 성도 <b>' + BR.readers + '명</b>');
    el.innerHTML = head +
      '<div style="display:flex;justify-content:space-between;align-items:center;font-size:.84rem;color:#5b6b7d;margin-bottom:6px"><span>' + cnt + ' / 365일</span><b style="color:var(--accent,#223350)">' + pct + '%</b></div>' +
      '<div style="background:#eef2f7;border-radius:7px;height:10px;overflow:hidden;margin-bottom:12px"><div style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,#3a6db5,#223350)"></div></div>' +
      (day
        ? '<div style="background:#f6f9f3;border:1px solid #e2e8da;border-radius:11px;padding:12px 14px;margin-bottom:12px">' +
          '<div style="font-size:.76rem;color:#5b7a52;font-weight:700;margin-bottom:3px">오늘의 읽기 · Day ' + day.d + '</div>' +
          '<div style="font-size:.8rem;color:#7b8794;margin-bottom:4px">' + esc(P.themes[day.t]) + '</div>' +
          '<div style="font-size:1.06rem;font-weight:700;color:var(--accent,#223350)">' + esc(day.r) + '</div>' +
          (window.BIBLE_NOTES && window.BIBLE_NOTES.days[day.d - 1]
            ? '<div style="margin-top:9px;padding-top:9px;border-top:1px dashed #d9e2d2;font-size:.87rem;line-height:1.75;color:#3f5240">💬 ' + esc(window.BIBLE_NOTES.days[day.d - 1]) + '</div>'
            : '') +
          '</div>'
        : '<div style="background:#f0f7ef;border:1px solid #d8e8d4;border-radius:11px;padding:14px;text-align:center;margin-bottom:12px;font-weight:700;color:#2f5d3a">🎉 365일 완주를 축하합니다!</div>') +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:' + (meta.length ? '10px' : '0') + '">' +
      (day
        ? '<button type="button" id="brRead" style="padding:9px 18px;border:0;border-radius:9px;background:var(--accent,#223350);color:#fff;font:inherit;font-weight:700;cursor:pointer">📖 본문 읽기</button>' +
          '<button type="button" class="btn btn-line" id="brDone" style="padding:8px 16px">✓ 읽기 완료</button>'
        : '') +
      '<button type="button" class="btn btn-line" id="brTable" style="padding:8px 16px">전체 표</button></div>' +
      (meta.length ? '<div style="font-size:.8rem;color:#7b8794">' + meta.join(' · ') + '</div>' : '') +
      '</div>';
    var rd = el.querySelector('#brRead'), dn = el.querySelector('#brDone'), tb = el.querySelector('#brTable');
    if (rd) rd.onclick = function () { brReadingModal(day, function () { brCheck(day.d, el, head); }); };
    if (dn) dn.onclick = function () { brCheck(day.d, el, head); };
    if (tb) tb.onclick = function () { brTableModal(el, head); };
  }
  function brCheck(dayNo, el, head) {
    if (BR.rows.some(function (r) { return r.day_no === dayNo; })) return;
    brFetch('bible_reading', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ day_no: dayNo }) })
      .then(function () { BR.rows.push({ day_no: dayNo, done_at: new Date().toISOString() }); paintBibleCard(el, head); })
      .catch(function (e) {
        if (/duplicate|23505/i.test((e && e.message) || '')) { BR.rows.push({ day_no: dayNo, done_at: new Date().toISOString() }); paintBibleCard(el, head); return; }
        alert('저장 실패: ' + ((e && e.message) || '네트워크 오류'));
      });
  }
  function brUncheck(dayNo) {
    return brFetch('bible_reading?day_no=eq.' + dayNo, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
      .then(function () { BR.rows = BR.rows.filter(function (r) { return r.day_no !== dayNo; }); });
  }
  function brLoadUrm() {
    if (window.BIBLE_URM) return Promise.resolve(window.BIBLE_URM);
    return fetch('data/bible-urm.json?v=20260729').then(function (r) { if (!r.ok) throw new Error('성경 본문을 불러오지 못했습니다'); return r.json(); })
      .then(function (d) { window.BIBLE_URM = d; return d; });
  }
  // 브라우저 내장 음성 중 가장 자연스러운 한국어 목소리 선택(AI·비용 없이 즉시 재생)
  function brBestVoice() {
    var vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
    var ko = vs.filter(function (v) { return /^ko/i.test(v.lang || ''); });
    function score(v) {
      var n = (v.name || '').toLowerCase();
      if (/google/.test(n)) return 4;                                   // 크롬 '구글 한국어' — 가장 자연스러움
      if (/natural|neural|premium|enhanced|yuna|sora|heami|siri/.test(n)) return 3;
      if (!v.localService) return 2;                                    // 온라인 음성이 대체로 더 자연스러움
      return 1;
    }
    ko.sort(function (a, b) { return score(b) - score(a); });
    return ko[0] || null;
  }
  // 본문 읽기(우리말성경) — 🔊 듣기(절 따라 하이라이트) + 하단 [읽기 완료]까지 한 흐름
  function brReadingModal(day, onDone) {
    var P = window.BIBLE_PLAN;
    var ttsOk = !!window.speechSynthesis;
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,25,.55);z-index:9600;display:flex;align-items:flex-start;justify-content:center;padding:20px 12px;overflow:auto';
    ov.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:720px;width:100%;padding:22px 24px;box-shadow:0 24px 60px rgba(0,0,0,.32)">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px"><div style="min-width:0">' +
      '<div style="font-size:.76rem;color:#5b7a52;font-weight:700">Day ' + day.d + ' · ' + esc(P.themes[day.t]) + '</div>' +
      '<h3 style="margin:4px 0 0;color:var(--accent,#223350);font-family:\'Noto Serif KR\',serif">' + esc(day.r) + ' <span style="font-size:.72rem;color:#9aa5b1;font-weight:400">우리말성경</span></h3></div>' +
      '<div style="display:flex;gap:6px;flex:0 0 auto">' +
      (ttsOk ? '<button class="btn btn-line" id="brm_tts" style="padding:4px 12px;white-space:nowrap">🔊 듣기</button>' : '') +
      '<button class="btn btn-line" id="brm_close" style="padding:4px 12px;white-space:nowrap">닫기</button></div></div>' +
      (function () {   // 🧭 구속사 파노라마: 지금 성경 전체 이야기의 어디쯤을 읽고 있는지 + 오늘 본문의 의미
        var N = window.BIBLE_NOTES; if (!N) return '';
        var t = N.themes[day.t] || '', dn = N.days[day.d - 1] || '';
        return '<div style="margin-top:12px;background:#f4f7fb;border:1px solid #dde6f2;border-radius:11px;padding:12px 14px">' +
          '<div style="font-size:.74rem;font-weight:700;color:#3a5a8c;margin-bottom:5px">🧭 구속사 파노라마 · 주제 ' + (day.t + 1) + '/38</div>' +
          (t ? '<div style="font-size:.84rem;line-height:1.75;color:#44506a">' + esc(t) + '</div>' : '') +
          (dn ? '<div style="margin-top:8px;padding-top:8px;border-top:1px dashed #d3ddeb;font-size:.86rem;line-height:1.75;color:#3f5240">💬 ' + esc(dn) + '</div>' : '') +
          '</div>';
      })() +
      '<div id="brm_body" style="margin-top:14px;max-height:60vh;overflow:auto;line-height:1.95;font-size:1.02rem;font-family:\'Noto Serif KR\',serif;color:#1f2937"><p class="qt-loading">본문을 불러오는 중…</p></div>' +
      (onDone ? '<div style="margin-top:14px;text-align:center"><button type="button" id="brm_done" style="padding:10px 28px;border:0;border-radius:10px;background:var(--accent,#223350);color:#fff;font:inherit;font-weight:700;cursor:pointer">✓ 읽기 완료</button></div>' : '') +
      '</div>';
    document.body.appendChild(ov); document.body.style.overflow = 'hidden';

    // ── 성경 듣기: 브라우저 내장 음성(비용·생성 대기 없음). 절 단위로 끊어 읽어 호흡이 자연스럽고,
    //    읽는 절을 하이라이트+자동 스크롤. 절을 누르면 그 절부터 듣는다. 절 번호는 읽지 않음.
    var tts = { on: false, gen: 0, idx: 0, items: [], btn: null };
    var TTS_LSK = 'wpBibleTtsPos';   // 멈춘 위치 저장(일차별) → 다음에 이어 듣기
    function savePos() {
      try {
        if (tts.idx > 0 && tts.idx < tts.items.length) localStorage.setItem(TTS_LSK, JSON.stringify({ d: day.d, i: tts.idx }));
        else { var sv = JSON.parse(localStorage.getItem(TTS_LSK) || 'null'); if (sv && sv.d === day.d) localStorage.removeItem(TTS_LSK); }
      } catch (e) { }
    }
    function ttsBtnLabel() { if (tts.btn) tts.btn.textContent = tts.idx > 0 ? '🔊 이어 듣기' : '🔊 듣기'; }
    function ttsHi(el, on) { if (el) { el.style.background = on ? 'rgba(249,222,116,.5)' : ''; el.style.borderRadius = on ? '6px' : ''; } }
    function ttsStop(finished) {
      tts.gen++; tts.on = false;
      if (tts.items[tts.idx]) ttsHi(tts.items[tts.idx].el, false);
      try { speechSynthesis.cancel(); } catch (e) { }
      if (finished) tts.idx = 0;   // 끝까지 들었으면 처음으로
      savePos();
      ttsBtnLabel();
    }
    function ttsSpeakFrom(i) {
      tts.gen++; var myGen = tts.gen;
      try { speechSynthesis.cancel(); } catch (e) { }
      if (tts.items[tts.idx]) ttsHi(tts.items[tts.idx].el, false);
      tts.on = true; tts.idx = i;
      if (tts.btn) tts.btn.textContent = '⏸ 멈춤';
      (function next() {
        if (!tts.on || myGen !== tts.gen) return;
        if (tts.idx >= tts.items.length) { ttsStop(true); return; }
        var it = tts.items[tts.idx];
        ttsHi(it.el, true);
        try { it.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { }
        var u = new SpeechSynthesisUtterance(it.text);
        u.lang = 'ko-KR'; var v = brBestVoice(); if (v) u.voice = v;
        u.rate = 0.95; u.pitch = 1.0;                       // 살짝 느리게 — 낭독 톤
        u.onend = function () { if (myGen !== tts.gen) return; ttsHi(it.el, false); tts.idx++; savePos(); next(); };
        u.onerror = function () { if (myGen !== tts.gen) return; ttsHi(it.el, false); tts.idx++; next(); };
        try { speechSynthesis.speak(u); } catch (e) { ttsStop(); }
      })();
    }

    function closeDom() { ttsStop(); ov.remove(); document.body.style.overflow = ''; }
    if (window.ModalNav) window.ModalNav.open(closeDom);
    function close() { if (window.ModalNav && window.ModalNav.close()) return; closeDom(); }
    ov.querySelector('#brm_close').onclick = close;
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    var doneBtn = ov.querySelector('#brm_done');
    if (doneBtn) doneBtn.onclick = function () { close(); if (onDone) onDone(); };

    brLoadUrm().then(function (B) {
      var html = '';
      (day.refs || []).forEach(function (ref) {
        var ab = ref[0], book = B[ab] || [];
        for (var c = ref[1]; c <= ref[2]; c++) {
          var verses = book[c - 1] || [];
          html += '<h4 class="brm-h" style="margin:20px 0 8px;color:var(--accent,#223350);font-size:1.05rem;border-bottom:1px solid #eef1f5;padding-bottom:6px">' + esc((P.names[ab] || ab) + ' ' + c + (ab === '시' ? '편' : '장')) + '</h4>' +
            verses.map(function (v, i) { return '<p class="brm-v" style="margin:0 0 6px"><sup style="color:#9db4d6;font-size:.72rem;margin-right:4px">' + (i + 1) + '</sup>' + esc(v) + '</p>'; }).join('');
        }
      });
      var body = ov.querySelector('#brm_body');
      if (!body) return;
      body.innerHTML = html || '<p style="color:#c0392b">본문 데이터를 찾지 못했습니다.</p>';
      if (!ttsOk || !html) return;
      // 듣기 목록: 장 제목 + 각 절(절 번호 sup 제외한 본문만 읽음)
      tts.items = [];
      Array.prototype.forEach.call(body.querySelectorAll('.brm-h, .brm-v'), function (el) {
        var text = '';
        if (el.classList.contains('brm-h')) text = el.textContent;
        else Array.prototype.forEach.call(el.childNodes, function (n) { if (n.nodeName !== 'SUP') text += n.textContent; });
        text = String(text || '').trim();
        if (text) tts.items.push({ el: el, text: text });
      });
      // 지난번에 멈춘 절이 있으면 그 자리에서 이어 듣기
      try {
        var sv = JSON.parse(localStorage.getItem(TTS_LSK) || 'null');
        if (sv && sv.d === day.d && sv.i > 0 && sv.i < tts.items.length) tts.idx = sv.i;
      } catch (e) { }
      tts.btn = ov.querySelector('#brm_tts');
      ttsBtnLabel();
      if (tts.btn) tts.btn.onclick = function () { if (tts.on) ttsStop(); else ttsSpeakFrom(tts.idx < tts.items.length ? tts.idx : 0); };
      // 절을 누르면 그 절부터 듣기(듣는 중이 아니어도 그 절부터 시작)
      tts.items.forEach(function (it, i) {
        it.el.style.cursor = 'pointer';
        it.el.addEventListener('click', function () { ttsSpeakFrom(i); });
      });
      // 일부 브라우저는 목소리 목록이 늦게 로드됨 — 미리 한 번 불러 캐시
      if (speechSynthesis.getVoices && !speechSynthesis.getVoices().length && 'onvoiceschanged' in speechSynthesis) {
        speechSynthesis.onvoiceschanged = function () { speechSynthesis.onvoiceschanged = null; };
      }
    }).catch(function (e) { var body = ov.querySelector('#brm_body'); if (body) body.innerHTML = '<p style="color:#c0392b">' + esc((e && e.message) || '오류') + '</p>'; });
  }
  // 전체 표: 38개 구속사 주제별 아코디언 + 일차 체크(해제 가능) + 📖 본문 열기
  function brTableModal(cardEl, head) {
    var P = window.BIBLE_PLAN;
    var done = {}; BR.rows.forEach(function (r) { done[r.day_no] = 1; });
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,25,.55);z-index:9550;display:flex;align-items:flex-start;justify-content:center;padding:20px 12px;overflow:auto';
    var groups = P.themes.map(function (t, ti) {
      var days = P.days.filter(function (d) { return d.t === ti; });
      var dn = days.filter(function (d) { return done[d.d]; }).length;
      var rowsH = days.map(function (d) {
        return '<div style="display:flex;align-items:center;gap:9px;padding:7px 4px;border-top:1px solid #f2f5f9">' +
          '<input type="checkbox" class="br-ck" data-d="' + d.d + '"' + (done[d.d] ? ' checked' : '') + ' style="width:17px;height:17px;flex:0 0 auto;cursor:pointer">' +
          '<span style="flex:0 0 56px;font-size:.78rem;color:#9aa5b1">Day ' + d.d + '</span>' +
          '<span style="flex:1;font-size:.9rem;color:#1f2937">' + esc(d.r) + '</span>' +
          '<button type="button" class="br-open" data-d="' + d.d + '" title="본문 읽기" style="border:1px solid #dfe5ee;background:#fff;border-radius:7px;padding:3px 8px;cursor:pointer;font-size:.8rem">📖</button>' +
          '</div>';
      }).join('');
      return '<details' + (days.some(function (d) { return !done[d.d]; }) && dn > 0 ? ' open' : '') + ' style="border:1px solid #e6ebf2;border-radius:10px;margin-bottom:8px;background:#fff">' +
        '<summary style="cursor:pointer;padding:10px 12px;font-weight:700;color:var(--accent,#223350);font-size:.9rem;list-style-position:inside">' + (ti + 1) + '. ' + esc(t) +
        ' <span class="br-gcnt" data-ti="' + ti + '" style="font-weight:400;color:' + (dn === days.length ? '#1e874b' : '#9aa5b1') + ';font-size:.78rem">' + (dn === days.length ? '✓ 완료' : dn + '/' + days.length + '일') + '</span></summary>' +
        '<div style="padding:2px 12px 10px">' +
        (window.BIBLE_NOTES && window.BIBLE_NOTES.themes[ti]
          ? '<div style="margin:4px 0 8px;padding:9px 11px;background:#f4f7fb;border-radius:8px;font-size:.8rem;line-height:1.7;color:#44506a">🧭 ' + esc(window.BIBLE_NOTES.themes[ti]) + '</div>'
          : '') +
        rowsH + '</div></details>';
    }).join('');
    ov.innerHTML = '<div style="background:#f7f9fc;border-radius:14px;max-width:720px;width:100%;padding:20px 18px;box-shadow:0 24px 60px rgba(0,0,0,.32)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><h3 style="margin:0;color:var(--accent,#223350)">📖 구속사 성경읽기 365 <span id="brt_cnt" style="font-size:.84rem;color:#9aa5b1;font-weight:600">' + BR.rows.length + '/365</span></h3><button class="btn btn-line" id="brt_close" style="padding:4px 12px">닫기</button></div>' +
      '<p style="margin:0 0 12px;font-size:.76rem;color:#9aa5b1">✅ 체크하면 <b>바로 저장</b>되고, 체크를 해제하면 <b>삭제</b>됩니다(별도 저장 버튼이 필요 없어요) · 📖 를 누르면 우리말성경 본문이 열립니다</p>' +
      '<div style="max-height:64vh;overflow:auto"><div id="brt_cov"></div>' + groups + '</div></div>';
    document.body.appendChild(ov); document.body.style.overflow = 'hidden';
    function closeDom() { ov.remove(); document.body.style.overflow = ''; paintBibleCard(cardEl, head); }   // 닫을 때 카드 갱신
    if (window.ModalNav) window.ModalNav.open(closeDom);
    function close() { if (window.ModalNav && window.ModalNav.close()) return; closeDom(); }
    ov.querySelector('#brt_close').onclick = close;
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });

    // ── 성경 전체 커버리지: 66권 각각 몇 장을 읽었는지 한눈에(권별 읽은 장/전체 장) ──
    var ORDER_OT = ['창', '출', '레', '민', '신', '수', '삿', '룻', '삼상', '삼하', '왕상', '왕하', '대상', '대하', '스', '느', '에', '욥', '시', '잠', '전', '아', '사', '렘', '애', '겔', '단', '호', '욜', '암', '옵', '욘', '미', '나', '합', '습', '학', '슥', '말'];
    var ORDER_NT = ['마', '막', '눅', '요', '행', '롬', '고전', '고후', '갈', '엡', '빌', '골', '살전', '살후', '딤전', '딤후', '딛', '몬', '히', '약', '벧전', '벧후', '요일', '요이', '요삼', '유', '계'];
    function paintCov() {
      var box = ov.querySelector('#brt_cov'); if (!box) return;
      var doneNow = {}; BR.rows.forEach(function (r) { doneNow[r.day_no] = 1; });
      var total = {}, read = {};   // 책별 장 집합 (읽기표가 성경 1189장 전체를 정확히 1회 커버함이 검증돼 있어 total=권별 전체 장수)
      P.days.forEach(function (d) {
        var isDone = doneNow[d.d];
        (d.refs || []).forEach(function (rf) {
          var ab = rf[0];
          var t = total[ab] || (total[ab] = {}), rd = read[ab] || (read[ab] = {});
          for (var c = rf[1]; c <= rf[2]; c++) { t[c] = 1; if (isDone) rd[c] = 1; }
        });
      });
      var totCh = 0, readCh = 0;
      Object.keys(total).forEach(function (ab) { totCh += Object.keys(total[ab]).length; readCh += Object.keys(read[ab] || {}).length; });
      function cells(list) {
        var doneBooks = 0;
        var html = list.map(function (ab) {
          var t = Object.keys(total[ab] || {}).length, r = Object.keys(read[ab] || {}).length;
          if (!t) return '';
          var full = r >= t; if (full) doneBooks++;
          var st = full
            ? 'background:#e7f4ea;border-color:#a9d5b3;color:#1e6b35'
            : (r > 0 ? 'background:#eaf1fb;border-color:#b9cff0;color:#2c4a7c' : 'background:#f6f8fb;border-color:#e4e9f1;color:#a6afbd');
          return '<div style="border:1px solid;border-radius:8px;padding:6px 4px;text-align:center;min-height:44px;display:flex;flex-direction:column;justify-content:center;gap:1px;' + st + '">' +
            '<span style="font-size:.76rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(P.names[ab] || ab) + '</span>' +
            '<span style="font-size:.68rem;font-weight:600">' + (full ? '✓ ' + t + '장' : (r > 0 ? r + '/' + t + '장' : '·')) + '</span></div>';
        }).join('');
        return { html: html, done: doneBooks };
      }
      var ot = cells(ORDER_OT), nt = cells(ORDER_NT);
      var pct = totCh ? Math.round(readCh / totCh * 100) : 0;
      box.innerHTML = '<div style="border:1px solid #e6ebf2;border-radius:10px;background:#fff;padding:12px;margin-bottom:10px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:7px">' +
        '<b style="color:var(--accent,#223350);font-size:.9rem">📖 성경 전체 진도</b>' +
        '<span style="font-size:.78rem;color:#5b6b7d">' + readCh + ' / ' + totCh + '장 · <b style="color:var(--accent,#223350)">' + pct + '%</b></span></div>' +
        '<div style="background:#eef2f7;border-radius:6px;height:9px;overflow:hidden;margin-bottom:11px"><div style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,#3a6db5,#223350)"></div></div>' +
        '<div style="font-size:.74rem;color:#7b8794;font-weight:700;margin-bottom:5px">구약 <span style="color:#1f6feb">' + ot.done + '</span>/39권 완독</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:5px;margin-bottom:11px">' + ot.html + '</div>' +
        '<div style="font-size:.74rem;color:#7b8794;font-weight:700;margin-bottom:5px">신약 <span style="color:#d6455a">' + nt.done + '</span>/27권 완독</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:5px">' + nt.html + '</div>' +
        '</div>';
    }
    paintCov();

    function refreshCnt() {
      var c = ov.querySelector('#brt_cnt'); if (c) c.textContent = BR.rows.length + '/365';
      paintCov();   // 체크가 바뀌면 성경 전체 진도도 함께 갱신
    }
    Array.prototype.forEach.call(ov.querySelectorAll('.br-ck'), function (ck) {
      ck.onchange = function () {
        var d = Number(ck.dataset.d);
        ck.disabled = true;
        var p = ck.checked
          ? brFetch('bible_reading', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ day_no: d }) })
              .then(function () { BR.rows.push({ day_no: d, done_at: new Date().toISOString() }); })
          : brUncheck(d);
        p.then(function () { ck.disabled = false; refreshCnt(); })
          .catch(function (e) { ck.disabled = false; ck.checked = !ck.checked; alert('저장 실패: ' + ((e && e.message) || '오류')); });
      };
    });
    Array.prototype.forEach.call(ov.querySelectorAll('.br-open'), function (b) {
      b.onclick = function () {
        var d = Number(b.dataset.d), day = P.days[d - 1];
        var already = BR.rows.some(function (r) { return r.day_no === d; });
        brReadingModal(day, already ? null : function () {
          brFetch('bible_reading', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ day_no: d }) })
            .then(function () { BR.rows.push({ day_no: d, done_at: new Date().toISOString() }); refreshCnt(); var ck = ov.querySelector('.br-ck[data-d="' + d + '"]'); if (ck) ck.checked = true; })
            .catch(function () { });
        });
      };
    });
  }

  /* ================= 나의 문서 (자료실에서 교회가 보관해 준 본인 자료) ================= */
  function loadMyDocs(me) {
    var el = document.getElementById('myDocs'); if (!el) return;
    var url = window.SUPABASE_URL, ak = window.SUPABASE_ANON_KEY, tok = (window.WPF && WPF.token && WPF.token());
    var head = '<div class="form-card" style="padding:16px 18px"><h3 style="margin:0 0 12px;font-size:1rem;color:var(--accent,#223350)">📄 나의 문서</h3>';
    var empty = head + '<p style="color:#9aa5b1;font-size:.9rem;margin:0">아직 등록된 문서가 없습니다.</p></div>';
    if (!url || !ak || !tok) { el.innerHTML = ''; return; }
    // 본인(+배우자) 매칭키로만 조회 — 관리자여도 대시보드에선 남의 문서가 보이면 안 됨
    var keys = [me.memberKey, me.spouseKey].filter(Boolean);
    if (!keys.length) { el.innerHTML = empty; return; }
    var inlist = keys.map(function (k) { return '"' + encodeURIComponent(k) + '"'; }).join(',');
    el.innerHTML = head + '<p class="qt-loading">불러오는 중…</p></div>';
    fetch(url + '/rest/v1/member_files?select=id,category,title,file_url,file_name,doc_date,created_at&member_key=in.(' + inlist + ')&order=created_at.desc', { headers: { apikey: ak, Authorization: 'Bearer ' + tok } })
      .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || ('HTTP ' + r.status)); }); return r.json(); })
      .then(function (rows) {
        rows = rows || [];
        if (!rows.length) { el.innerHTML = empty; return; }
        var d = function (f) { return (String(f.doc_date || '').slice(0, 10)) || (String(f.created_at || '').slice(0, 10)); };
        el.innerHTML = head + '<div style="overflow:auto"><table class="fin-table" style="font-size:.88rem"><thead><tr><th>분류</th><th>파일</th><th>일자</th></tr></thead><tbody>' +
          rows.map(function (f) {
            var name = f.file_name || f.title || '문서';
            var cell = f.file_url ? '<a href="' + esc(f.file_url) + '" target="_blank" rel="noopener noreferrer">📎 ' + esc(name) + '</a>' : esc(name);
            return '<tr><td>' + esc(f.category || '') + '</td><td>' + cell + '</td><td style="white-space:nowrap">' + esc(d(f)) + '</td></tr>';
          }).join('') +
          '</tbody></table></div></div>';
      })
      .catch(function (e) {
        var m = (e && e.message) || '';
        el.innerHTML = head + (/42P01|does not exist|schema cache|Could not find/i.test(m) ? '<p style="color:#9aa5b1;font-size:.88rem;margin:0">문서 보관함이 아직 준비되지 않았습니다.</p>' : '<p style="color:#9aa5b1;font-size:.88rem;margin:0">문서를 불러오지 못했습니다.</p>') + '</div>';
      });
  }

  // 이름 옆에 직책(profiles.role)을 붙여 표시
  function loadWelcomeName(me) {
    var el = document.getElementById('dashWelcome'); if (!el) return;
    var uid = sbUser() && sbUser().id;
    var url = window.SUPABASE_URL, ak = window.SUPABASE_ANON_KEY, tok = (window.WPF && WPF.token && WPF.token());
    if (!uid || !url || !ak || !tok) return;
    fetch(url + '/rest/v1/profiles?id=eq.' + uid + '&select=name,role', { headers: { apikey: ak, Authorization: 'Bearer ' + tok } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var row = rows && rows[0]; if (!row) return;
        var nm = me.memberName || row.name || '';
        var disp = row.role ? (nm + ' ' + row.role) : nm;
        el.textContent = disp + '님, 환영합니다 🙏';
      })
      .catch(function () {});
  }

  /* ================= 이번 주 말씀 / 주보 (main.js 홈 위젯을 대시보드에서 직접 채움) ================= */
  // main.js는 페이지 로드 시 1회만 #homeSermon/#homeBulletin을 채우는데, 대시보드는
  // 로그인 확인 후 비동기로 이 요소들을 나중에 만들기 때문에 그 타이밍을 놓친다.
  // 그래서 같은 BULLETINS 데이터로 대시보드가 직접 채운다.
  function loadHomeSermon() {
    var el = document.getElementById('homeSermon');
    if (!el || typeof BULLETINS === 'undefined' || !BULLETINS.length) return;
    var b = BULLETINS[0];
    el.style.cursor = 'pointer';
    el.title = '클릭해서 설교 요약 보기';
    el.innerHTML =
      '<span class="hs-date">' + b.dateLabel + ' · 주일 낮 예배</span>' +
      '<h3 class="hs-title">' + b.title + '</h3>' +
      '<p class="hs-ref">' + b.scripture + ' · ' + b.preacher + '</p>' +
      '<blockquote class="hs-quote">' + b.quote + '</blockquote>';
    el.onclick = function () { if (typeof openSermonSummary === 'function') openSermonSummary(0); };
  }
  function loadHomeBulletin() {
    var el = document.getElementById('homeBulletin');
    if (!el || typeof BULLETINS === 'undefined' || !BULLETINS.length) return;
    var b = BULLETINS[0];
    var orderItems = (b.order || []).map(function (o) { return '<li>' + o + '</li>'; }).join('');
    var newsItems = (b.news || []).slice(0, 3).map(function (n) { return '<li><strong>' + n.title + '</strong>' + n.detail + '</li>'; }).join('');
    el.innerHTML =
      '<div class="hb-card">' +
      '<div class="hb-hd"><span class="hb-hd-week">' + b.week + ' · 주일 낮 예배</span><span class="hb-hd-date">' + b.dateLabel + '</span></div>' +
      '<div class="hb-body">' +
      '<div class="hb-col"><p class="hb-col-title">예배 순서</p><ol class="hb-order">' + orderItems + '</ol></div>' +
      '<div class="hb-col"><p class="hb-col-title">이 주의 말씀 강해</p><ul class="hb-extra"><li>' + (b.wed || '') + '</li><li>' + (b.dawn || '') + '</li><li>' + (b.qt || '') + '</li></ul>' +
      (newsItems ? '<p class="hb-col-title">한 주의 소식</p><ul class="hb-news">' + newsItems + '</ul>' : '') +
      '</div></div>' +
      '<div class="hb-ft"><a class="btn btn-line" href="word.html#archive">주보 전체 보기 →</a></div>' +
      '</div>';
  }

  /* ================= 오늘의 큐티 (홈 화면과 동일한 카드) + 아멘 체크 ================= */
  function loadTodayQt(me) {
    var el = document.getElementById('dashQt'); if (!el) return;
    el.innerHTML = '<div class="qt-today"><p class="qt-loading">오늘의 말씀을 불러오는 중입니다…</p></div>';
    var url = window.SUPABASE_URL, ak = window.SUPABASE_ANON_KEY, t = todayStr();
    // 오늘 QT가 없으면 홈 화면처럼 가장 최근(오늘 이전) QT로 대체
    fetch(url + '/rest/v1/qt_published?select=*&sermon_date=lte.' + t + '&order=sermon_date.desc&limit=1', { headers: { apikey: ak, Authorization: 'Bearer ' + ak } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var q = rows && rows[0];
        if (!q) { el.innerHTML = '<div class="qt-today"><p class="qt-loading">아직 등록된 큐티가 없습니다.</p></div>'; return; }
        var qDate = String(q.sermon_date || t).slice(0, 10);
        var isToday = (qDate === t);
        var dotDate = qDate.replace(/-/g, '.');
        var listenHref = (typeof godpiaUrl === 'function') ? godpiaUrl(q.scripture) : 'https://www.godpia.com/read/reading.asp';
        el.innerHTML =
          '<div class="qt-today">' +
          '<button type="button" class="qt-card-today" id="dashQtOpen">' +
          '<span class="qt-badge">' + (isToday ? '오늘의 QT · ' : '최근 QT · ') + esc(dotDate) + '</span>' +
          (q.title ? '<h3 class="qt-card-title">' + esc(q.title) + '</h3>' : '') +
          (q.scripture ? '<p class="qt-card-ref">' + esc(q.scripture) + '</p>' : '') +
          '<span class="qt-card-more">묵상 전문 읽기 →</span>' +
          '</button>' +
          '<div id="dashQtFull" hidden style="margin-top:18px"></div>' +
          '</div>' +
          '<div class="qt-listen-wrap"><button type="button" class="qt-listen-btn" id="dashTtsBtn" style="border:0;cursor:pointer;font:inherit">🔊 오늘의 말씀 듣기</button></div>';
        var opened = false;
        function renderFullOnce() {
          var full = document.getElementById('dashQtFull'); if (!full || full.dataset.loaded) return;
          full.dataset.loaded = '1';
          full.innerHTML =
            '<div class="form-card qtc-card">' +
            (q.qt_bible_text ? '<div class="qtc-bible">' + bibleVersesHTML(q.qt_bible_text) + '</div>' : '') +
            (q.content ? '<div class="qtc-head">📝 묵상</div><div class="qtc-body">' + toParaHTML(q.content) + '</div>' : '') +
            (q.prayer ? '<div class="qtc-head">🙏 기도</div><div class="qtc-body">' + toParaHTML(q.prayer) + '</div>' : '') +
            '<div id="dashAmenBox" class="qtc-amen"></div>' +
            '</div>';
          loadAmenState(me, qDate);
        }
        function openFull() { var full = document.getElementById('dashQtFull'); if (!full) return; renderFullOnce(); opened = true; full.hidden = false; }
        document.getElementById('dashQtOpen').onclick = function () {
          opened = !opened;
          var full = document.getElementById('dashQtFull');
          full.hidden = !opened;
          if (opened) renderFullOnce();
        };
        // 🔊 오늘의 말씀 듣기 — 누르면 본문(묵상 전문)을 자동으로 펼치고 낭독
        (function () {
          var tb = document.getElementById('dashTtsBtn'); if (!tb) return;
          if (!(window.WPCTts && window.WPCTts.supported)) { tb.style.display = 'none'; return; }
          function plain(s) { if (!s) return ''; var d = document.createElement('div'); d.innerHTML = String(s); return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
          var parts = [];
          if (q.title) parts.push(q.title);
          if (q.scripture) parts.push(q.scripture);
          if (q.qt_bible_text) parts.push(plain(q.qt_bible_text));
          if (q.content) parts.push(plain(q.content));
          if (q.prayer) parts.push(plain(q.prayer));
          var readText = parts.join('. ');
          var preText = [q.title || '', q.scripture || ''].filter(Boolean).join(' ');
          tb.onclick = function () {
            var starting = tb.textContent.indexOf('멈춤') < 0 && tb.textContent.indexOf('준비') < 0;
            if (starting) { openFull(); try { document.getElementById('dashQtFull').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {} }
            window.WPCTts.toggle(readText, tb, '🔊 오늘의 말씀 듣기', { date: qDate, trackEl: document.getElementById('dashQtFull'), preText: preText });
          };
        })();
      })
      .catch(function () { el.innerHTML = '<p style="color:#c0392b;font-size:.88rem;">큐티를 불러오지 못했습니다.</p>'; });
  }
  function fetchAmenRank(t, ak, tok, url) {
    return fetch(url + '/rest/v1/rpc/qt_check_rank', {
      method: 'POST', headers: { apikey: ak, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_date: t })
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  var AMEN_MSG_FIRST = [
    '오늘 1번째 아멘을 하셨네요! 오늘 하루도 말씀 안에서 승리하세요! 🏆',
    '가장 먼저 아멘하셨어요! 오늘의 첫 열매가 되셨습니다 🌱',
    '1등으로 아멘! 부지런한 새벽이 복되다 하셨죠 ✨',
    '오늘의 첫 아멘의 주인공입니다! 은혜가 넘치는 하루 되세요 🙌'
  ];
  var AMEN_MSG_NEXT = [
    '오늘 {n}번째 아멘을 하셨네요! 축하합니다 🎉',
    '{n}번째로 함께해 주셨네요! 오늘도 은혜 충만하세요 🙏',
    '말씀과 함께한 {n}번째 발걸음이에요! 오늘 하루도 평안하세요 🌿',
    '{n}번째 아멘, 참 귀합니다! 늘 강건하시길 축복합니다 💚',
    '오늘 {n}번째로 큐티를 마치셨네요! 주님과 동행하는 하루 되세요 ✨'
  ];
  function pickAmenMessage(rank) {
    if (!rank) return '오늘의 큐티를 마치고 아멘 하셨습니다';   // ✓는 amenDoneHTML에서 붙임(중복 방지)
    var pool = rank === 1 ? AMEN_MSG_FIRST : AMEN_MSG_NEXT;
    var msg = pool[Math.floor(Math.random() * pool.length)];
    return msg.replace('{n}', rank);
  }
  function amenDoneHTML(rank) {
    return '<span class="qtc-amen-done">✓ ' + esc(pickAmenMessage(rank)) + '</span>';
  }
  function loadAmenState(me, t) {
    var box = document.getElementById('dashAmenBox'); if (!box) return;
    var uid = sbUser() && sbUser().id, tok = WPF.token();
    var url = window.SUPABASE_URL, ak = window.SUPABASE_ANON_KEY;
    if (!uid) { box.innerHTML = ''; return; }
    // 반드시 본인(user_id) 것만 조회 — 관리자는 RLS상 전체 qt_checks를 읽을 수 있어, 필터가 없으면
    // 다른 성도의 아멘이 잡혀 '내가 아멘한 것'처럼 잘못 표시된다.
    fetch(url + '/rest/v1/qt_checks?select=id&user_id=eq.' + uid + '&check_date=eq.' + t, { headers: { apikey: ak, Authorization: 'Bearer ' + tok } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        if (rows && rows.length) {
          box.innerHTML = amenDoneHTML(null);
          fetchAmenRank(t, ak, tok, url).then(function (rank) { if (rank) box.innerHTML = amenDoneHTML(rank); });
          return;
        }
        box.innerHTML = '<label><input type="checkbox" id="dashAmenChk"> 🙏 기도문까지 읽고, 오늘의 큐티에 아멘 합니다</label>';
        var chk = document.getElementById('dashAmenChk');
        if (chk) chk.onchange = function () {
          if (!chk.checked) return;
          chk.disabled = true;
          fetch(url + '/rest/v1/qt_checks', {
            method: 'POST', headers: { apikey: ak, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify({ user_id: uid, check_date: t })
          }).then(function (r) {
            if (!r.ok && r.status !== 409) return r.text().then(function (txt) { throw new Error(txt); });
            box.innerHTML = amenDoneHTML(null);
            fetchAmenRank(t, ak, tok, url).then(function (rank) { if (rank) box.innerHTML = amenDoneHTML(rank); });
          }).catch(function (e) {
            chk.disabled = false; chk.checked = false;
            var msg = (e && e.message) || '';
            if (/does not exist|42P01|schema cache|Could not find the table/i.test(msg)) {
              alert('저장에 실패했습니다 — Supabase에 qt_checks 테이블이 아직 없습니다.\n관리자는 supabase/qt_checks.sql 을 Supabase SQL Editor에서 1회 실행해 주세요.');
            } else {
              alert('저장에 실패했습니다: ' + (msg || '알 수 없는 오류') + '\n다시 시도해 주세요.');
            }
          });
        };
      })
      .catch(function () { box.innerHTML = ''; });
  }

  /* ================= 진행중인 교육 ================= */
  function fmtSize(n) { if (!n && n !== 0) return ''; if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(0) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; }
  function eduLabel(r) { return esc(r.title) + (r.cohort ? ' · ' + esc(r.cohort) : '') + (r.class_name ? ' · ' + esc(r.class_name) : ''); }
  function loadMyEdu(me) {
    var el = document.getElementById('myEdu'); if (!el) return;
    var url = window.SUPABASE_URL, ak = window.SUPABASE_ANON_KEY, tok = (window.WPF && WPF.token && WPF.token());
    if (!url || !ak || !tok) return;
    var t = todayStr();
    fetch(url + '/rest/v1/edu_records?select=id,title,cohort,class_name,edu_date,end_date,teacher&edu_date=lte.' + t, { headers: { apikey: ak, Authorization: 'Bearer ' + tok } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var ongoing = (rows || []).filter(function (r) { return !r.end_date || r.end_date >= t; });
        if (!ongoing.length) { el.innerHTML = ''; return; }
        var box = '<div class="form-card" style="padding:16px 18px;"><h3 style="margin:0 0 10px;font-size:1rem;color:var(--accent,#223350);">📚 진행중인 교육</h3>';
        el.innerHTML = box + ongoing.map(function (r) {
          return '<div class="my-edu-item" data-id="' + esc(r.id) + '" style="border:1px solid #e8edf3;border-radius:10px;padding:10px 12px;margin-bottom:8px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" class="my-edu-head">' +
            '<b style="font-size:.92rem">' + eduLabel(r) + '</b>' +
            '<span style="font-size:.78rem;color:#9aa5b1">' + esc(r.teacher || '') + ' ▾</span></div>' +
            '<div class="my-edu-body" hidden style="margin-top:8px;font-size:.83rem"></div></div>';
        }).join('') + '</div>';
        Array.prototype.forEach.call(el.querySelectorAll('.my-edu-item'), function (box2) {
          var head = box2.querySelector('.my-edu-head'), bodyEl = box2.querySelector('.my-edu-body');
          var loaded = false;
          head.onclick = function () {
            bodyEl.hidden = !bodyEl.hidden;
            if (!bodyEl.hidden && !loaded) { loaded = true; loadMyEduMaterials(box2.dataset.id, bodyEl, tok, url, ak); }
          };
        });
      })
      .catch(function () { el.innerHTML = ''; });
  }
  function loadMyEduMaterials(eduId, bodyEl, tok, url, ak) {
    bodyEl.innerHTML = '<p class="qt-loading">자료 불러오는 중…</p>';
    fetch(url + '/rest/v1/edu_materials?edu_id=eq.' + eduId + '&select=*&order=created_at.desc', { headers: { apikey: ak, Authorization: 'Bearer ' + tok } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        rows = rows || [];
        if (!rows.length) { bodyEl.innerHTML = '<p style="color:#9aa5b1">등록된 자료가 없습니다.</p>'; return; }
        bodyEl.innerHTML = rows.map(function (r) {
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-top:1px solid #f0f3f7">' +
            '<span>📎 ' + esc(r.title) + (r.size ? ' <span style="color:#9aa5b1;font-size:.76rem">· ' + fmtSize(r.size) + '</span>' : '') + '</span>' +
            '<a href="#" class="my-mat-dl" data-path="' + esc(r.path) + '" data-title="' + esc(r.title) + '" style="color:var(--accent,#223350)">다운로드</a></div>';
        }).join('');
        Array.prototype.forEach.call(bodyEl.querySelectorAll('.my-mat-dl'), function (a) {
          a.onclick = function (e) {
            e.preventDefault(); var old = a.textContent; a.textContent = '준비 중…';
            fetch(url + '/storage/v1/object/sign/edu_materials/' + a.dataset.path.split('/').map(encodeURIComponent).join('/'), {
              method: 'POST', headers: { apikey: ak, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 })
            }).then(function (r) { return r.json(); }).then(function (d) {
              a.textContent = old;
              if (!d || !d.signedURL) { alert('다운로드 오류: ' + (d && d.message || '알 수 없는 오류')); return; }
              window.open(url + '/storage/v1' + d.signedURL + '&download=' + encodeURIComponent(a.dataset.title || ''), '_blank');
            }).catch(function (err) { a.textContent = old; alert('다운로드 오류: ' + err.message); });
          };
        });
      })
      .catch(function () { bodyEl.innerHTML = '<p style="color:#9aa5b1">자료를 불러오지 못했습니다.</p>'; });
  }

  /* ================= 헌금 ================= */
  function offeringsFromSupabase(me) {
    var url = window.SUPABASE_URL, ak = window.SUPABASE_ANON_KEY, tok = (window.WPF && WPF.token && WPF.token());
    var keys = [me.memberKey, me.spouseKey].filter(Boolean);
    if (!url || !ak || !tok || !keys.length) return Promise.reject(new Error('no-supabase'));
    var inlist = keys.map(function (k) { return '"' + encodeURIComponent(k) + '"'; }).join(',');
    var q = url + '/rest/v1/offerings?select=offer_date,category,service,giver,member_key,amount&member_key=in.(' + inlist + ')&order=offer_date.desc&limit=5000';
    return fetch(q, { headers: { apikey: ak, Authorization: 'Bearer ' + tok } })
      .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || ('HTTP ' + r.status)); }); return r.json(); });
  }
  function spouseBanner(name) {
    return name ? '<p style="background:#e8f6ee;border:1px solid #bfe3cd;color:#1e874b;padding:8px 12px;border-radius:8px;font-size:.85rem;margin-bottom:14px;">💑 배우자 <b>' + esc(name) + '</b>님과 <b>가정 헌금</b>이 합산되어 표시됩니다.</p>' : '';
  }
  function loadOfferings(me) {
    var el = document.getElementById('offeringList');
    offeringsFromSupabase(me).then(function (rows) {
      var note = spouseBanner(me.spouse);
      var list = (rows || []).map(function (o) {
        return { date: o.offer_date, account: o.category || '', service: o.service || '', amount: o.amount, giver: o.giver || '',
                 who: (me.spouseKey && String(o.member_key) === String(me.spouseKey)) ? 'spouse' : 'self' };
      });
      if (!list.length) { el.innerHTML = note + '<p style="color:var(--ink-soft);font-size:.9rem;">조회된 헌금 내역이 없습니다.</p>'; return; }
      var r = { spouse: me.spouse || '', total: list.reduce(function (s, o) { return s + (Number(o.amount) || 0); }, 0) };
      renderWithFilter(el, list, r, me, note);
    }).catch(function () {
      WPF.call('myOfferings').then(function (r) {
        var note = spouseBanner(r.spouse);
        var list = r.offerings || [];
        if (!list.length) { el.innerHTML = note + '<p style="color:var(--ink-soft);font-size:.9rem;">조회된 헌금 내역이 없습니다.</p>'; return; }
        renderWithFilter(el, list, r, me, note);
      }).catch(function (e) {
        if (el) el.innerHTML = '<p style="color:var(--accent-soft);font-size:.9rem;">헌금 조회 실패: ' + esc(e.message) + '</p>';
      });
    });
  }
  function fmtDate(d) { return String(d == null ? '' : d).slice(0, 10); }
  function anyService(list) { return list.some(function (o) { return o.service; }); }
  function statCard(label, val, color) {
    return '<div style="flex:1;min-width:104px;background:#fff;border:1px solid #e8edf3;border-radius:12px;padding:13px 15px;"><div style="color:#7b8794;font-size:.76rem;margin-bottom:5px;">' + label + '</div><div style="font-size:1.2rem;font-weight:700;color:' + color + ';">' + val + '</div></div>';
  }
  function whoOf(o, selfName, spouseName) {
    if (o.giver) {
      if (spouseName && o.giver === spouseName) return 'spouse';
      if (selfName && o.giver === selfName) return 'self';
    }
    if (o.who === 'self' || o.who === 'spouse') return o.who;
    return 'self';
  }
  function renderWithFilter(el, list, r, me, spouseNote) {
    var selfName = me.memberName || '본인';
    var spouseName = r.spouse || '';
    var hasSelf = list.some(function (o) { return whoOf(o, selfName, spouseName) === 'self'; });
    var hasSpouse = !!spouseName && list.some(function (o) { return whoOf(o, selfName, spouseName) === 'spouse'; });
    if (!hasSpouse || !hasSelf) { renderOfferingView(el, list, r, me, spouseNote); return; }
    el.innerHTML =
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">' +
      '  <button type="button" class="btn fm-who" data-w="all">합산</button>' +
      '  <button type="button" class="btn fm-who" data-w="self">' + esc(selfName) + '</button>' +
      '  <button type="button" class="btn fm-who" data-w="spouse">' + esc(spouseName) + '</button>' +
      '</div><div id="fmInner"></div>';
    var inner = el.querySelector('#fmInner');
    var tabs = el.querySelectorAll('.fm-who');
    function setActive(b) {
      Array.prototype.forEach.call(tabs, function (x) { x.style.background = '#fff'; x.style.color = 'var(--accent,#223350)'; x.style.border = '1px solid #cdd7e3'; });
      b.style.background = 'var(--accent,#223350)'; b.style.color = '#fff'; b.style.border = '1px solid var(--accent,#223350)';
    }
    function show(w, btn) {
      setActive(btn);
      var filtered = w === 'all' ? list : list.filter(function (o) { return whoOf(o, selfName, spouseName) === w; });
      var note = w === 'all' ? spouseNote : '';
      var rr = { spouse: r.spouse, total: w === 'all' ? r.total : undefined };
      renderOfferingView(inner, filtered, rr, me, note);
    }
    Array.prototype.forEach.call(tabs, function (b) { b.onclick = function () { show(b.dataset.w, b); }; });
    show('all', tabs[0]);
  }
  function renderOfferingView(el, list, r, me, spouseNote) {
    var PAL = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4', '#a855f7', '#eab308', '#f43f5e', '#0ea5e9'];
    var byAcc = {};
    list.forEach(function (o) { var a = o.account || '기타'; if (!byAcc[a]) byAcc[a] = { name: a, total: 0, count: 0 }; byAcc[a].total += Number(o.amount) || 0; byAcc[a].count++; });
    var accs = Object.keys(byAcc).map(function (k) { return byAcc[k]; }).sort(function (a, b) { return b.total - a.total; });
    accs.forEach(function (a, i) { a.color = PAL[i % PAL.length]; });
    var total = r.total || list.reduce(function (s, o) { return s + (Number(o.amount) || 0); }, 0);
    var ds = list.map(function (o) { return fmtDate(o.date); }).filter(Boolean).sort();
    var period = ds.length ? ds[0] + ' ~ ' + ds[ds.length - 1] : '';
    var hasGiver = list.some(function (o) { return o.giver && o.giver !== (me.memberName || ''); });
    var R = 54, C = 2 * Math.PI * R, off = 0;
    var segs = accs.map(function (a) {
      var len = (a.total / (total || 1)) * C;
      var s = '<circle r="' + R + '" cx="75" cy="75" fill="none" stroke="' + a.color + '" stroke-width="22" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 75 75)"></circle>';
      off += len; return s;
    }).join('');
    var donut = '<svg viewBox="0 0 150 150" width="150" height="150" style="flex:0 0 auto;">' + segs +
      '<text x="75" y="70" text-anchor="middle" font-size="10" fill="#7b8794">총 헌금</text>' +
      '<text x="75" y="89" text-anchor="middle" font-size="12" font-weight="700" fill="#223350">' + won(total) + '</text></svg>';
    var legend = '<div style="flex:1;min-width:180px;display:flex;flex-direction:column;gap:6px;">' +
      accs.map(function (a) { return '<div style="display:flex;align-items:center;gap:8px;font-size:.85rem;"><span style="width:11px;height:11px;border-radius:3px;background:' + a.color + ';flex:0 0 auto;"></span><span style="flex:1;">' + esc(a.name) + '</span><b style="font-variant-numeric:tabular-nums;">' + won(a.total) + '</b><span style="color:#9aa5b1;width:40px;text-align:right;">' + (total ? (a.total / total * 100).toFixed(0) : 0) + '%</span></div>'; }).join('') +
      '</div>';
    var maxAcc = accs.length ? accs[0].total : 1;
    var byTab = '<table style="width:100%;border-collapse:collapse;font-size:.88rem;">' +
      accs.map(function (a) {
        var bar = (a.total / (maxAcc || 1) * 100).toFixed(1);
        return '<tr><td style="padding:7px 8px 7px 0;white-space:nowrap;"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:' + a.color + ';margin-right:6px;"></span>' + esc(a.name) + '</td>' +
          '<td style="width:44%;padding:7px 0;"><div style="background:#eef2f7;border-radius:5px;height:9px;overflow:hidden;"><div style="width:' + bar + '%;height:100%;background:' + a.color + ';"></div></div></td>' +
          '<td style="text-align:right;padding:7px 0 7px 8px;font-variant-numeric:tabular-nums;"><b>' + won(a.total) + '</b> <span style="color:#9aa5b1;">' + a.count + '건</span></td></tr>';
      }).join('') + '</table>';
    var sorted = list.slice().sort(function (a, b) { return String(fmtDate(b.date)).localeCompare(String(fmtDate(a.date))); });
    var sv = anyService(list);
    var allTab = '<div style="overflow:auto;max-height:460px;"><table class="board-table" style="width:100%;border-collapse:collapse;font-size:.88rem;">' +
      '<thead><tr style="position:sticky;top:0;background:#f5f8fc;"><th style="text-align:left;padding:8px;">일자</th>' + (hasGiver ? '<th style="text-align:left;padding:8px;">헌금자</th>' : '') + '<th style="text-align:left;padding:8px;">항목</th>' + (sv ? '<th style="text-align:left;padding:8px;">예배</th>' : '') + '<th style="text-align:right;padding:8px;">금액</th></tr></thead><tbody>' +
      sorted.map(function (o) { return '<tr><td style="padding:6px 8px;">' + esc(fmtDate(o.date)) + '</td>' + (hasGiver ? '<td style="padding:6px 8px;">' + esc(o.giver || '') + '</td>' : '') + '<td style="padding:6px 8px;">' + esc(o.account || '') + '</td>' + (sv ? '<td style="padding:6px 8px;">' + esc(o.service || '') + '</td>' : '') + '<td style="padding:6px 8px;text-align:right;font-variant-numeric:tabular-nums;">' + won(o.amount) + '</td></tr>'; }).join('') +
      '</tbody><tfoot><tr style="font-weight:700;background:#f5f8fc;"><td colspan="' + (1 + (hasGiver ? 1 : 0) + (sv ? 1 : 0)) + '" style="padding:8px;text-align:right;">합계</td><td style="padding:8px;text-align:right;">' + won(total) + '</td></tr></tfoot></table></div>';
    el.innerHTML = spouseNote +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">' +
        statCard('총 헌금액', won(total) + '원', '#223350') +
        statCard('헌금 건수', list.length + '건', '#1e874b') +
        statCard('헌금 항목', accs.length + '개', '#3b82f6') +
      '</div>' +
      '<div class="form-card" style="display:flex;gap:18px;flex-wrap:wrap;align-items:center;justify-content:center;margin-bottom:14px;padding:18px;">' + donut + legend + '</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:10px;">' +
        '<button type="button" class="btn os-tab" data-o="acc">항목별</button>' +
        '<button type="button" class="btn os-tab" data-o="all">전체 내역</button>' +
      '</div>' +
      '<div id="osPanel"></div>' +
      '<p style="color:var(--ink-soft);font-size:.8rem;margin-top:10px;">🔒 본인(부부)에게만 표시됩니다.' + (period ? ' · 기간 ' + esc(period) : '') + '</p>';
    var panel = el.querySelector('#osPanel');
    var tabs2 = el.querySelectorAll('.os-tab');
    function setActive2(b) {
      Array.prototype.forEach.call(tabs2, function (x) { x.style.background = '#fff'; x.style.color = 'var(--accent,#223350)'; x.style.border = '1px solid #cdd7e3'; });
      b.style.background = 'var(--accent,#223350)'; b.style.color = '#fff'; b.style.border = '1px solid var(--accent,#223350)';
    }
    function show2(which, btn) { setActive2(btn); panel.innerHTML = which === 'all' ? allTab : '<div class="form-card" style="padding:16px;">' + byTab + '</div>'; }
    Array.prototype.forEach.call(tabs2, function (b) { b.onclick = function () { show2(b.dataset.o, b); }; });
    show2('acc', tabs2[0]);
  }

  /* ================= 가계도 ================= */
  function loadFamily(me) {
    var el = document.getElementById('familyTree'); if (!el) return;
    if (!(window.WPF && WPF.call)) return;
    WPF.call('myFamily').then(function (r) {
      var ms = (r && r.members) || [];
      if (!ms.length) { el.innerHTML = ''; return; }
      el.innerHTML = renderFamilyTree(ms, me);
    }).catch(function () { el.innerHTML = ''; });
  }
  function renderFamilyTree(ms, me) {
    var myKeys = [me.memberKey, me.spouseKey].filter(Boolean).map(String);
    function bday(m) { var bd = (String(m.member_key || '').split('|')[1]) || ''; if (bd.length === 8) return bd.slice(0, 4) + '-' + bd.slice(4, 6) + '-' + bd.slice(6, 8); return String(m.birth || '').slice(0, 10); }
    function headOf(m) { return m.head || m.name; }
    var heads = {}, order = [];
    ms.forEach(function (m) { var h = headOf(m); if (!heads[h]) { heads[h] = []; order.push(h); } heads[h].push(m); });
    var myHead = (function () { for (var i = 0; i < ms.length; i++) if (myKeys.indexOf(String(ms[i].member_key)) >= 0) return headOf(ms[i]); return order[0]; })();
    order.sort(function (a, b) { return (b === myHead ? 0 : 1) - (a === myHead ? 0 : 1) || a.localeCompare(b, 'ko'); });
    function isMine(m) { return myKeys.indexOf(String(m.member_key)) >= 0; }
    function person(m, kind) {
      var mine = isMine(m);
      var icon = kind === 'head' ? '⌂ ' : (kind === 'spouse' ? '💑 ' : '');
      return '<span style="display:inline-flex;align-items:center;gap:5px">' + icon +
        '<b style="' + (mine ? 'color:#1e874b' : (kind === 'head' ? 'color:var(--accent,#223350)' : '')) + '">' + esc(m.name) + '</b>' +
        (mine ? '<span style="font-size:.7rem;background:#e8f6ee;color:#1e874b;border-radius:999px;padding:1px 7px">나</span>' : '') +
        '<span style="font-size:.74rem;color:#7b8794">' + esc(kind === 'head' ? '세대주' : (m.relation || (kind === 'spouse' ? '배우자' : ''))) + (bday(m) ? ' · ' + esc(bday(m)) : '') + '</span></span>';
    }
    function household(h) {
      var fam = heads[h];
      var head = null, spouse = null;
      for (var i = 0; i < fam.length; i++) if (fam[i].name === h) { head = fam[i]; break; }
      for (var j = 0; j < fam.length; j++) { var f = fam[j]; if (f !== head && (f.relation === '배우자' || (head && f.member_key && f.member_key === head.spouse_key))) { spouse = f; break; } }
      var others = fam.filter(function (m) { return m !== head && m !== spouse; }).sort(function (a, b) { return bday(a).localeCompare(bday(b)); });
      var origin = head && head.origin_head ? head.origin_head : '';
      var isMy = (h === myHead);
      return '<div style="border:1px solid ' + (isMy ? '#bfe3cd' : '#e8edf3') + ';border-radius:12px;padding:12px 14px;margin-bottom:10px;background:' + (isMy ? '#f4fbf6' : '#fff') + '">' +
        (origin ? '<div style="font-size:.76rem;color:#9aa5b1;margin-bottom:5px">↑ ' + esc(origin) + '님 가정에서 분가</div>' : '') +
        '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">' + (head ? person(head, 'head') : '') + (spouse ? '<span style="color:#cdd5e1">—</span>' + person(spouse, 'spouse') : '') + '</div>' +
        others.map(function (m) { return '<div style="padding:4px 0 4px 18px;color:#cbd5e1">└ ' + person(m, 'child') + '</div>'; }).join('') +
        '</div>';
    }
    return '<div class="form-card" style="padding:16px 18px;"><h3 style="margin:0 0 4px;color:var(--accent,#223350);font-size:1rem">👪 우리 가족 가계도</h3>' +
      '<p style="color:var(--ink-soft);font-size:.82rem;margin:0 0 12px">교적에 등록된 우리 가족 관계입니다. (변경은 교회 사무실·관리자에게 문의)</p>' +
      order.map(household).join('') + '</div>';
  }

  /* ================= QT 진행표 (성경 66권 커버리지) ================= */
  var BIBLE_OT = ['창세기', '출애굽기', '레위기', '민수기', '신명기', '여호수아', '사사기', '룻기', '사무엘상', '사무엘하', '열왕기상', '열왕기하', '역대상', '역대하', '에스라', '느헤미야', '에스더', '욥기', '시편', '잠언', '전도서', '아가', '이사야', '예레미야', '예레미야애가', '에스겔', '다니엘', '호세아', '요엘', '아모스', '오바댜', '요나', '미가', '나훔', '하박국', '스바냐', '학개', '스가랴', '말라기'];
  var BIBLE_NT = ['마태복음', '마가복음', '누가복음', '요한복음', '사도행전', '로마서', '고린도전서', '고린도후서', '갈라디아서', '에베소서', '빌립보서', '골로새서', '데살로니가전서', '데살로니가후서', '디모데전서', '디모데후서', '디도서', '빌레몬서', '히브리서', '야고보서', '베드로전서', '베드로후서', '요한일서', '요한이서', '요한삼서', '유다서', '요한계시록'];
  var BOOK_ALIAS = (function () {
    var m = {};
    BIBLE_OT.concat(BIBLE_NT).forEach(function (n) { m[n] = n; });
    var ab = { 창: '창세기', 출: '출애굽기', 레: '레위기', 민: '민수기', 신: '신명기', 수: '여호수아', 삿: '사사기', 룻: '룻기', 삼상: '사무엘상', 삼하: '사무엘하', 왕상: '열왕기상', 왕하: '열왕기하', 대상: '역대상', 대하: '역대하', 스: '에스라', 느: '느헤미야', 에: '에스더', 욥: '욥기', 시: '시편', 잠: '잠언', 전: '전도서', 아: '아가', 사: '이사야', 렘: '예레미야', 애: '예레미야애가', 겔: '에스겔', 단: '다니엘', 호: '호세아', 욜: '요엘', 암: '아모스', 옵: '오바댜', 욘: '요나', 미: '미가', 나: '나훔', 합: '하박국', 습: '스바냐', 학: '학개', 슥: '스가랴', 말: '말라기', 마: '마태복음', 막: '마가복음', 눅: '누가복음', 요: '요한복음', 행: '사도행전', 롬: '로마서', 고전: '고린도전서', 고후: '고린도후서', 갈: '갈라디아서', 엡: '에베소서', 빌: '빌립보서', 골: '골로새서', 살전: '데살로니가전서', 살후: '데살로니가후서', 딤전: '디모데전서', 딤후: '디모데후서', 딛: '디도서', 몬: '빌레몬서', 히: '히브리서', 약: '야고보서', 벧전: '베드로전서', 벧후: '베드로후서', 요일: '요한일서', 요이: '요한이서', 요삼: '요한삼서', 유: '유다서', 계: '요한계시록' };
    Object.keys(ab).forEach(function (k) { m[k] = ab[k]; });
    return m;
  })();
  function bookOf(scripture) {
    var s = String(scripture == null ? '' : scripture).trim();
    var m = s.match(/^([가-힣]+)/);
    if (!m) return null;
    var tok = m[1];
    if (BOOK_ALIAS[tok]) return BOOK_ALIAS[tok];
    for (var len = tok.length; len >= 1; len--) {
      var pre = tok.slice(0, len);
      if (BOOK_ALIAS[pre]) return BOOK_ALIAS[pre];
    }
    return null;
  }
  function loadQtProgress(me) {
    var el = document.getElementById('qtProgress'); if (!el) return;
    el.innerHTML = '<div class="form-card" style="padding:16px 18px;"><h3 style="margin:0 0 4px;font-size:1rem;color:var(--accent,#223350);">📊 QT 진행표</h3><p style="color:var(--ink-soft);font-size:.82rem;margin:0 0 12px;">아멘한 큐티의 말씀 본문이 성경 66권 중 어디를 지나왔는지 보여줍니다. 표시된 책을 누르면 그때 읽은 큐티를 다시 볼 수 있습니다.</p><div id="qtProgGrid"><p class="qt-loading">불러오는 중…</p></div><div id="qtProgDetail"></div></div>';
    var url = window.SUPABASE_URL, ak = window.SUPABASE_ANON_KEY, tok = (window.WPF && WPF.token && WPF.token());
    var uid = sbUser() && sbUser().id;
    if (!uid || !tok) { el.querySelector('#qtProgGrid').innerHTML = ''; return; }
    fetch(url + '/rest/v1/qt_checks?select=check_date&order=check_date.asc', { headers: { apikey: ak, Authorization: 'Bearer ' + tok } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (checks) {
        var dates = (checks || []).map(function (c) { return c.check_date; }).filter(Boolean);
        if (!dates.length) { drawGrid({}, {}); return; }
        var inlist = dates.map(function (d) { return '"' + d + '"'; }).join(',');
        return fetch(url + '/rest/v1/qt_published?select=sermon_date,title,scripture,qt_bible_text,content,prayer&sermon_date=in.(' + inlist + ')&order=sermon_date.desc', { headers: { apikey: ak, Authorization: 'Bearer ' + ak } })
          .then(function (r) { return r.ok ? r.json() : []; })
          .then(function (rows) {
            // 같은 날짜에 중복 게시된 큐티가 있으면 하루=1건으로 합침(내용이 더 채워진 레코드 우선)
            var seen = {}, uniq = [];
            function score(r) { return (r.content ? 1 : 0) + (r.qt_bible_text ? 1 : 0) + (r.prayer ? 1 : 0); }
            (rows || []).forEach(function (r) {
              var k = r.sermon_date;
              if (!(k in seen)) { seen[k] = uniq.length; uniq.push(r); }
              else if (score(r) > score(uniq[seen[k]])) uniq[seen[k]] = r;
            });
            var covered = {}, byBook = {};
            uniq.forEach(function (r) {
              var bk = bookOf(r.scripture); if (!bk) return;
              covered[bk] = (covered[bk] || 0) + 1;
              (byBook[bk] = byBook[bk] || []).push(r);
            });
            drawGrid(covered, byBook);
          });
      })
      .catch(function () { drawGrid({}, {}); });
    function grpHTML(list, covered) {
      return '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:6px;">' +
        list.map(function (b) {
          var n = covered[b] || 0;
          var on = n > 0;
          return '<div class="qtc-bookcell' + (on ? ' on' : '') + '" data-book="' + esc(b) + '" title="' + esc(b) + (on ? ' · ' + n + '회 · 눌러서 보기' : '') + '" style="padding:7px 4px;text-align:center;border-radius:6px;font-size:.74rem;font-weight:700;background:' + (on ? '#0d9488' : '#eef2f7') + ';color:' + (on ? '#fff' : '#9aa5b1') + ';word-break:keep-all;line-height:1.3;' + (on ? 'cursor:pointer;' : '') + '">' + esc(b) + (on ? '<div style="font-size:.64rem;font-weight:400;opacity:.85;">' + n + '회</div>' : '') + '</div>';
        }).join('') + '</div>';
    }
    function entryHTML(r, i) {
      return '<div class="qtc-bookentry" data-i="' + i + '" style="border:1px solid #e8edf3;border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
        '<b style="font-size:.9rem;">' + esc(r.title || '') + '</b>' +
        '<span style="font-size:.76rem;color:#9aa5b1;">' + esc(r.sermon_date) + ' ▾</span></div>' +
        (r.scripture ? '<div style="font-size:.8rem;color:var(--accent,#223350);margin-top:2px;">' + esc(r.scripture) + '</div>' : '') +
        '<div class="qtc-bookentry-body" hidden style="margin-top:10px;"></div></div>';
    }
    function drawGrid(covered, byBook) {
      var grid = el.querySelector('#qtProgGrid'); if (!grid) return;
      var detail = el.querySelector('#qtProgDetail');
      var totalCovered = BIBLE_OT.concat(BIBLE_NT).filter(function (b) { return covered[b]; }).length;
      grid.innerHTML =
        '<p style="font-size:.85rem;color:#3a4a63;margin:0 0 10px;font-weight:600;">' + totalCovered + ' / 66권 커버</p>' +
        '<div style="margin-bottom:6px;font-size:.76rem;color:#9aa5b1;font-weight:700;">구약</div>' + grpHTML(BIBLE_OT, covered) +
        '<div style="margin:14px 0 6px;font-size:.76rem;color:#9aa5b1;font-weight:700;">신약</div>' + grpHTML(BIBLE_NT, covered);
      Array.prototype.forEach.call(grid.querySelectorAll('.qtc-bookcell.on'), function (cell) {
        cell.onclick = function () { showBookQt(cell.dataset.book, byBook[cell.dataset.book] || [], detail); };
      });
    }
    function showBookQt(book, rows, detail) {
      if (!detail) return;
      detail.innerHTML = '<div style="border-top:1px solid #eef1f5;margin-top:16px;padding-top:14px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">' +
        '<b style="font-size:.92rem;color:var(--accent,#223350);">' + esc(book) + ' — 읽은 큐티 ' + rows.length + '건</b>' +
        '<button type="button" id="qtProgDetailClose" class="btn btn-line" style="padding:3px 12px;font-size:.78rem;white-space:nowrap;">✕ 닫기</button></div>' +
        '<div style="margin-top:10px;">' + rows.map(entryHTML).join('') + '</div></div>';
      var closeBtn = detail.querySelector('#qtProgDetailClose');
      if (closeBtn) closeBtn.onclick = function () { detail.innerHTML = ''; };
      Array.prototype.forEach.call(detail.querySelectorAll('.qtc-bookentry'), function (card) {
        var r = rows[Number(card.dataset.i)];
        var body = card.querySelector('.qtc-bookentry-body');
        var loaded = false;
        card.onclick = function () {
          body.hidden = !body.hidden;
          if (!body.hidden && !loaded) {
            loaded = true;
            body.innerHTML =
              (r.qt_bible_text ? '<div class="qtc-bible">' + bibleVersesHTML(r.qt_bible_text) + '</div>' : '') +
              (r.content ? '<div class="qtc-head">📝 묵상</div><div class="qtc-body">' + toParaHTML(r.content) + '</div>' : '') +
              (r.prayer ? '<div class="qtc-head">🙏 기도</div><div class="qtc-body">' + toParaHTML(r.prayer) + '</div>' : '');
          }
        };
      });
      detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitLogin);
  else waitLogin();
})();

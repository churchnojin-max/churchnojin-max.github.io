/* affairs.js — 행정관리(관리자 전용): 심방관리 · 상담관리
 * 데이터는 Supabase(visitations/counsels, 관리자 RLS)에 저장.
 * 콘솔: [affairs.js] v20260701dj
 */
console.log('[affairs.js] v20260701dj');

(function () {
  var root = document.getElementById('afRoot');
  if (!root) return;
  var SB = window.SUPABASE_URL, AK = window.SUPABASE_ANON_KEY;

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var pad2 = function (n) { return ('0' + n).slice(-2); };
  var today = function () { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
  var fmtD = function (d) { return String(d == null ? '' : d).slice(0, 10); };
  var nl2br = function (s) { return esc(s).replace(/\n/g, '<br>'); };
  function msgCard(t, x) { return '<div class="fin-card" style="text-align:center;padding:40px 18px;"><h3 style="margin:0 0 8px;color:var(--accent,#223350);">' + esc(t) + '</h3><p style="color:var(--ink-soft,#7b8794);">' + esc(x) + '</p></div>'; }

  // ── 교적 연동(대상자 자동완성·관계 표시) ──
  var MEMBERS = [], membersLoaded = false;
  function ymd(v) { return String(v == null ? '' : v).slice(0, 10); }
  function findMember(key) { if (!key) return null; for (var i = 0; i < MEMBERS.length; i++) if (String(MEMBERS[i].key) === String(key)) return MEMBERS[i]; return null; }
  // 교적은 구글시트에만 있으므로 Apps Script API(listGyojeok, 관리자 권한)로 1회 로드
  function loadMembers() {
    if (membersLoaded || !window.WPF || !window.SUPABASE_URL) return;
    WPF.call('listGyojeok').then(function (r) {
      MEMBERS = (r.members || []).map(function (m) {
        return { name: m['이름'], key: m['매칭키'], birth: ymd(m['생년월일']),
                 role: m['직책'] || '', group: m['그룹'] || m['소속그룹'] || '', head: m['세대주'] || '', rel: m['관계'] || '', spouse: m['배우자'] || '' };
      }).filter(function (m) { return m.name; });
      membersLoaded = true;
    }).catch(function () { /* 연동 실패 시 자동완성만 비활성, 이름 직접입력은 정상 동작 */ });
  }
  // 교적 매칭 정보를 한 줄로 요약(직책·구역·세대)
  function memberLine(m) {
    if (!m) return '';
    var bits = [];
    if (m.role) bits.push(m.role);
    if (m.group) bits.push(m.group);
    if (m.head && m.head !== m.name) bits.push(m.head + '의 가정');
    if (m.birth) bits.push(m.birth);
    return bits.join(' · ');
  }

  function sess() {
    try {
      var ref = (SB || '').match(/https:\/\/([^.]+)\./)[1];
      var raw = localStorage.getItem('sb-' + ref + '-auth-token');
      if (!raw) return null;
      var s = JSON.parse(raw); s = (s && s.currentSession) ? s.currentSession : s;
      return { uid: s && s.user && s.user.id, token: s && s.access_token };
    } catch (e) { return null; }
  }
  // 만료된 access_token 을 refresh_token 으로 갱신(중복 호출 방지)
  var _refreshing = null;
  function refreshToken() {
    if (_refreshing) return _refreshing;
    _refreshing = (function () {
      try {
        var ref = (SB || '').match(/https:\/\/([^.]+)\./)[1];
        var key = 'sb-' + ref + '-auth-token';
        var raw = localStorage.getItem(key); if (!raw) return Promise.reject(new Error('no session'));
        var stored = JSON.parse(raw); var cur = stored.currentSession || stored;
        var rt = cur && cur.refresh_token; if (!rt) return Promise.reject(new Error('no refresh token'));
        return fetch(SB + '/auth/v1/token?grant_type=refresh_token', {
          method: 'POST', headers: { apikey: AK, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: rt })
        }).then(function (r) { return r.json(); }).then(function (data) {
          if (!data || !data.access_token) throw new Error('refresh failed');
          var t = stored.currentSession ? stored.currentSession : stored;
          t.access_token = data.access_token; t.refresh_token = data.refresh_token || rt;
          if (data.expires_at) t.expires_at = data.expires_at; if (data.expires_in) t.expires_in = data.expires_in;
          if (data.user) t.user = data.user;
          localStorage.setItem(key, JSON.stringify(stored));
          return data.access_token;
        });
      } catch (e) { return Promise.reject(e); }
    })();
    _refreshing.then(function () { _refreshing = null; }, function () { _refreshing = null; });
    return _refreshing;
  }
  function api(method, path, body, prefer, _retried) {
    var s = sess(); var h = { apikey: AK, 'Content-Type': 'application/json' };
    if (s && s.token) h.Authorization = 'Bearer ' + s.token;
    if (prefer) h.Prefer = prefer;
    var opt = { method: method, headers: h };
    if (body) opt.body = JSON.stringify(body);
    return fetch(SB + '/rest/v1/' + path, opt).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          // 토큰 만료(JWT expired/PGRST303/401) → 1회 갱신 후 재시도
          if (!_retried && (r.status === 401 || /JWT expired|PGRST303|invalid (JWT|token)|token.*expired/i.test(t || ''))) {
            return refreshToken().then(function () { return api(method, path, body, prefer, true); });
          }
          throw new Error(t || ('HTTP ' + r.status));
        });
      }
      // return=minimal 의 POST 는 201(빈 본문), PATCH/DELETE 는 204 → 본문 유무로 안전 파싱
      return r.text().then(function (t) { return t ? JSON.parse(t) : null; });
    });
  }

  // ── 레코드 유형 정의 ──
  var TYPES = {
    visit: {
      table: 'visitations', name: '심방', dateCol: 'visit_date',
      fields: [
        { k: 'visit_date', label: '일자', type: 'date' },
        { k: 'member_name', label: '대상자', type: 'text', ph: '이름' },
        { k: 'category', label: '심방 종류', type: 'select', opts: ['일반심방', '병원심방', '구역심방', '새가족심방', '임종/장례', '경조사', '기타'] },
        { k: 'location', label: '장소', type: 'text', ph: '예: 자택, ○○병원' },
        { k: 'pastor', label: '심방자', type: 'text', ph: '예: 손병민 담임목사' },
        { k: 'content', label: '심방 내용', type: 'textarea', full: true }
      ],
      cols: [['visit_date', '일자'], ['member_name', '대상자'], ['category', '종류'], ['location', '장소'], ['pastor', '심방자'], ['content', '내용']]
    },
    counsel: {
      table: 'counsels', name: '상담', dateCol: 'counsel_date',
      fields: [
        { k: 'counsel_date', label: '일자', type: 'date' },
        { k: 'member_name', label: '대상자', type: 'text', ph: '이름' },
        { k: 'category', label: '분류', type: 'select', opts: ['신앙', '가정', '부부', '자녀', '진로/직업', '대인관계', '재정', '정서/심리', '기타'] },
        { k: 'counselor', label: '상담자', type: 'text', ph: '예: 손병민 담임목사' },
        { k: 'content', label: '상담 내용', type: 'textarea', full: true },
        { k: 'followup', label: '후속 조치', type: 'textarea', full: true },
        { k: 'is_private', label: '비공개(민감)', type: 'check' }
      ],
      cols: [['counsel_date', '일자'], ['member_name', '대상자'], ['category', '분류'], ['counselor', '상담자'], ['content', '내용']]
    },
    edu: {
      table: 'edu_records', name: '교육', dateCol: 'edu_date',
      fields: [
        { k: 'edu_date', label: '일자', type: 'date' },
        { k: 'title', label: '교육명', type: 'text', ph: '예: 새가족반 3주차' },
        { k: 'target', label: '대상/부서', type: 'text', ph: '예: 새가족, 중등부' },
        { k: 'teacher', label: '강사/인도자', type: 'text' },
        { k: 'attendance', label: '참석 인원', type: 'text', ph: '예: 12명' },
        { k: 'content', label: '내용/비고', type: 'textarea', full: true }
      ],
      cols: [['edu_date', '일자'], ['title', '교육명'], ['target', '대상'], ['teacher', '강사'], ['attendance', '인원'], ['content', '내용']]
    },
    sermon: {
      table: 'sermons', name: '설교', dateCol: 'sermon_date',
      fields: [
        { k: 'sermon_date', label: '일자', type: 'date' },
        { k: 'service', label: '예배', type: 'select', opts: ['주일 낮 예배', '주일 밤 예배', '수요기도회', '금요기도회', '새벽기도', '매일 QT', '특별집회', '기타'] },
        { k: 'title', label: '제목', type: 'text' },
        { k: 'scripture', label: '본문(성경)', type: 'text', ph: '예: 요한복음 3:16' },
        { k: 'preacher', label: '설교자', type: 'text', ph: '예: 손병민 담임목사' },
        { k: 'media_url', label: '영상/음성 링크', type: 'text', ph: '유튜브 등 URL' },
        { k: 'file_url', label: '설교 원고/자료', type: 'file' },
        { k: 'content', label: '요약/메모', type: 'textarea', full: true }
      ],
      cols: [['sermon_date', '일자'], ['service', '예배'], ['title', '제목'], ['scripture', '본문'], ['preacher', '설교자'], ['file_url', '자료'], ['content', '요약']]
    },
    doc: {
      table: 'documents', name: '문서', dateCol: 'doc_date',
      fields: [
        { k: 'doc_date', label: '일자', type: 'date' },
        { k: 'title', label: '제목', type: 'text' },
        { k: 'category', label: '분류', type: 'select', opts: ['공문', '회의록', '보고서', '양식', '규정/정관', '대외협조', '기타'] },
        { k: 'manager', label: '담당/부서', type: 'text' },
        { k: 'file_url', label: '첨부 파일', type: 'file' },
        { k: 'content', label: '내용/비고', type: 'textarea', full: true }
      ],
      cols: [['doc_date', '일자'], ['title', '제목'], ['category', '분류'], ['manager', '담당'], ['file_url', '파일'], ['content', '내용']]
    }
  };
  var TAB_ORDER = [['dashboard', '설교 대시보드'], ['sermon', '설교관리'], ['worship', '예배매니저'], ['illus', '예화 클립'], ['bulletin', '주보제작'], ['visit', '심방관리'], ['counsel', '상담관리'], ['edu', '교육관리'], ['doc', '자료실'], ['library', '나의 도서관'], ['bible', '📖 성경 보기'], ['settings', '설정']];

  // ── 성경 66권(설교 권별 커버리지) ──
  var BIBLE_OT = ['창세기', '출애굽기', '레위기', '민수기', '신명기', '여호수아', '사사기', '룻기', '사무엘상', '사무엘하', '열왕기상', '열왕기하', '역대상', '역대하', '에스라', '느헤미야', '에스더', '욥기', '시편', '잠언', '전도서', '아가', '이사야', '예레미야', '예레미야애가', '에스겔', '다니엘', '호세아', '요엘', '아모스', '오바댜', '요나', '미가', '나훔', '하박국', '스바냐', '학개', '스가랴', '말라기'];
  var BIBLE_NT = ['마태복음', '마가복음', '누가복음', '요한복음', '사도행전', '로마서', '고린도전서', '고린도후서', '갈라디아서', '에베소서', '빌립보서', '골로새서', '데살로니가전서', '데살로니가후서', '디모데전서', '디모데후서', '디도서', '빌레몬서', '히브리서', '야고보서', '베드로전서', '베드로후서', '요한일서', '요한이서', '요한삼서', '유다서', '요한계시록'];
  var BOOK_ALIAS = (function () {
    var m = {};
    BIBLE_OT.concat(BIBLE_NT).forEach(function (n) { m[n] = n; });
    var ab = { 창: '창세기', 출: '출애굽기', 레: '레위기', 민: '민수기', 신: '신명기', 수: '여호수아', 삿: '사사기', 룻: '룻기', 삼상: '사무엘상', 삼하: '사무엘하', 왕상: '열왕기상', 왕하: '열왕기하', 대상: '역대상', 대하: '역대하', 스: '에스라', 느: '느헤미야', 에: '에스더', 욥: '욥기', 시: '시편', 잠: '잠언', 전: '전도서', 아: '아가', 사: '이사야', 렘: '예레미야', 애: '예레미야애가', 겔: '에스겔', 단: '다니엘', 호: '호세아', 욜: '요엘', 암: '아모스', 옵: '오바댜', 욘: '요나', 미: '미가', 나: '나훔', 합: '하박국', 습: '스바냐', 학: '학개', 슥: '스가랴', 말: '말라기', 마: '마태복음', 막: '마가복음', 눅: '누가복음', 요: '요한복음', 행: '사도행전', 롬: '로마서', 고전: '고린도전서', 고후: '고린도후서', 갈: '갈라디아서', 엡: '에베소서', 빌: '빌립보서', 골: '골로새서', 살전: '데살로니가전서', 살후: '데살로니가후서', 딤전: '디모데전서', 딤후: '디모데후서', 딛: '디도서', 몬: '빌레몬서', 히: '히브리서', 약: '야고보서', 벧전: '베드로전서', 벧후: '베드로후서', 요일: '요한일서', 요이: '요한이서', 요삼: '요한삼서', 유: '유다서', 계: '요한계시록' };
    Object.keys(ab).forEach(function (k) { m[k] = ab[k]; });
    return m;
  })();
  // 설교 본문(scripture) 문자열에서 성경 책 이름을 추출 (예: "나훔 3:12~19" → "나훔", "레위기1:1" → "레위기")
  function bookOf(scripture) {
    var s = String(scripture == null ? '' : scripture).trim();
    var m = s.match(/^([가-힣]+)/);
    if (!m) return null;
    var tok = m[1];
    if (BOOK_ALIAS[tok]) return BOOK_ALIAS[tok];           // 전체/약어 정확 일치 우선
    for (var len = tok.length; len >= 1; len--) {           // 아니면 가장 긴 접두 별칭
      var pre = tok.slice(0, len);
      if (BOOK_ALIAS[pre]) return BOOK_ALIAS[pre];
    }
    return null;
  }
  // 성경 분류(설교 제안 — 분야가 골고루 채워지도록)
  var BIBLE_CATS = [
    { name: '모세오경', t: '구약', books: ['창세기', '출애굽기', '레위기', '민수기', '신명기'] },
    { name: '역사서', t: '구약', books: ['여호수아', '사사기', '룻기', '사무엘상', '사무엘하', '열왕기상', '열왕기하', '역대상', '역대하', '에스라', '느헤미야', '에스더'] },
    { name: '시가서', t: '구약', books: ['욥기', '시편', '잠언', '전도서', '아가'] },
    { name: '대선지서', t: '구약', books: ['이사야', '예레미야', '예레미야애가', '에스겔', '다니엘'] },
    { name: '소선지서', t: '구약', books: ['호세아', '요엘', '아모스', '오바댜', '요나', '미가', '나훔', '하박국', '스바냐', '학개', '스가랴', '말라기'] },
    { name: '복음서·사도행전', t: '신약', books: ['마태복음', '마가복음', '누가복음', '요한복음', '사도행전'] },
    { name: '바울서신', t: '신약', books: ['로마서', '고린도전서', '고린도후서', '갈라디아서', '에베소서', '빌립보서', '골로새서', '데살로니가전서', '데살로니가후서', '디모데전서', '디모데후서', '디도서', '빌레몬서'] },
    { name: '일반서신', t: '신약', books: ['히브리서', '야고보서', '베드로전서', '베드로후서', '요한일서', '요한이서', '요한삼서', '유다서'] },
    { name: '예언서', t: '신약', books: ['요한계시록'] }
  ];

  var tab = 'dashboard';
  var pendingSermon = null;   // 설교 제안에서 '이 책으로 시작' 클릭 시, 설교관리 탭이 열며 편집기 prefill
  function render() {
    root.innerHTML = '<div class="fin-tabs">' + TAB_ORDER.map(function (t) { return '<button data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><div id="afPanel"></div>';
    Array.prototype.forEach.call(root.querySelectorAll('.fin-tabs button'), function (b) {
      if (b.dataset.t === tab) b.classList.add('active');
      b.onclick = function () { if (b.dataset.t === tab) return; var prev = tab; tab = b.dataset.t; render(); pushBackClose(function () { tab = prev; render(); }); };
    });
    var p = document.getElementById('afPanel');
    if (tab === 'dashboard') renderSermonDashboard(p);
    else if (tab === 'illus') renderIllustrations(p);
    else if (tab === 'sermon') renderSermon(p);
    else if (tab === 'worship') renderSermon(p, { worship: true });
    else if (tab === 'bulletin') renderBulletinAdmin(p);
    else if (tab === 'library') renderLibrary(p);
    else if (tab === 'bible') renderBibleViewer(p);
    else if (tab === 'settings') renderSettings(p);
    else if (tab === 'edu') renderEdu(p);
    else if (tab === 'doc') renderArchive(p);
    else renderManager(p, TYPES[tab]);
  }

  // ═══════════════ 자료실 — 성도별 자료 보관·통합 관리 ═══════════════
  var ARCH_CATS = ['학습', '세례증명서', '입교', '임직', '수료증', '출석/이수', '보고서', '숙제', '과제물', '신앙고백', '추천서', '기타'];
  function renderArchive(panel) {
    panel.innerHTML = msgCard('자료실', '불러오는 중…');
    var state = { view: 'members', q: '', cat: '', sel: null };
    var FILES = [];
    function fmtBytes(n) { if (!n && n !== 0) return ''; if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(0) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; }
    function memMid(m) { return m.key || ('name:' + m.name); }
    function fileMid(f) { return f.member_key || ('name:' + (f.member_name || '')); }
    function ensureMembers() {
      if (membersLoaded && MEMBERS.length) return Promise.resolve();
      if (!window.WPF || !window.SUPABASE_URL) return Promise.resolve();
      return WPF.call('listGyojeok').then(function (r) {
        MEMBERS = (r.members || []).map(function (m) { return { name: m['이름'], key: m['매칭키'], birth: ymd(m['생년월일']), role: m['직책'] || '', group: m['그룹'] || m['소속그룹'] || '', head: m['세대주'] || '', rel: m['관계'] || '' }; }).filter(function (m) { return m.name; });
        membersLoaded = true;
      }).catch(function () { });
    }
    function load() {
      return Promise.all([ensureMembers(), api('GET', 'member_files?select=*&order=created_at.desc')]).then(function (res) { FILES = res[1] || []; });
    }
    function headerHTML(active) {
      return '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">' +
        '<h2 style="margin:0;color:var(--accent,#223350);font-size:1.2rem">🗂 자료실</h2>' +
        '<span style="color:#9aa5b1;font-size:.82rem">성도별로 학습·세례증명서·수료증·보고서·과제물 등을 보관합니다</span>' +
        '<div style="margin-left:auto;display:flex;gap:6px">' +
        '<button class="btn ' + (active === 'members' ? 'btn-solid' : 'btn-line') + '" data-v="members" style="padding:6px 13px;font-size:.85rem">성도별 보기</button>' +
        '<button class="btn ' + (active === 'all' ? 'btn-solid' : 'btn-line') + '" data-v="all" style="padding:6px 13px;font-size:.85rem">전체 목록</button>' +
        '</div></div>';
    }
    function bindHeader() { Array.prototype.forEach.call(panel.querySelectorAll('[data-v]'), function (b) { b.onclick = function () { if (b.dataset.v !== state.view) navTo(b.dataset.v, null); }; }); }
    function memberIndex() {
      var map = {};
      MEMBERS.forEach(function (m) { var id = memMid(m); map[id] = { mid: id, name: m.name, group: m.group, role: m.role, count: 0, cats: {} }; });
      FILES.forEach(function (f) { var id = fileMid(f); if (!map[id]) map[id] = { mid: id, name: f.member_name || '(이름없음)', group: '', role: '', count: 0, cats: {} }; map[id].count++; var c = f.category || '기타'; map[id].cats[c] = (map[id].cats[c] || 0) + 1; });
      return map;
    }
    function drawMembers() {
      var map = memberIndex(), rows = Object.keys(map).map(function (k) { return map[k]; });
      rows.sort(function (a, b) { if (b.count !== a.count) return b.count - a.count; return a.name.localeCompare(b.name, 'ko'); });
      panel.innerHTML = headerHTML('members') +
        '<div class="fin-card">' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px">' +
        '<input id="ar_q" placeholder="이름·구역·직책 검색" value="' + esc(state.q) + '" style="flex:1;min-width:180px;padding:8px 11px;border:1px solid #dfe5ee;border-radius:8px;font:inherit">' +
        '<button class="btn btn-line" id="ar_new" style="padding:7px 13px;font-size:.83rem">＋ 이름으로 추가</button>' +
        '<span style="color:#7b8794;font-size:.85rem">성도 ' + rows.length + '명 · 자료 ' + FILES.length + '건</span></div>' +
        '<div style="overflow:auto;max-height:60vh"><table class="fin-table"><thead><tr><th>이름</th><th>구역/부서</th><th>직책</th><th class="num">자료</th><th>분류</th><th></th></tr></thead><tbody>' +
        rows.map(function (r) {
          var cats = Object.keys(r.cats).map(function (c) { return '<span class="fin-pill" style="background:#eef2f7;color:#3a4a63">' + esc(c) + ' ' + r.cats[c] + '</span>'; }).join(' ');
          return '<tr data-mid="' + esc(r.mid) + '" data-search="' + esc((r.name + ' ' + (r.group || '') + ' ' + (r.role || '')).trim()) + '" style="cursor:pointer"><td><b>' + esc(r.name) + '</b></td><td>' + esc(r.group || '') + '</td><td>' + esc(r.role || '') + '</td><td class="num">' + (r.count || '') + '</td><td>' + cats + '</td><td style="text-align:right"><button class="btn btn-line" data-open="' + esc(r.mid) + '" style="padding:3px 10px;font-size:.8rem">열기 ›</button></td></tr>';
        }).join('') + '</tbody></table></div></div>';
      bindHeader();
      var q = panel.querySelector('#ar_q');
      if (q) q.oninput = function () { state.q = this.value; var v = this.value.trim(); Array.prototype.forEach.call(panel.querySelectorAll('tbody tr[data-mid]'), function (tr) { tr.style.display = (!v || tr.getAttribute('data-search').indexOf(v) >= 0) ? '' : 'none'; }); };
      var nb = panel.querySelector('#ar_new');
      if (nb) nb.onclick = function () { var nm = prompt('자료를 보관할 성도 이름을 입력하세요.'); if (nm && nm.trim()) { navTo('detail', 'name:' + nm.trim()); } };
      Array.prototype.forEach.call(panel.querySelectorAll('[data-mid],[data-open]'), function (el) { el.onclick = function (e) { e.stopPropagation(); navTo('detail', el.dataset.open || el.dataset.mid); }; });
    }
    function drawDetail() {
      var mid = state.sel;
      var m = MEMBERS.filter(function (x) { return memMid(x) === mid; })[0];
      var name = m ? m.name : (mid.indexOf('name:') === 0 ? mid.slice(5) : mid);
      var files = FILES.filter(function (f) { return fileMid(f) === mid; });
      panel.innerHTML = headerHTML('members') +
        '<div class="fin-card"><button class="btn btn-line" id="ar_back" style="padding:5px 12px;font-size:.82rem">‹ 성도 목록</button>' +
        '<h3 style="margin:10px 0 0;color:var(--accent,#223350)">' + esc(name) + ' <span style="font-weight:400;color:#7b8794;font-size:.86rem">' + esc(((m && m.group) || '') + ' ' + ((m && m.role) || '')).trim() + '</span></h3></div>' +
        '<div class="fin-card"><div class="fin-grid" style="align-items:end">' +
        '<div class="form-field"><label>분류</label><select id="ar_cat">' + ARCH_CATS.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
        '<div class="form-field"><label>자료 제목</label><input id="ar_title" placeholder="예: 2026 학습 수료증"></div>' +
        '<div class="form-field"><label>일자(선택)</label><input type="date" id="ar_date"></div></div>' +
        '<div id="ar_drop" style="border:2px dashed #cdd7e3;border-radius:11px;padding:18px;text-align:center;color:#5a6b82;cursor:pointer;margin-top:10px;transition:background .15s,border-color .15s">📎 파일을 여기로 <b>끌어다 놓거나</b> 클릭해서 선택 (PDF·이미지·문서 등)<input type="file" id="ar_file" style="display:none"></div>' +
        '<div class="fin-msg" id="ar_msg" style="margin-top:8px"></div></div>' +
        '<div class="fin-card"><b>보관 자료 ' + files.length + '건</b><div style="overflow:auto;margin-top:8px">' +
        (files.length ? '<table class="fin-table"><thead><tr><th>분류</th><th>제목</th><th>파일</th><th>일자</th><th class="num">크기</th><th></th></tr></thead><tbody>' +
          files.map(function (f) { return '<tr><td>' + esc(f.category || '') + '</td><td>' + esc(f.title || '') + '</td><td>' + (f.file_url ? '<a href="' + esc(f.file_url) + '" target="_blank" rel="noopener">' + esc(f.file_name || '열기') + '</a>' : '') + '</td><td style="white-space:nowrap">' + esc(ymd(f.doc_date) || ymd(f.created_at)) + '</td><td class="num">' + (f.file_size ? fmtBytes(f.file_size) : '') + '</td><td style="text-align:right"><button class="btn btn-line" data-del="' + esc(f.id) + '" style="padding:3px 9px;font-size:.78rem;color:#c0392b">삭제</button></td></tr>'; }).join('') +
          '</tbody></table>' : '<p style="color:#9aa5b1;padding:10px 2px">아직 보관된 자료가 없습니다. 위에서 파일을 올려보세요.</p>') + '</div></div>';
      bindHeader();
      panel.querySelector('#ar_back').onclick = function () { history.back(); };
      function doUpload(file) {
        var msg = panel.querySelector('#ar_msg');
        if (!file) return;
        if (!(window.ChurchUpload && ChurchUpload.isReady())) { msg.style.color = '#c0392b'; msg.textContent = '업로드 서버가 설정되지 않았습니다.'; return; }
        var cat = panel.querySelector('#ar_cat').value;
        var title = panel.querySelector('#ar_title').value.trim() || file.name.replace(/\.[^.]+$/, '');
        var dt = panel.querySelector('#ar_date').value || null;
        msg.style.color = '#7b8794'; msg.textContent = '⬆ 업로드 중… ' + file.name;
        ChurchUpload.upload(file, { folder: 'archive', compress: false }).then(function (res) {
          var data = { member_key: (m && m.key) || null, member_name: name, category: cat, title: title, file_url: res.url, file_key: res.key || null, file_name: file.name, file_size: file.size || null, doc_date: dt };
          return api('POST', 'member_files', data, 'return=representation');
        }).then(function (rows) {
          if (rows && rows[0]) FILES.unshift(rows[0]);
          msg.style.color = 'green'; msg.textContent = '✓ ' + name + ' — ' + cat + ' 자료를 보관했습니다.';
          drawDetail();
        }).catch(function (e) { msg.style.color = '#c0392b'; msg.textContent = /42P01|does not exist|schema cache|Could not find/i.test(e.message || '') ? '자료실 준비 필요 — supabase/member_files.sql 을 1회 실행해 주세요.' : ('업로드 실패: ' + (e.message || e)); });
      }
      var drop = panel.querySelector('#ar_drop'), fi = panel.querySelector('#ar_file');
      if (drop && fi) {
        drop.onclick = function () { fi.click(); };
        fi.onchange = function () { if (fi.files && fi.files[0]) doUpload(fi.files[0]); fi.value = ''; };
        ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); drop.style.background = '#eef5ff'; drop.style.borderColor = '#7fa3d8'; }); });
        ['dragleave', 'dragend'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); drop.style.background = ''; drop.style.borderColor = '#cdd7e3'; }); });
        drop.addEventListener('drop', function (e) { e.preventDefault(); e.stopPropagation(); drop.style.background = ''; drop.style.borderColor = '#cdd7e3'; var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) doUpload(f); });
      }
      Array.prototype.forEach.call(panel.querySelectorAll('[data-del]'), function (b) { b.onclick = function () { delFile(b.dataset.del); }; });
    }
    function delFile(id) {
      var f = FILES.filter(function (x) { return String(x.id) === String(id); })[0];
      if (!confirm('이 자료를 삭제할까요? 되돌릴 수 없습니다.')) return;
      api('DELETE', 'member_files?id=eq.' + id).then(function () {
        FILES = FILES.filter(function (x) { return String(x.id) !== String(id); });
        if (f && f.file_key && window.ChurchUpload && ChurchUpload.remove) { try { ChurchUpload.remove(f.file_key); } catch (e) { } }
        draw();
      }).catch(function (e) { alert('삭제 실패: ' + (e.message || e)); });
    }
    function drawAll() {
      var q = state.q.trim(), cat = state.cat;
      var list = FILES.slice();
      if (cat) list = list.filter(function (f) { return (f.category || '') === cat; });
      panel.innerHTML = headerHTML('all') +
        '<div class="fin-card"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px">' +
        '<input id="ar_q" placeholder="이름·제목·분류 검색" value="' + esc(state.q) + '" style="flex:1;min-width:160px;padding:8px 11px;border:1px solid #dfe5ee;border-radius:8px;font:inherit">' +
        '<select id="ar_catf" style="padding:8px;border:1px solid #dfe5ee;border-radius:8px;font:inherit"><option value="">전체 분류</option>' + ARCH_CATS.map(function (c) { return '<option' + (c === cat ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
        '<span style="color:#7b8794;font-size:.85rem">' + list.length + '건</span></div>' +
        '<div style="overflow:auto;max-height:62vh"><table class="fin-table"><thead><tr><th>이름</th><th>분류</th><th>제목</th><th>파일</th><th>일자</th><th></th></tr></thead><tbody>' +
        list.map(function (f) { return '<tr data-search="' + esc(((f.member_name || '') + ' ' + (f.title || '') + ' ' + (f.category || '')).trim()) + '"><td><b>' + esc(f.member_name || '') + '</b></td><td>' + esc(f.category || '') + '</td><td>' + esc(f.title || '') + '</td><td>' + (f.file_url ? '<a href="' + esc(f.file_url) + '" target="_blank" rel="noopener">' + esc(f.file_name || '열기') + '</a>' : '') + '</td><td style="white-space:nowrap">' + esc(ymd(f.doc_date) || ymd(f.created_at)) + '</td><td style="text-align:right"><button class="btn btn-line" data-del="' + esc(f.id) + '" style="padding:3px 9px;font-size:.78rem;color:#c0392b">삭제</button></td></tr>'; }).join('') +
        '</tbody></table></div></div>';
      bindHeader();
      var q2 = panel.querySelector('#ar_q');
      if (q2) q2.oninput = function () { state.q = this.value; var v = this.value.trim(); Array.prototype.forEach.call(panel.querySelectorAll('tbody tr[data-search]'), function (tr) { tr.style.display = (!v || tr.getAttribute('data-search').indexOf(v) >= 0) ? '' : 'none'; }); };
      var cf = panel.querySelector('#ar_catf'); if (cf) cf.onchange = function () { state.cat = this.value; drawAll(); };
      Array.prototype.forEach.call(panel.querySelectorAll('[data-del]'), function (b) { b.onclick = function () { delFile(b.dataset.del); }; });
    }
    function draw() { if (state.view === 'detail') return drawDetail(); if (state.view === 'all') return drawAll(); return drawMembers(); }
    // 자료실 내부 화면 전환은 히스토리에 남겨, 브라우저 '뒤로'가 바로 이전 화면(성도목록)으로 가게 한다
    // (안 그러면 상세에서 뒤로 시 목회행정 첫 탭으로 튐)
    function navTo(view, sel) {
      var pv = state.view, ps = state.sel;
      state.view = view; state.sel = (sel === undefined ? null : sel);
      draw();
      pushBackClose(function () { state.view = pv; state.sel = ps; draw(); });
    }
    load().then(draw).catch(function (e) {
      panel.innerHTML = /42P01|PGRST205|does not exist|schema cache|Could not find the table/i.test(e.message || '') ? msgCard('자료실 준비 필요', 'Supabase ▸ SQL Editor 에서 supabase/member_files.sql 을 1회 실행해 주세요.') : msgCard('불러오기 실패', (e && e.message) || '자료를 불러오지 못했습니다.');
    });
  }

  function fieldHTML(f, val) {
    var v = val == null ? '' : val;
    var inner;
    if (f.type === 'select') inner = '<select data-k="' + f.k + '"><option value="">선택</option>' + f.opts.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
    else if (f.type === 'textarea') inner = '<textarea data-k="' + f.k + '" placeholder="' + esc(f.ph || '') + '">' + esc(v) + '</textarea>';
    else if (f.type === 'check') inner = '<label class="sw" style="display:inline-flex;align-items:center;gap:6px;margin-top:6px"><input type="checkbox" data-k="' + f.k + '"' + (v ? ' checked' : '') + '> 예</label>';
    else if (f.type === 'file') inner = '<div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap"><input type="hidden" data-k="' + f.k + '" value="' + esc(v) + '"><button type="button" class="btn btn-line af-file" data-for="' + f.k + '" style="padding:5px 11px;font-size:.82rem">📎 ' + (v ? '파일 교체' : '파일 선택') + '</button><a class="af-file-link" data-for="' + f.k + '" href="' + esc(v || '#') + '" target="_blank" rel="noopener" style="font-size:.8rem;' + (v ? '' : 'display:none') + '">열기</a></div>';
    else inner = '<input type="' + (f.type === 'date' ? 'date' : 'text') + '" data-k="' + f.k + '" value="' + esc(v) + '" placeholder="' + esc(f.ph || '') + '">';
    return '<div class="af-field' + (f.full ? ' full' : '') + '" style="' + (f.full ? 'grid-column:1/-1' : '') + '"><label>' + esc(f.label) + '</label>' + inner + '</div>';
  }

  function collect(formEl, type) {
    var rec = {};
    type.fields.forEach(function (f) {
      var el = formEl.querySelector('[data-k="' + f.k + '"]');
      if (!el) return;
      if (f.type === 'check') rec[f.k] = !!el.checked;
      else rec[f.k] = el.value.trim() === '' ? null : el.value.trim();
    });
    return rec;
  }

  // 대상자 입력에 교적 자동완성 + 매칭키(관계) 연결을 부착
  function setupMemberLink(form) {
    var input = form.querySelector('[data-k="member_name"]');
    if (!input) return { clear: function () {}, setByKey: function () {} };
    input.setAttribute('autocomplete', 'off');
    var field = input.closest('.af-field'); if (field) field.style.position = 'relative';
    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:.78rem;margin-top:5px;min-height:1.1em;';
    if (field) field.appendChild(hint);
    var pop = null, hi = -1, matches = [];
    function close() { if (pop) { pop.remove(); pop = null; hi = -1; } }
    function showHint(m) {
      if (m) { var line = memberLine(m); hint.style.color = '#1e874b'; hint.innerHTML = '🔗 교적 연결: <b>' + esc(m.name) + '</b>' + (line ? ' <span style="color:#5b6b7d">· ' + esc(line) + '</span>' : ''); }
      else if (input.value.trim()) { hint.style.color = '#9aa5b1'; hint.innerHTML = '교적 미연결 — 이름만 저장됩니다(검색해서 연결 권장).'; }
      else { hint.innerHTML = ''; }
    }
    function setKey(m) { input.dataset.memberKey = (m && m.key) || ''; showHint(m); }
    function pick(m) { input.value = m.name; close(); setKey(m); setTimeout(function () { var nx = form.querySelector('[data-k="category"]'); if (nx) nx.focus(); }, 0); }
    input.addEventListener('input', function () {
      input.dataset.memberKey = ''; var q = input.value.trim().toLowerCase(); close(); showHint(null);
      if (!q || !MEMBERS.length) return;
      matches = MEMBERS.filter(function (m) { return (m.name || '').toLowerCase().indexOf(q) >= 0; }).slice(0, 8);
      if (!matches.length) return;
      pop = document.createElement('div'); pop.className = 'fin-sugg';
      matches.forEach(function (m) {
        var d = document.createElement('div'); var line = memberLine(m);
        d.innerHTML = esc(m.name) + (line ? ' <span style="color:#9aa5b1;font-size:.78rem">' + esc(line) + '</span>' : '');
        d.onclick = function () { pick(m); };
        pop.appendChild(d);
      });
      if (field) field.appendChild(pop);
    });
    input.addEventListener('keydown', function (e) {
      if (!pop) return; var rows = pop.querySelectorAll('div');
      if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hi + 1, rows.length - 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(hi - 1, 0); }
      else if (e.key === 'Enter') { if (matches.length) { e.preventDefault(); pick(matches[hi >= 0 ? hi : 0]); } return; }
      else if (e.key === 'Escape') { close(); return; }
      else return;
      Array.prototype.forEach.call(rows, function (r, i) { r.classList.toggle('hi', i === hi); });
    });
    input.addEventListener('blur', function () { setTimeout(close, 180); });
    return {
      clear: function () { input.dataset.memberKey = ''; hint.innerHTML = ''; close(); },
      setByKey: function (key, name) {
        if (name != null) input.value = name;
        input.dataset.memberKey = key || '';
        var m = findMember(key);
        if (m) showHint(m);
        else if (key) { hint.style.color = '#1e874b'; hint.innerHTML = '🔗 교적 연결됨'; }
        else showHint(null);
      }
    };
  }

  function renderManager(panel, type) {
    panel.innerHTML =
      '<div class="fin-card"><h3 style="margin:0 0 12px;color:var(--accent,#223350)">' + type.name + ' 기록 추가</h3>' +
      '<form id="afForm"><div class="fin-grid">' + type.fields.map(function (f) { return fieldHTML(f, f.type === 'date' ? today() : ''); }).join('') + '</div>' +
      '<div style="margin-top:14px;display:flex;gap:10px;align-items:center"><button type="submit" class="btn btn-solid" id="af_save">＋ 추가</button><button type="button" class="btn btn-line" id="af_reset" style="display:none">취소</button><span class="fin-msg" id="af_msg"></span></div></form></div>' +
      '<div id="afList"><p class="qt-loading">불러오는 중…</p></div>';

    var form = panel.querySelector('#afForm');
    var msg = panel.querySelector('#af_msg');
    var resetBtn = panel.querySelector('#af_reset');
    var linkCtl = setupMemberLink(form);
    var hasMember = type.fields.some(function (f) { return f.k === 'member_name'; });
    var editId = null;
    function syncFiles() { Array.prototype.forEach.call(form.querySelectorAll('.af-file-link'), function (lk) { var hid = form.querySelector('input[type="hidden"][data-k="' + lk.dataset.for + '"]'); var u = hid ? hid.value : ''; lk.href = u || '#'; lk.style.display = u ? '' : 'none'; var btn = form.querySelector('.af-file[data-for="' + lk.dataset.for + '"]'); if (btn) btn.textContent = '📎 ' + (u ? '파일 교체' : '파일 선택'); }); }
    function clearForm() {
      editId = null; resetBtn.style.display = 'none'; panel.querySelector('#af_save').textContent = '＋ 추가';
      type.fields.forEach(function (f) { var el = form.querySelector('[data-k="' + f.k + '"]'); if (!el) return; if (f.type === 'check') el.checked = false; else el.value = (f.type === 'date') ? today() : ''; });
      linkCtl.clear(); syncFiles();
    }
    resetBtn.onclick = clearForm;
    // 파일 업로드(R2)
    Array.prototype.forEach.call(form.querySelectorAll('.af-file'), function (btn) {
      btn.onclick = function () {
        if (!(window.ChurchUpload && ChurchUpload.isReady())) { msg.style.color = '#c0392b'; msg.textContent = '업로드 서버가 설정되지 않았습니다.'; return; }
        var fi = document.createElement('input'); fi.type = 'file';
        fi.onchange = function () {
          var f = fi.files && fi.files[0]; if (!f) return;
          var old = btn.textContent; btn.textContent = '업로드 중…'; btn.disabled = true;
          ChurchUpload.upload(f, { folder: 'affairs/' + type.table, compress: false }).then(function (res) {
            var hid = form.querySelector('input[type="hidden"][data-k="' + btn.dataset.for + '"]'); if (hid) hid.value = res.url;
            btn.disabled = false; syncFiles();
          }).catch(function (e) { btn.disabled = false; btn.textContent = old; msg.style.color = '#c0392b'; msg.textContent = '업로드 실패: ' + e.message; });
        };
        fi.click();
      };
    });
    form.onsubmit = function (e) {
      e.preventDefault();
      var rec = collect(form, type);
      var nme = form.querySelector('[data-k="member_name"]');
      if (hasMember) { rec.member_key = (nme && nme.dataset.memberKey) ? nme.dataset.memberKey : null; } // 교적 매칭키(관계 연결)
      if (!rec[type.dateCol] || (hasMember && !rec.member_name)) { msg.style.color = '#c0392b'; msg.textContent = hasMember ? '일자와 대상자는 필수입니다.' : '일자는 필수입니다.'; return; }
      msg.style.color = '#7b8794'; msg.textContent = '저장 중…';
      var p = editId
        ? api('PATCH', type.table + '?id=eq.' + editId, rec, 'return=minimal')
        : api('POST', type.table, rec, 'return=minimal');
      p.then(function () { msg.style.color = 'green'; msg.textContent = '✓ 저장되었습니다'; clearForm(); loadList(); setTimeout(function () { msg.textContent = ''; }, 2500); })
        .catch(function (err) { msg.style.color = '#c0392b'; msg.textContent = '저장 실패: ' + err.message; });
    };

    var listBox = panel.querySelector('#afList');
    function loadList() {
      api('GET', type.table + '?select=*&order=' + type.dateCol + '.desc,created_at.desc').then(function (rows) {
        rows = rows || [];
        if (!rows.length) { listBox.innerHTML = '<div class="fin-card"><p style="color:var(--ink-soft);margin:0">등록된 ' + type.name + ' 기록이 없습니다.</p></div>'; return; }
        var byId = {}; rows.forEach(function (r) { byId[r.id] = r; });
        listBox.innerHTML = '<div class="fin-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b>' + type.name + ' 기록 (' + rows.length + '건)</b><button class="btn btn-line" style="padding:4px 12px;font-size:.8rem" data-bulk>🗑 선택 삭제</button></div><div style="overflow:auto"><table class="fin-table"><thead><tr><th style="width:28px;text-align:center"><input type="checkbox" data-all></th>' +
          type.cols.map(function (c) { return '<th>' + esc(c[1]) + '</th>'; }).join('') + '<th>관리</th></tr></thead><tbody>' +
          rows.map(function (r) {
            return '<tr><td style="text-align:center"><input type="checkbox" class="rowck" value="' + esc(r.id) + '"></td>' +
              type.cols.map(function (c) {
                var k = c[0], val = r[k];
                if (k === type.dateCol) return '<td style="white-space:nowrap">' + esc(fmtD(val)) + '</td>';
                if (k === 'member_name') { var mm = findMember(r.member_key); var badge = mm ? ' <span class="fin-pill" style="background:#e8f6ee;color:#1e874b">🔗 ' + esc(mm.role || mm.group || '교적') + '</span>' : (r.member_key ? ' <span class="fin-pill" style="background:#e8f6ee;color:#1e874b">🔗</span>' : ''); return '<td style="white-space:nowrap">' + esc(val || '') + badge + '</td>'; }
                if (k === 'category') return '<td><span class="fin-pill">' + esc(val || '') + '</span></td>';
                if (k === 'content') return '<td style="max-width:320px;white-space:normal;color:#48576b">' + nl2br(String(val || '').slice(0, 140)) + (String(val || '').length > 140 ? '…' : '') + (r.is_private ? ' <span class="fin-pill" style="background:#fdecea;color:#c0392b">비공개</span>' : '') + '</td>';
                if (/url$/.test(k)) return '<td style="white-space:nowrap">' + (val ? '<a href="' + esc(val) + '" target="_blank" rel="noopener">📎 열기</a>' : '') + '</td>';
                return '<td style="white-space:nowrap">' + esc(val || '') + '</td>';
              }).join('') +
              '<td style="white-space:nowrap"><button class="btn btn-line" style="padding:3px 9px;font-size:.78rem" data-edit="' + esc(r.id) + '">수정</button> <button class="btn btn-line" style="padding:3px 9px;font-size:.78rem" data-del="' + esc(r.id) + '">삭제</button></td></tr>';
          }).join('') + '</tbody></table></div></div>';

        // 전체선택 + 일괄삭제
        var allck = listBox.querySelector('[data-all]');
        if (allck) allck.onclick = function () { Array.prototype.forEach.call(listBox.querySelectorAll('.rowck'), function (c) { c.checked = allck.checked; }); };
        listBox.querySelector('[data-bulk]').onclick = function () {
          var ids = Array.prototype.map.call(listBox.querySelectorAll('.rowck:checked'), function (c) { return c.value; });
          if (!ids.length) { alert('선택된 항목이 없습니다.'); return; }
          if (!confirm('선택한 ' + ids.length + '건을 삭제할까요?')) return;
          api('DELETE', type.table + '?id=in.(' + ids.join(',') + ')', null, 'return=minimal').then(loadList).catch(function (e) { alert('삭제 실패: ' + e.message); });
        };
        // 개별 수정/삭제
        Array.prototype.forEach.call(listBox.querySelectorAll('[data-edit]'), function (b) {
          b.onclick = function () {
            var r = byId[b.dataset.edit]; if (!r) return;
            editId = r.id; resetBtn.style.display = ''; panel.querySelector('#af_save').textContent = '저장(수정)';
            type.fields.forEach(function (f) { var el = form.querySelector('[data-k="' + f.k + '"]'); if (!el) return; if (f.type === 'check') el.checked = !!r[f.k]; else el.value = (f.type === 'date') ? fmtD(r[f.k]) : (r[f.k] == null ? '' : r[f.k]); });
            linkCtl.setByKey(r.member_key, r.member_name); syncFiles();
            panel.scrollIntoView({ behavior: 'smooth' });
          };
        });
        Array.prototype.forEach.call(listBox.querySelectorAll('[data-del]'), function (b) {
          b.onclick = function () { if (!confirm('삭제할까요?')) return; api('DELETE', type.table + '?id=eq.' + b.dataset.del, null, 'return=minimal').then(loadList).catch(function (e) { alert('삭제 실패: ' + e.message); }); };
        });
      }).catch(function (e) {
        if (/relation .* does not exist|42P01|PGRST205|schema cache|Could not find the table/i.test(e.message)) listBox.innerHTML = msgCard('테이블 준비 필요', 'Supabase → SQL Editor 에서 supabase/affairs.sql (심방·상담) 및 supabase/affairs_modules.sql (교육·설교·문서) 을 1회 실행해 주세요.');
        else listBox.innerHTML = msgCard('조회 실패', e.message);
      });
    }
    loadList();
  }

  // ── 설교관리(전용): 작성 페이지 · 도구상자 · 내보내기 · 아이패드 보기 ──
  var SERMON_TOOLS = [
    { label: '📖 성경본문', url: 'https://bible.goodtv.co.kr/' }
  ];
  function hymnTitle(n) { var H = window.HYMNS; if (H) { n = Number(n); for (var i = 0; i < H.length; i++) if (H[i].no === n) return H[i].title || ''; } return ''; }
  // ── 모달 뒤로가기 처리 ───────────────────────────────────────────────
  // 모달을 열 때 history 항목을 하나 쌓아, 브라우저/안드로이드 '뒤로가기'가
  // 사이트를 벗어나지 않고 "맨 위 모달만" 닫도록 한다(중첩 모달은 LIFO 순서).
  // 닫기 버튼·완료 등도 반환된 close() 로 통일하면, 우리가 넣은 history 항목이
  // 직접 닫기/뒤로가기 어느 쪽이든 정확히 한 번만 제거된다.
  var _wpcModalClosers = [];            // 열린 모달들의 teardown 스택(LIFO)
  var _wpcPopBound = false;
  function _wpcOnPop() { var fn = _wpcModalClosers.pop(); if (fn) fn(); }
  function pushBackClose(teardown) {
    if (!_wpcPopBound) { window.addEventListener('popstate', _wpcOnPop); _wpcPopBound = true; }
    _wpcModalClosers.push(teardown);
    history.pushState({ _wpcModal: 1 }, '');
    return function close() {
      if (_wpcModalClosers.indexOf(teardown) < 0) return;  // 이미 닫힘 → 무시
      history.back();   // → popstate → _wpcOnPop → 이 모달 teardown 실행
    };
  }

  // 찬송가 검색 선택기(번호·제목, 복수 선택) — 숫자만 입력해도 바로 검색
  function hymnPicker(initial, onDone) {
    var HY = window.HYMNS || [];
    var sel = {}; (initial || []).forEach(function (n) { n = Number(n); if (n) sel[n] = 1; });
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,25,.5);z-index:9500;display:flex;align-items:flex-start;justify-content:center;padding:24px 14px;overflow:auto';
    ov.innerHTML = '<div class="fin-card" style="max-width:560px;width:100%;background:#fff">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0;color:var(--accent,#223350)">🎵 찬송가 선택 (복수 선택)</h3><button class="btn btn-line" id="hp_close" style="padding:3px 11px">닫기</button></div>' +
      '<input type="text" id="hp_q" placeholder="🔍 번호 또는 제목 검색 (숫자만 입력해도 바로 검색)" style="width:100%;padding:9px 11px;border:1px solid #dfe5ee;border-radius:8px;font:inherit;margin-bottom:8px">' +
      '<div id="hp_sel" style="margin-bottom:8px;min-height:26px"></div>' +
      '<div id="hp_list" style="max-height:340px;overflow:auto;border:1px solid #eef1f5;border-radius:8px"></div>' +
      '<div style="margin-top:12px;display:flex;gap:8px;align-items:center;justify-content:flex-end"><button class="btn btn-solid" id="hp_done" style="padding:8px 18px">선택 완료</button></div></div>';
    document.body.appendChild(ov);
    var close = pushBackClose(function () { ov.remove(); });
    ov.querySelector('#hp_close').onclick = close;
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    var selBox = ov.querySelector('#hp_sel'), listEl = ov.querySelector('#hp_list'), qEl = ov.querySelector('#hp_q');
    function nums() { return Object.keys(sel).map(Number).sort(function (a, b) { return a - b; }); }
    function drawSel() {
      var ns = nums();
      selBox.innerHTML = ns.length ? ns.map(function (n) { return '<span class="hp-chip" data-n="' + n + '" style="display:inline-flex;align-items:center;gap:5px;background:#e7f0ff;color:#1f3a5f;border-radius:999px;padding:3px 10px;margin:0 5px 5px 0;font-size:.84rem;font-weight:700">' + n + '장' + (hymnTitle(n) ? ' <span style="font-weight:400">' + esc(hymnTitle(n)) + '</span>' : '') + ' <b style="cursor:pointer;color:#c0392b">✕</b></span>'; }).join('') : '<span style="font-size:.84rem;color:#9aa5b1">아직 선택한 찬송가가 없습니다. 위에서 검색해 고르세요.</span>';
      Array.prototype.forEach.call(selBox.querySelectorAll('.hp-chip b'), function (x) { x.onclick = function () { delete sel[Number(x.parentNode.dataset.n)]; drawSel(); drawList(qEl.value); }; });
    }
    function drawList(q) {
      q = (q || '').trim().toLowerCase();
      var rows = HY.filter(function (h) { return !q || String(h.no).indexOf(q) >= 0 || (h.title || '').toLowerCase().indexOf(q) >= 0; }).slice(0, 400);
      listEl.innerHTML = rows.length ? rows.map(function (h) { return '<div class="hp-item" data-n="' + h.no + '" style="padding:8px 11px;border-bottom:1px solid #f0f0f0;cursor:pointer;display:flex;align-items:center;gap:8px;background:' + (sel[h.no] ? '#eef4ff' : '#fff') + '"><span style="flex:0 0 48px;font-weight:700;color:' + (sel[h.no] ? '#1f3a5f' : '#7b8794') + '">' + h.no + '장</span><span>' + esc(h.title || '') + '</span>' + (sel[h.no] ? '<span style="margin-left:auto;color:#1e874b">✓</span>' : '') + '</div>'; }).join('') : '<p style="padding:10px;color:#9aa5b1">결과 없음</p>';
      Array.prototype.forEach.call(listEl.querySelectorAll('.hp-item'), function (d) { d.onclick = function () { var n = Number(d.dataset.n); if (sel[n]) delete sel[n]; else sel[n] = 1; drawSel(); drawList(qEl.value); }; });
    }
    qEl.oninput = function () { drawList(this.value); };
    qEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); var q = qEl.value.trim(); if (/^\d+$/.test(q)) { var n = Number(q); if (n >= 1 && n <= 645) { sel[n] = 1; qEl.value = ''; drawSel(); drawList(''); } } } });
    ov.querySelector('#hp_done').onclick = function () { if (onDone) onDone(nums()); close(); };
    drawSel(); drawList('');
    setTimeout(function () { qEl.focus(); }, 40);
  }
  function hymnsLabel(s) { var a = String(s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); return a.map(function (n) { var t = hymnTitle(n); return n + '장' + (t ? ' ' + t : ''); }).join(' · '); }
  // 교독문 본문을 인도자/회중/다같이 역할로 렌더
  function gyodokBodyHTML(body) {
    var lead = true;
    return (body || []).map(function (line) {
      if (/다같이/.test(line.slice(0, 8))) return '<div style="text-align:center;font-weight:600;color:#1f3a5f;margin:5px 0">' + esc(line) + '</div>';
      var role = lead ? '인도자' : '회중'; lead = !lead;
      return '<div style="margin:3px 0;display:flex;gap:8px"><span style="flex:0 0 46px;color:#9aa5b1;font-size:.76rem;padding-top:2px">' + role + '</span><span>' + esc(line) + '</span></div>';
    }).join('');
  }
  // 교독문 선택기(목록·검색·미리보기). 선택은 localStorage 에 저장(차후 예배 콘티에 자동 삽입).
  function gyodokPicker(onPick) {
    if (!window.GYODOK || !window.GYODOK.length) { alert('교독문 데이터를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.'); return; }
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,25,.5);z-index:9500;display:flex;align-items:flex-start;justify-content:center;padding:24px 14px;overflow:auto';
    ov.innerHTML = '<div class="fin-card" style="max-width:760px;width:100%;background:#fff">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0;color:var(--accent,#223350)">📜 교독문 선택</h3><button class="btn btn-line" id="gp_close" style="padding:3px 11px">닫기</button></div>' +
      '<input type="text" id="gp_q" placeholder="🔍 번호·제목 검색 (예: 시편 23, 성탄)" style="width:100%;padding:8px 11px;border:1px solid #dfe5ee;border-radius:8px;font:inherit;margin-bottom:10px">' +
      '<div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">' +
      '<div id="gp_list" style="flex:0 0 230px;max-width:100%;max-height:430px;overflow:auto;border:1px solid #eef1f5;border-radius:8px"></div>' +
      '<div style="flex:1;min-width:240px"><div id="gp_prev" style="max-height:390px;overflow:auto;border:1px solid #eef1f5;border-radius:8px;padding:12px;color:#48576b;font-size:.92rem">왼쪽에서 교독문을 선택하세요.</div>' +
      '<div style="margin-top:10px;display:flex;gap:8px;align-items:center"><button class="btn btn-solid" id="gp_pick" disabled style="padding:8px 16px">이 교독문 선택</button><span id="gp_msg" style="font-size:.84rem;color:#7b8794"></span></div></div>' +
      '</div></div>';
    document.body.appendChild(ov);
    var sel = null;
    var close = pushBackClose(function () { ov.remove(); });
    ov.querySelector('#gp_close').onclick = close;
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    var listEl = ov.querySelector('#gp_list'), prevEl = ov.querySelector('#gp_prev'), pickBtn = ov.querySelector('#gp_pick');
    function drawList(q) {
      q = (q || '').trim().toLowerCase();
      var rows = window.GYODOK.filter(function (g) { return !q || (g.no + '. ' + g.title).toLowerCase().indexOf(q) >= 0; });
      listEl.innerHTML = rows.map(function (g) { return '<div class="gp-item" data-no="' + g.no + '" style="padding:8px 11px;border-bottom:1px solid #f0f0f0;cursor:pointer;font-size:.9rem"><b>' + g.no + '.</b> ' + esc(g.title) + '</div>'; }).join('') || '<p style="padding:10px;color:#9aa5b1">결과 없음</p>';
      Array.prototype.forEach.call(listEl.querySelectorAll('.gp-item'), function (d) {
        d.onclick = function () {
          var g = window.GYODOK.filter(function (x) { return x.no === Number(d.dataset.no); })[0]; if (!g) return;
          sel = g; pickBtn.disabled = false;
          Array.prototype.forEach.call(listEl.querySelectorAll('.gp-item'), function (x) { x.style.background = ''; });
          d.style.background = '#eef4ff';
          prevEl.innerHTML = '<div style="font-weight:700;color:var(--accent,#223350);margin-bottom:8px">' + g.no + '. ' + esc(g.title) + '</div>' + gyodokBodyHTML(g.body);
        };
      });
    }
    ov.querySelector('#gp_q').oninput = function () { drawList(this.value); };
    pickBtn.onclick = function () {
      if (!sel) return;
      try { localStorage.setItem('wpc_sel_gyodok', JSON.stringify({ no: sel.no, title: sel.title })); } catch (e) {}
      if (onPick) onPick(sel);
      close();
    };
    drawList('');
  }
  function selectedGyodok() { try { return JSON.parse(localStorage.getItem('wpc_sel_gyodok') || 'null'); } catch (e) { return null; } }
  var SVC_OPTS = ['주일 낮 예배', '주일 밤 예배', '수요기도회', '금요기도회', '새벽기도', '매일 QT', '특별집회', '기타'];

  // 고정 전례문(설교 큐시트 자동 펼침용)
  var APOSTLES_CREED = ['전능하사 천지를 만드신 하나님 아버지를 내가 믿사오며,', '그 외아들 우리 주 예수 그리스도를 믿사오니,', '이는 성령으로 잉태하사 동정녀 마리아에게 나시고,', '본디오 빌라도에게 고난을 받으사, 십자가에 못 박혀 죽으시고, 장사한 지 사흘 만에 죽은 자 가운데서 다시 살아나시며,', '하늘에 오르사, 전능하신 하나님 우편에 앉아 계시다가,', '저리로서 산 자와 죽은 자를 심판하러 오시리라.', '성령을 믿사오며, 거룩한 공회와, 성도가 서로 교통하는 것과,', '죄를 사하여 주시는 것과, 몸이 다시 사는 것과, 영원히 사는 것을 믿사옵나이다. 아멘.'];
  var LORDS_PRAYER = ['하늘에 계신 우리 아버지여 이름이 거룩히 여김을 받으시오며', '나라가 임하시오며 뜻이 하늘에서 이루어진 것 같이 땅에서도 이루어지이다', '오늘 우리에게 일용할 양식을 주시옵고', '우리가 우리에게 죄 지은 자를 사하여 준 것 같이 우리 죄를 사하여 주시옵고', '우리를 시험에 들게 하지 마시옵고 다만 악에서 구하시옵소서', '대개 나라와 권세와 영광이 아버지께 영원히 있사옵나이다 아멘.'];
  function gyodokByNo(no) { if (!window.GYODOK) return null; for (var i = 0; i < window.GYODOK.length; i++) if (window.GYODOK[i].no === Number(no)) return window.GYODOK[i]; return null; }

  // ── 설교 대시보드: 통계 + 성경 권별 커버리지 ──
  function renderSermonDashboard(panel) {
    panel.innerHTML = '<div class="fin-card" style="text-align:center;padding:34px"><p class="qt-loading">설교 데이터를 불러오는 중…</p></div>';
    api('GET', 'sermons?select=sermon_date,service,title,scripture,content,file_url,media_url&order=sermon_date.desc')
      .then(function (rows) { draw(rows || []); })
      .catch(function (e) { panel.innerHTML = msgCard('불러오기 실패', (e && e.message) || '설교 데이터를 불러오지 못했습니다.'); });

    function draw(rows) {
      var now = new Date(), yr = now.getFullYear(), ym = yr + '-' + pad2(now.getMonth() + 1);
      var total = rows.length, thisYear = 0, thisMonth = 0;
      var bySvc = {}, cover = {}, coverList = {};
      rows.forEach(function (r) {
        var d = String(r.sermon_date || '');
        if (d.slice(0, 4) === String(yr)) thisYear++;
        if (d.slice(0, 7) === ym) thisMonth++;
        var s = r.service || '기타'; bySvc[s] = (bySvc[s] || 0) + 1;
        var b = bookOf(r.scripture); if (b) { cover[b] = (cover[b] || 0) + 1; (coverList[b] = coverList[b] || []).push(r); }
      });
      var otDone = BIBLE_OT.filter(function (n) { return cover[n]; }).length;
      var ntDone = BIBLE_NT.filter(function (n) { return cover[n]; }).length;
      var covDone = otDone + ntDone, covTotal = BIBLE_OT.length + BIBLE_NT.length;
      var pct = covTotal ? Math.round(covDone / covTotal * 100) : 0;

      function statCard(label, value, sub, accent) {
        return '<div class="fin-card" style="margin:0;padding:16px 18px">' +
          '<div style="font-size:.8rem;color:var(--ink-soft,#7b8794);font-weight:600">' + esc(label) + '</div>' +
          '<div style="font-size:1.85rem;font-weight:800;color:' + (accent || 'var(--accent,#223350)') + ';line-height:1.1;margin-top:4px">' + esc(String(value)) + '</div>' +
          (sub ? '<div style="font-size:.75rem;color:#9aa5b1;margin-top:3px">' + esc(sub) + '</div>' : '') + '</div>';
      }

      var svcArr = Object.keys(bySvc).map(function (k) { return [k, bySvc[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
      var svcMax = svcArr.length ? svcArr[0][1] : 1;
      var svcHTML = svcArr.map(function (x) {
        var w = Math.round(x[1] / svcMax * 100);
        return '<div style="display:flex;align-items:center;gap:10px;margin:6px 0">' +
          '<div class="svc-label" data-svc="' + esc(x[0]) + '" style="flex:0 0 96px;font-size:.84rem;color:#3a4a63;font-weight:600;text-align:right;cursor:pointer;text-decoration:underline;text-decoration-color:#cdd7e3;text-underline-offset:3px">' + esc(x[0]) + '</div>' +
          '<div style="flex:1;background:#eef2f7;border-radius:6px;height:16px;overflow:hidden"><div style="width:' + w + '%;height:100%;background:linear-gradient(90deg,#3a6db5,#223350)"></div></div>' +
          '<div style="flex:0 0 42px;font-size:.82rem;font-weight:700;color:#3a4a63">' + x[1] + '편</div></div>';
      }).join('') || '<p style="color:#9aa5b1;font-size:.86rem">아직 설교 기록이 없습니다.</p>';

      function cells(list, isNT) {
        return list.map(function (n) {
          var c = cover[n] || 0, on = c > 0;
          return '<div class="cov-cell' + (on ? ' on' : '') + (isNT ? ' cov-nt' : '') + '"' + (on ? ' data-book="' + esc(n) + '" title="' + esc(n) + ' · ' + c + '편 — 클릭해서 목록 보기"' : ' title="' + esc(n) + ' · 미설교"') + '><span class="cov-nm">' + esc(n) + '</span><span class="cov-ct">' + (on ? c : '·') + '</span></div>';
        }).join('');
      }

      var recent = rows.slice(0, 6).map(function (r, i) {
        return '<div style="display:flex;gap:10px;align-items:baseline;padding:7px 0;border-bottom:1px solid #f0f0f0">' +
          '<div style="flex:0 0 84px;font-size:.8rem;color:#9aa5b1">' + esc(fmtD(r.sermon_date)) + '</div>' +
          '<div style="flex:0 0 76px"><span class="fin-pill">' + esc(r.service || '-') + '</span></div>' +
          '<div style="flex:1;min-width:0"><div class="rc-title" data-idx="' + i + '" title="클릭해서 내용 보기" style="font-weight:700;color:var(--accent,#223350);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-decoration:underline;text-decoration-color:#cdd7e3;text-underline-offset:3px">' + esc(r.title || '(제목 없음)') + '</div>' +
          (r.scripture ? '<div style="font-size:.78rem;color:#7b8794">' + esc(r.scripture) + '</div>' : '') + '</div></div>';
      }).join('') || '<p style="color:#9aa5b1;font-size:.86rem">아직 설교 기록이 없습니다.</p>';

      panel.innerHTML =
        '<style>' +
        '.cov-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(82px,1fr));gap:7px}' +
        '.cov-cell{border:1px solid #e3e7ee;border-radius:9px;padding:7px 5px;text-align:center;background:#f7f9fc;color:#aab3c0;min-height:50px;display:flex;flex-direction:column;justify-content:center;gap:2px;transition:transform .14s ease,box-shadow .14s ease,border-color .14s ease}' +
        '.cov-cell.on{background:#eaf1ff;border-color:#9bbcf3;color:#1f3a5f;cursor:pointer}' +            /* 구약: 파랑 */
        '.cov-cell.on .cov-ct{color:#1f6feb}' +
        '.cov-cell.on.cov-nt{background:#fdeef0;border-color:#f2b3bb;color:#8a2a35}' +                    /* 신약: 연빨강 */
        '.cov-cell.on.cov-nt .cov-ct{color:#d6455a}' +
        '.cov-cell.on:hover{transform:translateY(-3px);box-shadow:0 8px 18px rgba(31,58,95,.16);border-color:#6f9be0}' +
        '.cov-cell.on.cov-nt:hover{box-shadow:0 8px 18px rgba(138,42,53,.18);border-color:#e08490}' +
        '.cov-nm{font-size:.8rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '.cov-ct{font-size:.72rem;font-weight:700}' +
        '.cov-wrap.only .cov-cell:not(.on){display:none}' +
        '</style>' +
        '<div class="fin-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:16px">' +
        statCard('총 설교', total, '전체 누적', null) +
        statCard(yr + '년 설교', thisYear, '올해 누적', '#1f6feb') +
        statCard('이번 달', thisMonth, ym, '#2e8b57') +
        statCard('성경 커버리지', covDone + '/' + covTotal + '권', pct + '% · 구약 ' + otDone + ' · 신약 ' + ntDone, '#c0392b') +
        '<div class="fin-card" id="qtAttendCard" style="margin:0;padding:16px 18px;cursor:pointer">' +
        '<div style="font-size:.8rem;color:var(--ink-soft,#7b8794);font-weight:600">📋 오늘 QT 출석</div>' +
        '<div style="font-size:1.85rem;font-weight:800;color:#0d9488;line-height:1.1;margin-top:4px" id="qtAttendNum">–</div>' +
        '<div style="font-size:.75rem;color:#9aa5b1;margin-top:3px">아멘 한 사람 · 눌러서 명단 보기</div></div>' +
        '<div class="fin-card" id="ttsLogCard" style="margin:0;padding:16px 18px;cursor:pointer">' +
        '<div style="font-size:.8rem;color:var(--ink-soft,#7b8794);font-weight:600">🔊 AI 음성 생성</div>' +
        '<div style="font-size:1.85rem;font-weight:800;color:#7c3aed;line-height:1.1;margin-top:4px" id="ttsLogNum">–</div>' +
        '<div style="font-size:.75rem;color:#9aa5b1;margin-top:3px">QT 낭독 저장본 · 눌러서 열람·재생</div></div>' +
        '<div class="fin-card" id="bibleReadCard" style="margin:0;padding:16px 18px;cursor:pointer">' +
        '<div style="font-size:.8rem;color:var(--ink-soft,#7b8794);font-weight:600">📖 성경읽기</div>' +
        '<div style="font-size:1.85rem;font-weight:800;color:#1e874b;line-height:1.1;margin-top:4px" id="bibleReadNum">–</div>' +
        '<div style="font-size:.75rem;color:#9aa5b1;margin-top:3px">구속사 365 참여 성도 · 눌러서 현황 보기</div></div>' +
        '</div>' +
        '<div class="fin-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">' +
        '<b style="color:var(--accent,#223350)">📖 성경 권별 커버리지</b>' +
        '<div><button class="btn btn-line" id="sd_all" style="padding:4px 11px;font-size:.8rem">전체</button> <button class="btn btn-line" id="sd_only" style="padding:4px 11px;font-size:.8rem">설교한 성경만</button></div></div>' +
        '<div style="background:#eef2f7;border-radius:7px;height:10px;overflow:hidden;margin-bottom:14px"><div style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,#3a6db5,#223350)"></div></div>' +
        '<div class="cov-wrap" id="sd_cov">' +
        '<div style="font-size:.82rem;color:#7b8794;font-weight:700;margin:2px 0 7px">구약 <span style="color:#1f6feb">' + otDone + '</span>/' + BIBLE_OT.length + '권</div>' +
        '<div class="cov-grid" style="margin-bottom:16px">' + cells(BIBLE_OT, false) + '</div>' +
        '<div style="font-size:.82rem;color:#7b8794;font-weight:700;margin:2px 0 7px">신약 <span style="color:#d6455a">' + ntDone + '</span>/' + BIBLE_NT.length + '권</div>' +
        '<div class="cov-grid">' + cells(BIBLE_NT, true) + '</div>' +
        '</div></div>' +
        '<div class="fin-grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));align-items:start">' +
        '<div class="fin-card"><b style="color:var(--accent,#223350)">🗂 예배별 분포</b><div style="margin-top:10px">' + svcHTML + '</div></div>' +
        '<div class="fin-card"><div style="display:flex;justify-content:space-between;align-items:center"><b style="color:var(--accent,#223350)">🕘 최근 설교</b><button class="btn btn-line" id="sd_goList" style="padding:4px 11px;font-size:.8rem">설교관리 →</button></div><div style="margin-top:8px">' + recent + '</div></div>' +
        '</div>';

      var cov = panel.querySelector('#sd_cov');
      panel.querySelector('#sd_only').onclick = function () { cov.classList.add('only'); };
      panel.querySelector('#sd_all').onclick = function () { cov.classList.remove('only'); };
      var go = panel.querySelector('#sd_goList'); if (go) go.onclick = function () { tab = 'sermon'; render(); };
      // 책 클릭 → 그 책의 설교 목록 팝업
      Array.prototype.forEach.call(panel.querySelectorAll('.cov-cell.on[data-book]'), function (el) {
        el.onclick = function () { bookSermonsModal(el.dataset.book, coverList[el.dataset.book] || []); };
      });
      // 최근 설교 제목 클릭 → 내용 보기
      Array.prototype.forEach.call(panel.querySelectorAll('.rc-title'), function (t) { t.onclick = function () { sermonContentModal(rows[Number(t.dataset.idx)]); }; });
      Array.prototype.forEach.call(panel.querySelectorAll('.svc-label[data-svc]'), function (el) {
        el.onclick = function () { svcCalendarModal(el.dataset.svc, rows); };
      });
      loadQtAttendance(panel);
      loadTtsLog(panel);
      loadBibleStats(panel);
    }

    // ── 성경읽기 현황(구속사 365): 참여 성도 수 + 개인별 진도 ──
    function loadBibleStats(panel) {
      var numEl = panel.querySelector('#bibleReadNum'), card = panel.querySelector('#bibleReadCard');
      if (!numEl || !card) return;
      api('GET', 'bible_reading?select=user_id,day_no,done_at')
        .then(function (rows) {
          rows = rows || [];
          var by = {};
          rows.forEach(function (r) {
            var u = by[r.user_id] || (by[r.user_id] = { cnt: 0, last: '' });
            u.cnt++;
            if (String(r.done_at || '') > u.last) u.last = String(r.done_at || '');
          });
          var ids = Object.keys(by);
          numEl.textContent = ids.length + '명';
          card.onclick = function () { bibleStatsModal(by, ids); };
        })
        .catch(function () { numEl.textContent = '–'; numEl.style.color = '#c0392b'; card.style.cursor = 'default'; });
    }
    function bibleStatsModal(by, ids) {
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,25,.5);z-index:9700;display:flex;align-items:flex-start;justify-content:center;padding:24px 14px;overflow:auto';
      ov.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:560px;width:100%;padding:20px 22px;box-shadow:0 24px 60px rgba(0,0,0,.3)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><h3 style="margin:0;color:var(--accent,#223350)">📖 성경읽기 현황 <span style="font-size:.86rem;color:#9aa5b1;font-weight:600">' + ids.length + '명</span></h3><button class="btn btn-line" id="bs_close" style="padding:3px 11px">닫기</button></div>' +
        '<div id="bs_list" style="max-height:62vh;overflow:auto"><p class="qt-loading">명단을 불러오는 중…</p></div></div>';
      document.body.appendChild(ov);
      var close = pushBackClose(function () { ov.remove(); });
      ov.querySelector('#bs_close').onclick = close;
      ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
      var listEl = ov.querySelector('#bs_list');
      if (!ids.length) { listEl.innerHTML = '<p style="color:#9aa5b1">아직 성경읽기를 시작한 성도가 없습니다.</p>'; return; }
      var inlist = ids.map(function (id) { return '"' + id + '"'; }).join(',');
      api('GET', 'member_links?select=user_id,member_name&user_id=in.(' + inlist + ')')
        .then(function (rows) {
          var nameById = {}; (rows || []).forEach(function (r) { nameById[r.user_id] = r.member_name; });
          var list = ids.map(function (id) {
            return { name: nameById[id] || '(이름 미확인)', cnt: by[id].cnt, last: by[id].last.replace('T', ' ').slice(0, 10) };
          }).sort(function (a, b) { return b.cnt - a.cnt || a.name.localeCompare(b.name, 'ko'); });
          listEl.innerHTML = '<div style="border:1px solid #eef1f5;border-radius:10px;overflow:hidden">' +
            list.map(function (x, i) {
              var pct = Math.round(x.cnt / 365 * 100);
              return '<div style="padding:10px 14px;' + (i ? 'border-top:1px solid #f0f3f7;' : '') + '">' +
                '<div style="display:flex;align-items:center;gap:10px">' +
                '<span style="flex:0 0 24px;color:#9aa5b1;font-size:.8rem;text-align:center">' + (i + 1) + '</span>' +
                '<span style="flex:1;font-weight:600;color:#1f2937">' + esc(x.name) + '</span>' +
                '<span style="font-size:.82rem;color:var(--accent,#223350);font-weight:700">' + x.cnt + '/365일 (' + pct + '%)</span>' +
                '<span style="font-size:.75rem;color:#9aa5b1">' + esc(x.last) + '</span></div>' +
                '<div style="background:#eef2f7;border-radius:5px;height:6px;overflow:hidden;margin:7px 0 0 34px"><div style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,#3fa06a,#1e874b)"></div></div>' +
                '</div>';
            }).join('') + '</div>';
        })
        .catch(function (e) { listEl.innerHTML = '<p style="color:#c0392b">명단 조회 실패: ' + esc((e && e.message) || '') + '</p>'; });
    }

    // ── AI 음성: 저장소의 '실제 파일'을 열람·재생·삭제 ──
    //    (예전에는 생성 기록(tts_log)만 보여줘, 파일 삭제가 권한 문제로 조용히 실패해도
    //     "지워진 것처럼" 보이는 문제가 있었음 → 목록·삭제 모두 tts 함수(서비스 권한)로 처리)
    function ttsAdminApi(body) {
      var s = sess();
      return fetch(SB + '/functions/v1/tts', {
        method: 'POST',
        headers: { apikey: AK, Authorization: 'Bearer ' + ((s && s.token) || AK), 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { j._http = r.status; return j; });
      });
    }
    function loadTtsLog(panel) {
      var numEl = panel.querySelector('#ttsLogNum');
      var card = panel.querySelector('#ttsLogCard');
      if (!numEl || !card) return;
      Promise.all([
        ttsAdminApi({ action: 'list' }),
        api('GET', 'tts_log?select=qt_date,label,url,voice,created_at&order=created_at.desc&limit=300').catch(function () { return []; })
      ]).then(function (rs) {
        var files = (rs[0] && rs[0].ok && rs[0].files) || null, logs = rs[1] || [];
        if (!files) {   // 함수가 아직 구버전(관리 액션 없음) → 기록 개수만 표시 + 안내
          numEl.textContent = logs.length + '건';
          card.onclick = function () { alert('저장된 음원 파일을 열람·삭제하려면 Supabase에서 tts 함수를 최신 index.ts로 재배포해 주세요.'); };
          return;
        }
        numEl.textContent = files.length + '개';
        card.onclick = function () { ttsFilesModal(files.slice(), logs, panel); };
      }).catch(function () { numEl.textContent = '–'; numEl.style.color = '#c0392b'; card.style.cursor = 'default'; });
    }

    function ttsFilesModal(files, logs, panel) {
      function fmtBytes(n) { n = Number(n) || 0; if (!n) return '-'; return n >= 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB'; }
      function fmtTime(s) { s = String(s || ''); var m = s.replace('T', ' ').slice(0, 16); return m || '-'; }
      function logFor(name) {   // 파일명과 생성 기록을 짝지어 제목·목소리 표시
        for (var i = 0; i < logs.length; i++) { var u = String(logs[i].url || ''); if (u.slice(-name.length - 1) === '/' + name) return logs[i]; }
        return null;
      }
      function dateOf(name) { var m = String(name).match(/^qt-(\d{4}-\d{2}-\d{2})/); return m ? m[1] : ''; }
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,25,.5);z-index:9700;display:flex;align-items:flex-start;justify-content:center;padding:24px 14px;overflow:auto';
      ov.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:680px;width:100%;padding:20px 22px;box-shadow:0 24px 60px rgba(0,0,0,.3)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><h3 style="margin:0;color:var(--accent,#223350)">🔊 저장된 AI 음성 <span id="tl_cnt" style="font-size:.86rem;color:#9aa5b1;font-weight:600">' + files.length + '개</span></h3><button class="btn btn-line" id="tl_close" style="padding:3px 11px">닫기</button></div>' +
        '<p style="margin:0 0 10px;font-size:.76rem;color:#9aa5b1">저장소에 실제로 존재하는 파일 목록입니다. 삭제하면 즉시 지워지며(오늘·내일 QT는 자동 생성이 다시 만듦), <b>14일이 지난 파일은 자동 삭제</b>되어 저장 공간이 항상 여유 있게 유지됩니다.</p>' +
        '<div id="tl_body" style="max-height:62vh;overflow:auto"></div></div>';
      document.body.appendChild(ov);
      var close = pushBackClose(function () { ov.remove(); });
      ov.querySelector('#tl_close').onclick = close;
      ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
      var body = ov.querySelector('#tl_body'), cntEl = ov.querySelector('#tl_cnt');

      function paint() {
        if (!files.length) { body.innerHTML = '<p style="color:#9aa5b1;font-size:.9rem;padding:8px 0">저장된 AI 음성이 없습니다. QT에서 🔊 오늘의 말씀 듣기를 한 번 누르면 저장됩니다.</p>'; cntEl.textContent = '0개'; return; }
        cntEl.textContent = files.length + '개';
        body.innerHTML = files.map(function (f, i) {
          var lg = logFor(f.name), d = dateOf(f.name);
          var when = d ? fmtD(d) : fmtTime(f.created_at);
          var title = (lg && lg.label) || f.name;
          var sub = [(lg && lg.voice) || null, fmtBytes(f.size), fmtTime(f.created_at)].filter(Boolean).join(' · ');
          var url = SB + '/storage/v1/object/public/tts-cache/' + encodeURIComponent(f.name);
          return '<div style="display:flex;gap:9px;align-items:center;padding:9px 0;border-bottom:1px solid #f0f0f0">' +
            '<div style="flex:0 0 78px;font-size:.8rem;color:#9aa5b1">' + esc(when) + '</div>' +
            '<div style="flex:1;min-width:0"><div style="font-weight:700;color:var(--accent,#223350);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + esc(f.name) + '">' + esc(title) + '</div>' +
            '<div style="font-size:.74rem;color:#9aa5b1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(sub) + '</div></div>' +
            '<audio controls preload="none" src="' + esc(url) + '" style="flex:0 0 190px;max-width:190px;height:34px"></audio>' +
            '<button class="btn btn-line tl-del" data-i="' + i + '" title="파일 삭제" style="flex:0 0 auto;padding:4px 9px;color:#c0392b;border-color:#e6b3b3">🗑</button>' +
            '</div>';
        }).join('');
        Array.prototype.forEach.call(body.querySelectorAll('.tl-del'), function (b) {
          b.onclick = function () { delFile(Number(b.dataset.i), b); };
        });
      }

      function delFile(i, btn) {
        var f = files[i]; if (!f) return;
        var lg = logFor(f.name);
        if (!confirm('이 AI 음성 파일을 삭제할까요?\n\n' + ((lg && lg.label) || f.name) + '\n(' + fmtBytes(f.size) + ')\n\n삭제하면 다음 재생 때 새로 생성됩니다.')) return;
        btn.disabled = true; btn.textContent = '…';
        ttsAdminApi({ action: 'delete', path: f.name }).then(function (j) {
          if (!j.ok) throw new Error((j && j.error) || ('HTTP ' + j._http));
          files.splice(i, 1); paint();
          var numEl = panel && panel.querySelector('#ttsLogNum'); if (numEl) numEl.textContent = files.length + '개';
        }).catch(function (e) {
          btn.disabled = false; btn.textContent = '🗑';
          alert('삭제 실패: ' + ((e && e.message) || '네트워크 오류'));
        });
      }

      paint();
    }

    // ── QT 출석부: 오늘 아멘 체크한 인원 수 + 명단 ──
    function loadQtAttendance(panel) {
      var numEl = panel.querySelector('#qtAttendNum');
      var card = panel.querySelector('#qtAttendCard');
      if (!numEl || !card) return;
      var t = today();
      api('GET', 'qt_checks?select=user_id&check_date=eq.' + t)
        .then(function (checks) {
          checks = checks || [];
          numEl.textContent = checks.length + '명';
          card.onclick = function () { qtAttendanceModal(t, checks); };
        })
        .catch(function () { numEl.textContent = '–'; numEl.style.color = '#c0392b'; card.style.cursor = 'default'; });
    }

    function qtAttendanceModal(dateStr, checks) {
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,25,.5);z-index:9700;display:flex;align-items:flex-start;justify-content:center;padding:24px 14px;overflow:auto';
      ov.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:520px;width:100%;padding:20px 22px;box-shadow:0 24px 60px rgba(0,0,0,.3)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><h3 style="margin:0;color:var(--accent,#223350)">📋 ' + esc(fmtD(dateStr)) + ' QT 출석 <span style="font-size:.86rem;color:#9aa5b1;font-weight:600">' + checks.length + '명</span></h3><button class="btn btn-line" id="qa_close" style="padding:3px 11px">닫기</button></div>' +
        '<div id="qa_list" style="max-height:60vh;overflow:auto"><p class="qt-loading">명단을 불러오는 중…</p></div></div>';
      document.body.appendChild(ov);
      var close = pushBackClose(function () { ov.remove(); });
      ov.querySelector('#qa_close').onclick = close;
      ov.addEventListener('click', function (e) { if (e.target === ov) close(); });

      var listEl = ov.querySelector('#qa_list');
      var ids = checks.map(function (c) { return c.user_id; }).filter(Boolean);
      if (!ids.length) { listEl.innerHTML = '<p style="color:#9aa5b1">아직 아멘 한 사람이 없습니다.</p>'; return; }
      var inlist = ids.map(function (id) { return '"' + id + '"'; }).join(',');
      api('GET', 'member_links?select=user_id,member_name&user_id=in.(' + inlist + ')')
        .then(function (rows) {
          var nameById = {}; (rows || []).forEach(function (r) { nameById[r.user_id] = r.member_name; });
          var names = ids.map(function (id) { return nameById[id] || '(이름 미확인)'; }).sort(function (a, b) { return a.localeCompare(b, 'ko'); });
          listEl.innerHTML = '<div style="border:1px solid #eef1f5;border-radius:10px;overflow:hidden">' +
            names.map(function (n, i) {
              return '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;' + (i ? 'border-top:1px solid #f0f3f7;' : '') + '">' +
                '<span style="flex:0 0 28px;color:#9aa5b1;font-size:.8rem;text-align:center">' + (i + 1) + '</span>' +
                '<span style="font-weight:600;color:#1f2937">' + esc(n) + '</span></div>';
            }).join('') + '</div>';
        })
        .catch(function (e) { listEl.innerHTML = '<p style="color:#c0392b">명단 조회 실패: ' + esc(e.message) + '</p>'; });
    }

    // 설교 한 편 내용 보기(제목·본문·묵상). 뒤로가기로 닫혀 목록으로 돌아감.
    function sermonContentModal(r) {
      if (!r) return;
      var meta = [r.service, fmtD(r.sermon_date), r.scripture].filter(Boolean).map(esc).join(' · ');
      var raw = r.content || '';
      var isHtml = /<(p|div|h[1-6]|ul|ol|li|blockquote|br|span|mark|b|i|strong|em|u|s|font)\b/i.test(raw);
      var body = raw.trim() ? (isHtml ? raw : '<p>' + esc(raw).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>') + '</p>') : '<p style="color:#9aa5b1">내용이 없습니다.</p>';
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,25,.55);z-index:9750;display:flex;align-items:flex-start;justify-content:center;padding:24px 14px;overflow:auto';
      ov.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:760px;width:100%;padding:24px 26px;box-shadow:0 24px 60px rgba(0,0,0,.32)">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:4px"><h3 style="margin:0;color:var(--accent,#223350);font-size:1.3rem;font-family:\'Noto Serif KR\',serif;line-height:1.35">' + esc(r.title || '(제목 없음)') + '</h3><button class="btn btn-line" id="sc_close" style="padding:5px 13px;white-space:nowrap">‹ 목록</button></div>' +
        (meta ? '<div style="font-size:.82rem;color:#7b8794;margin-bottom:15px">' + meta + '</div>' : '') +
        '<div style="line-height:1.95;font-size:1.02rem;color:#1f2937;font-family:\'Noto Serif KR\',serif;max-height:68vh;overflow:auto">' + body + '</div></div>';
      document.body.appendChild(ov);
      var close = pushBackClose(function () { ov.remove(); });
      ov.querySelector('#sc_close').onclick = close;
      ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    }

    function bookSermonsModal(book, list) {
      var SVC_C = { '주일 낮 예배': '#2563eb', '주일 밤 예배': '#4f46e5', '수요기도회': '#1e874b', '금요기도회': '#7c3aed', '새벽기도': '#0d9488', '매일 QT': '#d97706', '특별집회': '#c0392b', '기타': '#64748b' };
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,25,.5);z-index:9700;display:flex;align-items:flex-start;justify-content:center;padding:24px 14px;overflow:auto';
      var items = (list || []).map(function (r, i) {
        var c = SVC_C[r.service] || '#64748b';
        return '<div style="display:flex;gap:10px;align-items:baseline;padding:9px 2px;border-bottom:1px solid #f0f0f0">' +
          '<div style="flex:0 0 84px;font-size:.8rem;color:#9aa5b1;white-space:nowrap">' + esc(fmtD(r.sermon_date)) + '</div>' +
          '<div style="flex:0 0 72px"><span class="fin-pill" style="background:' + c + '1a;color:' + c + '">' + esc(r.service || '-') + '</span></div>' +
          '<div style="flex:1;min-width:0"><div class="bk-title" data-idx="' + i + '" title="클릭해서 내용 보기" style="font-weight:700;color:var(--accent,#223350);cursor:pointer;text-decoration:underline;text-decoration-color:#cdd7e3;text-underline-offset:3px">' + esc(r.title || '(제목 없음)') + '</div>' +
          (r.scripture ? '<div style="font-size:.78rem;color:#7b8794">' + esc(r.scripture) + '</div>' : '') + '</div></div>';
      }).join('');
      ov.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:700px;width:100%;padding:20px 22px;box-shadow:0 24px 60px rgba(0,0,0,.3)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><h3 style="margin:0;color:var(--accent,#223350)">📖 ' + esc(book) + ' <span style="font-size:.86rem;color:#9aa5b1;font-weight:600">' + (list ? list.length : 0) + '편</span></h3><button class="btn btn-line" id="bk_close" style="padding:3px 11px">닫기</button></div>' +
        '<div style="max-height:70vh;overflow:auto">' + (items || '<p style="color:#9aa5b1">기록이 없습니다.</p>') + '</div></div>';
      document.body.appendChild(ov);
      var close = pushBackClose(function () { ov.remove(); });
      ov.querySelector('#bk_close').onclick = close;
      ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
      Array.prototype.forEach.call(ov.querySelectorAll('.bk-title'), function (t) { t.onclick = function () { sermonContentModal((list || [])[Number(t.dataset.idx)]); }; });
    }

    function svcCalendarModal(svc, allRows) {
      var filtered = allRows.filter(function (r) { return r.service === svc; });
      var yearMap = {};
      filtered.forEach(function (r) {
        var d = String(r.sermon_date || '').slice(0, 10);
        if (!d) return;
        var parts = d.split('-');
        var y = parts[0], m = parseInt(parts[1], 10), day = parseInt(parts[2], 10);
        if (!y || !m || !day) return;
        if (!yearMap[y]) yearMap[y] = {};
        if (!yearMap[y][m]) yearMap[y][m] = {};
        if (!yearMap[y][m][day]) yearMap[y][m][day] = [];
        yearMap[y][m][day].push(r);
      });
      var years = Object.keys(yearMap).sort(function (a, b) { return Number(b) - Number(a); });
      if (!years.length) return;
      var selYearNum = Number(years[0]);
      var DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];

      function buildCalGrid(y) {
        var ys = String(y);
        var mData = yearMap[ys] || {};
        var hasYearData = Object.keys(mData).length > 0;
        var out = '';
        if (!hasYearData) {
          out = '<div style="grid-column:1/-1;text-align:center;padding:48px 0;color:#b0b8c4;font-size:.95rem">' + y + '년 설교 데이터가 없습니다.</div>';
        } else {
          for (var m = 1; m <= 12; m++) {
            var dSet = mData[m] || {};
            var first = new Date(y, m - 1, 1);
            var startDow = first.getDay();
            var daysInMonth = new Date(y, m, 0).getDate();
            var hasAny = Object.keys(dSet).length > 0;
            var cells = '<div style="font-size:.76rem;font-weight:700;color:#3a4a63;margin-bottom:4px;text-align:center">' + m + '월</div>';
            cells += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px;margin-bottom:2px">';
            DOW_KO.forEach(function (dk, i) {
              var tc = i === 0 ? '#e74c3c' : i === 6 ? '#3a6db5' : '#9aa5b1';
              cells += '<div style="text-align:center;font-size:.62rem;font-weight:700;color:' + tc + '">' + dk + '</div>';
            });
            cells += '</div>';
            cells += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">';
            for (var si = 0; si < startDow; si++) cells += '<div></div>';
            for (var day2 = 1; day2 <= daysInMonth; day2++) {
              var dow = (startDow + day2 - 1) % 7;
              var tc2 = dow === 0 ? '#e74c3c' : dow === 6 ? '#3a6db5' : '#3a4a63';
              if (dSet[day2]) {
                cells += '<div class="sv-day" data-y="' + ys + '" data-m="' + m + '" data-d="' + day2 + '" style="text-align:center;font-size:.7rem;font-weight:800;background:#223350;color:#fff;border-radius:4px;padding:2px 1px;cursor:pointer;line-height:1.6" title="' + dSet[day2].length + '편 — 클릭하여 보기">' + day2 + '</div>';
              } else {
                cells += '<div style="text-align:center;font-size:.7rem;color:' + tc2 + ';padding:2px 1px;line-height:1.6">' + day2 + '</div>';
              }
            }
            cells += '</div>';
            out += '<div style="background:' + (hasAny ? '#f0f5ff' : '#f7f9fc') + ';border:1px solid ' + (hasAny ? '#9bbcf3' : '#e3e7ee') + ';border-radius:9px;padding:9px 7px">' + cells + '</div>';
          }
        }
        return out;
      }

      function buildYearNav(y) {
        var hasData = !!yearMap[String(y)];
        var dot = hasData ? ' <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#4ade80;vertical-align:middle;margin-left:3px" title="설교 데이터 있음"></span>' : '';
        return '<button id="sv_prev" style="background:#eef2f7;border:none;border-radius:999px;padding:5px 14px;cursor:pointer;font-size:.84rem;font-weight:700;color:#3a4a63">◀ 이전년</button>' +
          '<span style="font-size:1.05rem;font-weight:800;color:#223350;min-width:80px;text-align:center">' + y + '년' + dot + '</span>' +
          '<button id="sv_next" style="background:#eef2f7;border:none;border-radius:999px;padding:5px 14px;cursor:pointer;font-size:.84rem;font-weight:700;color:#3a4a63">다음년 ▶</button>';
      }

      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,25,.5);z-index:9700;display:flex;align-items:flex-start;justify-content:center;padding:24px 14px;overflow:auto';
      ov.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:900px;width:100%;padding:20px 22px;box-shadow:0 24px 60px rgba(0,0,0,.3)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">' +
        '<h3 style="margin:0;color:var(--accent,#223350)">📅 ' + esc(svc) + ' <span style="font-size:.86rem;color:#9aa5b1;font-weight:600">' + filtered.length + '편</span></h3>' +
        '<button class="btn btn-line" id="sv_close" style="padding:3px 11px">닫기</button></div>' +
        '<div id="sv_nav" style="display:flex;align-items:center;gap:12px;margin-bottom:14px">' + buildYearNav(selYearNum) + '</div>' +
        '<div id="sv_cal" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:10px;max-height:72vh;overflow:auto;padding-bottom:4px">' + buildCalGrid(selYearNum) + '</div>' +
        '</div>';
      document.body.appendChild(ov);
      var close = pushBackClose(function () { ov.remove(); });
      ov.querySelector('#sv_close').onclick = close;
      ov.addEventListener('click', function (e) { if (e.target === ov) close(); });

      function rebind() {
        var btnPrev = ov.querySelector('#sv_prev');
        var btnNext = ov.querySelector('#sv_next');
        if (btnPrev) btnPrev.onclick = function () {
          selYearNum -= 1;
          ov.querySelector('#sv_nav').innerHTML = buildYearNav(selYearNum);
          ov.querySelector('#sv_cal').innerHTML = buildCalGrid(selYearNum);
          rebind();
        };
        if (btnNext) btnNext.onclick = function () {
          selYearNum += 1;
          ov.querySelector('#sv_nav').innerHTML = buildYearNav(selYearNum);
          ov.querySelector('#sv_cal').innerHTML = buildCalGrid(selYearNum);
          rebind();
        };
        Array.prototype.forEach.call(ov.querySelectorAll('.sv-day'), function (cell) {
          cell.onclick = function () {
            var y = cell.dataset.y, m = parseInt(cell.dataset.m, 10), d = parseInt(cell.dataset.d, 10);
            var dayRows = (yearMap[y] && yearMap[y][m] && yearMap[y][m][d]) || [];
            dayListModal(y + '년 ' + m + '월 ' + d + '일', dayRows);
          };
        });
      }
      rebind();
    }

    function dayListModal(label, list) {
      var ov2 = document.createElement('div');
      ov2.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,25,.4);z-index:9720;display:flex;align-items:flex-start;justify-content:center;padding:24px 14px;overflow:auto';
      var items = (list || []).map(function (r, i) {
        return '<div style="padding:9px 2px;border-bottom:1px solid #f0f0f0">' +
          '<div class="dl-title" data-idx="' + i + '" style="font-weight:700;color:var(--accent,#223350);cursor:pointer;text-decoration:underline;text-decoration-color:#cdd7e3;text-underline-offset:3px">' + esc(r.title || '(제목 없음)') + '</div>' +
          (r.scripture ? '<div style="font-size:.78rem;color:#7b8794">' + esc(r.scripture) + '</div>' : '') + '</div>';
      }).join('');
      ov2.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:520px;width:100%;padding:20px 22px;box-shadow:0 24px 60px rgba(0,0,0,.3)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<h3 style="margin:0;font-size:1rem;color:var(--accent,#223350)">' + esc(label) + '</h3>' +
        '<button class="btn btn-line" id="dl_close" style="padding:3px 11px">닫기</button></div>' +
        '<div style="max-height:60vh;overflow:auto">' + (items || '<p style="color:#9aa5b1">기록 없음</p>') + '</div></div>';
      document.body.appendChild(ov2);
      var close2 = pushBackClose(function () { ov2.remove(); });
      ov2.querySelector('#dl_close').onclick = close2;
      ov2.addEventListener('click', function (e) { if (e.target === ov2) close2(); });
      Array.prototype.forEach.call(ov2.querySelectorAll('.dl-title'), function (t) {
        t.onclick = function () { sermonContentModal((list || [])[Number(t.dataset.idx)]); };
      });
    }
  }

  // ── 설교 제안: 커버리지를 거꾸로 활용해 '다음에 설교할 책' 추천 ──
  function renderSermonSuggest(panel) {
    panel.innerHTML = '<div class="fin-card" style="text-align:center;padding:34px"><p class="qt-loading">설교 데이터를 분석하는 중…</p></div>';
    api('GET', 'sermons?select=sermon_date,service,title,scripture&order=sermon_date.desc')
      .then(function (rows) { draw(rows || []); })
      .catch(function (e) { panel.innerHTML = msgCard('불러오기 실패', (e && e.message) || '설교 데이터를 불러오지 못했습니다.'); });

    function draw(rows) {
      var cover = {}, lastDate = {};
      rows.forEach(function (r) {
        var b = bookOf(r.scripture); if (!b) return;
        cover[b] = (cover[b] || 0) + 1;
        var d = String(r.sermon_date || '').slice(0, 10);
        if (d && (!lastDate[b] || d > lastDate[b])) lastDate[b] = d;
      });

      var catData = BIBLE_CATS.map(function (c) {
        var un = c.books.filter(function (b) { return !cover[b]; });
        return { name: c.name, t: c.t, total: c.books.length, done: c.books.length - un.length, un: un, pct: Math.round((c.books.length - un.length) / c.books.length * 100) };
      });
      // 헤드라인: 미설교 책이 있는 분류 중 커버리지 낮은 순 3개에서 첫 책
      var head = catData.filter(function (c) { return c.un.length; }).slice()
        .sort(function (a, b) { return a.pct - b.pct || b.un.length - a.un.length; })
        .slice(0, 3).map(function (c) { return { book: c.un[0], cat: c.name }; });
      // 한동안 안 다룬 책: 설교한 책 중 마지막 설교가 가장 오래된 순
      var neglect = Object.keys(lastDate).map(function (b) { return { book: b, date: lastDate[b], n: cover[b] }; })
        .sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(0, 6);

      var headHTML = head.length ? head.map(function (h) {
        return '<button class="sg-head" data-book="' + esc(h.book) + '"><div class="sg-h-book">' + esc(h.book) + '</div><div class="sg-h-cat">' + esc(h.cat) + ' · 아직 설교 안 함</div><div class="sg-h-go">이 책으로 설교 시작 →</div></button>';
      }).join('') : '<p style="color:#2e8b57;font-weight:600;margin:0">🎉 성경 66권을 모두 한 번 이상 설교하셨습니다! 아래 “한동안 안 다룬 책”을 참고하세요.</p>';

      var catHTML = catData.map(function (c) {
        var inner = c.un.length ? c.un.map(function (b) { return '<button class="sg-chip" data-book="' + esc(b) + '">' + esc(b) + '</button>'; }).join('') : '<span style="font-size:.82rem;color:#2e8b57;font-weight:600">✓ 전부 설교함</span>';
        return '<div style="margin-bottom:13px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">' +
          '<b style="font-size:.92rem;color:#3a4a63">' + esc(c.name) + ' <span style="font-size:.74rem;color:#9aa5b1;font-weight:500">' + c.t + '</span></b>' +
          '<span style="font-size:.8rem;font-weight:700;color:' + (c.un.length ? '#c0392b' : '#2e8b57') + '">' + c.done + '/' + c.total + '권</span></div>' +
          '<div class="sg-chips">' + inner + '</div></div>';
      }).join('');

      var neglectHTML = neglect.length ? neglect.map(function (x) {
        return '<button class="sg-row" data-book="' + esc(x.book) + '"><span style="font-weight:700;color:#27364a">' + esc(x.book) + '</span><span style="font-size:.78rem;color:#9aa5b1">마지막 ' + esc(x.date) + ' · 누적 ' + x.n + '편</span></button>';
      }).join('') : '<p style="color:#9aa5b1;font-size:.86rem;margin:0">아직 설교 기록이 없습니다.</p>';

      panel.innerHTML =
        '<style>' +
        '.sg-head{display:block;width:100%;text-align:left;border:1px solid #cdddf6;background:linear-gradient(135deg,#f5f9ff,#eaf1ff);border-radius:12px;padding:14px 16px;cursor:pointer;font-family:inherit}' +
        '.sg-head:hover{border-color:#1f6feb}' +
        '.sg-h-book{font-size:1.3rem;font-weight:800;color:var(--accent,#223350)}' +
        '.sg-h-cat{font-size:.8rem;color:#5a6b82;margin-top:2px}.sg-h-go{font-size:.8rem;color:#1f6feb;font-weight:700;margin-top:8px}' +
        '.sg-chips{display:flex;flex-wrap:wrap;gap:6px}' +
        '.sg-chip{border:1px solid #f0c4c4;background:#fff6f6;border-radius:999px;padding:5px 13px;font-size:.86rem;font-weight:600;color:#b3413a;cursor:pointer;font-family:inherit}' +
        '.sg-chip:hover{border-color:#1f6feb;color:#1f6feb;background:#f5f9ff}' +
        '.sg-row{display:flex;justify-content:space-between;align-items:center;width:100%;text-align:left;gap:10px;background:none;border:0;border-bottom:1px solid #f0f0f0;padding:9px 2px;cursor:pointer;font-family:inherit}' +
        '.sg-row:hover{background:#f7f9fc}' +
        '</style>' +
        '<div class="fin-card"><b style="color:var(--accent,#223350)">💡 이번에 이 본문은 어떠세요?</b>' +
        '<div style="font-size:.8rem;color:#9aa5b1;margin:3px 0 12px">아직 설교하지 않은 성경 책 중에서, 분야가 골고루 채워지도록 추천합니다. 클릭하면 그 본문으로 바로 설교를 시작합니다.</div>' +
        '<div class="fin-grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">' + headHTML + '</div></div>' +
        '<div class="fin-grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));align-items:start">' +
        '<div class="fin-card"><b style="color:var(--accent,#223350)">📚 분류별 아직 안 한 책</b><div style="font-size:.78rem;color:#9aa5b1;margin:3px 0 12px">빨간 칩 = 아직 한 번도 설교 안 한 책 (클릭 → 설교 시작)</div>' + catHTML + '</div>' +
        '<div class="fin-card"><b style="color:var(--accent,#223350)">🕰 한동안 안 다룬 책</b><div style="font-size:.78rem;color:#9aa5b1;margin:3px 0 10px">설교했지만 가장 오래된 순 — 다시 다뤄볼 만한 책</div>' + neglectHTML + '</div>' +
        '</div>';

      Array.prototype.forEach.call(panel.querySelectorAll('[data-book]'), function (el) {
        el.onclick = function () { pendingSermon = { scripture: el.dataset.book + ' ' }; tab = 'sermon'; render(); };
      });
    }
  }

  // 붙여넣은 생명의 삶 본문을 날짜 블록으로 분리 (개인 비공개 보관용)
  function parseQtPaste(text, year) {
    text = String(text || '').replace(/\r\n?/g, '\n');

    // (A) 생명의삶 PLUS PDF 형식: "01"(일) 줄 + "202606"(YYYYMM) 줄 = 그날 시작
    var lines = text.split('\n');
    var bnds = [], seen = {};
    for (var bi = 0; bi < lines.length - 1; bi++) {
      var dm = lines[bi].trim().match(/^(\d{1,2})$/);
      var ym = lines[bi + 1].trim().match(/^(20\d{2})(\d{2})$/);
      if (!dm || !ym) continue;
      var da0 = Number(dm[1]), mo0 = Number(ym[2]);
      if (da0 < 1 || da0 > 31 || mo0 < 1 || mo0 > 12) continue;
      var dt = ym[1] + '-' + ym[2] + '-' + ('0' + da0).slice(-2);
      if (seen[dt]) continue;                 // 같은 날 머리글 반복 시 첫 번째만
      seen[dt] = 1; bnds.push({ line: bi, date: dt });
    }
    if (bnds.length) {
      var offs = [], pos = 0;
      for (var oi = 0; oi < lines.length; oi++) { offs.push(pos); pos += lines[oi].length + 1; }
      var outP = [];
      for (var p = 0; p < bnds.length; p++) {
        var s = offs[bnds[p].line];
        var e = (p + 1 < bnds.length) ? offs[bnds[p + 1].line] : text.length;
        var rawP = text.slice(s, e).trim();
        var refLine = (lines[bnds[p].line + 2] || '').trim();    // 3번째 줄: "요일 본문"
        var ref = refLine.replace(/^(월|화|수|목|금|토|일)요일\s*/, '').replace(/\s+/g, ' ').replace(/\s*([:：∼~·\-])\s*/g, '$1').replace(/(\d)\s+(\d)/g, '$1$2').trim();
        if (!bookOf(ref)) ref = '';
        outP.push({ date: bnds[p].date, title: '', scripture: ref, raw: rawP });
      }
      return outP;
    }

    // (B) 일반(붙여넣기/북마클릿): 줄머리 날짜
    var re = /(?:(\d{4})\s*[.\-\/년]\s*)?(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})\s*일?/g;
    var marks = [], m;
    while ((m = re.exec(text))) {
      var mo = Number(m[2]), da = Number(m[3]);
      if (mo < 1 || mo > 12 || da < 1 || da > 31) continue;
      var lineStart = text.lastIndexOf('\n', m.index - 1) + 1;
      if (text.slice(lineStart, m.index).trim() !== '') continue;   // 줄 머리의 날짜만(오탐 방지)
      var yy = m[1] ? Number(m[1]) : year;
      marks.push({ i: m.index, date: yy + '-' + ('0' + mo).slice(-2) + '-' + ('0' + da).slice(-2) });
    }
    if (!marks.length) return text.trim() ? [{ date: '', title: '', scripture: '', raw: text.trim() }] : [];
    var out = [];
    for (var k = 0; k < marks.length; k++) {
      var raw = text.slice(marks[k].i, k + 1 < marks.length ? marks[k + 1].i : text.length).trim();
      var lines = raw.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      var title = '', scripture = '';
      for (var li = 1; li < lines.length; li++) {
        if (!scripture && bookOf(lines[li]) && /\d+\s*[:：]\s*\d+/.test(lines[li]) && lines[li].length < 40) { scripture = lines[li]; continue; }
        if (!title && lines[li].length < 60 && !/^\d/.test(lines[li])) title = lines[li];
        if (title && scripture) break;
      }
      out.push({ date: marks[k].date, title: title, scripture: scripture, raw: raw });
    }
    return out;
  }

  // pdf.js 지연 로드(CDN) — PDF 가져오기 사용할 때만 1회 로드
  var _pdfjsP = null;
  function ensurePdfjs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (_pdfjsP) return _pdfjsP;
    _pdfjsP = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = function () {
        if (window.pdfjsLib) { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; } catch (e) {} resolve(window.pdfjsLib); }
        else reject(new Error('pdf.js 로드 실패'));
      };
      s.onerror = function () { reject(new Error('pdf.js를 불러오지 못했습니다(인터넷 연결 확인)')); };
      document.head.appendChild(s);
    });
    return _pdfjsP;
  }
  // PDF → 줄 구조를 살린 텍스트(Y좌표로 줄 묶기). 날짜별 분리를 위해 줄바꿈 유지.
  function extractPdfText(buf) {
    return ensurePdfjs().then(function (pdfjsLib) {
      return pdfjsLib.getDocument({ data: buf }).promise.then(function (pdf) {
        var pages = [], seq = Promise.resolve();
        for (var i = 1; i <= pdf.numPages; i++) {
          (function (n) {
            seq = seq.then(function () {
              return pdf.getPage(n).then(function (page) {
                return page.getTextContent().then(function (tc) {
                  var lines = {};
                  tc.items.forEach(function (it) {
                    if (!it.str) return;
                    var y = Math.round(it.transform[5]);
                    (lines[y] = lines[y] || []).push({ x: it.transform[4], s: it.str });
                  });
                  var ys = Object.keys(lines).map(Number).sort(function (a, b) { return b - a; });
                  pages.push(ys.map(function (y) {
                    return lines[y].sort(function (a, b) { return a.x - b.x; }).map(function (o) { return o.s; }).join('').replace(/\s+$/, '');
                  }).join('\n'));
                });
              });
            });
          })(i);
        }
        return seq.then(function () { return pages.join('\n\n'); });
      });
    });
  }

  // 생명의 삶 가져오기 모달 — 개인 비공개 보관함(qt_imports). 공개 사이트와 무관.
  // initialText: 북마클릿이 du.plus 페이지에서 긁어 넘긴 본문(있으면 자동 정리).
  function qtImportModal(initialText) {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:#f4f6fa;z-index:9000;overflow:auto';
    var thisYear = new Date().getFullYear();
    ov.innerHTML =
      '<header style="position:sticky;top:0;z-index:6;background:linear-gradient(180deg,#fff,#f7f9fc);border-bottom:1px solid #e1e6ef;box-shadow:0 2px 10px rgba(34,51,80,.06)">' +
      '<div style="max-width:900px;margin:0 auto;padding:11px 18px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">' +
      '<button class="btn btn-line" id="qi_close" style="padding:8px 14px;border-radius:9px">‹ 닫기</button>' +
      '<div style="flex:1;min-width:160px"><div style="font-weight:700;font-size:1.12rem;color:var(--accent,#223350)">📥 생명의 삶 가져오기</div>' +
      '<div style="font-size:.72rem;color:#9aa5b1;margin-top:2px">개인 참고용 비공개 보관함 — 홈페이지엔 절대 표시되지 않습니다</div></div>' +
      '<button class="btn btn-solid" id="qi_save" style="padding:8px 18px;border-radius:9px;font-weight:700" disabled>💾 날짜별 저장</button>' +
      '</div></header>' +
      '<div style="max-width:900px;margin:0 auto;padding:18px">' +
      '<div class="fin-card"><b style="color:var(--accent,#223350)">① 생명의 삶 열기 → 내용 복사</b>' +
      '<div style="font-size:.84rem;color:#5a6b82;margin:6px 0 10px">아래 버튼으로 (이미 로그인된) 생명의 삶을 새 탭에서 엽니다. 그날(또는 한 달치) QT 본문을 <b>전체 선택(Ctrl+A) → 복사(Ctrl+C)</b> 하세요.</div>' +
      '<a class="btn btn-line" href="https://www.du.plus/my-library" target="_blank" rel="noopener" style="padding:8px 16px">생명의 삶 열기 ↗</a></div>' +
      '<div class="fin-card"><b style="color:var(--accent,#223350)">② 여기에 붙여넣기</b>' +
      '<div style="display:flex;gap:10px;align-items:center;margin:8px 0;flex-wrap:wrap">' +
      '<label style="font-size:.84rem;color:#5a6b82">연도(날짜에 연도가 없을 때)</label>' +
      '<input type="number" id="qi_year" value="' + thisYear + '" style="width:96px;padding:6px 8px;border:1px solid #dfe5ee;border-radius:7px;font:inherit">' +
      '<button class="btn btn-line" id="qi_parse" style="padding:7px 14px;margin-left:auto">날짜별로 정리 ↓</button></div>' +
      '<textarea id="qi_paste" placeholder="생명의 삶 본문을 여기에 붙여넣으세요. (여러 날짜를 한 번에 붙여넣어도 날짜별로 자동 분리됩니다)" style="width:100%;min-height:180px;line-height:1.7;font-size:.95rem;padding:11px;border:1px solid #dfe5ee;border-radius:9px;font-family:\'Noto Serif KR\',serif;box-sizing:border-box"></textarea>' +
      '<div style="margin-top:10px;border-top:1px dashed #e1e6ef;padding-top:10px"><b style="font-size:.9rem;color:#3a4a63">또는 — 생명의 삶 PDF 올리기</b>' +
      '<div style="font-size:.78rem;color:#9aa5b1;margin:3px 0 8px">그 달 PDF(생명의 삶 PLUS)를 올리면 전문을 추출해 위 칸에 채우고 날짜별로 정리합니다.</div>' +
      '<input type="file" id="qi_pdf" accept="application/pdf,.pdf"><span id="qi_pdfmsg" style="font-size:.8rem;color:#7b8794;margin-left:8px"></span></div></div>' +
      '<div id="qi_prev"></div>' +
      '<div class="fin-card"><b style="color:var(--accent,#223350)">📂 가져온 자료 (비공개)</b><div id="qi_list" style="margin-top:8px"><p class="qt-loading">불러오는 중…</p></div></div>' +
      '</div>';
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    var close = pushBackClose(function () { ov.remove(); document.body.style.overflow = ''; });
    ov.querySelector('#qi_close').onclick = close;

    var parsed = [];
    var prevBox = ov.querySelector('#qi_prev'), saveBtn = ov.querySelector('#qi_save');

    ov.querySelector('#qi_parse').onclick = function () {
      parsed = parseQtPaste(ov.querySelector('#qi_paste').value, Number(ov.querySelector('#qi_year').value) || thisYear);
      renderPrev();
    };

    // PDF 올리기 → 텍스트 추출 → 붙여넣기 칸 채우고 자동 정리
    var pdfIn = ov.querySelector('#qi_pdf'), pdfMsg = ov.querySelector('#qi_pdfmsg');
    if (pdfIn) pdfIn.onchange = function () {
      var f = pdfIn.files && pdfIn.files[0]; if (!f) return;
      pdfMsg.style.color = '#7b8794'; pdfMsg.textContent = 'PDF 분석 중… (장수에 따라 시간이 걸립니다)';
      f.arrayBuffer().then(function (b) { return extractPdfText(b); }).then(function (txt) {
        if (!txt || txt.replace(/\s/g, '').length < 20) { pdfMsg.style.color = '#c0392b'; pdfMsg.textContent = '텍스트를 추출하지 못했습니다(이미지 기반 PDF일 수 있음).'; return; }
        ov.querySelector('#qi_paste').value = txt;
        pdfMsg.style.color = 'green'; pdfMsg.textContent = '✓ 추출 완료 (' + txt.length + '자) — 아래 미리보기에서 확인/수정 후 저장';
        ov.querySelector('#qi_parse').click();
      }).catch(function (e) { pdfMsg.style.color = '#c0392b'; pdfMsg.textContent = '실패: ' + ((e && e.message) || e); });
    };

    function renderPrev() {
      if (!parsed.length) { prevBox.innerHTML = ''; saveBtn.disabled = true; return; }
      saveBtn.disabled = false;
      prevBox.innerHTML = '<div class="fin-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="color:var(--accent,#223350)">③ 날짜별 정리 미리보기 (' + parsed.length + '일)</b><span style="font-size:.78rem;color:#9aa5b1">저장 전에 날짜·제목을 고칠 수 있어요</span></div>' +
        parsed.map(function (p, i) {
          return '<div style="border:1px solid #eef1f5;border-radius:9px;padding:10px;margin-bottom:8px">' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px">' +
            '<input type="date" data-qf="date" data-i="' + i + '" value="' + esc(p.date) + '" style="padding:5px 8px;border:1px solid #dfe5ee;border-radius:7px;font:inherit">' +
            '<input type="text" data-qf="scripture" data-i="' + i + '" value="' + esc(p.scripture) + '" placeholder="본문" style="width:140px;padding:5px 8px;border:1px solid #dfe5ee;border-radius:7px;font:inherit">' +
            '<input type="text" data-qf="title" data-i="' + i + '" value="' + esc(p.title) + '" placeholder="제목" style="flex:1;min-width:120px;padding:5px 8px;border:1px solid #dfe5ee;border-radius:7px;font:inherit">' +
            '<span style="font-size:.76rem;color:#9aa5b1">' + p.raw.length + '자</span>' +
            '<button class="btn btn-line" data-qf="rm" data-i="' + i + '" style="padding:3px 9px;color:#c0392b">✕</button></div>' +
            '<div style="font-size:.8rem;color:#7b8794;white-space:pre-wrap;max-height:80px;overflow:auto;background:#fafbfd;border-radius:6px;padding:7px">' + esc(p.raw.slice(0, 300)) + (p.raw.length > 300 ? ' …' : '') + '</div></div>';
        }).join('') + '</div>';
      Array.prototype.forEach.call(prevBox.querySelectorAll('[data-qf]'), function (el) {
        var i = Number(el.dataset.i), f = el.dataset.qf;
        if (f === 'rm') el.onclick = function () { parsed.splice(i, 1); renderPrev(); };
        else el.oninput = function () { parsed[i][f] = el.value; };
      });
    }

    saveBtn.onclick = function () {
      var rows = parsed.filter(function (p) { return p.date; }).map(function (p) {
        return { ref_date: p.date, title: p.title || null, scripture: p.scripture || null, raw_text: p.raw, updated_at: new Date().toISOString() };
      });
      if (!rows.length) { alert('저장할 날짜가 없습니다. 각 항목의 날짜를 확인해 주세요.'); return; }
      saveBtn.disabled = true; saveBtn.textContent = '저장 중…';
      api('POST', 'qt_imports?on_conflict=ref_date', rows, 'resolution=merge-duplicates,return=minimal')
        .then(function () { saveBtn.textContent = '✓ 저장됨'; parsed = []; renderPrev(); ov.querySelector('#qi_paste').value = ''; loadList(); setTimeout(function () { saveBtn.textContent = '💾 날짜별 저장'; }, 1500); })
        .catch(function (e) {
          saveBtn.disabled = false; saveBtn.textContent = '💾 날짜별 저장';
          if (/42P01|PGRST205|does not exist|schema cache|Could not find the table/i.test(e.message)) alert('보관함 테이블이 없습니다. Supabase → SQL Editor 에서 supabase/qt_imports.sql 을 1회 실행해 주세요.');
          else alert('저장 실패: ' + e.message);
        });
    };

    var listBox = ov.querySelector('#qi_list');
    function loadList() {
      api('GET', 'qt_imports?select=ref_date,title,scripture,raw_text&order=ref_date.desc&limit=400').then(function (rows) {
        rows = rows || [];
        if (!rows.length) { listBox.innerHTML = '<p style="color:#9aa5b1;font-size:.86rem;margin:0">아직 가져온 자료가 없습니다.</p>'; return; }
        var byDate = {}; rows.forEach(function (r) { byDate[r.ref_date] = r; });
        listBox.innerHTML = rows.map(function (r) {
          return '<div style="border-bottom:1px solid #f0f0f0;padding:8px 0">' +
            '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
            '<b style="color:#27364a">' + esc(r.ref_date) + '</b>' +
            (r.scripture ? '<span class="fin-pill">' + esc(r.scripture) + '</span>' : '') +
            '<span style="flex:1;min-width:80px;color:#3a4a63">' + esc(r.title || '') + '</span>' +
            '<button class="btn btn-line qi-view" data-d="' + esc(r.ref_date) + '" style="padding:3px 10px;font-size:.8rem">보기</button>' +
            '<button class="btn btn-line qi-copy" data-d="' + esc(r.ref_date) + '" style="padding:3px 10px;font-size:.8rem">복사</button>' +
            '<button class="btn btn-line qi-del" data-d="' + esc(r.ref_date) + '" style="padding:3px 10px;font-size:.8rem;color:#c0392b">삭제</button></div>' +
            '<pre class="qi-raw" data-d="' + esc(r.ref_date) + '" style="display:none;white-space:pre-wrap;font-family:\'Noto Serif KR\',serif;font-size:.9rem;background:#fafbfd;border-radius:7px;padding:10px;margin:7px 0 0;max-height:300px;overflow:auto">' + esc(r.raw_text || '') + '</pre></div>';
        }).join('');
        Array.prototype.forEach.call(listBox.querySelectorAll('.qi-view'), function (b) { b.onclick = function () { var pre = listBox.querySelector('.qi-raw[data-d="' + b.dataset.d + '"]'); if (pre) pre.style.display = pre.style.display === 'none' ? 'block' : 'none'; }; });
        Array.prototype.forEach.call(listBox.querySelectorAll('.qi-copy'), function (b) { b.onclick = function () { var r = byDate[b.dataset.d]; if (r && navigator.clipboard) navigator.clipboard.writeText(r.raw_text || '').then(function () { b.textContent = '복사됨'; setTimeout(function () { b.textContent = '복사'; }, 1200); }); }; });
        Array.prototype.forEach.call(listBox.querySelectorAll('.qi-del'), function (b) { b.onclick = function () { if (!confirm(b.dataset.d + ' 자료를 삭제할까요?')) return; api('DELETE', 'qt_imports?ref_date=eq.' + b.dataset.d, null, 'return=minimal').then(loadList).catch(function (e) { alert('삭제 실패: ' + e.message); }); }; });
      }).catch(function (e) {
        if (/42P01|PGRST205|does not exist|schema cache|Could not find the table/i.test(e.message)) listBox.innerHTML = msgCard('보관함 준비 필요', 'Supabase → SQL Editor 에서 supabase/qt_imports.sql 을 1회 실행해 주세요.');
        else listBox.innerHTML = '<p style="color:#c0392b;font-size:.86rem">조회 실패: ' + esc(e.message) + '</p>';
      });
    }
    loadList();

    // 북마클릿으로 넘어온 본문이 있으면 자동으로 채우고 날짜별 정리 실행
    if (initialText && String(initialText).trim()) {
      ov.querySelector('#qi_paste').value = String(initialText);
      ov.querySelector('#qi_parse').click();
      var prev = ov.querySelector('#qi_prev'); if (prev && prev.scrollIntoView) setTimeout(function () { prev.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    }
  }

  // ── 나의 도서관: 분류·추천·검색 대시보드 (구글 드라이브, 관리자 전용) ──
  var _libCache = null;
  // 파일명 키워드 기반 자동 분류(우선순위 순). 일치 없으면 성경책 이름 → 성경·주석, 그래도 없으면 기타.
  var LIB_CATS = [
    ['정기간행물·잡지', /목회와신학|생명의\s*삶|월간목회|그말씀|디사이플|빛과소금|기독교사상|활천|현대종교|신학지남|날마다\s*솟는\s*샘물|매일성경|교회와신앙|갱신과부흥|개혁신앙|^20\d{4}|\d{1,2}\s*월\s*호|\d{4}\s*년\s*\d{1,2}\s*월/],
    ['교육', /기독교교육|교회교육|교회학교|주일학교|교육학|교수법|교사용|학습자용|교재|공과|커리큘럼|교리교육|양육교재|훈련교재/],
    ['AI·디지털', /인공지능|챗GPT|ChatGPT|\bGPT\b|메타버스|머신러닝|딥러닝|빅데이터|알고리즘|디지털|\bAI\b/],
    ['경영·경제', /경영|경제|마케팅|회계|재무|투자|자본주의|매니지먼트|버핏|노믹스|재테크/],
    ['신학·교리', /신학|교의|조직신학|변증|개혁주의|칼빈|교리|세계관|기독교\s*강요|성령론|기독론|구원론|예정|언약/],
    ['설교·예배', /설교|강단|예화|예배|찬양|찬송|예전|설교학/],
    ['자녀교육·육아', /육아|자녀교육|자녀양육|엄마표|아빠표|훈육|사춘기|입시|영재|태교|하브루타|그림책|부모|문제행동/],
    ['상담·가정', /상담|치유|위로|중독|가정|부부|자녀|결혼|심리|애도/],
    ['선교·전도', /선교|전도|복음화|땅끝|제자훈련/],
    ['목회·교회', /목회|교회|노회|총회|규정|정관|회의|행정|리더십|당회|장로|집사|세미나|성장/],
    ['교회사·인물', /교회사|역사|전기|인물|종교개혁|루터|어거스틴|아우구스티누스|청교도|위인/],
    ['역사', /세계사|한국사(?!회)|문명사|전쟁사|근현대사|근대사|조선왕조|일제강점|로마제국|십자군/],
    ['신앙·경건', /경건|큐티|묵상|기도|영성|확신|회복|은혜|믿음|신앙|영적|제자|소그룹|훈련/],
    ['철학·사상', /철학|사상|형이상학|윤리학|논리학|인식론|존재론|헤겔|칸트|니체|플라톤|아리스토텔레스|소크라테스|실존주의|현상학|변증법|인문학|쇼펜하우어|스토아/],
    ['소설·문학', /소설|장편|단편선|단편소설|단편집|시집|수필|동화|희곡|산문|우화|판타지|에세이|(?<![인천])문학/],
    ['성경·주석', /주석|강해|틴데일|NICOT|NICNT|WBC|NAC|BECNT|100주년|현대성서|성경|개역|원어|구약|신약|히브리어|헬라어/i]
  ];
  function libHasBibleBook(t) {
    var i; for (i = 0; i < BIBLE_OT.length; i++) if (t.indexOf(BIBLE_OT[i]) >= 0) return true;
    for (i = 0; i < BIBLE_NT.length; i++) if (t.indexOf(BIBLE_NT[i]) >= 0) return true;
    return false;
  }
  // 영문 성경책 이름 / 영문 주석 시리즈 코드 → 성경·주석
  var LIB_BIBLE_EN = /\b(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation)\b/i;
  var LIB_SERIES = /\b(AOTC|BCBC|BCOTWP|BTCP|CNTUOT|CSC|DBS|ZECNT|NIGTC|PNTC|NIVAC|TOTC|TNTC|EBC|BST|UBC|WBC|NAC|NICOT|NICNT|BECNT)\b|BIBLE in Hand|SOLAS/;
  function libClassify(title) {
    for (var i = 0; i < LIB_CATS.length; i++) if (LIB_CATS[i][1].test(title)) return LIB_CATS[i][0];
    if (libHasBibleBook(title) || LIB_BIBLE_EN.test(title) || LIB_SERIES.test(title)) return '성경·주석';
    return '기타';
  }
  function libSeededPicks(books, n, seed) {
    var picks = [], used = {}, s = seed % 2147483647; if (s <= 0) s += 2147483646;
    var guard = 0;
    while (picks.length < n && picks.length < books.length && guard < n * 40) {
      s = (s * 16807) % 2147483647; var idx = s % books.length;
      if (!used[idx]) { used[idx] = 1; picks.push(books[idx]); }
      guard++;
    }
    return picks;
  }
  // 주석 시리즈 태그(성경·주석 하위 필터용)
  var LIB_SERIES_TAG = [
    ['현대성서주석', /현대성서/], ['NICOT·NICNT', /\bNIC[NO]T\b/i], ['칼빈주석', /칼빈/], ['틴데일(TOTC·TNTC)', /틴데일|\bT[NO]TC\b/i],
    ['BECNT', /\bBECNT\b/i], ['NAC', /\bNAC\b/i], ['NIGTC', /\bNIGTC\b/i], ['PNTC', /\bPNTC\b/i], ['WBC', /\bWBC\b/i], ['UBC', /\bUBC\b/i],
    ['CNB', /\bCNB\b/i], ['AOTC', /\bAOTC\b/i], ['BCBC', /\bBCBC\b/i], ['BCOTWP', /\bBCOTWP\b/i], ['CNTUOT', /\bCNTUOT\b/i], ['CSC', /\bCSC\b/i],
    ['DBS', /\bDBS\b/i], ['100주년주석', /100주년/], ['강해', /강해/], ['단행본 주석', /주석/]
  ];
  function libSeries(t) {
    for (var i = 0; i < LIB_SERIES_TAG.length; i++) if (LIB_SERIES_TAG[i][1].test(t)) return LIB_SERIES_TAG[i][0];
    return '';
  }
  // 정기간행물·잡지 종류 태그(하위 필터용). 이름 우선, 날짜만 있으면 월간 묵상·QT.
  var LIB_MAG_TAG = [
    ['월간목회', /월간목회/], ['목회와신학', /목회와신학/], ['생명의삶', /생명의\s*삶/], ['디사이플', /디사이플/],
    ['그말씀', /그말씀/], ['날마다 솟는 샘물', /날마다\s*솟는\s*샘물/], ['빛과소금', /빛과소금/],
    ['기독교사상', /기독교사상/], ['활천', /활천/], ['현대종교', /현대종교/], ['신학지남', /신학지남/], ['매일성경', /매일성경/],
    ['교회와신앙', /교회와신앙/], ['갱신과부흥', /갱신과부흥/], ['개혁신앙', /개혁신앙/], ['월간 묵상·QT', /^20\d{4}/]
  ];
  function libMag(t) {
    for (var i = 0; i < LIB_MAG_TAG.length; i++) if (LIB_MAG_TAG[i][1].test(t)) return LIB_MAG_TAG[i][0];
    return '';
  }
  // 도서관 목록 로컬 캐시(즉시 표시용). 분류 규칙 바뀌면 LIB_CACHE_VER +1 → 옛 캐시 무효화.
  var LIB_LS_KEY = 'wpc_lib_cache', LIB_CACHE_VER = 10;
  function libLoadLS() {
    try { var o = JSON.parse(localStorage.getItem(LIB_LS_KEY) || 'null'); return (o && o.v === LIB_CACHE_VER && o.books && o.books.length) ? o.books : null; } catch (e) { return null; }
  }
  function libSaveLS(books) {
    try { localStorage.setItem(LIB_LS_KEY, JSON.stringify({ v: LIB_CACHE_VER, books: books })); } catch (e) { /* 용량초과 등 → 캐시 생략 */ }
  }
  var LIB_PALETTE = ['#0e7c5a', '#0a4a6e', '#7c5cbf', '#c0813a', '#3a7d8c', '#9c4a52', '#5a7d4a', '#475569', '#8a6d3b', '#5b5fa6', '#2f8f6b', '#7a5c8a', '#5a6675', '#a0522d', '#456b8c', '#6b8e23'];

  // ── 수동 분류 변경(드래그&드롭): Supabase library_overrides 에 저장(관리자 공유·영구). 자동분류보다 우선 ──
  var LIB_OV = {};        // { book_id: {cat, sub} }  (sub=세부분류: 시리즈/종류)
  var LIB_DRAG = null;    // 드래그 중인 책 id
  var LIB_TRASH = '휴지통';      // 삭제 대기 보관함(특수 분류)
  var LIB_DELETED = '__deleted__'; // 영구 삭제(목록에서 숨김)
  function libLoadOverrides() {
    return api('GET', 'library_overrides?select=*').then(function (rows) {
      LIB_OV = {}; (rows || []).forEach(function (r) { LIB_OV[r.book_id] = { cat: r.category, sub: r.subcat || '' }; }); return LIB_OV;
    }).catch(function () { return LIB_OV; });   // 테이블 미생성 등 → 자동분류만 사용
  }
  function libSetOverride(id, cat, sub) {
    return api('POST', 'library_overrides', [{ book_id: String(id), category: cat, subcat: sub || null }], 'resolution=merge-duplicates,return=minimal');
  }
  // 분류 안 세부분류 정보: 성경·주석=시리즈, 정기간행물·잡지=종류. 없으면 null.
  function libSubInfo(cat) {
    if (cat === '성경·주석') return { field: 'series', label: '시리즈', tags: LIB_SERIES_TAG };
    if (cat === '정기간행물·잡지') return { field: 'pub', label: '종류', tags: LIB_MAG_TAG };
    return null;
  }
  // 책 1권에 자동분류 + 수동 override 적용(cat/series/pub 세팅). title 필요.
  function libApplyOv(b) {
    var ov = LIB_OV[b.id];
    b.cat = (ov && ov.cat) || libClassify(b.title);
    b.series = libSeries(b.title);
    b.pub = libMag(b.title);
    if (ov && ov.sub) {
      if (b.cat === '성경·주석') b.series = ov.sub;
      else if (b.cat === '정기간행물·잡지') b.pub = ov.sub;
    }
    return b;
  }
  // 세부분류 선택 팝업. cb(선택값) — 취소 시 호출 안 함.
  function libSubPopup(cat, sub, bk, cb) {
    var cur = bk[sub.field] || '';
    var ov = document.createElement('div'); ov.className = 'lib-modal';
    ov.innerHTML = '<div class="lib-modal-box"><div class="lib-modal-h">' + esc(cat) + ' · ' + esc(sub.label) + ' 선택</div>' +
      '<div class="lib-modal-sub">‘' + esc(bk.title) + '’ 의 ' + esc(sub.label) + '을(를) 선택하세요</div>' +
      '<div class="lib-modal-chips"><button class="lib-mchip' + (cur ? '' : ' on') + '" data-v="">지정 안 함(자동)</button>' +
      sub.tags.map(function (s) { return '<button class="lib-mchip' + (s[0] === cur ? ' on' : '') + '" data-v="' + esc(s[0]) + '">' + esc(s[0]) + '</button>'; }).join('') +
      '</div><div class="lib-modal-foot"><button class="lib-mcancel">취소</button></div></div>';
    document.body.appendChild(ov);
    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('.lib-mcancel').onclick = close;
    Array.prototype.forEach.call(ov.querySelectorAll('.lib-mchip'), function (b) { b.onclick = function () { var v = b.dataset.v; close(); cb(v); }; });
  }
  function libCatCounts(books) { var c = {}; books.forEach(function (b) { c[b.cat] = (c[b.cat] || 0) + 1; }); return c; }
  function libCatBarHtml(books, activeCat) {
    var counts = libCatCounts(books);
    var order = LIB_CATS.map(function (c) { return c[0]; }).concat(['기타']);
    var arr = order.filter(function (c) { return counts[c]; }).map(function (c) { return [c, counts[c]]; });
    var cards = arr.map(function (c, i) {
      return '<button class="lib-catcard' + (c[0] === activeCat ? ' on' : '') + '" data-cat="' + esc(c[0]) + '" style="--c:' + LIB_PALETTE[i % LIB_PALETTE.length] + '"><span class="lib-cat-name">' + esc(c[0]) + '</span><span class="lib-cat-cnt">' + c[1] + '권</span></button>';
    }).join('');
    // 휴지통: 항상 표시(드롭 대상)
    cards += '<button class="lib-catcard lib-trashcard' + (activeCat === LIB_TRASH ? ' on' : '') + '" data-cat="' + LIB_TRASH + '" style="--c:#b4232a"><span class="lib-cat-name">🗑 휴지통</span><span class="lib-cat-cnt">' + (counts[LIB_TRASH] || 0) + '권</span></button>';
    return '<div class="lib-cats">' + cards + '</div>';
  }
  // 분류 카드에 클릭(이동)·드롭(재분류) 연결. opts: {onNavigate(cat), onMoved(book,from,to)}
  function libBindCatBar(container, books, opts) {
    if (!container) return;
    Array.prototype.forEach.call(container.querySelectorAll('.lib-catcard'), function (el) {
      var cat = el.dataset.cat;
      el.onclick = function () { if (!LIB_DRAG && opts.onNavigate) opts.onNavigate(cat); };
      el.ondragover = function (e) { if (LIB_DRAG) { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch (x) {} el.classList.add('lib-drop'); } };
      el.ondragleave = function () { el.classList.remove('lib-drop'); };
      el.ondrop = function (e) {
        e.preventDefault(); el.classList.remove('lib-drop');
        var id = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || LIB_DRAG; LIB_DRAG = null;
        if (!id) return;
        var bk = null, i; for (i = 0; i < books.length; i++) { if (String(books[i].id) === String(id)) { bk = books[i]; break; } }
        if (!bk) return;
        var sub = libSubInfo(cat);
        if (bk.cat === cat && !sub) return;   // 같은 분류 + 세부분류 없음 → 무시 (세부분류 있으면 재지정 허용)
        function finish(chosenSub) {
          var from = bk.cat; el.classList.add('lib-saving');
          libSetOverride(id, cat, chosenSub).then(function () {
            LIB_OV[id] = { cat: cat, sub: chosenSub || '' }; libApplyOv(bk); libSaveLS(books); el.classList.remove('lib-saving');
            if (opts.onMoved) opts.onMoved(bk, from, cat, chosenSub);
          }).catch(function (err) {
            el.classList.remove('lib-saving');
            libToast('저장 실패: ' + ((err && err.message) || '오류') + ' — library_overrides 테이블(subcat 컬럼)을 확인하세요', true);
          });
        }
        if (sub) libSubPopup(cat, sub, bk, finish);
        else finish(null);
      };
    });
  }
  var _libToastEl = null, _libToastTmr = null;
  function libToast(msg, isErr) {
    if (!_libToastEl) { _libToastEl = document.createElement('div'); _libToastEl.className = 'lib-toast'; document.body.appendChild(_libToastEl); }
    _libToastEl.textContent = msg; _libToastEl.style.background = isErr ? '#b4232a' : '#13314e';
    _libToastEl.classList.add('show'); clearTimeout(_libToastTmr);
    _libToastTmr = setTimeout(function () { if (_libToastEl) _libToastEl.classList.remove('show'); }, isErr ? 4500 : 1900);
  }
  function renderLibrary(panel) {
    var url = window.LIBRARY_API_URL;
    if (!url) { panel.innerHTML = msgCard('나의 도서관 — 설정 필요', 'Apps Script(library-api.gs) 배포 후 config.js 의 LIBRARY_API_URL 을 설정해 주세요.'); return; }
    var furl = url + (window.LIBRARY_FOLDER_ID ? ((url.indexOf('?') >= 0 ? '&' : '?') + 'folderId=' + encodeURIComponent(window.LIBRARY_FOLDER_ID)) : '');
    function doFetch(silent) {
      var prevN = _libCache ? _libCache.length : -1;
      fetch(furl).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || !d.ok) { if (!silent) panel.innerHTML = msgCard('불러오기 실패', (d && d.error) || '목록을 불러오지 못했습니다.'); return; }
        var fresh = (d.books || []).map(norm).filter(function (b) { return b.cat !== LIB_DELETED; });
        _libCache = fresh; libSaveLS(fresh);
        if (!silent) dashboard(fresh);
        else if (fresh.length !== prevN && panel.querySelector('#lib_recos')) dashboard(fresh);   // 변경 있을 때만 조용히 새로고침
      }).catch(function (e) { if (!silent) panel.innerHTML = msgCard('불러오기 실패', (e && e.message) || '도서관을 불러오지 못했습니다.'); });
    }

    function norm(b) {
      var t = String(b.title == null ? '' : b.title).replace(/\+/g, ' ').replace(/\s+/g, ' ').trim();
      var a = b.author || '';
      if (!a) { var m = t.match(/^[\(\[]\s*([^\)\]]{1,24})\s*[\)\]]\s*(.+)$/); if (m) { a = m[1].trim(); t = m[2].trim(); } }
      return libApplyOv({ id: b.id, title: t || '(제목 없음)', author: a, key: (t + ' ' + a).toLowerCase() });
    }
    var GRID_CSS = '<style>' +
      '@keyframes libfade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}' +
      '.lib-root{animation:libfade .4s ease}' +
      '.lib-hero{position:relative;overflow:hidden;border-radius:18px;padding:32px 30px;margin-bottom:22px;color:#fff;background:linear-gradient(160deg,#103a2b 0%,#0b2c22 58%,#08211a 100%);box-shadow:0 18px 44px rgba(6,32,24,.32)}' +
      '.lib-hero::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,0) 42%);pointer-events:none}' +
      '.lib-hero::after{content:"";position:absolute;right:-90px;top:-100px;width:340px;height:340px;border-radius:50%;background:radial-gradient(circle,rgba(130,205,165,.12),transparent 70%);pointer-events:none}' +
      '.lib-hero-in{position:relative;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}' +
      '.lib-eyebrow{font-size:.72rem;letter-spacing:.22em;font-weight:700;color:#e8c87e}' +
      '.lib-htitle{font-size:1.9rem;font-weight:800;letter-spacing:-.02em;margin:5px 0 0;color:#fff;font-family:\'Noto Serif KR\',serif}' +
      '.lib-hsub{font-size:.86rem;color:rgba(255,255,255,.82);margin-top:7px}' +
      '.lib-search{padding:12px 17px;border:1px solid rgba(255,255,255,.22);border-radius:999px;font:inherit;min-width:240px;background:rgba(255,255,255,.16);color:#fff;outline:none}' +
      '.lib-search::placeholder{color:rgba(255,255,255,.72)}.lib-search:focus{background:rgba(255,255,255,.26)}' +
      '.lib-sec{margin-bottom:26px}' +
      '.lib-sec-h{display:flex;justify-content:space-between;align-items:center;font-size:1.06rem;font-weight:800;color:#13314e;letter-spacing:-.01em;margin-bottom:13px}' +
      '.lib-sec-sub{font-size:.78rem;font-weight:500;color:#9aa5b1}' +
      '.lib-cats{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:12px}' +
      '.lib-catcard{position:relative;overflow:hidden;cursor:pointer;border:1px solid #e6eaf0;border-radius:14px;padding:15px 16px 14px;background:#fff;text-align:left;font-family:inherit;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease;animation:libfade .35s ease both}' +
      '.lib-catcard::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--c,#0e7c5a)}' +
      '.lib-catcard:hover{transform:translateY(-4px);box-shadow:0 12px 26px rgba(15,37,64,.12);border-color:var(--c,#0e7c5a)}' +
      '.lib-cat-name{display:block;font-weight:800;color:#1f2937;font-size:.97rem}' +
      '.lib-cat-cnt{display:inline-block;margin-top:9px;font-size:.74rem;font-weight:800;padding:3px 10px;border-radius:999px;background:#f1f5f9;background:color-mix(in srgb,var(--c,#0e7c5a) 13%,#fff);color:var(--c,#475569)}' +
      '.lib-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(146px,1fr));gap:18px}' +
      '.lib-card{cursor:pointer;text-align:left;background:none;border:0;padding:0;font-family:inherit;animation:libfade .35s ease both}' +
      '.lib-coverwrap{position:relative;border-radius:12px;overflow:hidden;box-shadow:0 6px 18px rgba(15,37,64,.13);transition:transform .2s ease,box-shadow .2s ease;background:#eef2f7}' +
      '.lib-card:hover .lib-coverwrap{transform:translateY(-5px);box-shadow:0 16px 34px rgba(15,37,64,.24)}' +
      '.lib-cover{display:block;width:100%;aspect-ratio:3/4;object-fit:cover}' +
      '.lib-t{font-size:.86rem;font-weight:700;color:#1f2937;margin-top:9px;line-height:1.32;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
      '.lib-a{font-size:.77rem;color:#9aa5b1;margin-top:2px}' +
      '.lib-bar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:18px}' +
      '.lib-back{display:inline-flex;align-items:center;gap:5px;border:1px solid #e2e8f0;background:#f3f6fa;color:#33415c;font-weight:700;border-radius:999px;padding:8px 16px;cursor:pointer;font-family:inherit;font-size:.86rem;transition:background .15s}.lib-back:hover{background:#e7edf4}' +
      '.lib-ltitle{font-size:1.25rem;font-weight:800;color:#13314e;letter-spacing:-.01em}' +
      '.lib-chips{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:18px;align-items:center}.lib-chips .lbl{font-size:.78rem;color:#7b8794;font-weight:800;margin-right:2px}' +
      '.lib-schip{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:5px 13px;font-size:.8rem;cursor:pointer;font-family:inherit;color:#475569;font-weight:600;transition:all .15s}.lib-schip:hover{border-color:#0e7c5a;color:#0c5a42}' +
      '.lib-schip.on{background:linear-gradient(135deg,#11785a,#0c4030);color:#fff;border-color:transparent;box-shadow:0 4px 12px rgba(12,64,48,.26)}' +
      '.lib-more{border:1px solid #e2e8f0;background:#fff;color:#33415c;font-weight:700;border-radius:999px;padding:10px 26px;cursor:pointer;font-family:inherit;transition:all .15s}.lib-more:hover{border-color:#0e7c5a;color:#0c5a42}' +
      '.lib-cnt{font-size:.8rem;color:#9aa5b1;margin-top:9px}' +
      '.lib-reroll{border:1px solid #e2e8f0;background:#fff;color:#475569;font-weight:700;border-radius:999px;padding:5px 14px;font-size:.8rem;cursor:pointer;font-family:inherit}.lib-reroll:hover{border-color:#0e7c5a;color:#0c5a42}' +
      // 드래그&드롭 분류 이동
      '.lib-card[draggable]{cursor:grab}.lib-card:active{cursor:grabbing}' +
      '.lib-card.lib-dragging{opacity:.35}' +
      '.lib-catcard.on{border-color:var(--c,#0e7c5a);box-shadow:0 6px 18px color-mix(in srgb,var(--c,#0e7c5a) 18%,transparent)}' +
      '.lib-catcard.lib-saving{opacity:.55}' +
      'body.lib-dnd .lib-cats .lib-catcard{border-style:dashed;border-color:var(--c,#0e7c5a)}' +
      '.lib-catcard.lib-drop{border-style:solid !important;transform:translateY(-3px);box-shadow:0 0 0 3px color-mix(in srgb,var(--c,#0e7c5a) 38%,#fff),0 12px 26px rgba(15,37,64,.16)}' +
      // 목록 화면 상단 고정 분류 바
      '.lib-catbar{position:sticky;top:84px;z-index:6;background:rgba(255,255,255,.98);backdrop-filter:saturate(1.2) blur(2px);padding:10px 0 12px;margin-bottom:14px;border-bottom:1px solid #eef1f5}' +
      '@media(max-width:640px){.lib-catbar{position:static;top:auto;backdrop-filter:none;margin-bottom:10px}}' +   // 모바일: 분류 바 고정 해제(스크롤되며 책이 보이게)
      '.lib-catbar-hint{font-size:.74rem;font-weight:700;color:#9aa5b1;margin:0 2px 9px}' +
      '.lib-catbar .lib-cats{grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:9px}' +
      '.lib-catbar .lib-catcard{padding:11px 13px 10px}.lib-catbar .lib-cat-name{font-size:.9rem}.lib-catbar .lib-cat-cnt{margin-top:6px}' +
      // 이동 완료 토스트
      '.lib-toast{position:fixed;left:50%;bottom:34px;transform:translateX(-50%) translateY(8px);background:#13314e;color:#fff;padding:11px 22px;border-radius:999px;font-size:.86rem;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,.28);z-index:99999;opacity:0;pointer-events:none;transition:opacity .2s ease,transform .2s ease}' +
      '.lib-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}' +
      // 세부분류 선택 팝업
      '.lib-modal{position:fixed;inset:0;background:rgba(15,30,50,.45);display:flex;align-items:center;justify-content:center;z-index:100000;animation:libfade .15s ease}' +
      '.lib-modal-box{background:#fff;border-radius:16px;padding:22px 22px 18px;max-width:560px;width:calc(100% - 40px);max-height:80vh;overflow:auto;box-shadow:0 24px 60px rgba(0,0,0,.32)}' +
      '.lib-modal-h{font-size:1.06rem;font-weight:800;color:#13314e;letter-spacing:-.01em}' +
      '.lib-modal-sub{font-size:.82rem;color:#7b8794;margin:5px 0 15px;line-height:1.4}' +
      '.lib-modal-chips{display:flex;flex-wrap:wrap;gap:8px}' +
      '.lib-mchip{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:8px 15px;font-size:.85rem;cursor:pointer;font-family:inherit;color:#33415c;font-weight:600;transition:all .15s}' +
      '.lib-mchip:hover{border-color:#0e7c5a;color:#0c5a42;background:#f3faf6}' +
      '.lib-mchip.on{background:linear-gradient(135deg,#11785a,#0c4030);color:#fff;border-color:transparent}' +
      '.lib-modal-foot{margin-top:16px;text-align:right}' +
      '.lib-mcancel{border:1px solid #e2e8f0;background:#f3f6fa;color:#475569;font-weight:700;border-radius:999px;padding:8px 18px;cursor:pointer;font-family:inherit}.lib-mcancel:hover{background:#e7edf4}' +
      // 휴지통
      '.lib-trashcard .lib-cat-name{color:#b4232a}' +
      '.lib-trashcard .lib-cat-cnt{background:color-mix(in srgb,#b4232a 12%,#fff);color:#b4232a}' +
      '.lib-trashbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;background:#fff5f4;border:1px solid #f1cfcb;border-radius:12px;padding:11px 15px;margin-bottom:16px;font-size:.84rem;color:#8a3a36}' +
      '.lib-empty{border:1px solid #d9534f;background:#d9534f;color:#fff;font-weight:700;border-radius:999px;padding:8px 16px;cursor:pointer;font-family:inherit;font-size:.83rem;white-space:nowrap}.lib-empty:hover{background:#c9302c}' +
      '.lib-titem{display:flex;flex-direction:column}' +
      '.lib-del{margin-top:7px;border:1px solid #f0c8c5;background:#fff5f4;color:#b4232a;font-weight:700;border-radius:8px;padding:6px 0;cursor:pointer;font-family:inherit;font-size:.76rem}.lib-del:hover{background:#fde6e3;border-color:#e0a09b}' +
      '</style>';
    function card(bk) {
      var t = esc(bk.title), a = esc(bk.author);
      return '<button class="lib-card" draggable="true" data-id="' + esc(bk.id) + '" data-cat="' + esc(bk.cat) + '" title="끌어서 분류 이동 · 눌러서 열기"><div class="lib-coverwrap"><img class="lib-cover" loading="lazy" src="https://drive.google.com/thumbnail?id=' + esc(bk.id) + '&sz=w320" onerror="this.style.visibility=\'hidden\'" alt="' + t + '"></div><div class="lib-t">' + t + '</div>' + (a ? '<div class="lib-a">' + a + '</div>' : '') + '</button>';
    }
    function bindCards(box) {
      Array.prototype.forEach.call(box.querySelectorAll('.lib-card'), function (b) {
        b.onclick = function () { if (b.dataset.dragged) { b.dataset.dragged = ''; return; } window.open('https://drive.google.com/file/d/' + b.dataset.id + '/view', '_blank', 'noopener'); };
        b.ondragstart = function (e) { LIB_DRAG = b.dataset.id; b.dataset.dragged = '1'; try { e.dataTransfer.setData('text/plain', b.dataset.id); e.dataTransfer.effectAllowed = 'move'; } catch (x) {} b.classList.add('lib-dragging'); document.body.classList.add('lib-dnd'); };
        b.ondragend = function () { b.classList.remove('lib-dragging'); document.body.classList.remove('lib-dnd'); LIB_DRAG = null; Array.prototype.forEach.call(document.querySelectorAll('.lib-catcard.lib-drop'), function (x) { x.classList.remove('lib-drop'); }); };
      });
    }

    function dashboard(books) {
      var catArr = libCatBarHtml(books, '');
      var counts = libCatCounts(books);
      var nCats = LIB_CATS.map(function (c) { return c[0]; }).concat(['기타']).filter(function (c) { return counts[c]; }).length;
      var visible = books.filter(function (b) { return b.cat !== LIB_TRASH; });
      var dt = new Date(), seed = dt.getFullYear() * 372 + dt.getMonth() * 31 + dt.getDate();
      var ds = dt.getFullYear() + '.' + pad2(dt.getMonth() + 1) + '.' + pad2(dt.getDate());
      var picks = libSeededPicks(visible, 6, seed);
      panel.innerHTML = GRID_CSS + '<div class="lib-root">' +
        '<div class="lib-hero"><div class="lib-hero-in"><div>' +
        '<div class="lib-eyebrow">MY LIBRARY</div>' +
        '<div class="lib-htitle">나의 도서관</div>' +
        '<div class="lib-hsub">총 ' + visible.length + '권 · ' + nCats + '개 분류 · 표지를 누르면 드라이브에서 열립니다</div></div>' +
        '<input type="text" id="lib_q" class="lib-search" placeholder="🔍 제목·저자 검색"></div></div>' +
        '<div class="lib-sec"><div class="lib-sec-h"><span>🗂 분류별 <span class="lib-sec-sub">책을 분류 칸으로 끌어다 놓으면 분류가 바뀝니다</span></span></div>' +
        catArr +
        '</div>' +
        '<div class="lib-sec"><div class="lib-sec-h"><span>📖 오늘의 추천 <span class="lib-sec-sub">' + ds + ' · 매일 바뀝니다</span></span><button class="lib-reroll" id="lib_reroll">↻ 다시</button></div><div class="lib-grid" id="lib_recos">' + picks.map(card).join('') + '</div></div></div>';
      bindCards(panel.querySelector('#lib_recos'));
      libBindCatBar(panel.querySelector('.lib-cats'), books, {
        onNavigate: function (cat) { openList(books, cat, ''); },
        onMoved: function (bk, from, to, sub) { dashboard(books); libToast('‘' + bk.title + '’ → ' + to + (sub ? ' · ' + sub : '')); }
      });
      var rer = 0;
      panel.querySelector('#lib_reroll').onclick = function () { rer++; var box = panel.querySelector('#lib_recos'); box.innerHTML = libSeededPicks(books, 6, seed + rer * 7919).map(card).join(''); bindCards(box); };
      var tmr = null;
      panel.querySelector('#lib_q').oninput = function () { var v = this.value.trim(); clearTimeout(tmr); tmr = setTimeout(function () { if (v) openList(books, '', v.toLowerCase()); }, 250); };
    }

    // 분류/검색 화면 진입: 브라우저 히스토리에 한 단계 쌓아 '뒤로가기'가 대시보드로 오게 함
    function openList(books, cat, q) {
      var close = pushBackClose(function () { if (tab === 'library') dashboard(books); });
      listView(books, cat, q, close);
    }
    function listView(books, cat, q, close) {
      var curCat = cat, curSub = '', PAGE = 60, shown = PAGE;
      var isTrash = (cat === LIB_TRASH);
      // 분류 안 하위 필터: 성경·주석=시리즈, 정기간행물·잡지=종류
      var subField = (cat === '성경·주석') ? 'series' : (cat === '정기간행물·잡지') ? 'pub' : '';
      var subOrder = (subField === 'series') ? LIB_SERIES_TAG : (subField === 'pub') ? LIB_MAG_TAG : [];
      var subLabel = (subField === 'pub') ? '종류' : '시리즈';
      function build(qq) { return books.filter(function (b) { return (!curCat || b.cat === curCat) && (!curSub || b[subField] === curSub) && (!qq || b.key.indexOf(qq) >= 0); }); }
      function curQ() { var el = panel.querySelector('#lib_q2'); return el ? el.value.trim().toLowerCase() : ''; }
      var subBar = '';
      if (subField) {
        var sc = {}; books.forEach(function (b) { if (b.cat === curCat && b[subField]) sc[b[subField]] = (sc[b[subField]] || 0) + 1; });
        var arr = subOrder.map(function (s) { return s[0]; }).filter(function (s) { return sc[s]; }).map(function (s) { return [s, sc[s]]; });
        if (arr.length) subBar = '<div class="lib-chips"><span class="lbl">' + subLabel + '</span><button class="lib-schip on" data-s="">전체</button>' + arr.map(function (x) { return '<button class="lib-schip" data-s="' + esc(x[0]) + '">' + esc(x[0]) + ' ' + x[1] + '</button>'; }).join('') + '</div>';
      }
      var trashBar = isTrash ? '<div class="lib-trashbar"><span>🗑 삭제할 책을 모아둔 곳입니다. 다른 분류 칸으로 끌어다 놓으면 <b>복원</b>됩니다.</span><button class="lib-empty" id="lib_empty">휴지통 비우기 (영구 삭제)</button></div>' : '';
      var curList = build(q);
      panel.innerHTML = GRID_CSS + '<div class="lib-root">' +
        '<div class="lib-bar"><div style="display:flex;align-items:center;gap:12px"><button class="lib-back" id="lib_back">‹ 도서관</button>' +
        '<span class="lib-ltitle">' + (isTrash ? '🗑 휴지통' : (cat ? esc(cat) : '검색: ' + esc(q))) + '</span></div>' +
        '<input type="text" id="lib_q2" placeholder="🔍 이 안에서 검색" value="' + esc(q) + '" style="padding:9px 14px;border:1px solid #e2e8f0;border-radius:999px;font:inherit;min-width:200px;outline:none"></div>' +
        '<div class="lib-catbar"><div class="lib-catbar-hint">🗂 분류 · 책을 칸으로 끌어다 놓으면 이동 · 휴지통에 넣으면 삭제 대기</div>' + libCatBarHtml(books, curCat) + '</div>' +
        trashBar + subBar +
        '<div class="lib-grid" id="lib_grid"></div>' +
        '<div style="text-align:center;margin:22px 0"><button class="lib-more" id="lib_more">더 보기</button><div class="lib-cnt" id="lib_cnt"></div></div></div>';
      var grid = panel.querySelector('#lib_grid'), moreBtn = panel.querySelector('#lib_more'), cntEl = panel.querySelector('#lib_cnt');
      // 상단 고정 분류 바를 사이트 고정헤더 아래로 내림(가려져 드롭 못 하던 문제)
      (function () { var hdr = document.querySelector('header.header') || document.querySelector('header'); var bar = panel.querySelector('.lib-catbar'); if (hdr && bar) bar.style.top = Math.round(hdr.getBoundingClientRect().height) + 'px'; })();
      function delBook(id) {
        if (!window.confirm('이 책을 도서관에서 영구 삭제할까요?\n(드라이브 원본 파일은 그대로 남고, 도서관 목록에서만 사라집니다)')) return;
        libSetOverride(id, LIB_DELETED).then(function () {
          LIB_OV[id] = { cat: LIB_DELETED, sub: '' };
          for (var i = 0; i < books.length; i++) { if (String(books[i].id) === String(id)) { books.splice(i, 1); break; } }
          libSaveLS(books); curList = build(curQ()); render(); refreshCatBar(); libToast('영구 삭제됨');
        }).catch(function (err) { libToast('삭제 실패: ' + ((err && err.message) || '오류'), true); });
      }
      function emptyTrash() {
        var ids = books.filter(function (b) { return b.cat === LIB_TRASH; }).map(function (b) { return b.id; });
        if (!ids.length) { libToast('휴지통이 비어 있습니다'); return; }
        if (!window.confirm('휴지통의 ' + ids.length + '권을 모두 영구 삭제할까요?\n(드라이브 원본은 남고 도서관에서만 사라집니다)')) return;
        var rows = ids.map(function (id) { return { book_id: String(id), category: LIB_DELETED, subcat: null }; });
        api('POST', 'library_overrides', rows, 'resolution=merge-duplicates,return=minimal').then(function () {
          ids.forEach(function (id) { LIB_OV[id] = { cat: LIB_DELETED, sub: '' }; });
          for (var i = books.length - 1; i >= 0; i--) { if (books[i].cat === LIB_TRASH) books.splice(i, 1); }
          libSaveLS(books); curList = build(curQ()); render(); refreshCatBar(); libToast(ids.length + '권 영구 삭제됨');
        }).catch(function (err) { libToast('삭제 실패: ' + ((err && err.message) || '오류'), true); });
      }
      function render() {
        var total = curList.length, vis = Math.min(shown, total);
        if (!total) { grid.innerHTML = '<p style="color:#9aa5b1;grid-column:1/-1;padding:10px">' + (isTrash ? '휴지통이 비어 있습니다.' : '결과가 없습니다.') + '</p>'; }
        else if (isTrash) { grid.innerHTML = curList.slice(0, vis).map(function (bk) { return '<div class="lib-titem">' + card(bk) + '<button class="lib-del" data-id="' + esc(bk.id) + '">영구 삭제</button></div>'; }).join(''); }
        else { grid.innerHTML = curList.slice(0, vis).map(card).join(''); }
        bindCards(grid);
        if (isTrash) Array.prototype.forEach.call(grid.querySelectorAll('.lib-del'), function (btn) { btn.onclick = function (e) { e.stopPropagation(); delBook(btn.dataset.id); }; });
        cntEl.textContent = vis + ' / ' + total + '권';
        moreBtn.style.display = vis < total ? '' : 'none';
      }
      function refreshCatBar() {
        var counts = libCatCounts(books);
        Array.prototype.forEach.call(panel.querySelectorAll('.lib-catcard'), function (el) {
          var c = el.dataset.cat, pill = el.querySelector('.lib-cat-cnt');
          if (pill) pill.textContent = (counts[c] || 0) + '권';
          el.style.display = (counts[c] || c === LIB_TRASH) ? '' : 'none';   // 휴지통은 비어도 항상 표시
          if (c === curCat) el.classList.add('on'); else el.classList.remove('on');
        });
      }
      libBindCatBar(panel.querySelector('.lib-cats'), books, {
        onNavigate: function (c) { if (c !== curCat) listView(books, c, '', close); },
        onMoved: function (bk, from, to, sub) {
          curList = build(curQ());
          render(); refreshCatBar();
          libToast(to === LIB_TRASH ? ('‘' + bk.title + '’ 휴지통으로') : ('‘' + bk.title + '’ → ' + to + (sub ? ' · ' + sub : '')));
        }
      });
      moreBtn.onclick = function () { shown += PAGE; render(); };
      panel.querySelector('#lib_back').onclick = function () { if (close) close(); else dashboard(books); };
      if (isTrash) panel.querySelector('#lib_empty').onclick = emptyTrash;
      Array.prototype.forEach.call(panel.querySelectorAll('.lib-schip'), function (b) {
        b.onclick = function () {
          curSub = b.dataset.s; shown = PAGE;
          Array.prototype.forEach.call(panel.querySelectorAll('.lib-schip'), function (x) { x.className = (x === b) ? 'lib-schip on' : 'lib-schip'; });
          curList = build(curQ()); render();
        };
      });
      var tmr = null;
      panel.querySelector('#lib_q2').oninput = function () { var v = this.value.trim().toLowerCase(); clearTimeout(tmr); tmr = setTimeout(function () { curList = build(v); shown = PAGE; render(); }, 250); };
      render();
    }

    // 수동 분류 변경(overrides)을 _libCache 에 다시 입혀 카운트·목록을 최신화. 대시보드면 재렌더.
    function applyOverrides() {
      if (!_libCache) return; var changed = false;
      _libCache.forEach(function (b) { var pc = b.cat, ps = b.series, pp = b.pub; libApplyOv(b); if (b.cat !== pc || b.series !== ps || b.pub !== pp) changed = true; });
      var before = _libCache.length;
      _libCache = _libCache.filter(function (b) { return b.cat !== LIB_DELETED; });
      if (_libCache.length !== before) changed = true;
      if (changed) { libSaveLS(_libCache); if (panel.querySelector('#lib_recos')) dashboard(_libCache); }
    }

    // 모든 헬퍼·스타일 정의 후 실행 (캐시 즉시 렌더 시 GRID_CSS 등이 정의돼 있도록)
    // 분류 변경 내역은 병렬로 불러와(즉시 렌더를 막지 않음) 도착하면 다시 입힘.
    libLoadOverrides().then(applyOverrides);
    if (_libCache) { dashboard(_libCache); return; }
    var cached = libLoadLS();
    if (cached) { _libCache = cached; dashboard(_libCache); doFetch(true); return; }   // 저장된 목록 즉시 표시 + 뒤에서 갱신
    panel.innerHTML = '<div class="fin-card" style="text-align:center;padding:34px"><p class="qt-loading">도서관을 불러오는 중… <span style="color:#9aa5b1">(처음 한 번만 걸리고, 다음부터는 바로 열립니다)</span></p></div>';
    doFetch(false);
  }

  // 생명의삶(목회자판) 자료 자동 분류: 붙여넣은 전체 텍스트 → 날짜·본문·개역개정·우리말·제목·설교원고·예화클립
  function parseSaengmyeong(text) {
    var raw = String(text || '').replace(/\r/g, ''), lines = raw.split('\n');
    var trim = lines.map(function (l) { return l.trim(); });
    function findEq(label, from) { from = from || 0; for (var i = from; i < trim.length; i++) if (trim[i] === label) return i; return -1; }
    function block(a, b) { var arr = [], end = (b < 0 ? lines.length : b); for (var i = a + 1; i < end; i++) arr.push(lines[i]); while (arr.length && !arr[0].trim()) arr.shift(); while (arr.length && !arr[arr.length - 1].trim()) arr.pop(); return arr; }
    var i, m, date = '';
    for (i = 0; i < trim.length; i++) { m = trim[i].match(/(20\d{2})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/); if (m) { date = m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]); break; } }
    var scripture = '';
    for (i = 0; i < trim.length; i++) { var mm = trim[i].match(/^([가-힣]+\s*\d+:\d+(?:[~\-]\d+)?)\s*$/); if (mm) { scripture = mm[1].replace(/~/g, '-').replace(/\s+/g, ' '); break; } }
    var iGae = findEq('개역개정'), iWoo = -1, iNasb = -1, iSummary = findEq('오늘의 말씀 요약');
    if (iGae >= 0) { iWoo = findEq('우리말', iGae + 1); if (iWoo < 0) iWoo = findEq('우리말성경', iGae + 1); }
    if (iWoo >= 0) iNasb = findEq('NASB', iWoo + 1);
    var gaeyeok = iGae >= 0 ? block(iGae, iWoo >= 0 ? iWoo : (iSummary >= 0 ? iSummary : -1)).filter(function (l) { return l.trim(); }).join('\n') : '';
    var woorimal = iWoo >= 0 ? block(iWoo, iNasb >= 0 ? iNasb : (iSummary >= 0 ? iSummary : -1)).filter(function (l) { return l.trim(); }).join('\n') : '';
    var iGuide = findEq('설교 길잡이'), titleIdx = -1, title = '';
    if (iGuide >= 0) { for (i = iGuide + 1; i < trim.length; i++) { if (trim[i]) { titleIdx = i; title = trim[i]; break; } } }
    var iJit = findEq('본문과 설교 잇기', iGuide >= 0 ? iGuide : 0), iApply = findEq('적용', iGuide >= 0 ? iGuide : 0);
    var sermonEnd = iJit >= 0 ? iJit : (iApply >= 0 ? iApply : -1);
    var sermonLines = titleIdx >= 0 ? block(titleIdx, sermonEnd) : [];
    var iSunday = findEq('주일설교');   // 주일 QT에만 있는 별도 설교 블록(예화 클립 뒤)
    var iYehwa = findEq('예화 클립'), illusLines = iYehwa >= 0 ? block(iYehwa, iSunday >= 0 ? iSunday : -1) : [];
    function toHtml(arr) {
      var chunks = [], cur = [];
      arr.forEach(function (l) { if (!l.trim()) { if (cur.length) { chunks.push(cur); cur = []; } } else cur.push(l); });
      if (cur.length) chunks.push(cur);
      return chunks.map(function (c) {
        var first = c[0].trim();
        if (/\(\s*\d+[~\-]?\d*\s*절\s*\)\s*\.?\s*$/.test(first)) { var rest = c.slice(1).join(' ').trim(); return '<h3>' + esc(first) + '</h3>' + (rest ? '<p>' + esc(rest) + '</p>' : ''); }
        return '<p>' + esc(c.join(' ').trim()) + '</p>';
      }).join('');
    }
    // 주일 QT: 주일설교 블록에서 제목·본문(성구)·설교 원고를 추출 → '주일 낮 예배'로 분류
    var sunday = null;
    if (iSunday >= 0) {
      var sTitle = '', sScr = '', sBodyStart = -1, seen = 0;
      for (var si = iSunday + 1; si < trim.length; si++) {
        if (!trim[si]) continue;
        var sm2 = trim[si].match(/^([가-힣]+\s*\d+:\d+(?:[~\-]\d+)?)\s*$/);
        if (sm2) { sScr = sm2[1].replace(/~/g, '-').replace(/\s+/g, ' '); sBodyStart = si; break; }  // 성구 줄 = 본문
        seen++;
        if (seen === 1) sTitle = trim[si];            // 첫 줄 = 설교 제목
        else { sBodyStart = si - 1; break; }          // 성구 없이 둘째 줄 → 그 줄부터 본문
      }
      var sBody = sBodyStart >= 0 ? block(sBodyStart, -1) : [];
      if (sTitle || sBody.length) sunday = { title: sTitle, scripture: sScr, sermonHtml: toHtml(sBody) };
    }
    return { date: date, scripture: scripture, gaeyeok: gaeyeok, woorimal: woorimal, title: title, sermonHtml: toHtml(sermonLines), illustration: illusLines.join('\n').trim(), sunday: sunday };
  }
  // 예화 클립을 보관함(sermon_illustrations)에 저장(같은 날짜면 덮어씀). 출처(「…」)는 분리.
  function saveIllustration(p, onDone, onErr) {
    var content = p.illustration || '', src = '';
    var il = content.split('\n'), last = (il[il.length - 1] || '').trim();
    if (/「[^」]+」/.test(last) && last.length < 90) { src = last; content = il.slice(0, -1).join('\n').trim(); }
    var payload = { ref_date: p.date || null, scripture: p.scripture || null, title: p.title || null, source: src || null, content: content };
    function ins() { return api('POST', 'sermon_illustrations', payload, 'return=minimal'); }
    var pr = p.date ? api('GET', 'sermon_illustrations?ref_date=eq.' + encodeURIComponent(p.date) + '&select=id').then(function (rows) { return (rows && rows.length) ? api('PATCH', 'sermon_illustrations?id=eq.' + rows[0].id, payload, 'return=minimal') : ins(); }) : ins();
    pr.then(function () { if (onDone) onDone(); }).catch(function (e) { if (onErr) onErr(e); });
  }
  // 출처 문자열 "저자, 「책제목」(출판사)" → {author, book, publisher}
  function parseIllusSource(src) {
    src = String(src || '').trim();
    var book = '', author = '', publisher = '', m;
    m = src.match(/[「『]([^」』]+)[」』]/); if (m) book = m[1].trim();
    var pubs = src.match(/[(（]([^)）]+)[)）]/g);
    if (pubs && pubs.length) publisher = pubs[pubs.length - 1].replace(/[()（）]/g, '').trim();
    var before = book ? src.split(/[「『]/)[0] : (publisher ? src.split(/[(（]/)[0] : src);
    author = before.replace(/[,，]\s*$/, '').trim();
    return { author: author, book: book, publisher: publisher, raw: src };
  }
  function illusBookLine(r) { var s = parseIllusSource(r.source); return [s.author, s.book ? '「' + s.book + '」' : '', s.publisher ? '(' + s.publisher + ')' : ''].filter(Boolean).join(' '); }
  // 저자·책·출판사 → 출처 문자열 "저자, 「책」(출판사)"
  function composeIllusSource(author, book, publisher) {
    author = (author || '').trim(); book = (book || '').trim(); publisher = (publisher || '').trim();
    var s = author;
    if (book) s += (s ? ', ' : '') + '「' + book + '」';
    if (publisher) s += (s && !book ? ' ' : '') + '(' + publisher + ')';
    return s.trim();
  }
  function copyToClipboard(t, btn, okText) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { if (btn) btn.textContent = okText || '✓ 복사됨'; }, function () { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); if (btn) btn.textContent = okText || '✓ 복사됨'; } catch (e) {} document.body.removeChild(ta); }); }

  // 예화 클립 한 건 보기(전문)
  function illustrationViewModal(r) {
    var meta = [fmtD(r.ref_date), r.scripture, r.title].filter(Boolean).map(esc).join(' · ');
    var book = esc(illusBookLine(r));
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,25,.5);z-index:9800;display:flex;align-items:flex-start;justify-content:center;padding:24px 14px;overflow:auto';
    ov.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:680px;width:100%;padding:22px 24px;box-shadow:0 24px 60px rgba(0,0,0,.3)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><h3 style="margin:0;color:var(--accent,#223350)">📖 예화 클립</h3><button class="btn btn-line" id="iv_close" style="padding:3px 11px">닫기</button></div>' +
      (meta ? '<div style="font-size:.78rem;color:#7b8794;margin-bottom:2px">' + meta + '</div>' : '') +
      (book ? '<div style="font-size:.88rem;color:#7a5d27;font-weight:600;margin-bottom:12px">' + book + '</div>' : '') +
      '<div style="white-space:pre-wrap;line-height:1.85;font-size:.97rem;color:#1f2937;max-height:62vh;overflow:auto">' + esc(r.content || '') + '</div>' +
      '<div style="margin-top:14px;text-align:right"><button class="btn btn-line" id="iv_copy" style="padding:6px 14px">📋 복사</button></div></div>';
    document.body.appendChild(ov);
    var close = pushBackClose(function () { ov.remove(); });
    ov.querySelector('#iv_close').onclick = close;
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('#iv_copy').onclick = function () { copyToClipboard((r.content || '') + (r.source ? '\n— ' + r.source : ''), this); };
  }

  // 예화 클립 수정 모달. 저장 시 onSaved(updatedRow) 호출.
  function illustrationEditModal(r, onSaved) {
    var s = parseIllusSource(r.source);
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,25,.5);z-index:9800;display:flex;align-items:flex-start;justify-content:center;padding:24px 14px;overflow:auto';
    function fld(label, id, val, ph) { return '<div style="margin-bottom:10px"><label style="display:block;font-size:.78rem;color:#5a6b82;font-weight:700;margin-bottom:4px">' + label + '</label><input type="' + (id === 'ie_date' ? 'date' : 'text') + '" id="' + id + '" value="' + esc(val || '') + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + ' style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font:inherit;outline:none"></div>'; }
    ov.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:680px;width:100%;padding:22px 24px;box-shadow:0 24px 60px rgba(0,0,0,.3)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3 style="margin:0;color:var(--accent,#223350)">✏️ 예화 클립 수정</h3><button class="btn btn-line" id="ie_close" style="padding:3px 11px">닫기</button></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' + fld('일자', 'ie_date', fmtD(r.ref_date)) + fld('본문(성경)', 'ie_scr', r.scripture, '예: 에스겔 33:1-9') + '</div>' +
      fld('제목(책)', 'ie_book', s.book || r.title, '예: 이기는 신앙') +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' + fld('저자', 'ie_author', s.author, '예: 이권희') + fld('출판사', 'ie_pub', s.publisher, '예: 두란노') + '</div>' +
      '<div style="margin-bottom:10px"><label style="display:block;font-size:.78rem;color:#5a6b82;font-weight:700;margin-bottom:4px">내용</label><textarea id="ie_content" style="width:100%;min-height:200px;padding:11px 13px;border:1px solid #e2e8f0;border-radius:8px;font:inherit;line-height:1.7;outline:none;resize:vertical">' + esc(r.content || '') + '</textarea></div>' +
      '<div id="ie_msg" class="fin-msg" style="min-height:0;margin-bottom:8px;text-align:right"></div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn btn-line" id="ie_cancel" style="padding:8px 16px">취소</button><button class="btn btn-solid" id="ie_save" style="padding:8px 20px;font-weight:700">💾 저장</button></div></div>';
    document.body.appendChild(ov);
    var close = pushBackClose(function () { ov.remove(); });
    ov.querySelector('#ie_close').onclick = close;
    ov.querySelector('#ie_cancel').onclick = close;
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('#ie_save').onclick = function () {
      var content = ov.querySelector('#ie_content').value.trim();
      if (!content) { var m = ov.querySelector('#ie_msg'); m.style.color = '#c0392b'; m.textContent = '내용을 입력해 주세요.'; return; }
      var payload = {
        ref_date: ov.querySelector('#ie_date').value || null,
        scripture: ov.querySelector('#ie_scr').value.trim() || null,
        source: composeIllusSource(ov.querySelector('#ie_author').value, ov.querySelector('#ie_book').value, ov.querySelector('#ie_pub').value) || null,
        content: content
      };
      var btn = this; btn.disabled = true; var msg = ov.querySelector('#ie_msg'); msg.style.color = '#7b8794'; msg.textContent = '저장 중…';
      api('PATCH', 'sermon_illustrations?id=eq.' + r.id, payload, 'return=representation').then(function (rows) {
        var saved = (rows && rows[0]) || null;
        for (var k in payload) r[k] = payload[k];
        close(); if (onSaved) onSaved(saved || r);
      }).catch(function (e) { btn.disabled = false; msg.style.color = '#c0392b'; msg.textContent = '저장 실패: ' + e.message; });
    };
  }

  // 예화 클립 검색·선택 모달. opts.onPick(row) 있으면 선택 버튼(라벨 opts.pickLabel) 노출.
  function illustrationsModal(opts) {
    opts = opts || {};
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,25,.5);z-index:9700;display:flex;align-items:flex-start;justify-content:center;padding:24px 14px;overflow:auto';
    ov.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:720px;width:100%;padding:20px 22px;box-shadow:0 24px 60px rgba(0,0,0,.3)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><h3 style="margin:0;color:var(--accent,#223350)">🔍 예화 검색</h3><button class="btn btn-line" id="il_close" style="padding:3px 11px">닫기</button></div>' +
      '<input type="text" id="il_q" placeholder="🔍 제목·저자·출판사·본문·내용 검색" style="width:100%;padding:9px 13px;border:1px solid #e2e8f0;border-radius:9px;font:inherit;margin:6px 0 12px;outline:none">' +
      '<div id="il_list"><p class="qt-loading">불러오는 중…</p></div></div>';
    document.body.appendChild(ov);
    var close = pushBackClose(function () { ov.remove(); });
    ov.querySelector('#il_close').onclick = close;
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    var all = [];
    function draw() {
      var q = (ov.querySelector('#il_q').value || '').trim().toLowerCase();
      var rows = all.filter(function (r) { return !q || ((r.content || '') + (r.scripture || '') + (r.source || '') + (r.title || '')).toLowerCase().indexOf(q) >= 0; });
      var box = ov.querySelector('#il_list');
      if (!all.length) { box.innerHTML = '<div class="fin-card"><p style="color:#9aa5b1;margin:0">보관된 예화 클립이 없습니다. 생명의삶 자동분류 시 자동으로 모입니다.</p></div>'; return; }
      box.innerHTML = rows.length ? rows.map(function (r) {
        var head = [fmtD(r.ref_date), r.scripture].filter(Boolean).map(esc).join(' · ');
        var book = esc(illusBookLine(r));
        return '<div class="fin-card" style="padding:13px 15px">' +
          (head ? '<div style="font-size:.74rem;color:#9aa5b1;margin-bottom:3px">' + head + '</div>' : '') +
          (book ? '<div style="font-size:.9rem;color:#7a5d27;font-weight:700;margin-bottom:6px">' + book + '</div>' : '') +
          '<div style="white-space:pre-wrap;line-height:1.6;font-size:.86rem;color:#41506a;max-height:96px;overflow:hidden;position:relative">' + esc(r.content || '') + '</div>' +
          '<div style="display:flex;gap:6px;margin-top:9px;flex-wrap:wrap"><button class="btn btn-line il-view" data-id="' + esc(r.id) + '" style="padding:4px 11px;font-size:.78rem">📖 전문 보기</button>' +
          (opts.onPick ? '<button class="btn btn-solid il-pick" data-id="' + esc(r.id) + '" style="padding:4px 11px;font-size:.78rem">' + esc(opts.pickLabel || '선택') + '</button>' : '') +
          '<button class="btn btn-line il-copy" data-id="' + esc(r.id) + '" style="padding:4px 11px;font-size:.78rem">📋 복사</button></div></div>';
      }).join('') : '<p style="color:#9aa5b1">검색 결과가 없습니다.</p>';
      var byId = {}; all.forEach(function (r) { byId[r.id] = r; });
      Array.prototype.forEach.call(box.querySelectorAll('.il-view'), function (b) { b.onclick = function () { illustrationViewModal(byId[b.dataset.id]); }; });
      Array.prototype.forEach.call(box.querySelectorAll('.il-copy'), function (b) { b.onclick = function () { var r = byId[b.dataset.id]; copyToClipboard((r.content || '') + (r.source ? '\n— ' + r.source : ''), b); }; });
      Array.prototype.forEach.call(box.querySelectorAll('.il-pick'), function (b) { b.onclick = function () { opts.onPick(byId[b.dataset.id]); close(); }; });
    }
    ov.querySelector('#il_q').oninput = draw;
    api('GET', 'sermon_illustrations?select=*&order=ref_date.desc,created_at.desc').then(function (rows) { all = rows || []; draw(); }).catch(function (e) {
      var box = ov.querySelector('#il_list');
      box.innerHTML = /42P01|PGRST205|does not exist|schema cache|Could not find the table/i.test(e.message) ? msgCard('테이블 준비 필요', 'Supabase ▸ SQL Editor 에서 supabase/sermon_illustrations.sql 을 1회 실행해 주세요.') : msgCard('조회 실패', e.message);
    });
  }

  // 예화 클립 탭(전체 페이지): 목차형 표(일자·제목·저자·출판사·본문) + 보기·삭제
  function renderIllustrations(panel) {
    panel.innerHTML =
      '<div class="fin-card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">' +
      '<div><b style="font-size:1.08rem;color:var(--accent,#223350)">🗂 예화 클립</b>' +
      '<div style="font-size:.84rem;color:var(--ink-soft);margin-top:4px">생명의삶 자동분류에서 모은 예화 클립입니다. <b>보기</b>로 전문을 확인하고, 설교 작성 중에는 ‘예화 검색’으로 원고에 삽입할 수 있습니다.</div></div>' +
      '<input type="text" id="il_q" placeholder="🔍 제목·저자·출판사·본문 검색" style="padding:9px 13px;border:1px solid #e2e8f0;border-radius:9px;font:inherit;min-width:230px;outline:none"></div>' +
      '<div id="il_list"><p class="qt-loading">불러오는 중…</p></div>';
    var all = [];
    function draw() {
      var q = (panel.querySelector('#il_q').value || '').trim().toLowerCase();
      var rows = all.filter(function (r) { return !q || ((r.content || '') + (r.scripture || '') + (r.source || '') + (r.title || '')).toLowerCase().indexOf(q) >= 0; });
      var box = panel.querySelector('#il_list');
      if (!all.length) { box.innerHTML = '<div class="fin-card"><p style="color:#9aa5b1;margin:0">보관된 예화 클립이 없습니다. <b>설교관리 → 설교 시작</b> 후 오른쪽 ‘생명의삶 자동분류’로 자료를 분류하면 예화 클립이 여기에 모입니다.</p></div>'; return; }
      box.innerHTML = '<div class="fin-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b>예화 클립 (' + all.length + '개)</b></div><div style="overflow:auto"><table class="fin-table"><thead><tr><th style="white-space:nowrap">일자</th><th>제목(책)</th><th style="white-space:nowrap">저자</th><th>출판사</th><th>관리</th></tr></thead><tbody>' +
        (rows.length ? rows.map(function (r) {
          var s = parseIllusSource(r.source);
          return '<tr><td style="white-space:nowrap">' + esc(fmtD(r.ref_date) || '') + '</td>' +
            '<td><b class="il-view" data-id="' + esc(r.id) + '" title="클릭하면 전문을 봅니다" style="cursor:pointer;color:var(--accent,#223350);text-decoration:underline;text-decoration-color:#cdd7e3;text-underline-offset:3px">' + esc(s.book || r.title || '(제목 없음)') + '</b></td>' +
            '<td style="white-space:nowrap">' + esc(s.author || '—') + '</td>' +
            '<td>' + esc(s.publisher || '—') + '</td>' +
            '<td style="white-space:nowrap"><button class="btn btn-solid il-view" data-id="' + esc(r.id) + '" style="padding:4px 12px;font-size:.78rem">📖 보기</button> <button class="btn btn-line il-edit" data-id="' + esc(r.id) + '" style="padding:4px 11px;font-size:.78rem">✏️ 수정</button> <button class="btn btn-line il-del" data-id="' + esc(r.id) + '" style="padding:4px 11px;font-size:.78rem">삭제</button></td></tr>';
        }).join('') : '<tr><td colspan="5" style="color:#9aa5b1;padding:10px">검색 결과가 없습니다.</td></tr>') +
        '</tbody></table></div></div>';
      var byId = {}; all.forEach(function (r) { byId[r.id] = r; });
      Array.prototype.forEach.call(box.querySelectorAll('.il-view'), function (b) { b.onclick = function () { illustrationViewModal(byId[b.dataset.id]); }; });
      Array.prototype.forEach.call(box.querySelectorAll('.il-edit'), function (b) { b.onclick = function () { illustrationEditModal(byId[b.dataset.id], function (updated) { for (var i = 0; i < all.length; i++) { if (String(all[i].id) === String(updated.id)) { all[i] = updated; break; } } draw(); }); }; });
      Array.prototype.forEach.call(box.querySelectorAll('.il-del'), function (b) { b.onclick = function () { if (!confirm('이 예화 클립을 삭제할까요?')) return; api('DELETE', 'sermon_illustrations?id=eq.' + b.dataset.id, null, 'return=minimal').then(function () { all = all.filter(function (r) { return String(r.id) !== String(b.dataset.id); }); draw(); }).catch(function (e) { alert('삭제 실패: ' + e.message); }); }; });
    }
    panel.querySelector('#il_q').oninput = draw;
    api('GET', 'sermon_illustrations?select=*&order=ref_date.desc,created_at.desc').then(function (rows) { all = rows || []; draw(); }).catch(function (e) {
      panel.querySelector('#il_list').innerHTML = /42P01|PGRST205|does not exist|schema cache|Could not find the table/i.test(e.message) ? msgCard('테이블 준비 필요', 'Supabase ▸ SQL Editor 에서 supabase/sermon_illustrations.sql 을 1회 실행해 주세요.') : msgCard('조회 실패', e.message);
    });
  }

  function renderSermon(panel, opts) {
    var worshipMode = !!(opts && opts.worship);
    var _now = new Date();   // 목록 기본 필터: 오늘 기준 연·월
    var WTPL = {}, smView = 'list', smRows = [], calYM = null, smTableState = { svc: '전체', ser: '전체', year: String(_now.getFullYear()), month: pad2(_now.getMonth() + 1), week: '전체', sort: 'desc', perPage: 20, page: 1 };
    var SERVICE_COLORS = { '주일 낮 예배': '#2563eb', '주일 밤 예배': '#4f46e5', '수요기도회': '#1e874b', '금요기도회': '#7c3aed', '새벽기도': '#0d9488', '매일 QT': '#d97706', '특별집회': '#c0392b', '기타': '#64748b' };
    function svcColor(s) { return SERVICE_COLORS[s] || '#64748b'; }
    function orderCount(r) { try { var a = JSON.parse(r.worship_order || '[]'); return Array.isArray(a) ? a.length : 0; } catch (e) { return 0; } }
    function hasOrder(r) { return orderCount(r) > 0; }
    api('GET', 'worship_templates?select=*').then(function (rows) { WTPL = {}; (rows || []).forEach(function (r) { WTPL[r.service] = r.items || []; }); }).catch(function () {});
    panel.innerHTML =
      '<div class="fin-card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">' +
      '<div><b style="font-size:1.08rem;color:var(--accent,#223350)">' + (worshipMode ? '예배 준비·관리' : '설교 작성·관리') + '</b>' +
      '<div style="font-size:.84rem;color:var(--ink-soft);margin-top:4px">' + (worshipMode ? '캘린더에서 <b>날짜를 클릭</b>하면 그 날짜의 <b>예배 순서</b>를 짜고 아이패드로 발표할 수 있습니다. (주일 낮 예배 중심)' : '캘린더에서 <b>날짜를 클릭</b>하면 그 날짜로 바로 설교를 준비할 수 있고, 아래 <b>목록</b>에서도 관리됩니다.') + '</div></div>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      '<button class="btn btn-solid" id="sm_start" style="padding:11px 22px;font-size:1rem">' + (worshipMode ? '🎼 예배 순서 작성' : '✍️ 설교 시작') + '</button></div></div>' +
      '<div id="sm_cal"></div>' +
      '<div id="sm_list"><p class="qt-loading">불러오는 중…</p></div>';
    panel.querySelector('#sm_start').onclick = function () { sermonEditor(null); };
    if (pendingSermon) { var _pp = pendingSermon; pendingSermon = null; sermonEditor(_pp); }   // 설교 제안에서 넘어온 prefill

    // ── 우리말성경 일괄입력 헬퍼 ──
    var BKEYS = ['창','출','레','민','신','수','삿','룻','삼상','삼하','왕상','왕하','대상','대하','스','느','에','욥','시','잠','전','아','사','렘','애','겔','단','호','욜','암','옵','욘','미','나','합','습','학','슥','말','마','막','눅','요','행','롬','고전','고후','갈','엡','빌','골','살전','살후','딤전','딤후','딛','몬','히','약','벧전','벧후','요일','요이','요삼','유','계'];
    var BMAP2 = {'창세기':1,'창':1,'출애굽기':2,'출':2,'레위기':3,'레':3,'민수기':4,'민':4,'신명기':5,'신':5,'여호수아':6,'수':6,'사사기':7,'삿':7,'룻기':8,'룻':8,'사무엘상':9,'삼상':9,'사무엘하':10,'삼하':10,'열왕기상':11,'왕상':11,'열왕기하':12,'왕하':12,'역대상':13,'대상':13,'역대하':14,'대하':14,'에스라':15,'스':15,'느헤미야':16,'느':16,'에스더':17,'에':17,'욥기':18,'욥':18,'시편':19,'시':19,'잠언':20,'잠':20,'전도서':21,'전':21,'아가':22,'아':22,'이사야':23,'사':23,'예레미야':24,'렘':24,'예레미야애가':25,'애가':25,'애':25,'에스겔':26,'겔':26,'다니엘':27,'단':27,'호세아':28,'호':28,'요엘':29,'욜':29,'아모스':30,'암':30,'오바댜':31,'옵':31,'요나':32,'욘':32,'미가':33,'미':33,'나훔':34,'나':34,'하박국':35,'합':35,'스바냐':36,'습':36,'학개':37,'학':37,'스가랴':38,'슥':38,'말라기':39,'말':39,'마태복음':40,'마':40,'마가복음':41,'막':41,'누가복음':42,'눅':42,'요한복음':43,'요':43,'사도행전':44,'행':44,'로마서':45,'롬':45,'고린도전서':46,'고전':46,'고린도후서':47,'고후':47,'갈라디아서':48,'갈':48,'에베소서':49,'엡':49,'빌립보서':50,'빌':50,'골로새서':51,'골':51,'데살로니가전서':52,'살전':52,'데살로니가후서':53,'살후':53,'디모데전서':54,'딤전':54,'디모데후서':55,'딤후':55,'디도서':56,'딛':56,'빌레몬서':57,'몬':57,'히브리서':58,'히':58,'야고보서':59,'약':59,'베드로전서':60,'벧전':60,'베드로후서':61,'벧후':61,'요한일서':62,'요일':62,'요한이서':63,'요이':63,'요한삼서':64,'요삼':64,'유다서':65,'유':65,'요한계시록':66,'계':66,'계시록':66};
    function parseScripRef(ref) {
      var s = (ref || '').trim().replace(/\s+/g, ' ');
      var m = s.match(/^([가-힣]+)\s*(\d+)\s*[:장]\s*(\d+)(?:\s*[-~]\s*(\d+))?/);
      if (!m) return null;
      var bid = BMAP2[m[1].replace(/\s/g, '')];
      if (!bid) return null;
      return { bookId: bid, ch: parseInt(m[2], 10), from: parseInt(m[3], 10), to: m[4] ? parseInt(m[4], 10) : parseInt(m[3], 10) };
    }
    function bulkFillUrm() {
      var todo = smRows.filter(function (r) {
        return !r.qt_bible_text && r.scripture;
      });
      if (!todo.length) { alert('우리말 미입력 항목이 없습니다.'); return; }
      if (!confirm('우리말성경 미입력 ' + todo.length + '개를 자동 입력합니다.\n잠시 시간이 걸릴 수 있습니다. 계속할까요?')) return;
      var btn = panel.querySelector('#sm_bulk_urm');
      function proceed(urm) {
        var done = 0, skipped = [], idx = 0;
        function next() {
          if (btn) btn.textContent = '처리 중 ' + (done + skipped.length) + '/' + todo.length + '…';
          if (idx >= todo.length) {
            if (btn) { btn.textContent = '📥 우리말 일괄입력'; btn.disabled = false; }
            loadList();
            alert('완료 — ' + done + '개 입력 성공' + (skipped.length ? '\n파싱 불가 ' + skipped.length + '개: ' + skipped.join(', ') : ''));
            return;
          }
          var r = todo[idx++];
          var p = parseScripRef(r.scripture);
          var key = p ? BKEYS[p.bookId - 1] : null;
          if (!p || !key) { skipped.push(r.scripture || '?'); next(); return; }
          var chap = (urm[key] || [])[p.ch - 1] || [];
          var lines = [];
          for (var vi = p.from; vi <= p.to; vi++) { var t = chap[vi - 1]; if (t) lines.push(vi + ' ' + t.trim()); }
          if (!lines.length) { skipped.push(r.scripture || '?'); next(); return; }
          var text = lines.join('\n');
          api('PATCH', 'sermons?id=eq.' + r.id, { qt_bible_text: text }, 'return=minimal')
            .then(function () { r.qt_bible_text = text; done++; next(); })
            .catch(function () { skipped.push(r.scripture || '?'); next(); });
        }
        if (btn) btn.disabled = true;
        next();
      }
      if (window.BIBLE_URM) { proceed(window.BIBLE_URM); return; }
      if (btn) { btn.disabled = true; btn.textContent = 'JSON 로드 중…'; }
      fetch('data/bible-urm.json?v=20260729')
        .then(function (r) { return r.json(); })
        .then(function (d) { window.BIBLE_URM = d; proceed(d); })
        .catch(function () { alert('우리말성경 데이터 로드 실패'); if (btn) { btn.disabled = false; btn.textContent = '📥 우리말 일괄입력'; } });
    }

    // ── 새벽기도 → 매일 QT 예배종류 일괄 전환 ──
    function bulkConvertDawnToQt() {
      var todo = smRows.filter(function (r) { return r.service === '새벽기도'; });
      if (!todo.length) { alert('전환할 "새벽기도" 항목이 없습니다.'); return; }
      if (!confirm('"새벽기도" ' + todo.length + '개를 모두 "매일 QT"로 전환합니다.\n계속할까요?')) return;
      var btn = panel.querySelector('#sm_conv_dawn');
      if (btn) { btn.disabled = true; }
      var CHUNK = 50;
      var ids = todo.map(function (r) { return r.id; });
      var chunks = [];
      for (var i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
      var done = 0, failed = 0, ci = 0;
      function next() {
        if (btn) btn.textContent = '전환 중 ' + Math.min(done + failed, ids.length) + '/' + ids.length + '…';
        if (ci >= chunks.length) {
          if (btn) { btn.disabled = false; btn.textContent = '🔁 새벽기도→QT 전환'; }
          loadList();
          alert('완료 — ' + done + '개를 "매일 QT"로 전환했습니다.' + (failed ? '\n실패 ' + failed + '개' : ''));
          return;
        }
        var chunk = chunks[ci++];
        api('PATCH', 'sermons?id=in.(' + chunk.join(',') + ')', { service: '매일 QT' }, 'return=minimal')
          .then(function () { done += chunk.length; next(); })
          .catch(function () { failed += chunk.length; next(); });
      }
      next();
    }

    function loadList() {
      api('GET', 'sermons?select=*&order=sermon_date.desc,created_at.desc').then(function (rows) { smRows = rows || []; renderView(); }).catch(function (e) {
        var listBox = panel.querySelector('#sm_list');
        if (/42P01|PGRST205|does not exist|schema cache|Could not find the table/i.test(e.message)) listBox.innerHTML = msgCard('테이블 준비 필요', 'Supabase → SQL Editor 에서 supabase/affairs_modules.sql 을 1회 실행해 주세요.');
        else listBox.innerHTML = msgCard('조회 실패', e.message);
      });
    }
    function renderView() { renderCalendar(); renderTable(); }
    function wireRows(box) {
      var byId = {}; smRows.forEach(function (r) { byId[r.id] = r; });
      Array.prototype.forEach.call(box.querySelectorAll('.sm-read'), function (b) { b.onclick = function () { sermonReadingView(byId[b.dataset.id], { qt: false }); }; });
      Array.prototype.forEach.call(box.querySelectorAll('.sm-qt'), function (b) { b.onclick = function () { sermonReadingView(byId[b.dataset.id], { qt: true }); }; });
      Array.prototype.forEach.call(box.querySelectorAll('.sm-kakao'), function (b) { b.onclick = function () { copyKakaoQt(byId[b.dataset.id]); }; });
      Array.prototype.forEach.call(box.querySelectorAll('.sm-title'), function (b) { b.onclick = function () { sermonEditor(byId[b.dataset.id]); }; });
      Array.prototype.forEach.call(box.querySelectorAll('.sm-edit'), function (b) { b.onclick = function () { sermonEditor(byId[b.dataset.id]); }; });
      Array.prototype.forEach.call(box.querySelectorAll('.sm-del'), function (b) { b.onclick = function () { if (!confirm('이 설교를 삭제할까요?')) return; api('DELETE', 'sermons?id=eq.' + b.dataset.id, null, 'return=minimal').then(loadList).catch(function (e) { alert('삭제 실패: ' + e.message); }); }; });
      Array.prototype.forEach.call(box.querySelectorAll('.sm-orderdel'), function (b) { b.onclick = function () { if (!confirm('이 날짜의 예배 순서를 삭제할까요?\n(설교 내용은 설교관리에 그대로 남습니다)')) return; api('PATCH', 'sermons?id=eq.' + b.dataset.id, { worship_order: null }, 'return=minimal').then(loadList).catch(function (e) { alert('삭제 실패: ' + e.message); }); }; });
      Array.prototype.forEach.call(box.querySelectorAll('.cal-item'), function (el) { el.onclick = function (e) { e.stopPropagation(); sermonEditor(byId[el.dataset.id]); }; });
    }
    function renderTable() {
      var listBox = panel.querySelector('#sm_list');
      if (worshipMode) {
        var wrows = smRows.filter(hasOrder);
        if (!wrows.length) { listBox.innerHTML = '<div class="fin-card"><p style="color:var(--ink-soft);margin:0">작성된 예배 순서가 없습니다. <b>예배 순서 작성</b>을 누르거나 위 달력에서 날짜를 클릭해 시작하세요.</p></div>'; return; }
        listBox.innerHTML = '<div class="fin-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b>예배 (' + wrows.length + '건)</b></div><div style="overflow:auto"><table class="fin-table"><thead><tr><th style="width:40px;text-align:center">순번</th><th>일자</th><th>예배</th><th>제목</th><th>본문</th><th>순서</th><th>관리</th></tr></thead><tbody>' +
          wrows.map(function (r, i) {
            var c = svcColor(r.service), ds = fmtD(r.sermon_date), n = orderCount(r);
            return '<tr><td style="text-align:center;color:#9aa5b1;font-size:.8rem">' + (i + 1) + '</td><td style="white-space:nowrap">' + esc(ds) + '</td><td style="white-space:nowrap"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + c + ';margin-right:5px"></span>' + esc(r.service || '') + '</td>' +
              '<td><b class="sm-edit" data-id="' + esc(r.id) + '" title="클릭하면 예배 순서를 엽니다" style="cursor:pointer;color:var(--accent,#223350);text-decoration:underline;text-decoration-color:#cdd7e3;text-underline-offset:3px">' + esc(r.title || '(제목없음)') + '</b></td>' +
              '<td style="white-space:nowrap">' + esc(r.scripture || '') + '</td><td style="white-space:nowrap">' + n + '항목</td>' +
              '<td style="white-space:nowrap"><button class="btn btn-solid sm-read" data-id="' + esc(r.id) + '" style="padding:4px 11px;font-size:.78rem">📖 발표</button> <button class="btn btn-line sm-edit" data-id="' + esc(r.id) + '" style="padding:4px 9px;font-size:.78rem">수정</button> <button class="btn btn-line sm-orderdel" data-id="' + esc(r.id) + '" style="padding:4px 9px;font-size:.78rem">순서삭제</button></td></tr>';
          }).join('') + '</tbody></table></div></div>';
        wireRows(listBox); return;
      }
      if (!smRows.length) { listBox.innerHTML = '<div class="fin-card"><p style="color:var(--ink-soft);margin:0">등록된 설교가 없습니다. <b>설교 시작</b>으로 작성해 보세요.</p></div>'; return; }

      // ── 고유 예배종류·연도 추출 ──
      var svcOrder = Object.keys(SERVICE_COLORS);
      var svcSet = {}, yearSet = {}, serSet = {};
      smRows.forEach(function (r) {
        if (r.service) svcSet[r.service] = true;
        String(r.series || '').split(',').forEach(function (s) { s = s.trim(); if (s) serSet[s] = true; });   // 설교 시리즈
        var y = (r.sermon_date || '').slice(0, 4);
        if (y) yearSet[y] = true;
      });
      yearSet[String(new Date().getFullYear())] = true;   // 올해는 자료가 없어도 항상 선택 가능(기본 필터와 일치)
      var svcs = ['전체'].concat(svcOrder.filter(function (s) { return svcSet[s]; }))
        .concat(Object.keys(svcSet).filter(function (s) { return svcOrder.indexOf(s) < 0; }).sort());   // 사용자 정의 분류(기타→새 이름)도 필터에
      var yrs = ['전체'].concat(Object.keys(yearSet).sort(function (a, b) { return b.localeCompare(a); }));
      var sers = ['전체'].concat(Object.keys(serSet).sort());
      if (sers.indexOf(smTableState.ser) < 0) smTableState.ser = '전체';

      // ── 필터·정렬 적용 ──
      var filtSvc = smTableState.svc, filtYear = smTableState.year, filtMonth = smTableState.month, filtSer = smTableState.ser;
      var monthOn = (filtMonth !== '전체');
      var filtWeek = smTableState.week || '전체';
      var weekOn = monthOn && filtWeek !== '전체';   // 주차는 특정 월을 골랐을 때만 의미가 있다
      function weekOfMonth(d) { var day = parseInt(String(d || '').slice(8, 10), 10); return day ? Math.ceil(day / 7) : 0; }   // 1~7일=1주 … 29~31일=5주
      var sortDir = smTableState.sort, perPage = smTableState.perPage, page = smTableState.page;
      var filtered = smRows.filter(function (r) {
        var svcOk = (filtSvc === '전체') || (r.service === filtSvc);
        var serOk = (filtSer === '전체') || (String(r.series || '').split(',').map(function (s) { return s.trim(); }).indexOf(filtSer) >= 0);
        var yearOk = (filtYear === '전체') || ((r.sermon_date || '').slice(0, 4) === filtYear);
        var monthOk = !monthOn || ((r.sermon_date || '').slice(5, 7) === filtMonth);
        var weekOk = !weekOn || (weekOfMonth(r.sermon_date) === Number(filtWeek));
        return svcOk && serOk && yearOk && monthOk && weekOk;
      }).slice().sort(function (a, b) {
        var da = a.sermon_date || '', db = b.sermon_date || '';
        // 특정 월을 고르면 항상 1일→31일 순서(오름차순)로 표기
        if (monthOn) return da.localeCompare(db);
        if (sortDir === 'asc') return da.localeCompare(db);
        // 최신순 = '오늘 기준' — 오늘·과거를 최신순으로 먼저, 미래(게시예정)는 가까운 날부터 뒤에
        var td = today();
        var aFut = da > td, bFut = db > td;
        if (aFut !== bFut) return aFut ? 1 : -1;        // 미래는 항상 과거·오늘 뒤로
        if (aFut) return da.localeCompare(db);          // 미래끼리: 가까운 날(오름차순) 먼저
        return db.localeCompare(da);                    // 과거·오늘끼리: 최신(내림차순) 먼저
      });
      var total = filtered.length;
      var totalPages = Math.max(1, Math.ceil(total / perPage));
      if (page > totalPages) { page = smTableState.page = 1; }
      var baseIdx = (page - 1) * perPage;
      var pageRows = filtered.slice(baseIdx, baseIdx + perPage);
      var todayS = today();

      // ── 컨트롤 바 ──
      var svcSel = '<select id="sm_flt_svc" style="padding:5px 10px;border:1px solid #dfe5ee;border-radius:8px;font:inherit;font-size:.84rem;cursor:pointer">' +
        svcs.map(function (s) { return '<option value="' + esc(s) + '"' + (s === filtSvc ? ' selected' : '') + '>' + esc(s === '전체' ? '전체 예배' : s) + '</option>'; }).join('') + '</select>';
      var yrSel = '<select id="sm_flt_yr" style="padding:5px 10px;border:1px solid #dfe5ee;border-radius:8px;font:inherit;font-size:.84rem;cursor:pointer">' +
        yrs.map(function (y) { return '<option value="' + esc(y) + '"' + (y === filtYear ? ' selected' : '') + '>' + (y === '전체' ? '전체 연도' : y + '년') + '</option>'; }).join('') + '</select>';
      var moList = ['전체', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
      var moSel = '<select id="sm_flt_mo" style="padding:5px 10px;border:1px solid #dfe5ee;border-radius:8px;font:inherit;font-size:.84rem;cursor:pointer">' +
        moList.map(function (mo) { return '<option value="' + mo + '"' + (mo === filtMonth ? ' selected' : '') + '>' + (mo === '전체' ? '전체 월' : parseInt(mo, 10) + '월') + '</option>'; }).join('') + '</select>';
      // 시리즈 필터 — 시리즈가 하나라도 등록돼 있을 때만 표시
      var serSel = sers.length > 1 ? '<select id="sm_flt_ser" style="padding:5px 10px;border:1px solid #dfe5ee;border-radius:8px;font:inherit;font-size:.84rem;cursor:pointer;max-width:170px">' +
        sers.map(function (s) { return '<option value="' + esc(s) + '"' + (s === filtSer ? ' selected' : '') + '>' + esc(s === '전체' ? '전체 시리즈' : '📚 ' + s) + '</option>'; }).join('') + '</select>' : '';
      var sortBtn = monthOn
        ? '<button id="sm_sort_btn" class="btn btn-line" style="padding:5px 13px;font-size:.84rem;color:#8a93a0;cursor:default" title="월을 선택하면 1일→31일 순으로 정렬됩니다" disabled>▲ 1일→31일 순</button>'
        : '<button id="sm_sort_btn" class="btn btn-line" style="padding:5px 13px;font-size:.84rem" title="최신순: 오늘·최근 설교를 위로, 게시예정(미래)은 가까운 날부터 아래로">' + (sortDir === 'desc' ? '▼ 최신순(오늘 기준)' : '▲ 오래된순') + '</button>';
      // 주차 버튼 — 특정 월을 골랐을 때만 표시(1주=1~7일 … 5주=29~31일)
      var weekBtns = '';
      if (monthOn) {
        weekBtns = '<span style="display:inline-flex;flex-wrap:wrap;gap:4px;align-items:center">' +
          ['전체', '1', '2', '3', '4', '5'].map(function (w) {
            var on = (String(filtWeek) === w);
            return '<button class="sm-wk" data-wk="' + w + '" style="padding:5px 11px;border:1px solid ' + (on ? 'var(--accent,#223350)' : '#dfe5ee') + ';border-radius:8px;background:' + (on ? 'var(--accent,#223350)' : '#fff') + ';color:' + (on ? '#fff' : '#3a4a63') + ';cursor:pointer;font-size:.82rem;font-weight:' + (on ? '700' : '400') + '">' + (w === '전체' ? '전체 주' : w + '주') + '</button>';
          }).join('') + '</span>';
      }
      var ppSel = '<select id="sm_per_page" style="padding:5px 10px;border:1px solid #dfe5ee;border-radius:8px;font:inherit;font-size:.84rem;cursor:pointer">' +
        [20, 30, 50].map(function (n) { return '<option value="' + n + '"' + (n === perPage ? ' selected' : '') + '>' + n + '개씩</option>'; }).join('') + '</select>';
      var info = '<span style="font-size:.83rem;color:#9aa5b1">' + total + '편 / ' + pageRows.length + '편 표시</span>';

      // ── 페이지네이션 ──
      var pageBtns = '';
      if (totalPages > 1) {
        var from = Math.max(1, page - 2), to = Math.min(totalPages, from + 4);
        from = Math.max(1, to - 4);
        function pgBtn(pg, label) {
          return '<button class="sm-pg" data-pg="' + pg + '" style="padding:4px 11px;border:1px solid #dfe5ee;border-radius:6px;background:#fff;cursor:pointer;font-size:.84rem">' + label + '</button>';
        }
        if (page > 10) pageBtns += pgBtn(Math.max(1, page - 10), '«10');
        if (page > 1) pageBtns += pgBtn(page - 1, '‹');
        for (var pi = from; pi <= to; pi++) {
          var isActive = pi === page;
          pageBtns += '<button class="sm-pg" data-pg="' + pi + '" style="padding:4px 11px;border:1px solid ' + (isActive ? 'var(--accent,#223350)' : '#dfe5ee') + ';border-radius:6px;background:' + (isActive ? 'var(--accent,#223350)' : '#fff') + ';color:' + (isActive ? '#fff' : 'inherit') + ';cursor:pointer;font-size:.84rem;font-weight:' + (isActive ? '700' : '400') + '">' + pi + '</button>';
        }
        if (page < totalPages) pageBtns += pgBtn(page + 1, '›');
        if (page <= totalPages - 10) pageBtns += pgBtn(Math.min(totalPages, page + 10), '10»');
      }

      // ── 테이블 행 ──
      var tableRows = pageRows.map(function (r, i) {
        var num = baseIdx + i + 1;
        var c = svcColor(r.service);
        var isQt = (r.service === '매일 QT');   // 게시는 매일 QT만 (새벽기도는 비게시 — 2026-07 정책)
        var ds = fmtD(r.sermon_date);
        var hasUri = !!(r.qt_bible_text && r.qt_bible_text.trim());
        var qtCell;
        if (!isQt) { qtCell = '<span style="color:#cbd2db">—</span>'; }
        else if (ds && ds <= todayS) { qtCell = '<span class="fin-pill" style="background:#e6f4ea;color:#1e874b">🟢 게시중</span>' + (hasUri ? '' : '<div style="font-size:.7rem;color:#c0392b;margin-top:2px">우리말 미입력</div>'); }
        else { qtCell = '<span class="fin-pill" style="background:#fff4e0;color:#a8742a">🕒 ' + esc(ds) + ' 게시예정</span>' + (hasUri ? '' : '<div style="font-size:.7rem;color:#c0392b;margin-top:2px">우리말 미입력</div>'); }
        return '<tr><td style="text-align:center;color:#9aa5b1;font-size:.8rem">' + num + '</td>' +
          '<td style="white-space:nowrap">' + esc(ds) + '</td>' +
          '<td style="white-space:nowrap"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + c + ';margin-right:5px"></span>' + esc(r.service || '') + '</td>' +
          '<td style="min-width:11em;word-break:keep-all"><b class="sm-title" data-id="' + esc(r.id) + '"' + (r.summary ? ' title="' + esc(String(r.summary).slice(0, 200)) + '"' : '') + ' style="cursor:pointer;color:var(--accent,#223350);text-decoration:underline;text-decoration-color:#cdd7e3;text-underline-offset:3px">' + esc(r.title || '(제목없음)') + '</b>' +
          (r.series ? '<div style="margin-top:2px">' + String(r.series).split(',').map(function (s) { s = s.trim(); return s ? '<span style="display:inline-block;font-size:.66rem;background:#eef3fa;color:#3a5a8c;border:1px solid #d9e4f2;border-radius:999px;padding:1px 7px;margin:1px 3px 0 0">📚 ' + esc(s) + '</span>' : ''; }).join('') + '</div>' : '') + '</td>' +
          '<td style="white-space:nowrap">' + esc(r.scripture || '') + '</td>' +
          '<td style="white-space:nowrap">' + qtCell + '</td>' +
          '<td style="white-space:nowrap">' +
          (isQt ? '<button class="btn btn-line sm-qt" data-id="' + esc(r.id) + '" style="padding:4px 9px;font-size:.78rem;background:#fff8e6;border-color:#e6c97a">📲 QT</button> <button class="btn btn-line sm-kakao" data-id="' + esc(r.id) + '" style="padding:4px 9px;font-size:.78rem;background:#fff8c4;border-color:#f4d641">💬 톡 복사</button>' : '') +
          ' <button class="btn btn-line sm-edit" data-id="' + esc(r.id) + '" style="padding:4px 9px;font-size:.78rem">수정</button>' +
          ' <button class="btn btn-line sm-del" data-id="' + esc(r.id) + '" style="padding:4px 9px;font-size:.78rem">삭제</button></td></tr>';
      }).join('');

      listBox.innerHTML =
        '<div class="fin-card">' +
        '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #eef1f5">' +
        '<b style="font-size:.95rem">설교</b>' + svcSel + serSel + yrSel + moSel + weekBtns + sortBtn + ppSel +
        '<span style="margin-left:auto">' + info + '</span></div>' +
        '<div style="overflow:auto;-webkit-overflow-scrolling:touch"><table class="fin-table" style="min-width:660px"><thead><tr>' +
        '<th style="width:40px;text-align:center">순번</th><th>일자</th><th>예배</th><th>제목</th><th>본문</th><th>오늘의 말씀(QT)</th><th>관리</th>' +
        '</tr></thead><tbody>' + tableRows + '</tbody></table></div>' +
        (pageBtns ? '<div style="display:flex;justify-content:center;gap:4px;margin-top:14px;flex-wrap:wrap">' + pageBtns + '</div>' : '') +
        '</div>';

      wireRows(listBox);
      listBox.querySelector('#sm_flt_svc').onchange = function () { smTableState.svc = this.value; smTableState.page = 1; renderTable(); };
      listBox.querySelector('#sm_flt_yr').onchange = function () { smTableState.year = this.value; smTableState.page = 1; renderTable(); };
      listBox.querySelector('#sm_flt_mo').onchange = function () { smTableState.month = this.value; smTableState.week = '전체'; smTableState.page = 1; renderTable(); };
      Array.prototype.forEach.call(listBox.querySelectorAll('.sm-wk'), function (b) {
        b.onclick = function () { smTableState.week = b.dataset.wk; smTableState.page = 1; renderTable(); };
      });
      var serSelEl = listBox.querySelector('#sm_flt_ser');
      if (serSelEl) serSelEl.onchange = function () { smTableState.ser = this.value; smTableState.page = 1; renderTable(); };
      var sortBtnEl = listBox.querySelector('#sm_sort_btn');
      if (sortBtnEl && !sortBtnEl.disabled) sortBtnEl.onclick = function () { smTableState.sort = smTableState.sort === 'desc' ? 'asc' : 'desc'; renderTable(); };
      listBox.querySelector('#sm_per_page').onchange = function () { smTableState.perPage = Number(this.value); smTableState.page = 1; renderTable(); };
      Array.prototype.forEach.call(listBox.querySelectorAll('.sm-pg'), function (btn) {
        btn.onclick = function () { smTableState.page = Number(btn.dataset.pg); renderTable(); };
      });
    }
    function renderCalendar() {
      var calBox = panel.querySelector('#sm_cal');
      if (!calBox) return;
      if (!calYM) { var t = new Date(); calYM = { y: t.getFullYear(), m: t.getMonth() }; }
      var y = calYM.y, m = calYM.m, startDow = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
      var todayStr = today();
      var byDate = {}; smRows.forEach(function (r) { if (worshipMode && !hasOrder(r)) return; var d = fmtD(r.sermon_date); if (d) (byDate[d] = byDate[d] || []).push(r); });
      var legend = Object.keys(SERVICE_COLORS).map(function (s) { return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:.74rem;margin:0 9px 4px 0"><span style="width:11px;height:11px;border-radius:3px;background:' + SERVICE_COLORS[s] + '"></span>' + esc(s) + '</span>'; }).join('');
      var wd = ['일', '월', '화', '수', '목', '금', '토'];
      var html = '<div class="fin-card"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">' +
        '<div style="display:flex;align-items:center;gap:8px"><button class="btn btn-line" id="cal_prev" style="padding:3px 11px">‹</button><b style="font-size:1.05rem;min-width:110px;text-align:center">' + y + '년 ' + (m + 1) + '월</b><button class="btn btn-line" id="cal_next" style="padding:3px 11px">›</button><button class="btn btn-line" id="cal_today" style="padding:3px 10px;font-size:.8rem">오늘</button></div>' +
        '<div style="display:flex;flex-wrap:wrap;align-items:center"><span style="font-size:.72rem;color:#9aa5b1;margin-right:10px">날짜 클릭 → ' + (worshipMode ? '예배 순서 작성' : '설교 작성') + '</span>' + legend + '</div></div>' +
        '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">' +
        wd.map(function (w, i) { return '<div style="text-align:center;font-size:.78rem;font-weight:700;color:' + (i === 0 ? '#c0392b' : (i === 6 ? '#2563eb' : '#7b8794')) + ';padding:4px 0">' + w + '</div>'; }).join('');
      for (var b = 0; b < startDow; b++) html += '<div></div>';
      for (var dd = 1; dd <= days; dd++) {
        var ds = y + '-' + pad2(m + 1) + '-' + pad2(dd), dow = new Date(y, m, dd).getDay(), isToday = (ds === todayStr);
        var items = (byDate[ds] || []).map(function (r) { var c = svcColor(r.service); return '<div class="cal-item" data-id="' + esc(r.id) + '" title="' + esc((r.service || '') + ' · ' + (r.title || '') + (r.scripture ? ' · ' + r.scripture : '')) + '" style="background:' + c + '1a;border-left:3px solid ' + c + ';border-radius:4px;padding:2px 5px;margin-top:3px;cursor:pointer;font-size:.72rem;line-height:1.25"><b style="color:' + c + '">' + esc(r.title || '(제목없음)') + '</b>' + (r.scripture ? '<div style="color:#7b8794">' + esc(r.scripture) + '</div>' : '') + '</div>'; }).join('');
        var dnumColor = isToday ? '#fff' : (dow === 0 ? '#c0392b' : (dow === 6 ? '#2563eb' : '#48576b'));
        var dnum = isToday
          ? '<span style="display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;border-radius:50%;background:#2f5d50;color:#fff;font-size:.74rem;font-weight:700">' + dd + '</span>'
          : '<span style="font-size:.78rem;color:' + dnumColor + '">' + dd + '</span>';
        html += '<div class="cal-day" data-date="' + ds + '" title="' + ds + ' — 이 날짜로 설교 작성" style="min-height:86px;border:1px solid ' + (isToday ? '#2f5d50' : '#eef1f5') + ';border-radius:8px;padding:4px 5px;background:' + (isToday ? '#f1f7f5' : '#fff') + ';cursor:pointer;transition:background .12s">' + dnum + items + '</div>';
      }
      html += '</div><div style="font-size:.72rem;color:#9aa5b1;margin-top:8px">' + (worshipMode ? '＋ 빈 날짜를 클릭하면 그 날짜로 새 예배 순서를, 예배 칸을 클릭하면 해당 예배를 엽니다.' : '＋ 빈 날짜를 클릭하면 그 날짜로 새 설교를, 설교 칸을 클릭하면 해당 설교를 엽니다.') + '</div></div>';
      calBox.innerHTML = html;
      panel.querySelector('#cal_prev').onclick = function () { var nm = m - 1, ny = y; if (nm < 0) { nm = 11; ny--; } calYM = { y: ny, m: nm }; renderCalendar(); };
      panel.querySelector('#cal_next').onclick = function () { var nm = m + 1, ny = y; if (nm > 11) { nm = 0; ny++; } calYM = { y: ny, m: nm }; renderCalendar(); };
      panel.querySelector('#cal_today').onclick = function () { var t = new Date(); calYM = { y: t.getFullYear(), m: t.getMonth() }; renderCalendar(); };
      Array.prototype.forEach.call(calBox.querySelectorAll('.cal-day'), function (cell) {
        cell.onmouseenter = function () { cell.style.background = '#eef4ff'; };
        cell.onmouseleave = function () { cell.style.background = (cell.dataset.date === todayStr) ? '#f1f7f5' : '#fff'; };
        cell.onclick = function () {
          var ds = cell.dataset.date;
          if (worshipMode) {
            // 그 날짜의 기존 설교(주일 낮 예배 우선)에 예배 순서를 붙임 — 새 빈 레코드 방지(설교 본문 유지)
            var exist = smRows.filter(function (r) { return fmtD(r.sermon_date) === ds; });
            var pick = null, i; for (i = 0; i < exist.length; i++) { if (exist[i].service === '주일 낮 예배') { pick = exist[i]; break; } }
            if (!pick && exist.length) pick = exist[0];
            sermonEditor(pick || { sermon_date: ds, service: '주일 낮 예배' });
          } else { sermonEditor({ sermon_date: ds }); }
        };
      });
      wireRows(calBox);
    }
    loadList();

    // 설교 작성 페이지(전체화면)
    function sermonEditor(rec) {
      rec = rec || {};
      // 생명의삶 자동분류 등 ed.innerHTML을 코드로 바꿔치기하는 곳에서 페이지 나눔을 다시 계산하도록 호출하는 훅
      // (wdPageView() IIFE 안에서 실제 함수가 대입됨 — 'input' 이벤트가 안 나는 프로그램적 변경 후 반드시 호출해야 함)
      var wdRepaginate = null;
      // 저장·미리보기용으로 '깨끗한' 원고 HTML을 돌려주는 훅 — 페이지 나눔 간격(.pg-break-spacer)과
      // 페이지 넘김용으로 쪼갠 조각(.pg-cont)을 모두 원상복구해, 원래 문단 구조 그대로의 HTML을 준다(wdPageView에서 대입).
      var wdCleanHtml = null;
      var ov = document.createElement('div');
      ov.className = worshipMode ? 'sed-lightov' : 'sed-dark';   // 설교 매니저 = 다크 스튜디오, 예배 매니저 = 기존 라이트
      ov.style.cssText = worshipMode
        ? 'position:fixed;inset:0;background:#f5f7fa;z-index:9000;overflow:auto'
        : 'position:fixed;inset:0;background:#141922;z-index:9000;overflow:hidden;display:flex;flex-direction:column';
      var svcList = SVC_OPTS.slice();
      (smRows || []).forEach(function (r) { if (r.service && svcList.indexOf(r.service) < 0) svcList.push(r.service); });   // 사용자 정의 분류(기타→새 이름)도 목록에
      if (rec.service && svcList.indexOf(rec.service) < 0) svcList.unshift(rec.service);   // 옛 명칭(예: 수요예배) 보존
      var svcOpts = svcList.map(function (o) { return '<option' + (o === (rec.service || '') ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('');
      // 설교 원고 글꼴 — 모두 오픈폰트 라이선스(상업적 무료). [표시명, CSS font-family]
      var SED_FONTS = [
        ['본명조', "'Noto Serif KR',serif"],
        ['본고딕', "'Noto Sans KR',sans-serif"],
        ['나눔명조', "'Nanum Myeongjo',serif"],
        ['나눔고딕', "'Nanum Gothic',sans-serif"],
        ['고운바탕', "'Gowun Batang',serif"],
        ['송명', "'Song Myung',serif"],
        ['IBM 고딕', "'IBM Plex Sans KR',sans-serif"],
        ['개구(손글씨)', "'Gaegu',cursive"],
        ['나눔펜(손글씨)', "'Nanum Pen Script',cursive"]
      ];
      var fontOptsHtml = '<option value="" disabled selected>글꼴</option>' + SED_FONTS.map(function (f) {
        return '<option value="' + f[1].replace(/"/g, '&quot;') + '" style="font-family:' + f[1] + '">' + esc(f[0]) + '</option>';
      }).join('');
      var SED_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48];
      var sizeOptsHtml = SED_SIZES.map(function (s) { return '<option value="' + s + '"' + (s === 18 ? ' selected' : '') + '>' + s + '</option>'; }).join('');
      var FORE_COLORS = ['#1a1a1a', '#0a2c5c', '#1d6fb8', '#0d7a4f', '#0e8a74', '#b8860b', '#d97706', '#c0392b', '#d81b60', '#8e44ad', '#5b6b7d', '#ffffff'];
      var HI_COLORS = ['#fff59d', '#ffe0a3', '#c8f7d4', '#bfe3ff', '#f8c9d4', '#e6d6ff', '#e2e8f0', 'transparent'];
      ov.innerHTML =
        '<style>' +
        '.sed-wrap{position:relative;padding:22px 24px 70px}' +
        '.sed-aside{position:absolute;left:24px;top:22px;width:268px}' +
        '.sed-aside-r{position:absolute;right:24px;top:22px;width:300px}' +
        '.sed-mode-sermon .sed-aside{display:none}' +          // 설교 매니저: 예배 순서 숨김
        '.sed-mode-worship .sed-aside-r{display:none}' +        // 예배 매니저: 생명의삶 자동분류 숨김
        '.sed-mode-worship .se-hide-worship{display:none}' +   // 예배 매니저: 설교 본문·원고·기도·QT 숨김
        '.sed-wrap.sed-mode-worship{display:flex;flex-direction:column}' +
        '.sed-wrap.sed-mode-worship .sed-form{order:1;max-width:780px;margin:0 auto;width:100%}' +
        '.sed-wrap.sed-mode-worship .sed-aside{order:2;position:static;left:auto;top:auto;width:100%;max-width:880px;margin:4px auto 0}' +
        '.sed-mode-worship .sed-aside>.af-field>label{font-size:1.35rem}' +
        '.sed-mode-worship #se_order .od-row{padding:10px 12px;margin-bottom:8px}' +
        '.qtc-card{border:1px solid #e1e6ef;border-radius:12px;background:#fff;padding:14px 15px;box-shadow:0 4px 14px rgba(34,51,80,.05)}' +
        '.qtc-h{font-size:1.02rem;font-weight:800;color:var(--accent,#223350);display:flex;align-items:center;gap:5px}' +
        '.qtc-sub{font-size:.74rem;color:#9aa5b1;margin:5px 0 9px;line-height:1.45}' +
        '.qtc-paste{width:100%;min-height:148px;border:1px solid #e2e8f0;border-radius:8px;padding:9px 11px;font:inherit;font-size:.82rem;line-height:1.5;outline:none;resize:vertical}.qtc-paste:focus{border-color:#9db4d6}' +
        '.qtc-rrow{font-size:.76rem;color:#41607f;background:#f3f7fc;border-radius:7px;padding:5px 9px;margin-top:5px;display:flex;gap:6px}.qtc-rrow b{color:#0a2c5c}' +
        // 문서(설교 원고) 페이지 — MS Word 스타일: 회색 캔버스 위 흰 페이지
        '.sed-form{max-width:820px;margin:0 auto;background:#fff;border:1px solid #e7ebf2;border-radius:16px;box-shadow:0 12px 44px rgba(34,51,80,.09),0 2px 6px rgba(34,51,80,.04);padding:32px 42px 42px}' +
        '.sed-mode-worship .sed-form{padding:26px 32px 34px}' +
        '.sed-form .af-field input,.sed-form .af-field select,.sed-form .af-field textarea{border:1px solid #e3e8f0;border-radius:9px;transition:border-color .15s,box-shadow .15s}' +
        '.sed-form .af-field input:focus,.sed-form .af-field select:focus,.sed-form .af-field textarea:focus{border-color:#9db4d6;box-shadow:0 0 0 3px rgba(60,110,200,.08);outline:none}' +
        '.sed-form .af-field label{font-weight:600;color:#5b6b7d}' +
        // 왼쪽 성경 보기 팝업 (버튼으로 열고 닫음 · 스크롤해도 고정)
        '.sed-aside-l{position:fixed;left:18px;top:74px;width:326px;z-index:9600;opacity:0;visibility:hidden;transform:translateX(-26px);transition:opacity .26s ease,transform .32s cubic-bezier(.22,.61,.36,1),visibility .26s}' +
        '.sed-aside-l.open{opacity:1;visibility:visible;transform:translateX(0)}' +
        '.sed-mode-worship .sed-aside-l{display:none!important}' +
        '.mb-close{margin-left:auto;border:none;background:none;font-size:1.05rem;line-height:1;color:#9aa5b1;cursor:pointer;padding:2px 4px;border-radius:6px}.mb-close:hover{background:#eceff4;color:#33415c}' +
        '.mb-card{border:1px solid #d7e0ee;border-radius:14px;background:#fff;box-shadow:0 18px 50px rgba(34,51,80,.22);overflow:hidden;display:flex;flex-direction:column;max-height:calc(100vh - 92px)}' +
        '.mb-head{font-family:\'Noto Serif KR\',serif;font-weight:700;font-size:1.02rem;color:var(--accent,#223350);padding:13px 15px 12px;border-bottom:1px solid #eef1f5;background:linear-gradient(180deg,#fbfcfe 0%,#f3f7fb 100%);display:flex;align-items:center;gap:6px}' +
        '.mb-trans{display:flex;gap:5px;padding:11px 12px 7px}' +
        '.mb-trans button{flex:1;padding:6px 4px;border:1px solid #dde3ec;background:#fff;border-radius:999px;font:inherit;font-size:.79rem;font-weight:700;cursor:pointer;color:#3a4a63;transition:.14s}' +
        '.mb-trans button:hover{border-color:#b9c6da}' +
        '.mb-trans button.on{background:var(--accent,#223350);color:#fff;border-color:var(--accent,#223350)}' +
        '.mb-selrow{display:flex;gap:6px;padding:3px 12px 11px}' +
        '.mb-selrow select{padding:7px 8px;border:1px solid #dde3ec;border-radius:8px;font:inherit;font-size:.82rem;cursor:pointer;background:#fff}' +
        '.mb-selrow #mb_book{flex:1}.mb-selrow #mb_chap{width:74px}' +
        '.mb-text{flex:1;overflow-y:auto;padding:6px 15px 15px;font-family:\'Noto Serif KR\',serif;border-top:1px solid #f0f3f7;background:#fdfcf8}' +
        '.mb-thead{font-size:.8rem;font-weight:700;color:var(--accent,#223350);padding:10px 0 8px;border-bottom:1px solid #eceff4;margin-bottom:9px;display:flex;justify-content:space-between;align-items:baseline}' +
        '.mb-thead span:last-child{font-size:.7rem;color:#9aa5b1;font-weight:400}' +
        '.mb-verse{margin-bottom:6px;font-size:.92rem;line-height:1.85;color:#22303f}' +
        '.mb-vn{display:inline-block;font-size:.64rem;font-weight:800;color:#3a6db5;min-width:20px;vertical-align:top;margin-top:4px}' +
        '.mb-hint{color:#9aa5b1;font-size:.84rem;padding:16px 4px;font-style:italic}' +
        '.mb-ins{margin:0;border:none;border-top:1px solid #eef1f5;background:#f7faff;color:#0d6b5e;font:inherit;font-size:.8rem;font-weight:700;padding:10px;cursor:pointer;transition:.14s}.mb-ins:hover{background:#edf4ff}' +
        '.sed-qt{display:flex;align-items:center;gap:7px;background:#fff7e3;border:1px solid #e8cd86;border-radius:8px;padding:0 11px;height:40px;font-size:.84rem;font-weight:500;color:#8a6d1f;cursor:pointer;user-select:none}' +
        '.sed-row2{display:grid;grid-template-columns:2.3fr 1fr;gap:12px;margin-bottom:12px}' +
        // 설교 원고 리치 에디터
        '.se-toolbar{display:flex;flex-wrap:wrap;gap:1px;align-items:center;background:linear-gradient(180deg,#ffffff 0%,#f5f8fc 100%);border:1px solid #e3e8f0;border-bottom:none;border-radius:11px 11px 0 0;padding:7px 9px;position:sticky;top:60px;z-index:5;box-shadow:0 1px 0 rgba(34,51,80,.03)}' +
        '.se-toolbar button{font:inherit;font-size:.86rem;border:1px solid transparent;background:none;border-radius:7px;padding:6px 9px;cursor:pointer;color:#33415c;line-height:1;min-width:32px;transition:background .12s,box-shadow .12s}' +
        '.se-toolbar button:hover{background:#eaf1fb;box-shadow:inset 0 0 0 1px #dbe6f5}.se-toolbar button:active{background:#d8e2f0}' +
        '.se-toolbar select{font:inherit;font-size:.82rem;border:1px solid #dde3ec;border-radius:7px;padding:6px 8px;background:#fff;cursor:pointer;color:#33415c}' +
        '.se-sep{width:1px;height:20px;background:#e0e6ef;margin:0 5px}' +
        '.se-color{position:relative;display:inline-flex;align-items:center;font-size:.86rem;border-radius:7px;padding:6px 9px;cursor:pointer;color:#33415c}.se-color:hover{background:#eaf1fb}' +
        '.se-color input{position:absolute;left:0;bottom:-2px;width:100%;height:3px;opacity:0;cursor:pointer}' +
        '.se-color b{display:inline-block;border-bottom:3px solid currentColor;line-height:1.05}' +
        // ── 리본 툴바 고급화 (글꼴·크기·색상) ──
        '.se-grp{display:inline-flex;align-items:center;gap:1px}' +
        '.se-selflat{font:inherit;font-size:.82rem;border:1px solid #dde3ec;border-radius:7px;padding:6px 8px;background:#fff;cursor:pointer;color:#33415c;max-width:118px}' +
        '.se-selfont{min-width:96px}' +
        '.se-size{display:inline-flex;align-items:center;border:1px solid #dde3ec;border-radius:7px;overflow:hidden;background:#fff;margin-left:2px}' +
        '.se-size button{min-width:26px;padding:6px 0;border:none;border-radius:0;font-size:1rem;font-weight:700;color:#4a5b70;background:#f6f9fd}.se-size button:hover{background:#e6eefb}' +
        '.se-size select{border:none;border-left:1px solid #eef1f5;border-right:1px solid #eef1f5;border-radius:0;padding:6px 4px;text-align:center;width:46px;font-size:.82rem;background:#fff;cursor:pointer;color:#33415c}' +
        '.se-swbtn{display:inline-flex!important;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-width:34px!important;padding:4px 6px!important;line-height:1}' +
        '.se-swbtn b{font-size:.9rem;font-weight:800;color:#33415c}' +
        '.se-swbar{width:16px;height:4px;border-radius:2px;display:block}' +
        '.se-hiico{font-size:.86rem;font-weight:800;color:#5a4a12;padding:0 3px;border-radius:3px;line-height:1.25}' +
        '.se-caret{font-size:.6rem;color:#9aa5b1;position:absolute;right:2px;top:3px}' +
        '.se-pop-wrap{position:relative;display:inline-flex}' +
        // 색상 팔레트 — 화면 기준(fixed)으로 띄워 리본의 overflow(가로 스크롤)에 잘리지 않게 함. 위치는 열 때 버튼 좌표로 계산
        '.se-pop{position:fixed;z-index:9999;background:#fff;border:1px solid #dde3ec;border-radius:12px;box-shadow:0 14px 40px rgba(34,51,80,.28);padding:9px;display:none;grid-template-columns:repeat(6,22px);gap:7px}' +
        '.se-pop.open{display:grid}' +
        '.se-pop .se-sw{width:22px;height:22px;border-radius:6px;border:1px solid rgba(0,0,0,.14);cursor:pointer;padding:0;min-width:0;transition:transform .1s}.se-pop .se-sw:hover{transform:scale(1.14)}' +
        '.se-pop .se-sw.se-none{background:repeating-linear-gradient(45deg,#fff,#fff 4px,#f1d0d0 4px,#f1d0d0 6px);position:relative}' +
        '.se-bible-btn{color:#1d4ed8!important;font-weight:700}.se-bible-btn:hover{background:#dbe9ff!important}' +
        '.se-editor{min-height:56vh;border:1px solid #e3e8f0;border-radius:0 0 11px 11px;padding:26px 30px 34px;font-size:1.06rem;line-height:2;font-family:\'Noto Serif KR\',serif;background:#fff;outline:none;color:#1a1a1a}' +
        '.se-editor:focus{border-color:#c4d2e6;box-shadow:inset 0 1px 4px rgba(34,51,80,.04)}' +
        '.se-editor:empty:before{content:attr(data-ph);color:#aab3c0}' +
        '.se-editor h2{font-size:1.42em;font-weight:800;margin:.6em 0 .3em;color:#0a2c5c}' +
        '.se-editor h3{font-size:1.18em;font-weight:700;margin:.5em 0 .25em;color:#13314e}' +
        '.se-editor blockquote{border-left:4px solid #cdd7e3;margin:.5em 0;padding:.15em 0 .15em 14px;color:#475569}' +
        '.se-editor p{margin:.45em 0}.se-editor ul,.se-editor ol{margin:.45em 0;padding-left:1.5em}.se-editor mark{padding:0 1px}' +
        '.se-count{font-weight:400;font-size:.74rem;color:#9aa5b1;margin-left:8px}' +
        '@media(max-width:1560px){.sed-lightov .sed-aside-r{position:static;right:auto;top:auto;width:auto;max-width:820px;margin:0 auto 18px}}' +
        '@media(max-width:1240px){.sed-lightov .sed-aside{position:static;left:auto;top:auto;width:auto;max-width:820px;margin:0 auto 20px}.sed-lightov .sed-form{max-width:820px}}' +
        '@media(max-width:560px){.sed-row2{grid-template-columns:1fr}.sed-aside-l{left:8px;right:8px;width:auto;top:64px}}' +
        // ═══ 설교 매니저 스튜디오(다크 3분할) — 헤더·리본·바인더·미리보기·상태바 ═══
        '.sed-hd{position:sticky;top:0;z-index:6;background:linear-gradient(180deg,#ffffff 0%,#f7f9fc 100%);border-bottom:1px solid #e1e6ef;box-shadow:0 2px 10px rgba(34,51,80,.06)}' +
        '.sed-brand{font-family:\'Noto Serif KR\',serif;font-weight:700;font-size:1.18rem;letter-spacing:-.01em;color:var(--accent,#223350)}' +
        '.sed-sub{font-size:.7rem;color:#9aa5b1;margin-top:1px;letter-spacing:.02em}' +
        '.sed-status{font:inherit;font-size:.84rem;border:1px solid #dde3ec;border-radius:9px;padding:8px 10px;background:#fff;cursor:pointer;color:#33415c;font-weight:700}' +
        '.sed-ribbon{display:flex;justify-content:center;padding:7px 12px;overflow-x:auto;flex:none}' +
        '.sed-ribbon .se-toolbar{position:static;top:auto;flex-wrap:nowrap;white-space:nowrap;border-bottom:1px solid #e3e8f0;border-radius:11px}' +
        '.se-editor{border-radius:11px;border-top:1px solid #e3e8f0}' +
        '.se-editor h1{font-size:1.62em;font-weight:800;margin:.6em 0 .3em;color:#08213f}' +
        '.se-editor .se-note{background:#fef3c7;border-bottom:2px dotted #d4a53f;cursor:help}' +
        // 성경 박스 드래그 중에는 원고·미리보기 선택 금지(선택이 박스 밖으로 새는 것 방지)
        '.sed-nosel-editor .se-editor,.sed-nosel-editor .rp-paper,.sed-nosel-editor #rp_flow{-webkit-user-select:none!important;user-select:none!important}' +
        '.mb-text,.mb-text .mb-verse{-webkit-user-select:text;user-select:text}' +
        // ⚙ 자동저장 설정창(팝오버)
        '.se-setpop{position:fixed;z-index:40;width:232px;background:#fff;border:1px solid #dde3ec;border-radius:11px;box-shadow:0 10px 30px rgba(34,51,80,.18);padding:12px 14px;color:#33415c;font-size:.86rem}' +
        '.se-setpop-h{font-weight:800;color:var(--accent,#223350);margin-bottom:9px;font-size:.9rem}' +
        '.se-setpop-row{display:flex;align-items:center;gap:7px;margin-bottom:8px}' +
        '.se-setpop-row input[type=number]{font:inherit;border:1px solid #dde3ec;border-radius:6px;padding:4px 6px}' +
        '.se-setpop-note{font-size:.74rem;color:#9aa5b1;line-height:1.5;margin-top:2px}' +
        '.se-editor img{max-width:100%;border-radius:6px}' +
        '.se-editor .se-video{color:#1d4ed8;font-weight:600}' +
        '.bd-tabs{display:flex;gap:4px;margin-bottom:12px}' +
        '.bd-tabs button{flex:1;font:inherit;font-size:.78rem;font-weight:700;padding:7px 3px;border:1px solid #dde3ec;background:#fff;color:#5b6b7d;border-radius:8px;cursor:pointer}' +
        '.bd-tabs button.on{background:var(--accent,#223350);border-color:var(--accent,#223350);color:#fff}' +
        '.sed-binder .af-field{margin-bottom:11px}' +
        '.bd-chip{display:inline-flex;align-items:center;gap:5px;background:#eef3fa;border:1px solid #d5e0f0;color:#27466e;border-radius:999px;padding:3px 10px;font-size:.78rem;font-weight:600;margin:0 5px 6px 0}' +
        '.bd-chip button{border:0;background:none;cursor:pointer;color:#8296b3;font-size:.82rem;padding:0;line-height:1}' +
        '.bd-doc{display:block;width:100%;text-align:left;border:1px solid #e3e8f0;background:#fff;border-radius:9px;padding:7px 10px;margin-bottom:6px;cursor:pointer;font:inherit}' +
        '.bd-doc b{display:block;font-size:.82rem;color:#22314a}' +
        '.bd-doc span{font-size:.7rem;color:#9aa5b1}' +
        '.bd-doc.cur{border-color:#7fa3d8;box-shadow:0 0 0 2px rgba(90,140,220,.18)}' +
        '.rp-tabs{display:flex;gap:4px;margin-bottom:10px}' +
        '.rp-tabs button{flex:1;font:inherit;font-size:.8rem;font-weight:700;padding:8px 3px;border:1px solid #dde3ec;background:#fff;color:#5b6b7d;border-radius:9px;cursor:pointer}' +
        '.rp-tabs button.on{background:var(--accent,#223350);color:#fff;border-color:var(--accent,#223350)}' +
        '.rp-paperwrap{overflow:hidden;display:flex;justify-content:center}' +
        // PDF 미리보기 — 아이패드(3:4) 페이지, Apps Script exportSermonPdf(576×768pt·여백 44/48pt)와 동일 비율(0.903px/pt)
        // CSS 다단(column)으로 실제 페이지처럼 넘겨봄: 한 단 = 한 페이지 본문, 줄이 잘리지 않음
        // flex:none 필수 — paperwrap(flex)이 종이를 패널 폭으로 찌그러뜨리면 단 간격이 어긋나 페이지가 반쪽씩 잘림
        '.rp-paper{width:520px;height:693px;flex:none;background:#fff;color:#1a1a1a;box-shadow:0 10px 34px rgba(0,0,0,.5);padding:40px 43px;box-sizing:border-box;transform-origin:top center;font-family:\'Noto Serif KR\',serif;word-break:keep-all;overflow:hidden}' +
        '.rp-flow{height:613px;column-width:434px;column-gap:86px;column-fill:auto;transition:transform .22s ease}' +
        '.rp-paper .pdf-t{font-size:23.5px;font-weight:700;text-align:center;line-height:1.35;margin:0 0 5px}' +
        '.rp-paper .pdf-meta{font-size:9.9px;color:#8a8f99;text-align:center;margin:0 0 13px}' +
        '.rp-paper .pdf-hr{border:none;border-top:1px solid #c9ced6;margin:9px 0}' +
        '.rp-paper .pdf-h{font-size:10.8px;font-weight:700;color:#1f3a63;margin:13px 0 7px}' +
        '.rp-paper .pdf-bible{font-size:12.6px;color:#33445c;line-height:1.55;margin:0 0 3px;padding-left:5px}' +
        '.rp-paper .pdf-p{font-size:14.4px;color:#1a1a1a;line-height:1.7;margin:0 0 10px}' +
        '.rp-nav{display:flex;align-items:center;justify-content:center;gap:12px;padding:9px 0 0}' +
        '.rp-nav button{font:inherit;font-size:.82rem;padding:4px 14px;border:1px solid #dde3ec;background:#fff;border-radius:8px;cursor:pointer;color:#33415c}' +
        '.rp-nav button:disabled{opacity:.35;cursor:default}' +
        '.sed-dark .rp-nav button{background:#161d29;border-color:#2a3547;color:#c3cede}' +
        '.rp-nav b{font-size:.8rem;color:#8b96a5;min-width:52px;text-align:center;font-weight:600}' +
        // ── 설교 원고: 구글 문서처럼 캔버스 위 흰 용지만 — 줄자 없음, 꺾쇠 여백 가이드 ──
        '.wd-area{width:-webkit-max-content;width:max-content;margin:8px auto 0;transform-origin:top center}' +
        '.wd-page{background:#fff;box-shadow:0 6px 26px rgba(0,0,0,.5);box-sizing:border-box;position:relative;background-origin:border-box}' +
        '.wd-page .se-editor{border:none;border-radius:0;background:transparent;min-height:0;box-shadow:none}' +
        '.wd-page .se-editor:focus{border:none;box-shadow:none;outline:none}' +
        // 워드식 꺾쇠 여백 가이드(본문 영역 네 귀퉁이) — 페이지마다 반복 생성되는 오버레이 레이어
        '.wd-crop-layer{position:absolute;left:0;right:0;top:0;pointer-events:none}' +
        '.wd-crop{position:absolute;width:17px;height:17px;pointer-events:none;border:0 solid #aeb7c4;display:block}' +
        '.wd-tl{border-right-width:1px;border-bottom-width:1px}' +
        '.wd-tr{border-left-width:1px;border-bottom-width:1px}' +
        '.wd-bl{border-right-width:1px;border-top-width:1px}' +
        '.wd-br{border-left-width:1px;border-top-width:1px}' +
        // 페이지 구분(실제로 내용을 다음 장으로 밀어내는 빈 칸) — 구글 문서처럼 눈에 보이는 간격으로 페이지가 나뉨
        '.pg-break-spacer{display:block;user-select:none;pointer-events:none}' +
        // 문단이 페이지 경계에서 줄 단위로 쪼개졌을 때: 앞조각은 아래 여백 0, 이어지는 조각(.pg-cont)은 위 여백 0 → 이어진 줄이 다음 페이지 맨 위에 정확히 붙음
        '.se-editor [data-splitbase]{margin-bottom:0}' +
        '.se-editor .pg-cont{margin-top:0}' +
        // Ctrl+Enter로 넣는 수동 페이지 나눔 표시 — 워드처럼 점선+라벨, 클릭 선택·삭제(Backspace/Delete) 가능
        '.pg-manual-break{position:relative;height:0;border-top:1.5px dashed #9fb0cc;margin:18px 0 20px;user-select:none}' +
        '.pg-manual-break::after{content:"⌐ 페이지 나눔 ⌐";position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:#fff;padding:0 8px;font:600 10px/1 \'Noto Sans KR\',sans-serif;color:#7a8aa8;white-space:nowrap}' +
        // 페이지 번호 레이어(편집 불가 오버레이, 페이지마다 하단 중앙에 표시)
        '.wd-pagenum-layer{position:absolute;left:0;right:0;top:0;pointer-events:none}' +
        '.wd-pagenum-item{position:absolute;left:0;right:0;text-align:center;font:12px/1 \'Noto Serif KR\',serif;color:#9aa5b1}' +
        '.sed-dark .wd-pagenum-item{color:#6d7c92}' +
        // ── 리본 2줄째(제목·본문·불러오기·용지·여백·배율) ──
        '.sed-ribbon2{padding-top:0}' +
        '.sed-r2{display:flex;align-items:center;gap:7px;flex-wrap:wrap;width:100%;max-width:1400px;background:linear-gradient(180deg,#ffffff 0%,#f5f8fc 100%);border:1px solid #e3e8f0;border-radius:11px;padding:7px 10px}' +
        '.sed-r2 input[type=text]{font:inherit;font-size:.9rem;border:1px solid #dde3ec;border-radius:8px;padding:7px 10px;background:#fff;color:#22303f}' +
        '.r2-title{flex:2;min-width:180px;font-weight:700}' +
        '.r2-scrip{flex:1;min-width:150px}' +
        '.r2-btn{font:inherit;font-size:.82rem;border:1px solid #dde3ec;background:#fff;border-radius:8px;padding:7px 11px;cursor:pointer;color:#33415c;white-space:nowrap}' +
        '.r2-lbl{font-size:.76rem;color:#8a93a0;white-space:nowrap}' +
        '.sed-dark .sed-r2{background:linear-gradient(180deg,#1d2634,#171f2b);border-color:#2a3547}' +
        '.sed-dark .sed-r2 input[type=text]{background:#131a25;border-color:#2a3547;color:#dde5f0}' +
        '.sed-dark .r2-btn{background:#1a2330;border-color:#2a3547;color:#c3cede}' +
        '.sed-dark .r2-lbl{color:#8394ab}' +
        '.sed-lightov .wd-ctl{display:none}' +   // 예배 매니저에서는 용지·여백·배율 숨김
        '.sed-lightov .r2-sm{display:none}' +    // 예배 매니저에서는 본문 텍스트·기도 패널 버튼 숨김
        '.r2-btn.on{background:#2c4a86;border-color:#2c4a86;color:#fff}' +
        // ── 접이식 패널(성경 본문 텍스트 · 기도) — 리본과 같은 다크 바 ──
        '.sed-panel{background:#10151d;border-bottom:1px solid #242e3e;padding:10px 16px 14px;flex:none;max-height:44vh;overflow-y:auto}' +
        '.sed-panel-in{max-width:1100px;margin:0 auto}' +
        '.sed-panel textarea{background:#161d29;border:1px solid #2a3547;color:#dde5f0;border-radius:9px;padding:9px 11px;font:inherit;resize:vertical}' +
        '.sed-panel textarea:focus{border-color:#3f5578;outline:none}' +
        // ── 시리즈 목록 머리글 + PDF 시리즈 줄 ──
        '.bd-serhead{font-size:.74rem;font-weight:700;color:#8fa0b5;margin:9px 0 5px}' +
        '.bd-serhead span{font-weight:400;color:#6d7c92}' +
        '.rp-paper .pdf-series{font-size:9px;font-weight:700;color:#1f3a63;margin:0 0 6px;text-align:left}' +
        // ── 시리즈 선택 목록 ──
        // 시리즈 선택 드롭다운 — 입력칸을 누르면 나타나는 팝업(스크롤), 평소엔 숨김 → 선택된 시리즈가 쌓여도 화면이 끝없이 안 늘어남
        '.bd-serwrap{position:relative}' +
        '.bd-serlist{display:none;position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:32;max-height:190px;overflow:auto;border:1px solid #e3e8f0;border-radius:9px;padding:4px;background:#fff;box-shadow:0 12px 30px rgba(0,0,0,.22)}' +
        '.bd-serlist.open{display:block}' +
        '.bd-seritem{display:block;width:100%;text-align:left;border:0;background:none;border-radius:7px;padding:5px 8px;cursor:pointer;font:inherit;font-size:.8rem;color:#3a4a63}' +
        '.bd-seritem span{color:#9aa5b1;font-size:.7rem}' +
        '.bd-seritem:hover{background:#f2f6fc}' +
        '.bd-seritem.on{background:#e8f0fc;color:#1d4ed8;font-weight:700}' +
        '.sed-dark .bd-serlist{background:#141b27;border-color:#2a3547}' +
        '.sed-dark .bd-seritem{color:#aab8cc}.sed-dark .bd-seritem:hover{background:#1b2536}' +
        '.sed-dark .bd-seritem.on{background:#1a2c4d;color:#9ec1f7}' +
        '.sed-dark .bd-seritem span{color:#6d7c92}' +
        // 시리즈 섹션 소제목 + 박스(추가된 시리즈 · 같은 시리즈의 설교) — 둘 다 이 박스 안에서만 스크롤(끝없이 안 늘어남)
        '.bd-boxhead{font-size:.72rem;font-weight:700;color:#75839a;margin:10px 0 4px}' +
        '.bd-serchipsbox{min-height:34px;max-height:110px;overflow-y:auto;border:1px solid #e3e8f0;border-radius:9px;padding:6px 7px;background:#fff}' +
        '.sed-dark .bd-serchipsbox{background:#141b27;border-color:#2a3547}' +
        '.bd-serdocs{max-height:230px;overflow-y:auto;padding-right:3px;border:1px solid #e3e8f0;border-radius:9px;padding:7px}' +
        '.sed-dark .bd-serdocs{border-color:#2a3547}' +
        // ── QT 체크박스 정렬(.af-field label의 display:block이 이기던 문제) ──
        '.af-field label.sed-qt{display:flex;align-items:center;gap:8px;margin-bottom:0;font-weight:600}' +
        // ── 예배 매니저: 제목·본문은 리본 2줄째로 이동했으므로 빈 폼 카드 숨김 ──
        '.sed-mode-worship .sed-form{display:none}' +
        '.rp-paper img{max-width:100%}' +
        '.rp-pageinfo{text-align:center;font-size:.74rem;color:#8b96a5;padding:8px 0 2px}' +
        '.sed-sb{display:flex;align-items:center;gap:18px;padding:7px 18px;font-size:.76rem;flex:none}' +
        // ── 다크 테마 ──
        '.sed-dark .sed-hd{background:linear-gradient(180deg,#161d28,#111722);border-bottom:1px solid #242e3e;box-shadow:0 2px 14px rgba(0,0,0,.4)}' +
        '.sed-dark .sed-brand{color:#e7edf6}.sed-dark .sed-sub{color:#6d7c92}' +
        '.sed-dark .sed-hd .btn{background:#1b2431;border-color:#2e3b52;color:#c9d4e4}' +
        '.sed-dark .sed-status{background:#1b2431;border-color:#2e3b52;color:#e3bb63}' +
        '.sed-dark .sed-ribbon{background:#10151d;border-bottom:1px solid #242e3e}' +
        '.sed-dark .se-toolbar{background:linear-gradient(180deg,#1d2634,#171f2b);border-color:#2a3547;box-shadow:none}' +
        '.sed-dark .se-toolbar button{color:#c3cede}' +
        '.sed-dark .se-toolbar button:hover{background:#26334a;box-shadow:inset 0 0 0 1px #35455f}' +
        '.sed-dark .se-toolbar select,.sed-dark .se-selflat{background:#131a25;border-color:#2a3547;color:#c3cede}' +
        '.sed-dark .se-size{background:#131a25;border-color:#2a3547}' +
        '.sed-dark .se-size button{background:#1a2330;color:#c3cede}' +
        '.sed-dark .se-size select{background:#131a25;border-left-color:#242e3e;border-right-color:#242e3e;color:#c3cede}' +
        '.sed-dark .se-sep{background:#2a3547}' +
        '.sed-dark .se-swbtn b{color:#c3cede}' +
        '.sed-dark .sed-wrap{flex:1;min-height:0;display:flex;align-items:stretch;padding:0;position:relative}' +
        '.sed-dark .sed-binder{width:274px;flex:none;overflow-y:auto;background:#10151d;border-right:1px solid #242e3e;padding:14px 13px 26px}' +
        '.sed-dark .sed-binder .af-field label{color:#8394ab}' +
        '.sed-dark .sed-binder .af-field input,.sed-dark .sed-binder .af-field select,.sed-dark .sed-binder .af-field textarea{background:#161d29;border:1px solid #2a3547;color:#dde5f0}' +
        '.sed-dark .sed-qt{background:#161d29;border-color:#2a3547;color:#c9d4e4}' +   // 주변 입력칸과 같은 색
        '.sed-dark .bd-tabs button{background:#161d29;border-color:#2a3547;color:#8394ab}' +
        '.sed-dark .bd-tabs button.on{background:#2c4a86;border-color:#2c4a86;color:#fff}' +
        '.sed-dark .bd-chip{background:#1a2740;border-color:#223350;color:#a9c3ec}' +
        '.sed-dark .bd-chip button{color:#6d84ad}' +
        '.sed-dark .bd-doc{background:#141b27;border-color:#242e3e}' +
        '.sed-dark .bd-doc b{color:#cdd8e8}.sed-dark .bd-doc span{color:#75839a}' +
        '.sed-dark .bd-doc.cur{border-color:#3f639f;box-shadow:0 0 0 2px rgba(70,120,200,.25)}' +
        '.sed-dark .sed-main{flex:1;min-width:0;overflow-y:auto;overflow-x:auto;padding:26px 30px 70px;background:radial-gradient(900px 420px at 50% -8%,#1c2431 0%,#141922 62%)}' +
        // 설교 매니저: 흰 카드 제거 — 문서(용지)가 캔버스 위에 바로 놓임. 폭은 상단 툴바와 같은 기준으로 가득
        '.sed-dark .sed-form{max-width:none;background:transparent;border:none;box-shadow:none;padding:0 0 30px;border-radius:0}' +
        '.sed-dark .sed-form textarea{background:#161d29;border:1px solid #2a3547;color:#dde5f0;border-radius:9px}' +
        '.sed-dark .sed-form .af-field label,.sed-dark .sed-form label{color:#8394ab}' +
        '.sed-dark .se-count{color:#6d7c92}' +
        '.sed-dark .sed-aside-r{position:static;right:auto;top:auto;width:392px;flex:none;overflow-y:auto;background:#10151d;border-left:1px solid #242e3e;padding:12px 12px 26px}' +
        '.sed-dark .rp-tabs button{background:#161d29;border-color:#2a3547;color:#8394ab}' +
        '.sed-dark .rp-tabs button.on{background:#2c4a86;border-color:#2c4a86;color:#fff}' +
        '.sed-dark .qtc-card{background:#141b27;border-color:#242e3e;box-shadow:none}' +
        '.sed-dark .qtc-h{color:#cdd8e8}.sed-dark .qtc-sub{color:#75839a}' +
        '.sed-dark .qtc-paste{background:#0f141d;border-color:#2a3547;color:#dde5f0}' +
        '.sed-dark .qtc-rrow{background:#18202e;color:#9db1cd}.sed-dark .qtc-rrow b{color:#cdd8e8}' +
        '.sed-dark .sed-sb{background:#10151d;border-top:1px solid #242e3e;color:#8394ab}' +
        '.sed-dark ::-webkit-scrollbar{width:10px;height:10px}.sed-dark ::-webkit-scrollbar-thumb{background:#2a3547;border-radius:5px}.sed-dark ::-webkit-scrollbar-track{background:transparent}' +
        '.sed-dark .sed-aside-l{left:286px;top:118px}' +   // 성경 보기: 바인더 옆·리본 아래에서 열림(openPop이 리본 높이에 맞춰 재계산)
        '@media(max-width:1120px){.sed-dark .sed-aside-l{left:8px;right:8px;width:auto;top:64px}}' +
        // ── 성경 보기: 보기 설정(배경·글씨·줄간격) + 배경 테마 ──
        '.mb-setrow{display:flex;align-items:center;gap:6px;font-size:.74rem;color:#8a93a0;margin-top:7px}' +
        '.mb-sw{width:20px;height:20px;border-radius:6px;border:1px solid rgba(0,0,0,.22);cursor:pointer;padding:0;flex:none}' +
        '.mb-sw.on{outline:2px solid #4a7dd4;outline-offset:1px}' +
        '.mb-fsbtn{width:24px;height:22px;border:1px solid #dde3ec;border-radius:6px;background:#fff;cursor:pointer;font-weight:700;color:#4a5b70;line-height:1;padding:0}' +
        '#mb_lh{padding:3px 5px;border:1px solid #dde3ec;border-radius:6px;font:inherit;font-size:.74rem;background:#fff;cursor:pointer}' +
        '.mb-text .mb-verse{font-size:inherit;line-height:inherit;color:inherit}' +
        '.mb-text[data-bg=dark]{background:#10151d;color:#c9d4e4}.mb-text[data-bg=dark] .mb-thead{color:#9db4d6;border-color:#2a3547}.mb-text[data-bg=dark] .mb-thead span:last-child{color:#6d7c92}.mb-text[data-bg=dark] .mb-vn{color:#6f8fc9}' +
        '.mb-text[data-bg=white]{background:#fff;color:#22303f}' +
        '.mb-text[data-bg=cream]{background:#fdfcf8;color:#22303f}' +
        '.mb-text[data-bg=sepia]{background:#f2e7ce;color:#463823}.mb-text[data-bg=sepia] .mb-vn{color:#8a6d35}' +
        // 성경 보기 카드 자체를 다크 스튜디오와 어울리게
        '.sed-dark .mb-card{background:#141b27;border-color:#2a3547;box-shadow:0 18px 50px rgba(0,0,0,.65)}' +
        '.sed-dark .mb-head{background:linear-gradient(180deg,#1a2230,#151c28);color:#cdd8e8;border-color:#242e3e}' +
        '.sed-dark .mb-close{color:#7c8ba0}.sed-dark .mb-close:hover{background:#26334a;color:#cdd8e8}' +
        '.sed-dark .mb-trans button{background:#161d29;border-color:#2a3547;color:#8fa0b5}' +
        '.sed-dark .mb-trans button.on{background:#2c4a86;border-color:#2c4a86;color:#fff}' +
        '.sed-dark .mb-selrow select{background:#161d29;border-color:#2a3547;color:#dde5f0}' +
        '.sed-dark #mb_set{border-color:#242e3e}' +
        '.sed-dark .mb-setrow{color:#7c8ba0}' +
        '.sed-dark .mb-fsbtn{background:#161d29;border-color:#2a3547;color:#c3cede}' +
        '.sed-dark #mb_fs_v{color:#cdd8e8}' +
        '.sed-dark #mb_lh{background:#161d29;border-color:#2a3547;color:#dde5f0}' +
        '.sed-dark .mb-text{border-color:#242e3e}' +
        '.sed-dark .mb-ins{background:#152233;border-color:#242e3e;color:#5fb891}.sed-dark .mb-ins:hover{background:#1a2b42}' +
        '.sed-dark .mb-hint{color:#6d7c92}' +
        // ── 예배 매니저(라이트) 배치: 바인더는 상단 카드, 시리즈·첨부 탭 숨김 ──
        '.sed-mode-worship .sed-main{display:contents}' +
        '.sed-mode-worship .sed-binder{position:static;width:auto;max-width:780px;margin:0 auto 14px;background:#fff;border:1px solid #e7ebf2;border-radius:14px;padding:16px 18px 8px;order:0}' +
        '.sed-mode-worship .bd-tabs,.sed-mode-worship .bd-pane-series,.sed-mode-worship .bd-pane-attach{display:none!important}' +
        '.sed-mode-worship .bd-pane-info{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}' +
        // ── 반응형: 좁은 화면에서는 세로 스택 ──
        '@media(max-width:1500px){.sed-dark .sed-aside-r{width:330px}}' +
        '@media(max-width:1120px){.sed-dark{overflow:auto!important;display:block!important}.sed-dark .sed-wrap{flex-direction:column;overflow:visible}.sed-dark .sed-binder{width:auto;border-right:none;border-bottom:1px solid #242e3e}.sed-dark .sed-main{overflow:visible;padding:16px 10px 30px}.sed-dark .sed-aside-r{width:auto;border-left:none}.sed-dark .sed-sb{position:sticky;bottom:0}}' +
        '</style>' +
        '<header class="sed-hd">' +
        '<div style="margin:0 auto;padding:10px 18px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">' +
        '<button class="btn btn-line" id="se_close" style="padding:8px 14px;border-radius:9px">‹ 닫기</button>' +
        '<div style="flex:1;min-width:150px;text-align:center;line-height:1.25">' +
        '<div class="sed-brand">' + (worshipMode ? '예배 매니저' : '설교 매니저') + '</div>' +
        '<div class="sed-sub">' + (worshipMode ? '예배 순서를 짜고 아이패드로 발표·내보냅니다 (주일 낮 예배 중심)' : '설교문을 쓰고 · QT를 함께 준비해 아이패드로 내보냅니다') + '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">' +
        '<select id="se_status" class="sed-status" title="작성 상태">' + ['작성중', '수정중', '완료'].map(function (s) { return '<option' + (s === (rec.status || '작성중') ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
        '<button class="btn btn-line" id="se_save" style="padding:8px 13px;border-radius:9px">💾 저장</button>' +
        (worshipMode ? '' : '<button class="btn btn-line" id="se_settings" title="자동 임시저장 설정" style="padding:8px 11px;border-radius:9px">⚙</button>') +
        '<button class="btn btn-line" id="se_kakao" style="padding:8px 12px;border-radius:9px;background:#fbe94d;border-color:#e6d23f;color:#3a2e00;font-weight:600;display:none">💬 카카오톡 복사</button>' +
        '<button class="btn btn-line" id="se_preview" style="padding:8px 13px;border-radius:9px">👁 미리보기</button>' +
        (worshipMode ? '' : '<button class="btn btn-line" id="se_present" style="padding:8px 13px;border-radius:9px">🖥 발표자 모드</button>') +
        (worshipMode ? '' : '<button class="btn btn-line" id="se_pdf" style="padding:8px 13px;border-radius:9px">📄 내보내기</button>') +
        (worshipMode ? '<button class="btn btn-solid" id="se_export" style="padding:8px 18px;border-radius:9px;font-weight:700">📤 저장 후 내보내기</button>' : '') +
        '</div>' +
        '<div id="se_msg" class="fin-msg" style="flex-basis:100%;text-align:right;min-height:0;margin-top:-2px"></div>' +
        '</div></header>' +
        // ── 전역 리본 툴바 (설교 매니저 전용 — 예배 매니저는 숨김) ──
        '<div class="sed-ribbon"' + (worshipMode ? ' style="display:none"' : '') + '>' +
        '<div class="se-toolbar" id="se_tb">' +
        '<span class="se-grp">' +
        '<button type="button" data-cmd="undo" title="실행취소">↶</button><button type="button" data-cmd="redo" title="다시실행">↷</button>' +
        '</span><span class="se-sep"></span>' +
        '<span class="se-grp">' +
        '<select id="se_block" class="se-selflat" title="문단 스타일"><option value="p">본문</option><option value="h1">큰제목</option><option value="h2">제목</option><option value="h3">소제목</option><option value="blockquote">인용</option></select>' +
        '<select id="se_font" class="se-selflat se-selfont" title="글꼴 · 모두 저작권 없는 오픈폰트">' + fontOptsHtml + '</select>' +
        '<span class="se-size" title="글자 크기(px)"><button type="button" id="se_size_dn" title="작게">−</button><select id="se_size">' + sizeOptsHtml + '</select><button type="button" id="se_size_up" title="크게">+</button></span>' +
        '<select id="se_lh" class="se-selflat" title="줄간격"><option value="" disabled selected>줄간격</option><option value="1.5">1.5</option><option value="1.75">1.75</option><option value="2">2.0</option><option value="2.4">2.4</option><option value="2.8">2.8</option></select>' +
        '<select id="se_ls" class="se-selflat" title="자간(px)"><option value="" disabled selected>자간</option><option value="0">0px</option><option value="0.5">0.5px</option><option value="1">1px</option><option value="2">2px</option></select>' +
        '</span><span class="se-sep"></span>' +
        '<span class="se-grp">' +
        '<button type="button" data-cmd="bold" title="굵게" style="font-weight:800">B</button>' +
        '<button type="button" data-cmd="italic" title="기울임" style="font-style:italic">I</button>' +
        '<button type="button" data-cmd="underline" title="밑줄" style="text-decoration:underline">U</button>' +
        '<button type="button" data-cmd="strikeThrough" title="취소선" style="text-decoration:line-through">S</button>' +
        '<button type="button" data-cmd="superscript" title="위첨자">x²</button>' +
        '<span class="se-pop-wrap"><button type="button" class="se-swbtn" id="se_fore_btn" title="글자색"><b>가</b><i class="se-swbar" id="se_fore_bar" style="background:#c0392b"></i><span class="se-caret">▾</span></button><div class="se-pop" id="se_fore_pop"></div></span>' +
        '<span class="se-pop-wrap"><button type="button" class="se-swbtn" id="se_hi_btn" title="형광펜"><b class="se-hiico" id="se_hi_ico" style="background:#fff59d">가</b><span class="se-caret">▾</span></button><div class="se-pop" id="se_hi_pop"></div></span>' +
        '<button type="button" data-cmd="removeFormat" title="선택 부분 서식 지우기">✕ 서식</button>' +
        '<button type="button" id="se_fontreset" title="원고 전체의 글꼴·크기·색을 기본값으로 되돌립니다">폰트 초기화</button>' +
        '</span><span class="se-sep"></span>' +
        '<span class="se-grp">' +
        '<button type="button" data-blk="h1" title="큰제목">H₁</button><button type="button" data-blk="h2" title="제목">H₂</button><button type="button" data-blk="h3" title="소제목">H₃</button>' +
        '<button type="button" data-blk="blockquote" title="인용구">❝ 인용</button>' +
        '</span><span class="se-sep"></span>' +
        '<span class="se-grp">' +
        '<button type="button" data-cmd="insertUnorderedList" title="글머리 목록">• 목록</button>' +
        '<button type="button" data-cmd="insertOrderedList" title="번호 목록">1. 목록</button>' +
        '<button type="button" id="se_chk" title="체크 기호 삽입">☑</button>' +
        '<button type="button" data-cmd="justifyLeft" title="왼쪽 정렬">⯇</button>' +
        '<button type="button" data-cmd="justifyCenter" title="가운데 정렬">≡</button>' +
        '<button type="button" data-cmd="justifyRight" title="오른쪽 정렬">⯈</button>' +
        '<button type="button" data-cmd="justifyFull" title="양쪽 정렬">☰</button>' +
        '</span><span class="se-sep"></span>' +
        '<span class="se-grp">' +
        '<button type="button" id="se_ins_bible" title="본문 칸의 성경 구절을 굵게 삽입">📖 구절</button>' +
        '<button type="button" data-cmd="insertHorizontalRule" title="구분선">— 구분선</button>' +
        '<button type="button" id="se_bible_open" class="se-bible-btn" title="성경을 왼쪽에서 열기">📖 성경</button>' +
        '<button type="button" id="se_note" title="선택 부분에 메모(주석) 달기 — 마우스를 올리면 표시">💬 메모</button>' +
        '<button type="button" id="se_img" title="이미지 삽입">🖼</button>' +
        '<button type="button" id="se_vid" title="유튜브·영상 삽입">▶</button>' +
        '<button type="button" id="se_ill_ins" title="예화 검색·삽입">💡 예화</button>' +
        '<button type="button" id="se_ill_save" title="선택한 문단을 예화 보관함에 저장">💾 예화 저장</button>' +
        '</span><span class="se-sep"></span>' +
        '<span class="se-grp"><button type="button" id="se_tb_reset" title="도구 배치 초기화 — 도구는 꾹 눌러 끌면 위치를 바꿀 수 있습니다">↺</button></span>' +
        '</div></div>' +
        // ── 리본 2줄째: 제목·본문(성경)·불러오기 + 용지·여백·배율 (예배 매니저에서는 제목·본문만) ──
        '<div class="sed-ribbon sed-ribbon2"><div class="sed-r2">' +
        '<input type="text" id="se_title" value="' + esc(rec.title || '') + '" placeholder="설교 제목" class="r2-title">' +
        '<input type="text" id="se_scripture" value="' + esc(rec.scripture || '') + '" placeholder="본문(성경) — 예: 창1:1-5" class="r2-scrip">' +
        '<button type="button" id="se_fetch_btn" class="r2-btn" title="입력한 구절의 개역개정 본문을 자동으로 불러옵니다">📥 불러오기</button>' +
        '<button type="button" id="se_pn_bible" class="r2-btn r2-sm" title="출력되는 성경 본문(개역개정·우리말) 열기/닫기">📖 본문 텍스트</button>' +
        '<button type="button" id="se_pn_prayer" class="r2-btn r2-sm" title="설교 후 기도문 열기/닫기">🙏 기도</button>' +
        '<span class="se-sep wd-ctl"></span>' +
        '<span class="r2-lbl wd-ctl">용지</span><select id="wd_paper" class="se-selflat wd-ctl"><option value="A4">A4 (210×297㎜)</option><option value="iPad">아이패드 (180×240㎜)</option><option value="Letter">레터 (216×279㎜)</option><option value="B5">B5 (176×250㎜)</option></select>' +
        '<span class="r2-lbl wd-ctl">여백</span><select id="wd_margin" class="se-selflat wd-ctl"><option value="15">좁게 (15㎜)</option><option value="20" selected>보통 (20㎜)</option><option value="25">넓게 (25㎜)</option></select>' +
        '<span class="r2-lbl wd-ctl">배율</span><input type="range" id="wd_zoom" class="wd-ctl" min="50" max="160" value="100" style="width:110px"><b id="wd_zoom_v" class="r2-lbl wd-ctl" style="min-width:38px">100%</b>' +
        '<span class="r2-lbl wd-ctl">페이지 번호</span><select id="wd_pgnum" class="se-selflat wd-ctl">' +
        '<option value="off">없음</option><option value="num">1</option><option value="numTotal">1 / N</option><option value="dash">- 1 -</option><option value="kr">1페이지</option><option value="paren">(1)</option>' +
        '</select>' +
        '</div></div>' +
        // ── 접이식 패널: 출력되는 성경 본문 / 기도 (리본 버튼으로 열고 닫음 — 원고 영역과 분리) ──
        '<div class="sed-panel" id="pn_bible" style="display:none"><div class="sed-panel-in">' +
        '<div style="display:flex;align-items:center;gap:14px;margin-bottom:6px">' +
        '<span style="font-size:.82rem;font-weight:700;color:#8fa0b5">📖 성경 본문 <span style="font-weight:400;color:#6d7c92">(PDF·아이패드에 출력되는 본문)</span></span>' +
        '<label style="display:flex;align-items:center;gap:5px;font-size:.82rem;font-weight:600;cursor:pointer;color:#4fae95"><input type="checkbox" id="se_woorimal_chk" style="width:14px;height:14px;cursor:pointer;accent-color:#0d9488;margin:0"> 우리말성경</label>' +
        '<span id="se_bible_loading" style="font-size:.75rem;color:#9aa5b1;margin-left:4px"></span>' +
        '</div>' +
        // 우리말성경 체크는 항상 꺼진 상태가 기본값 — 매일 QT/새벽기도(qtOn)일 때만 처음부터 2단으로 보임(체크와 무관하게), 아래 syncQt()가 실제 표시를 정함
        '<div id="se_bible_cols" style="display:grid;grid-template-columns:' + ((rec.service === '매일 QT' || rec.service === '새벽기도') ? '1fr 1fr' : '1fr') + ';gap:12px">' +
        '<div><div style="font-size:.73rem;color:#75839a;font-weight:600;margin-bottom:3px">개역개정</div>' +
        '<textarea id="se_bible" placeholder="[📥 불러오기]를 누르거나 직접 붙여넣으세요." style="min-height:150px;line-height:1.8;font-size:1rem;font-family:\'Noto Serif KR\',serif;width:100%;box-sizing:border-box">' + esc(rec.bible_text || '') + '</textarea></div>' +
        '<div id="se_qt_bible_wrap" style="' + ((rec.service === '매일 QT' || rec.service === '새벽기도') ? '' : 'display:none') + '"><div style="font-size:.73rem;color:#75839a;font-weight:600;margin-bottom:3px">우리말성경 <span style="font-weight:400">(직접 입력)</span></div>' +
        '<textarea id="se_qt_bible" placeholder="우리말성경 본문을 붙여넣으세요." style="min-height:150px;line-height:1.8;font-size:1rem;font-family:\'Noto Serif KR\',serif;width:100%;box-sizing:border-box">' + esc(rec.qt_bible_text || '') + '</textarea></div>' +
        '</div></div></div>' +
        '<div class="sed-panel" id="pn_prayer" style="display:none"><div class="sed-panel-in">' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px"><span style="font-size:.82rem;font-weight:700;color:#8fa0b5">🙏 기도</span><span style="font-weight:400;font-size:.74rem;color:#6d7c92">설교 원고 뒤에 함께 출력됩니다</span><button type="button" id="se_prayer_ai" class="btn btn-line" style="margin-left:auto;padding:4px 12px;font-size:.76rem;font-weight:600;color:#b79df1;border-color:#4a3d73;background:#1b2431">✨ AI 생성</button></div>' +
        '<textarea id="se_prayer" placeholder="설교 후 드릴 기도를 적으세요. (마침기도·결단기도 등) — ‘✨ AI 생성’으로 설교 원고 기반 300자 미만 기도문을 만들 수 있습니다." style="min-height:130px;line-height:1.85;font-size:1rem;font-family:\'Noto Serif KR\',serif;width:100%;box-sizing:border-box">' + esc(rec.prayer || '') + '</textarea>' +
        '</div></div>' +
        '<div class="sed-wrap ' + (worshipMode ? 'sed-mode-worship' : 'sed-mode-sermon') + '">' +
        (worshipMode ? '' : '<div class="sed-aside-l" id="se_bible_pop"><div class="mb-card">' +
          '<div class="mb-head">📖 성경 보기<button type="button" class="mb-close" id="mb_set_btn" title="보기 설정(배경·글씨 크기·줄간격)">⚙</button><button type="button" class="mb-close" id="mb_close" title="닫기" style="margin-left:0">✕</button></div>' +
          '<div class="mb-trans"><button data-v="gyr" class="on">개역개정</button><button data-v="urm">우리말성경</button></div>' +
          '<div class="mb-selrow"><select id="mb_book"></select><select id="mb_chap"></select></div>' +
          // 보기 설정: 배경 색상 · 글씨 크기 · 줄간격 (localStorage에 저장)
          '<div id="mb_set" style="display:none;padding:2px 12px 11px;border-bottom:1px solid #eef1f5">' +
          '<div class="mb-setrow">배경 <button type="button" class="mb-sw" data-bg="dark" style="background:#10151d" title="다크"></button><button type="button" class="mb-sw" data-bg="white" style="background:#ffffff" title="화이트"></button><button type="button" class="mb-sw" data-bg="cream" style="background:#fdfcf8" title="크림"></button><button type="button" class="mb-sw" data-bg="sepia" style="background:#f2e7ce" title="세피아"></button></div>' +
          '<div class="mb-setrow">글씨 <button type="button" class="mb-fsbtn" id="mb_fs_dn">−</button><b id="mb_fs_v" style="min-width:38px;text-align:center">15px</b><button type="button" class="mb-fsbtn" id="mb_fs_up">＋</button><span style="margin-left:8px">줄간격</span> <select id="mb_lh"><option value="1.6">1.6</option><option value="1.85">1.85</option><option value="2.1">2.1</option><option value="2.4">2.4</option></select></div>' +
          '</div>' +
          '<div class="mb-text" id="mb_text"><p class="mb-hint">성경책과 장을 고르면 본문이 표시됩니다.</p></div>' +
          '<button type="button" class="mb-ins" id="mb_insert" title="현재 보고 있는 장을 위 본문(성경) 칸에 넣습니다">＋ 이 장을 본문칸에 넣기</button>' +
          '</div></div>') +
        '<div class="sed-aside"><div class="af-field" style="margin:0">' +
        '<label style="font-size:1.18rem;font-weight:700;color:var(--accent,#223350);margin-bottom:2px">📋 예배 순서</label>' +
        '<div style="font-size:.74rem;color:#9aa5b1;margin-bottom:9px">교독문·찬송가·CCM·항목을 추가하고 드래그로 정렬 · 항목에 📎 파일 첨부</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px"><button type="button" class="btn btn-line" id="se_tpl_load" style="padding:6px 8px;font-size:.78rem">📋 양식 불러오기</button><button type="button" class="btn btn-line" id="se_tpl_save" style="padding:6px 8px;font-size:.78rem">💾 양식 저장</button></div>' +
        '<div id="se_tpl_msg" style="font-size:.74rem;color:#7b8794;min-height:0;margin-bottom:6px"></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px"><button type="button" class="btn btn-line" id="se_gyodok" style="padding:7px 4px;font-size:.8rem">📜 교독문</button><button type="button" class="btn btn-line" id="se_hymn" style="padding:7px 4px;font-size:.8rem">🎵 찬송가</button><button type="button" class="btn btn-line" id="se_ccm" style="padding:7px 4px;font-size:.8rem">🎶 CCM</button></div>' +
        '<div id="se_order"></div>' +
        '</div></div>' +
        // ── 좌측 바인더: 정보(분류·키워드·요약) / 시리즈(분류·탐색) / 첨부 ──
        '<aside class="sed-binder">' +
        '<div class="bd-tabs"><button type="button" class="bd-tab on" data-p="info">📋 정보</button><button type="button" class="bd-tab" data-p="attach">📎 첨부</button></div>' +
        '<div class="bd-pane bd-pane-info" id="bd_info">' +
        '<div class="af-field"><label>일자</label><input type="date" id="se_date" value="' + esc(fmtD(rec.sermon_date) || today()) + '"></div>' +
        '<div class="af-field"><label>설교 분류(예배)</label><select id="se_service"><option value="">선택</option>' + svcOpts + '</select>' +
        '<input type="text" id="se_svc_custom" placeholder="새 분류 이름 (예: 청년예배)" style="display:none;margin-top:6px" title="기타를 고른 뒤 새 분류 이름을 적으면 그 이름으로 저장되고, 다음부터 분류 목록에 나타납니다"></div>' +
        // 시리즈: 분류 바로 다음 — 입력하면 기존 시리즈가 자동완성으로 뜸
        // 순서: ①입력+추가(클릭하면 기존 시리즈 목록 드롭다운) ②추가된 시리즈 목록 박스 ③같은 시리즈의 설교(스크롤) 박스
        '<div class="af-field se-hide-worship"><label>📚 시리즈 <span style="font-weight:400">(여러 개 선택 가능)</span></label>' +
        '<div class="bd-serwrap">' +
        '<div style="display:flex;gap:5px"><input type="text" id="se_series_in" placeholder="시리즈 추가 · 클릭하면 목록에서 선택" autocomplete="off" style="flex:1"><button type="button" class="btn btn-line" id="se_series_add" style="padding:6px 11px;font-size:.8rem;flex:none">＋ 추가</button></div>' +
        '<div id="se_series_list" class="bd-serlist"></div>' +
        '</div>' +
        '<div class="bd-boxhead">추가된 시리즈</div>' +
        '<div id="se_series_chips" class="bd-serchipsbox"></div>' +
        '<div class="bd-boxhead">같은 시리즈의 설교</div>' +
        '<div id="se_series_docs" class="bd-serdocs"></div>' +
        '</div>' +
        '<div class="af-field"><label>설교자</label><input type="text" id="se_preacher" value="' + esc(rec.preacher || '손병민 담임목사') + '"></div>' +
        '<div class="af-field se-hide-worship"><label>QT</label><label class="sed-qt" id="se_qt_lbl"><input type="checkbox" id="se_qt_toggle" style="width:16px;height:16px;cursor:pointer;accent-color:#c79a2e;margin:0;flex:none">함께 만들기</label></div>' +
        '<div class="af-field se-hide-worship"><label>🏷 키워드 <span style="font-weight:400">(최대 3개)</span></label><input type="text" id="se_keywords" value="' + esc(rec.keywords || '') + '" placeholder="쉼표로 구분"></div>' +
        '<div class="af-field se-hide-worship"><label>📝 미리보기 요약</label><textarea id="se_summary" maxlength="500" placeholder="목록·카드 하단에 노출 (최대 500자, 2줄까지 표시)" style="min-height:74px">' + esc(rec.summary || '') + '</textarea></div>' +
        '<input type="hidden" id="se_gyodok_v" value="' + esc(rec.gyodok || '') + '"><input type="hidden" id="se_hymns_v" value="' + esc(rec.hymns || '') + '">' +
        '</div>' +
        '<div class="bd-pane bd-pane-attach" id="bd_attach" style="display:none">' +
        '<div class="af-field"><label>🎬 영상 URL</label><input type="text" id="se_media" value="' + esc(rec.media_url || '') + '" placeholder="유튜브 등 영상 주소"></div>' +
        '<div class="af-field"><label>📎 파일 URL</label><input type="text" id="se_file" value="' + esc(rec.file_url || '') + '" placeholder="자료 파일 주소"><button type="button" class="btn btn-line" id="se_file_up" style="margin-top:6px;width:100%;padding:7px;font-size:.8rem">⬆ 파일 업로드</button></div>' +
        '</div>' +
        '</aside>' +
        '<main class="sed-main">' +
        '<div class="sed-form">' +
        // 구글 문서처럼: 회색 캔버스 위 흰 용지만 — 줄자 없음, 글쓰기에 집중 (성경 본문·기도는 상단 리본 패널로 이동)
        '<div class="se-hide-worship"><span class="se-count" id="se_count" style="display:none"></span>' +
        '<div class="wd-area" id="wd_area">' +
        '<div class="wd-page" id="wd_page">' +
        '<div class="wd-crop-layer" id="wd_crop_layer"></div>' +
        '<div class="se-editor" id="se_editor" contenteditable="true" spellcheck="false" autocorrect="off" autocapitalize="off" data-ph="설교 원고를 작성하세요. 상단 리본의 도구로 굵게·제목·인용·색·목록·메모·이미지 등 서식을 적용할 수 있습니다."></div>' +
        '<div class="wd-pagenum-layer" id="wd_pgnum_layer"></div>' +
        '</div>' +
        '</div>' +
        '<textarea id="se_content" style="display:none"></textarea></div>' +
        '</div></main>' +
        // ── 우측 패널: 원고지 미리보기 / 생명의삶 자동분류 ──
        '<aside class="sed-aside-r">' +
        '<div class="rp-tabs"><button type="button" class="rp-tab on" data-p="prev">📄 PDF 미리보기</button><button type="button" class="rp-tab" data-p="qtc">📥 자동분류</button></div>' +
        '<div class="rp-pane" id="rp_prev">' +
        '<div class="rp-paperwrap" id="rp_paperwrap"><div class="rp-paper" id="rp_paper"><div class="rp-flow" id="rp_flow"></div></div></div>' +
        '<div class="rp-nav"><button type="button" id="rp_pg_prev" title="이전 페이지">◀</button><b id="rp_pg">1 / 1</b><button type="button" id="rp_pg_next" title="다음 페이지">▶</button></div>' +
        '<div class="rp-pageinfo" id="rp_pageinfo">아이패드 크기(3:4) · 실제 PDF 내보내기와 동일한 양식</div>' +
        '</div>' +
        '<div class="rp-pane" id="rp_qtc" style="display:none"><div class="qtc-card">' +
        '<div class="qtc-h">📥 생명의삶 자동분류</div>' +
        '<div class="qtc-sub">생명의삶(목회자판) 자료 전체를 붙여넣고 <b>분류</b>를 누르면 — 매일 QT로 설정되고 <b>날짜·본문·개역개정·우리말성경·제목·설교 원고·예화 클립</b>이 자동 입력됩니다.</div>' +
        '<textarea id="qtc_paste" class="qtc-paste" placeholder="여기에 생명의삶 자료 전체를 붙여넣으세요"></textarea>' +
        '<div style="display:flex;gap:6px;margin-top:7px"><button type="button" class="btn btn-solid" id="qtc_run" style="flex:1;padding:9px;font-weight:700">🔎 분류</button><button type="button" class="btn btn-line" id="qtc_clear" style="padding:9px 12px">지우기</button></div>' +
        '<div id="qtc_msg" style="font-size:.76rem;margin-top:7px;min-height:0;line-height:1.5"></div>' +
        '<div id="qtc_result"></div>' +
        '<div style="border-top:1px solid #eef1f5;margin:13px 0 0;padding-top:11px"><button type="button" class="btn btn-line" id="qtc_illus" style="width:100%;padding:9px">🔍 예화 검색·삽입</button></div>' +
        '</div></div>' +
        '</aside>' +
        '</div>' +
        // ── 하단 상태바: 페이지·단어·글자 · 저장 시각 · 맞춤(줌) ──
        '<footer class="sed-sb"' + (worshipMode ? ' style="display:none"' : '') + '>' +
        '<span id="sb_count">1 페이지 · 0 단어 · 0 글자</span>' +
        '<span id="sb_saved" style="margin-left:auto">' + (rec.id ? '불러옴' : '새 문서') + '</span>' +
        '<span style="display:inline-flex;align-items:center;gap:7px">맞춤 <input type="range" id="sb_zoom" min="40" max="130" value="66" style="width:110px"> <b id="sb_zoom_v" style="min-width:36px">66%</b></span>' +
        '</footer>';
      document.body.appendChild(ov);
      document.body.style.overflow = 'hidden';
      var close = pushBackClose(function () { ov.remove(); document.body.style.overflow = ''; });
      ov.querySelector('#se_close').onclick = close;

      // ── 예배 순서(드래그) + 항목별 파일 업로드 ──
      var dragKind = null, dragOrderIdx = -1, dragGyodok = null;

      // ── 예배 순서(왼쪽): 항목 추가 · 드래그 정렬 ──
      var order = []; try { order = JSON.parse(rec.worship_order || '[]') || []; } catch (e) { order = []; }
      var oSortable = null;
      // 주보와 동일한 주일 낮 예배 순서(15항목) 프리셋
      function sundayPresetOrder() { return BULLETIN_PRESET.map(function (n) { return { label: n, detail: '' }; }); }
      function uploadToOrder(i, f) {
        if (!f || !order[i]) return;
        if (!(window.ChurchUpload && ChurchUpload.isReady())) { alert('업로드 서버가 설정되지 않았습니다.'); return; }
        order[i]._up = true; renderOrder();
        ChurchUpload.upload(f, { folder: 'worship/order', compress: false }).then(function (res) { if (order[i]) { order[i].url = res.url; order[i]._up = false; } renderOrder(); }).catch(function (e) { if (order[i]) order[i]._up = false; renderOrder(); alert('업로드 실패: ' + e.message); });
      }
      var oBox = ov.querySelector('#se_order');
      var PRESETS = ['묵도', '찬송', '신앙고백', '교독문', '대표기도', '성경봉독', '찬양', '특송', '봉헌', '말씀(설교)', '주기도문', '광고', '축도', '기타'];
      function presetDetail(label) {
        if (label === '교독문') return ov.querySelector('#se_gyodok_v').value || '';
        if (label === '성경봉독') return ov.querySelector('#se_scripture').value || '';
        if (label === '말씀(설교)') return ov.querySelector('#se_title').value || '';
        if (label === '찬송') return hymnsLabel(ov.querySelector('#se_hymns_v').value) || '';
        return '';
      }
      // 항목 전문(기도문·소식·신앙고백 등) 작성 모달 → it.body 에 저장
      function orderTextModal(it, title, ph) {
        var ov2 = document.createElement('div');
        ov2.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,25,.5);z-index:9700;display:flex;align-items:flex-start;justify-content:center;padding:30px 14px;overflow:auto';
        ov2.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:640px;width:100%;padding:20px 22px;box-shadow:0 24px 60px rgba(0,0,0,.3)">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><h3 style="margin:0;color:var(--accent,#223350)">' + esc(title) + '</h3><button class="btn btn-line" id="otm_close" style="padding:3px 11px">닫기</button></div>' +
          '<textarea id="otm_ta" placeholder="' + esc(ph) + '" style="width:100%;min-height:260px;padding:12px 14px;border:1px solid #e2e8f0;border-radius:9px;font:inherit;line-height:1.85;outline:none;font-family:\'Noto Serif KR\',serif">' + esc(it.body || '') + '</textarea>' +
          '<div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;gap:8px"><label style="font-size:.82rem;color:#5a6b82;display:inline-flex;align-items:center;gap:5px"><input type="checkbox" id="otm_fixed"' + (it.fixed ? ' checked' : '') + ' style="width:15px;height:15px;accent-color:#c79a2e"> 📌 고정(매주 유지)</label>' +
          '<div><button class="btn btn-line" id="otm_cancel" style="padding:8px 16px">취소</button> <button class="btn btn-solid" id="otm_save" style="padding:8px 20px;font-weight:700">저장</button></div></div></div>';
        document.body.appendChild(ov2);
        function close() { ov2.remove(); }
        ov2.querySelector('#otm_close').onclick = close;
        ov2.querySelector('#otm_cancel').onclick = close;
        ov2.addEventListener('click', function (e) { if (e.target === ov2) close(); });
        ov2.querySelector('#otm_ta').focus();
        ov2.querySelector('#otm_save').onclick = function () { it.body = ov2.querySelector('#otm_ta').value; it.fixed = ov2.querySelector('#otm_fixed').checked; close(); renderOrder(); };
      }
      function renderOrder() {
        var rowsHtml = order.map(function (it, i) {
          var detailLine = it.detail ? '<div class="od-detail-view" style="font-size:.82rem;color:#48576b;margin-top:2px">' + esc(it.detail) + '</div>' : '';
          var bodyPrev = (it.body && !it._openBody) ? '<div style="font-size:.78rem;color:#7b8794;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📝 ' + esc(it.body.replace(/\s+/g, ' ').slice(0, 40)) + (it.body.length > 40 ? '…' : '') + '</div>' : '';
          var badges = (it.fixed ? ' <span style="font-size:.64rem;background:#fff3d6;color:#a8742a;border-radius:4px;padding:1px 6px;font-weight:700">📌 고정</span>' : '') +
            (it.noexport ? ' <span style="font-size:.64rem;background:#f1f3f6;color:#8a93a0;border-radius:4px;padding:1px 6px;font-weight:700">🚫 출력제외</span>' : '');
          return '<div class="od-row" data-i="' + i + '" style="display:flex;align-items:flex-start;gap:6px;border:1px solid #e1e7ef;border-radius:9px;padding:7px 9px;margin-bottom:6px;background:#fff' + (it.noexport ? ';opacity:.62' : '') + '">' +
            '<span class="od-handle" style="cursor:grab;color:#9aa5b1;padding-top:2px;touch-action:none">≡</span>' +
            '<span style="flex:0 0 16px;text-align:center;color:#7b8794;font-size:.74rem;padding-top:3px">' + (i + 1) + '</span>' +
            '<div style="flex:1;min-width:0"><div class="od-labelclick" data-i="' + i + '" title="클릭해서 작성/수정" style="font-weight:700;font-size:.9rem;color:var(--accent,#223350);cursor:pointer">' + esc(it.label || '항목') + badges + (it.url ? ' <a href="' + esc(it.url) + '" target="_blank" rel="noopener" style="font-size:.72rem;font-weight:400">자료</a>' : '') + '</div>' +
            detailLine + bodyPrev +
            (it._openBody ? '<textarea class="od-body" data-i="' + i + '" placeholder="전문(찬송가 가사·기도문 등) — 아이패드 보기에 그대로 펼쳐집니다" style="width:100%;margin-top:5px;min-height:72px;line-height:1.7;padding:6px 8px;border:1px solid #dfe5ee;border-radius:7px;font:inherit;font-size:.84rem">' + esc(it.body || '') + '</textarea>' : '') +
            '</div>' +
            '<button type="button" class="od-bodybtn" data-i="' + i + '" title="전문(가사·기도문) 직접 입력" style="border:0;background:none;cursor:pointer;color:' + (it.body ? '#1e874b' : '#5b6b7d') + ';padding-top:2px;font-size:.9rem">📄</button>' +
            '<button type="button" class="od-edit" data-i="' + i + '" title="작성/수정" style="border:0;background:none;cursor:pointer;color:#5b6b7d;padding-top:2px;font-size:.95rem">✎</button>' +
            '<button type="button" class="od-fix" data-i="' + i + '" title="고정(매주 유지·자료실 미업로드)" style="border:0;background:none;cursor:pointer;color:' + (it.fixed ? '#c79a2e' : '#c2c9d3') + ';padding-top:2px;font-size:.92rem">📌</button>' +
            '<button type="button" class="od-noexp" data-i="' + i + '" title="내보내기에서 제외" style="border:0;background:none;cursor:pointer;color:' + (it.noexport ? '#c0392b' : '#c2c9d3') + ';padding-top:2px;font-size:.92rem">🚫</button>' +
            '<button type="button" class="od-file" data-i="' + i + '" title="파일 첨부 (드래그앤드롭 가능)" style="border:0;background:none;cursor:pointer;color:' + (it.url ? '#1e874b' : '#5b6b7d') + ';padding-top:2px;font-size:.92rem">' + (it._up ? '⏳' : '📎') + '</button>' +
            '<button type="button" class="od-del" data-i="' + i + '" style="border:0;background:none;color:#c0392b;cursor:pointer;padding-top:2px">✕</button>' +
            '</div>';
        }).join('');
        oBox.innerHTML =
          '<button type="button" class="btn btn-line" id="od_add" style="padding:6px 13px;font-size:.84rem;margin-bottom:6px">＋ 항목 추가</button><div id="od_menu" style="display:none;flex-wrap:wrap;gap:5px;margin-bottom:8px"></div>' +
          '<div id="od_rows">' + rowsHtml + '</div>';
        Array.prototype.forEach.call(oBox.querySelectorAll('.od-del'), function (b) { b.onclick = function () { order.splice(Number(b.dataset.i), 1); renderOrder(); }; });
        Array.prototype.forEach.call(oBox.querySelectorAll('.od-bodybtn'), function (b) { b.onclick = function () { var i = Number(b.dataset.i); order[i]._openBody = !order[i]._openBody; renderOrder(); var ta = oBox.querySelector('.od-body[data-i="' + i + '"]'); if (ta) ta.focus(); }; });
        Array.prototype.forEach.call(oBox.querySelectorAll('.od-body'), function (ta) { ta.oninput = function () { order[Number(ta.dataset.i)].body = ta.value; }; });
        Array.prototype.forEach.call(oBox.querySelectorAll('.od-file'), function (b) { b.onclick = function () { var fi = document.createElement('input'); fi.type = 'file'; fi.onchange = function () { uploadToOrder(Number(b.dataset.i), fi.files && fi.files[0]); }; fi.click(); }; });
        Array.prototype.forEach.call(oBox.querySelectorAll('.od-fix'), function (b) { b.onclick = function () { var i = Number(b.dataset.i); order[i].fixed = !order[i].fixed; renderOrder(); }; });
        Array.prototype.forEach.call(oBox.querySelectorAll('.od-noexp'), function (b) { b.onclick = function () { var i = Number(b.dataset.i); order[i].noexport = !order[i].noexport; renderOrder(); }; });
        function editItem(i) {
          var it = order[i]; if (!it) return;
          if (it.label === '교독문') {
            gyodokPicker(function (g) { it.detail = g.no + '. ' + g.title; if (ov.querySelector('#se_gyodok_v')) ov.querySelector('#se_gyodok_v').value = it.detail; renderOrder(); });
          } else if (it.label === '찬송') {
            hymnPicker(it.hno ? [it.hno] : [], function (ns) {
              if (!ns.length) return;
              var f0 = ns[0]; it.hno = f0; it.detail = f0 + '장' + (hymnTitle(f0) ? ' ' + hymnTitle(f0) : '');
              var extras = ns.slice(1).map(function (n) { return { label: '찬송', detail: n + '장' + (hymnTitle(n) ? ' ' + hymnTitle(n) : ''), url: '', hno: n }; });
              if (extras.length) Array.prototype.splice.apply(order, [i + 1, 0].concat(extras));
              renderOrder();
            });
          } else if (/기도|축도/.test(it.label)) {
            orderTextModal(it, it.label + ' — 기도문 작성', '기도문을 입력하세요. (아이패드 보기에 그대로 펼쳐집니다)');
          } else if (/소식/.test(it.label)) {
            orderTextModal(it, '교회 소식 작성', '예배·주보에 넣을 교회 소식을 입력하세요. (한 줄에 하나씩)');
          } else if (it.label === '신앙고백') {
            orderTextModal(it, '신앙고백 (사도신경)', '사도신경 본문을 입력하세요. 매주 같으면 📌 고정으로 두세요.');
          } else {
            orderTextModal(it, it.label + ' — 내용 작성', '내용을 입력하세요.');
          }
        }
        Array.prototype.forEach.call(oBox.querySelectorAll('.od-edit'), function (b) { b.onclick = function () { editItem(Number(b.dataset.i)); }; });
        Array.prototype.forEach.call(oBox.querySelectorAll('.od-labelclick'), function (b) { b.onclick = function () { editItem(Number(b.dataset.i)); }; });
        var menu = oBox.querySelector('#od_menu');
        menu.innerHTML = PRESETS.map(function (p) { return '<button type="button" class="btn btn-line od-preset" style="padding:3px 9px;font-size:.78rem">' + esc(p) + '</button>'; }).join('');
        oBox.querySelector('#od_add').onclick = function () { menu.style.display = (menu.style.display === 'none' ? 'flex' : 'none'); };
        Array.prototype.forEach.call(menu.querySelectorAll('.od-preset'), function (b) { b.onclick = function () { var lb = b.textContent; order.push({ label: lb, detail: presetDetail(lb), url: '' }); renderOrder(); }; });
        function insertAt(idx, item) { if (idx < 0 || idx > order.length) idx = order.length; order.splice(idx, 0, item); }
        function clearDrag() { dragKind = null; dragOrderIdx = -1; dragGyodok = null; }
        function dropItem() {
          if (dragKind === 'gyodok' && dragGyodok) return { label: '교독문', detail: dragGyodok, url: '' };
          return null;
        }
        Array.prototype.forEach.call(oBox.querySelectorAll('.od-row'), function (row) {
          row.addEventListener('dragover', function (e) { e.preventDefault(); row.style.borderColor = '#6f9be0'; });
          row.addEventListener('dragleave', function () { row.style.borderColor = '#e1e7ef'; });
          row.addEventListener('drop', function (e) { e.preventDefault(); e.stopPropagation(); row.style.borderColor = '#e1e7ef'; var to = Number(row.dataset.i);
            var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (f) { uploadToOrder(to, f); return; }
            var it = dropItem();
            if (it) { insertAt(to, it); clearDrag(); renderOrder(); }
          });
        });
        if (oSortable) { try { oSortable.destroy(); } catch (e) { } oSortable = null; }
        var oRows = oBox.querySelector('#od_rows');
        if (window.Sortable && oRows) oSortable = window.Sortable.create(oRows, {
          handle: '.od-handle', draggable: '.od-row', animation: 170, easing: 'cubic-bezier(.2,.6,.35,1)',
          onEnd: function () {
            var ids = Array.prototype.map.call(oRows.querySelectorAll('.od-row'), function (r) { return Number(r.dataset.i); });
            var no = ids.map(function (idx) { return order[idx]; }).filter(Boolean);
            if (!no.length) { renderOrder(); return; }
            order.length = 0; Array.prototype.push.apply(order, no); renderOrder();
          }
        });
      }
      renderOrder();

      // 예배별 순서 양식: 저장/불러오기 + 예배 변경 시 자동 불러오기
      function tplMsg(t, ok) { var e = ov.querySelector('#se_tpl_msg'); if (e) { e.style.color = ok === false ? '#c0392b' : (ok ? 'green' : '#7b8794'); e.textContent = t; if (t) setTimeout(function () { if (e.textContent === t) e.textContent = ''; }, 2500); } }
      ov.querySelector('#se_tpl_save').onclick = function () {
        var svc = ov.querySelector('#se_service').value; if (!svc) { tplMsg('예배를 먼저 선택하세요.', false); return; }
        if (!order.length) { tplMsg('저장할 순서가 없습니다.', false); return; }
        tplMsg('저장 중…');
        api('POST', 'worship_templates?on_conflict=service', { service: svc, items: order, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=minimal')
          .then(function () { WTPL[svc] = JSON.parse(JSON.stringify(order)); tplMsg('✓ ' + svc + ' 양식 저장됨', true); })
          .catch(function (e) { if (/42P01|PGRST205|does not exist|schema cache/i.test(e.message)) tplMsg('worship_templates.sql 실행 필요', false); else tplMsg('저장 실패: ' + e.message, false); });
      };
      function loadTpl(svc, silent) {
        if (!svc || !WTPL[svc] || !WTPL[svc].length) { if (!silent) tplMsg('저장된 양식이 없습니다.', false); return false; }
        order = JSON.parse(JSON.stringify(WTPL[svc])); renderOrder(); if (!silent) tplMsg('✓ ' + svc + ' 양식 불러옴', true); return true;
      }
      ov.querySelector('#se_tpl_load').onclick = function () { loadTpl(ov.querySelector('#se_service').value, false); };
      // 예배 변경 시: 저장된 양식 우선, 없고 주일 낮 예배면 주보 표준 15순서 자동
      function autoFillOrder(svc) {
        if (order.length) return;
        if (loadTpl(svc, true)) return;
        if (svc === '주일 낮 예배') { order = sundayPresetOrder(); renderOrder(); }
      }
      // '기타' 선택 시 새 분류 이름 입력칸 표시 — 저장하면 그 이름이 분류가 되어 다음부터 목록에 나타남
      var svcCustomInp = ov.querySelector('#se_svc_custom');
      function syncSvcCustom() { if (svcCustomInp) svcCustomInp.style.display = (ov.querySelector('#se_service').value === '기타') ? '' : 'none'; }
      ov.querySelector('#se_service').addEventListener('change', function () {
        autoFillOrder(this.value);
        syncSvcCustom();
        // 매일 QT·새벽기도 선택 시 → 'QT 함께 만들기'·'우리말성경' 자동 켜짐 (다른 종류로 바꾸면 우리말성경 꺼짐)
        var qtSvc = (this.value === '매일 QT' || this.value === '새벽기도');
        if (qtToggle) qtToggle.checked = qtSvc;
        if (wmChk) wmChk.checked = qtSvc;
        syncQt();
      });
      syncSvcCustom();
      if (!rec.id) autoFillOrder(ov.querySelector('#se_service').value); // 새 설교 → 자동

      // 교독문·찬송가 선택 → 예배 순서에 항목으로 추가(드래그·파일 가능)
      ov.querySelector('#se_gyodok').onclick = function () {
        gyodokPicker(function (g) {
          var d = g.no + '. ' + g.title;
          ov.querySelector('#se_gyodok_v').value = d;
          order = order.filter(function (it) { return it.label !== '교독문'; });
          order.push({ label: '교독문', detail: d, url: '' });
          renderOrder();
        });
      };
      ov.querySelector('#se_hymn').onclick = function () {
        var cur = ov.querySelector('#se_hymns_v').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        hymnPicker(cur, function (ns) {
          ov.querySelector('#se_hymns_v').value = ns.join(',');
          var have = {}; order.forEach(function (it) { if (it.label === '찬송' && it.hno) have[it.hno] = 1; });
          order = order.filter(function (it) { return !(it.label === '찬송' && it.hno && ns.indexOf(it.hno) < 0); }); // 선택 해제된 찬송 제거
          ns.forEach(function (n) { if (!have[n]) { var t = hymnTitle(n); order.push({ label: '찬송', detail: n + '장' + (t ? ' ' + t : ''), url: '', hno: n }); } });
          renderOrder();
        });
      };
      // CCM: 예배 순서에 빈 CCM 항목 추가(✎로 곡명 입력, 📎로 파일 첨부)
      ov.querySelector('#se_ccm').onclick = function () {
        var v = prompt('CCM 곡명을 입력하세요', '');
        order.push({ label: 'CCM', detail: (v || '').trim(), url: '' });
        renderOrder();
      };
      // QT 내보내기 체크박스: 켜면 우리말성경 본문칸·카카오톡 버튼 표시
      var qtToggle = ov.querySelector('#se_qt_toggle');
      var qtWrap = ov.querySelector('#se_qt_bible_wrap');
      var wmChk = ov.querySelector('#se_woorimal_chk');
      var bibleColsEl = ov.querySelector('#se_bible_cols');
      var kakaoBtn = ov.querySelector('#se_kakao');
      function qtOn() { return !!(qtToggle && qtToggle.checked); }
      function wmOn() { return !!(wmChk && wmChk.checked); }
      // 우리말성경 본문 칸(2단)은 오직 '우리말성경' 체크박스로만 열고 닫는다 — 끄면 즉시 사라짐
      function syncQt() {
        var showW = wmOn();
        if (qtWrap) qtWrap.style.display = showW ? '' : 'none';
        if (bibleColsEl) bibleColsEl.style.gridTemplateColumns = showW ? '1fr 1fr' : '1fr';
        if (kakaoBtn) kakaoBtn.style.display = qtOn() ? '' : 'none';
      }
      var isQtSvc = (rec.service === '매일 QT' || rec.service === '새벽기도');
      if (qtToggle) {
        // 체크 여부는 '이 예배 종류가 QT류인가'로만 결정 — 과거에 우리말 데이터가 남아있다고 해서 자동으로 켜지지 않음(다른 종류로 바뀐 설교에서 오작동 방지)
        qtToggle.checked = isQtSvc;
        qtToggle.onchange = syncQt;
      }
      if (wmChk) {
        wmChk.checked = isQtSvc;   // QT·새벽기도면 우리말성경 기본 켜짐, 그 외엔 꺼짐
        wmChk.onchange = syncQt;
      }
      syncQt();

      // ── 성경 본문 자동 불러오기 (개역한글, bolls.life API) ──
      var BOOK_IDS = {
        '창세기':1,'창':1,'출애굽기':2,'출':2,'레위기':3,'레':3,'민수기':4,'민':4,
        '신명기':5,'신':5,'여호수아':6,'수':6,'사사기':7,'삿':7,'룻기':8,'룻':8,
        '사무엘상':9,'삼상':9,'사무엘하':10,'삼하':10,'열왕기상':11,'왕상':11,
        '열왕기하':12,'왕하':12,'역대상':13,'대상':13,'역대하':14,'대하':14,
        '에스라':15,'스':15,'느헤미야':16,'느':16,'에스더':17,'에':17,'욥기':18,'욥':18,
        '시편':19,'시':19,'잠언':20,'잠':20,'전도서':21,'전':21,'아가':22,'아':22,
        '이사야':23,'사':23,'예레미야':24,'렘':24,'예레미야애가':25,'애가':25,'애':25,
        '에스겔':26,'겔':26,'다니엘':27,'단':27,'호세아':28,'호':28,'요엘':29,'욜':29,
        '아모스':30,'암':30,'오바댜':31,'옵':31,'요나':32,'욘':32,'미가':33,'미':33,
        '나훔':34,'나':34,'하박국':35,'합':35,'스바냐':36,'습':36,'학개':37,'학':37,
        '스가랴':38,'슥':38,'말라기':39,'말':39,
        '마태복음':40,'마':40,'마가복음':41,'막':41,'누가복음':42,'눅':42,
        '요한복음':43,'요':43,'사도행전':44,'행':44,'로마서':45,'롬':45,
        '고린도전서':46,'고전':46,'고린도후서':47,'고후':47,'갈라디아서':48,'갈':48,
        '에베소서':49,'엡':49,'빌립보서':50,'빌':50,'골로새서':51,'골':51,
        '데살로니가전서':52,'살전':52,'데살로니가후서':53,'살후':53,
        '디모데전서':54,'딤전':54,'디모데후서':55,'딤후':55,'디도서':56,'딛':56,
        '빌레몬서':57,'몬':57,'히브리서':58,'히':58,'야고보서':59,'약':59,
        '베드로전서':60,'벧전':60,'베드로후서':61,'벧후':61,
        '요한일서':62,'요일':62,'요한이서':63,'요이':63,'요한삼서':64,'요삼':64,
        '유다서':65,'유':65,'요한계시록':66,'계':66,'계시록':66
      };
      function parseRef(ref) {
        var s = (ref || '').trim().replace(/\s+/g, ' ');
        var m = s.match(/^([가-힣]+)\s*(\d+)\s*[:장]\s*(\d+)(?:\s*[-~]\s*(\d+))?/);
        if (!m) return null;
        var bookId = BOOK_IDS[m[1].replace(/\s/g, '')];
        if (!bookId) return null;
        return { bookId: bookId, ch: parseInt(m[2], 10), from: parseInt(m[3], 10), to: m[4] ? parseInt(m[4], 10) : parseInt(m[3], 10) };
      }
      var fetchBtn = ov.querySelector('#se_fetch_btn');
      var scInp = ov.querySelector('#se_scripture');
      var bibleLoading = ov.querySelector('#se_bible_loading');
      function doFetchBible() {
        var ref = scInp ? scInp.value.trim() : '';
        if (!ref) return;
        var p = parseRef(ref);
        if (!p) { if (bibleLoading) bibleLoading.textContent = '구절 형식 오류 (예: 창1:1-5)'; return; }
        var bk = BBLK[p.bookId - 1];
        if (!bk) { if (bibleLoading) bibleLoading.textContent = '성경책을 찾을 수 없습니다'; return; }
        if (bibleLoading) bibleLoading.textContent = '불러오는 중…';
        var bookKey = bk[2];
        function extractLines(data) {
          var chap = (data[bookKey] || [])[p.ch - 1] || [];
          var lines = [];
          for (var vi = p.from; vi <= p.to; vi++) {
            var t = chap[vi - 1];
            if (t) lines.push(vi + ' ' + t.trim());
          }
          return lines;
        }
        function loadBible(trans) {
          var cached = trans === 'gyr' ? window.BIBLE_GYR : window.BIBLE_URM;
          if (cached) return Promise.resolve(cached);
          return fetch('data/bible-' + trans + '.json?v=20260729')
            .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
            .then(function (d) { if (trans === 'gyr') window.BIBLE_GYR = d; else window.BIBLE_URM = d; return d; });
        }
        Promise.all([loadBible('gyr'), loadBible('urm')])
          .then(function (res) {
            var gLines = extractLines(res[0]);
            var uLines = extractLines(res[1]);
            var bEl  = ov.querySelector('#se_bible');
            var qtEl = ov.querySelector('#se_qt_bible');
            if (bEl)  bEl.value  = gLines.join('\n');
            if (qtEl) qtEl.value = uLines.join('\n');
            if (bibleLoading) bibleLoading.textContent = gLines.length ? ('✓ ' + gLines.length + '절') : '해당 구절 없음';
          })
          .catch(function (e) { if (bibleLoading) bibleLoading.textContent = '불러오기 실패 — ' + (e.message || '오류'); });
      }
      if (fetchBtn) fetchBtn.onclick = doFetchBible;
      if (scInp) scInp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doFetchBible(); } });

      // ── 왼쪽 성경 보기 패널 (설교 모드 전용) ──
      if (!worshipMode) (function () {
        var bookSel = ov.querySelector('#mb_book'), chapSel = ov.querySelector('#mb_chap');
        var textEl = ov.querySelector('#mb_text'), insBtn = ov.querySelector('#mb_insert');
        if (!bookSel || !chapSel || !textEl) return;
        var mbTrans = 'gyr', mbBook = 1, mbChap = 1;
        var pref = parseRef(scInp ? scInp.value : ''); if (pref) { mbBook = pref.bookId; mbChap = pref.ch; }
        // 성경 박스 안에서 절을 드래그로 선택할 때, 선택이 뒤쪽 원고로 새어 나가지 않도록
        // 드래그하는 동안만 원고·미리보기를 선택 불가로 막는다(박스 밖으로 마우스가 나가도 원고가 잡히지 않음).
        textEl.addEventListener('mousedown', function () {
          ov.classList.add('sed-nosel-editor');
          var onUp = function () { ov.classList.remove('sed-nosel-editor'); document.removeEventListener('mouseup', onUp); };
          document.addEventListener('mouseup', onUp);
        });
        bookSel.innerHTML = BBLK.map(function (b) { return '<option value="' + b[0] + '"' + (b[0] === mbBook ? ' selected' : '') + '>' + esc(b[1]) + '</option>'; }).join('');
        function fillChaps() {
          var bk = BBLK[mbBook - 1], h = '';
          for (var c = 1; c <= bk[3]; c++) h += '<option value="' + c + '"' + (c === mbChap ? ' selected' : '') + '>' + c + '장</option>';
          chapSel.innerHTML = h;
        }
        function mbLoad(trans) {
          var cached = trans === 'gyr' ? window.BIBLE_GYR : window.BIBLE_URM;
          if (cached) return Promise.resolve(cached);
          return fetch('data/bible-' + trans + '.json?v=20260729').then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
            .then(function (d) { if (trans === 'gyr') window.BIBLE_GYR = d; else window.BIBLE_URM = d; return d; });
        }
        function show() {
          var bk = BBLK[mbBook - 1];
          textEl.innerHTML = '<p class="mb-hint">불러오는 중…</p>';
          mbLoad(mbTrans).then(function (data) {
            var verses = (data[bk[2]] || [])[mbChap - 1] || [];
            var tname = mbTrans === 'gyr' ? '개역개정' : '우리말성경';
            var html = '<div class="mb-thead"><span>' + esc(bk[1]) + ' ' + mbChap + '장</span><span>' + tname + ' · ' + verses.length + '절</span></div>';
            html += verses.map(function (v, i) { return '<div class="mb-verse"><span class="mb-vn">' + (i + 1) + '</span>' + esc(v) + '</div>'; }).join('');
            if (!verses.length) html += '<p class="mb-hint">해당 장의 데이터가 없습니다.</p>';
            textEl.innerHTML = html; textEl.scrollTop = 0;
          }).catch(function () { textEl.innerHTML = '<p class="mb-hint" style="color:#c0392b">성경 데이터를 불러오지 못했습니다.</p>'; });
        }
        bookSel.onchange = function () { mbBook = Number(this.value); mbChap = 1; fillChaps(); show(); };
        chapSel.onchange = function () { mbChap = Number(this.value); show(); };
        Array.prototype.forEach.call(ov.querySelectorAll('.mb-trans button'), function (b) {
          b.onclick = function () { mbTrans = b.dataset.v; Array.prototype.forEach.call(ov.querySelectorAll('.mb-trans button'), function (x) { x.classList.toggle('on', x.dataset.v === mbTrans); }); show(); };
        });
        if (insBtn) insBtn.onclick = function () {
          var bk = BBLK[mbBook - 1];
          var bEl = ov.querySelector('#se_bible');
          if (bEl && bEl.value.trim() && !confirm('본문(성경) 칸을 ' + bk[1] + ' ' + mbChap + '장 전체로 바꿀까요?')) return;
          if (scInp) scInp.value = bk[1] + ' ' + mbChap + '장';
          mbLoad('gyr').then(function (g) { var gv = (g[bk[2]] || [])[mbChap - 1] || []; if (bEl) bEl.value = gv.map(function (v, i) { return (i + 1) + ' ' + v; }).join('\n'); });
          if (qtOn() || wmOn()) mbLoad('urm').then(function (u) { var uv = (u[bk[2]] || [])[mbChap - 1] || []; var qEl = ov.querySelector('#se_qt_bible'); if (qEl) qEl.value = uv.map(function (v, i) { return (i + 1) + ' ' + v; }).join('\n'); });
          var msg = ov.querySelector('#se_msg'); if (msg) { msg.style.color = '#0d6b5e'; msg.textContent = '📖 ' + bk[1] + ' ' + mbChap + '장을 본문칸에 넣었습니다.'; }
        };
        fillChaps(); show();
        // ── 성경 팝업 열기/닫기 (툴바 📖 성경 버튼) ──
        var pop = ov.querySelector('#se_bible_pop'), openBtn = ov.querySelector('#se_bible_open'), closeBtn = ov.querySelector('#mb_close');
        function openPop() {
          // 본문칸에 적힌 구절이 있으면 그 책·장으로 맞춰서 연다
          var pref = parseRef(scInp ? scInp.value : '');
          if (pref && (pref.bookId !== mbBook || pref.ch !== mbChap)) { mbBook = pref.bookId; mbChap = pref.ch; bookSel.value = mbBook; fillChaps(); show(); }
          // 위 도구상자(헤더+리본)를 침범하지 않게 리본 바로 아래에서 열림
          if (pop) {
            try {
              var rb = ov.querySelector('.sed-ribbon'), hd = ov.querySelector('.sed-hd');
              var base = (rb && rb.offsetHeight > 0) ? rb.getBoundingClientRect().bottom : (hd ? hd.getBoundingClientRect().bottom : 66);
              var top = Math.max(64, Math.round(base) + 8);
              pop.style.top = top + 'px';
              var card = pop.querySelector('.mb-card'); if (card) card.style.maxHeight = 'calc(100vh - ' + (top + 14) + 'px)';
            } catch (e) { }
            pop.classList.add('open');
          }
          if (openBtn) openBtn.style.background = '#dbe9ff';
        }
        function closePop() { if (pop) pop.classList.remove('open'); if (openBtn) openBtn.style.background = ''; }
        if (openBtn) openBtn.onclick = function () { if (pop && pop.classList.contains('open')) closePop(); else openPop(); };
        if (closeBtn) closeBtn.onclick = closePop;
        ov.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pop && pop.classList.contains('open')) closePop(); });

        // ── 성경 보기 설정: 배경 색상·글씨 크기·줄간격 (localStorage 저장) ──
        (function mbPrefs() {
          var setBtn = ov.querySelector('#mb_set_btn'), setBox = ov.querySelector('#mb_set'), mbText = ov.querySelector('#mb_text');
          if (!setBtn || !setBox || !mbText) return;
          var LSK = 'wpMbPrefs1';
          var prefs = { bg: 'dark', fs: 15, lh: 1.85 };
          try { var sv = JSON.parse(localStorage.getItem(LSK) || 'null'); if (sv) { prefs.bg = sv.bg || prefs.bg; prefs.fs = Number(sv.fs) || prefs.fs; prefs.lh = Number(sv.lh) || prefs.lh; } } catch (e) { }
          var fsV = ov.querySelector('#mb_fs_v'), lhSel2 = ov.querySelector('#mb_lh');
          function apply() {
            mbText.setAttribute('data-bg', prefs.bg);
            mbText.style.fontSize = prefs.fs + 'px';
            mbText.style.lineHeight = String(prefs.lh);
            if (fsV) fsV.textContent = prefs.fs + 'px';
            if (lhSel2) lhSel2.value = String(prefs.lh);
            Array.prototype.forEach.call(ov.querySelectorAll('.mb-sw'), function (b) { b.classList.toggle('on', b.dataset.bg === prefs.bg); });
            try { localStorage.setItem(LSK, JSON.stringify(prefs)); } catch (e) { }
          }
          setBtn.onclick = function () { setBox.style.display = (setBox.style.display === 'none' ? '' : 'none'); };
          Array.prototype.forEach.call(ov.querySelectorAll('.mb-sw'), function (b) { b.onclick = function () { prefs.bg = b.dataset.bg; apply(); }; });
          var fsDn = ov.querySelector('#mb_fs_dn'), fsUp = ov.querySelector('#mb_fs_up');
          if (fsDn) fsDn.onclick = function () { prefs.fs = Math.max(12, prefs.fs - 1); apply(); };
          if (fsUp) fsUp.onclick = function () { prefs.fs = Math.min(26, prefs.fs + 1); apply(); };
          if (lhSel2) lhSel2.onchange = function () { prefs.lh = Number(this.value) || 1.85; apply(); };
          apply();
        })();
      })();

      function gather() {
        return {
          sermon_date: ov.querySelector('#se_date').value || null,
          // '기타' + 새 분류 이름 입력 시 → 그 이름으로 저장(다음부터 분류 목록에 자동 표시)
          service: (function () { var v = ov.querySelector('#se_service').value; var cu = ov.querySelector('#se_svc_custom'); if (v === '기타' && cu && cu.value.trim()) return cu.value.trim(); return v || null; })(),
          title: ov.querySelector('#se_title').value.trim() || null,
          scripture: ov.querySelector('#se_scripture').value.trim() || null,
          preacher: ov.querySelector('#se_preacher').value.trim() || null,
          // 저장은 페이지 나눔 흔적(자동 간격 .pg-break-spacer, 페이지 넘김용 조각 .pg-cont)을 모두 원상복구한 깨끗한 HTML로
          // — 용지·여백·배율마다 달라지는 임시 레이아웃은 저장하지 않음. (Ctrl+Enter 수동 나눔 .pg-manual-break은 사용자 의도라 보존)
          content: (wdCleanHtml ? wdCleanHtml() : (function () { var c = ed.cloneNode(true); Array.prototype.forEach.call(c.querySelectorAll('.pg-break-spacer'), function (n) { n.remove(); }); return c.innerHTML; })()) || null,
          prayer: (ov.querySelector('#se_prayer') ? ov.querySelector('#se_prayer').value : '') || null,
          bible_text: (ov.querySelector('#se_bible') ? ov.querySelector('#se_bible').value : '') || null,
          // 체크박스는 화면에 보이고 안 보이고만 결정 — 저장은 칸에 실제로 있는 값 그대로(체크 꺼졌다고 기존 우리말 데이터가 지워지면 안 됨)
          qt_bible_text: (ov.querySelector('#se_qt_bible') ? ov.querySelector('#se_qt_bible').value : '') || null,
          media_url: ov.querySelector('#se_media').value || null,
          file_url: ov.querySelector('#se_file').value || null,
          gyodok: ov.querySelector('#se_gyodok_v').value || null,
          hymns: ov.querySelector('#se_hymns_v').value || null,
          worship_order: (order.length ? JSON.stringify(order.map(function (o) { return { label: o.label, detail: o.detail, url: o.url || '', hno: o.hno, body: o.body || '', fixed: !!o.fixed, noexport: !!o.noexport, images: o.images || undefined }; })) : null),
          // 설교 매니저 확장(supabase/sermons_manager.sql): 시리즈·키워드·요약·상태
          series: seriesArr.length ? seriesArr.join(', ') : null,
          keywords: (function () { var el = ov.querySelector('#se_keywords'); if (!el) return null; var a = el.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 3); return a.join(', ') || null; })(),
          summary: (ov.querySelector('#se_summary') ? ov.querySelector('#se_summary').value.trim() : '') || null,
          status: (ov.querySelector('#se_status') ? ov.querySelector('#se_status').value : '') || null
        };
      }
      // 새벽기도 + 'QT 함께 만들기' 체크 시 → 매일 QT를 별도 목록에 함께 저장
      function shouldPairQt() { return ov.querySelector('#se_service').value === '새벽기도' && qtOn(); }
      function pairQt(mainData, done) {
        var qtData = {
          sermon_date: mainData.sermon_date, service: '매일 QT',
          title: mainData.title, scripture: mainData.scripture, preacher: mainData.preacher,
          content: mainData.content, bible_text: mainData.bible_text, qt_bible_text: mainData.qt_bible_text,
          prayer: mainData.prayer   // 기도를 새벽기도·매일 QT 둘 다 함께 저장
        };
        api('GET', 'sermons?select=id&service=eq.' + encodeURIComponent('매일 QT') + '&sermon_date=eq.' + encodeURIComponent(mainData.sermon_date) + '&limit=1')
          .then(function (rows) {
            return (rows && rows[0])
              ? api('PATCH', 'sermons?id=eq.' + rows[0].id, qtData, 'return=minimal')
              : api('POST', 'sermons', qtData, 'return=minimal');
          })
          .then(function () { if (done) done(true); })
          .catch(function () { if (done) done(false); });
      }
      function save(then, onErr) {
        var data = gather();
        var msg = ov.querySelector('#se_msg');
        if (!data.sermon_date || !data.title) { msg.style.color = '#c0392b'; msg.textContent = '일자와 제목은 필수입니다.'; if (onErr) onErr(new Error('일자·제목 필수')); return; }
        msg.style.color = '#7b8794'; msg.textContent = '저장 중…';
        var p = rec.id ? api('PATCH', 'sermons?id=eq.' + rec.id, data, 'return=representation') : api('POST', 'sermons', data, 'return=representation');
        p.then(function (rows) {
          var saved = (rows && rows[0]) || data; if (rows && rows[0]) rec.id = rows[0].id;
          markSaved();
          if (shouldPairQt()) {
            msg.style.color = '#7b8794'; msg.textContent = '새벽기도 저장됨 · QT 함께 저장 중…';
            pairQt(data, function (ok) {
              msg.style.color = ok ? 'green' : '#c0392b';
              msg.textContent = ok ? '✓ 새벽기도 · 매일 QT 함께 저장되었습니다' : '✓ 새벽기도 저장됨 — QT 저장 실패, 다시 시도해 주세요';
              loadList(); if (then) then(saved);
            });
          } else {
            msg.style.color = 'green'; msg.textContent = '✓ 저장되었습니다'; loadList(); if (then) then(saved);
          }
        })
          .catch(function (e) {
            // 시리즈·키워드·요약·상태 컬럼이 아직 없으면(sermons_manager.sql 미실행) 해당 필드만 빼고 재시도
            if (/series|keywords|summary|status/i.test(e.message || '') && ('series' in data)) {
              var d2 = {}; Object.keys(data).forEach(function (k) { if (['series', 'keywords', 'summary', 'status'].indexOf(k) < 0) d2[k] = data[k]; });
              var p2 = rec.id ? api('PATCH', 'sermons?id=eq.' + rec.id, d2, 'return=representation') : api('POST', 'sermons', d2, 'return=representation');
              p2.then(function (rows) {
                var saved = (rows && rows[0]) || d2; if (rows && rows[0]) rec.id = rows[0].id;
                markSaved();
                msg.style.color = '#a8742a'; msg.textContent = '✓ 저장됨 — 시리즈·키워드·요약·상태 저장은 Supabase에서 supabase/sermons_manager.sql 1회 실행 후 가능합니다.';
                loadList(); if (then) then(saved);
              }).catch(function (e2) { fail(e2); });
              return;
            }
            fail(e);
            function fail(e) {
              msg.style.color = '#c0392b';
              var hint = /qt_bible_text|bible_text|column|PGRST204|schema cache|Could not find/i.test(e.message || '') ? ' — Supabase에서 supabase/sermons_extra.sql 을 1회 실행해 주세요(설교 본문·QT 컬럼 추가).' : '';
              msg.textContent = '저장 실패: ' + (e.message || e) + hint;
              if (onErr) onErr(e);
            }
          });
      }
      ov.querySelector('#se_save').onclick = function () { save(null); };
      // 👁 미리보기 — 저장 없이 현재 화면 그대로 아이패드 보기로 미리 확인(설교 본문 포함)
      ov.querySelector('#se_preview').onclick = function () {
        var msg = ov.querySelector('#se_msg');
        var w = window.open('', '_blank');
        if (!w) { msg.style.color = '#c0392b'; msg.textContent = '팝업이 차단되었습니다 — 미리보기를 위해 팝업을 허용해 주세요.'; return; }
        try { w.document.write('<p style="font-family:sans-serif;color:#7b8794;padding:24px">미리보기 준비 중…</p>'); } catch (_) { }
        sermonReadingView(gather(), { qt: false, win: w });
        msg.style.color = '#7b8794'; msg.textContent = worshipMode ? '👁 미리보기를 열었습니다(저장 안 됨). 확인 후 ‘저장 후 내보내기’를 누르세요.' : '👁 미리보기를 열었습니다(저장 안 됨). 확인 후 ‘저장’을 누르세요.';
      };
      var exportBtn = ov.querySelector('#se_export');
      if (exportBtn) exportBtn.onclick = function () {
        var msg = ov.querySelector('#se_msg');
        var data = gather();
        if (!data.sermon_date || !data.title) { msg.style.color = '#c0392b'; msg.textContent = '내보내기 전에 일자와 제목을 입력해 주세요.'; var t = ov.querySelector(!data.title ? '#se_title' : '#se_date'); if (t) t.focus(); return; }
        // 창은 클릭 즉시(사용자 제스처) 동기로 열어야 팝업 차단을 피함 — 저장 후 내용 주입
        var w1 = window.open('', '_blank');
        if (!w1) { msg.style.color = '#c0392b'; msg.textContent = '팝업이 차단되었습니다. 브라우저에서 팝업을 허용해 주세요.'; return; }
        try { w1.document.write('<p style="font-family:sans-serif;color:#7b8794;padding:24px">저장 후 내보내는 중입니다…</p>'); } catch (_) { }
        save(function (saved) {
          sermonReadingView(saved, { qt: false, win: w1 });   // 설교문(개역개정) + 예배 순서(정식 예배) + 설교 본문
        }, function (e) {
          var isCol = /column|PGRST204|schema cache|Could not find|qt_bible_text|bible_text|prayer|worship_order/i.test((e && e.message) || '');
          var html = '<div style="font-family:sans-serif;color:#c0392b;padding:24px;line-height:1.7">저장에 실패해 내보내기를 완료하지 못했습니다.<br><br><b>' + esc(e && e.message ? e.message : e) + '</b>' + (isCol ? '<br><br>※ Supabase SQL Editor에서 <b>supabase/sermons_extra.sql</b> 을 1회 실행해 주세요(설교 본문·기도·QT 컬럼 추가).' : '') + '</div>';
          try { if (w1) { w1.document.body.innerHTML = html; } } catch (_) { }
        });
      };
      ov.querySelector('#se_kakao').onclick = function () {
        save(function (saved) { copyKakaoQt(saved); });
      };
      var pdfBtn = ov.querySelector('#se_pdf');
      if (pdfBtn) pdfBtn.onclick = function () {
        var msg = ov.querySelector('#se_msg');
        var data = gather();
        if (!data.sermon_date || !data.title) { msg.style.color = '#c0392b'; msg.textContent = 'PDF 내보내기 전에 일자와 제목을 입력해 주세요.'; return; }
        if (!(window.WPF && window.FINANCE_API_URL)) { msg.style.color = '#c0392b'; msg.textContent = 'PDF 내보내기는 재정 API 설정 후 이용할 수 있습니다.'; return; }
        var old = pdfBtn.textContent; pdfBtn.disabled = true; pdfBtn.textContent = '저장 중…';
        save(function (saved) {
          pdfBtn.textContent = 'PDF 생성 중…';
          WPF.call('exportSermonPdf', {
            date: saved.sermon_date,
            title: saved.title || '',
            service: saved.service || '',
            preacher: saved.preacher || '',
            scripture: saved.scripture || '',
            bibleText: saved.bible_text || '',
            contentHtml: saved.content || '',
            seriesLine: seriesLineInfo()   // 시리즈 · N번째 설교 (제목 왼쪽 위 출력)
          }).then(function (r) {
            pdfBtn.disabled = false; pdfBtn.textContent = old;
            msg.style.color = 'green';
            msg.innerHTML = '✓ PDF 저장됨 — "' + esc(r.folder) + '" 폴더 · <a href="' + esc(r.url) + '" target="_blank" rel="noopener">열어보기 →</a>';
          }).catch(function (e) {
            pdfBtn.disabled = false; pdfBtn.textContent = old;
            msg.style.color = '#c0392b';
            var m = (e && e.message) || '';
            msg.textContent = /unknown action/i.test(m) ? 'PDF 내보내기는 Apps Script 재배포 후 이용할 수 있습니다.' : ('PDF 내보내기 실패: ' + m);
          });
        }, function (e) {
          pdfBtn.disabled = false; pdfBtn.textContent = old;
          msg.style.color = '#c0392b'; msg.textContent = '저장 실패: ' + (e && e.message ? e.message : e);
        });
      };

      // ── 설교 원고 리치 에디터(contenteditable) ──
      var ed = ov.querySelector('#se_editor'), hid = ov.querySelector('#se_content'), cntEl = ov.querySelector('#se_count');
      (function initEditor() {
        var raw = rec.content || '';
        if (/<(p|div|h[1-6]|ul|ol|li|blockquote|br|span|mark|b|i|strong|em|u|s|font)\b/i.test(raw)) ed.innerHTML = raw;        // 이미 서식 있는 원고
        else if (raw.trim()) ed.innerHTML = raw.split(/\n{2,}/).map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('');  // 기존 평문 → 문단
        else ed.innerHTML = '';
        syncContent();
      })();
      // 저장·미리보기·AI용 깨끗한 HTML — 예전엔 키 입력마다 원고 전체를 복제·정리해 숨은칸(hid)에 넣어
      // 긴 원고에서 타이핑이 무거웠음 → 필요할 때만 계산하는 함수로 전환(입력 성능).
      function cleanContent() { return wdCleanHtml ? wdCleanHtml() : ed.innerHTML; }
      var cntT = null;
      function updateCounts() {
        var t = (ed.innerText || '').replace(/ /g, ' ').trim();
        var words = t ? t.split(/\s+/).length : 0, chars = t.replace(/\s/g, '').length;
        cntEl.textContent = words + '단어 · ' + chars + '자';
      }
      function syncContent() { clearTimeout(cntT); cntT = setTimeout(updateCounts, 300); }   // 카운트만 디바운스 갱신
      ed.addEventListener('input', syncContent);
      try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
      function exec(cmd, val) { pushUndo(); ed.focus(); try { document.execCommand(cmd, false, val == null ? null : val); } catch (e) {} syncContent(); }
      Array.prototype.forEach.call(ov.querySelectorAll('#se_tb [data-cmd]'), function (b) {
        b.onmousedown = function (e) { e.preventDefault(); };   // 선택영역 유지
        b.onclick = function () {
          var c = b.dataset.cmd;
          if (c === 'undo') { doUndo(); return; }   // 브라우저 undo는 페이지 나눔 DOM 재구성으로 오염됨 → 자체 스택 사용
          if (c === 'redo') { doRedo(); return; }
          exec(c);
        };
      });
      // 셀렉트·팔레트 클릭 시 선택영역 보존 — 노드 참조가 아니라 '전역 문자 오프셋'으로 저장한다.
      // (페이지 나눔이 조각을 합치거나 다시 쪼개면 노드가 갈아치워져 참조형 Range는 무효가 됨 → 색상이 엉뚱한 곳에 적용되던 오류)
      var savedSel = null;
      function selToGlobal(container, offset) { var pre = document.createRange(); pre.selectNodeContents(ed); try { pre.setEnd(container, offset); } catch (e) { return -1; } return pre.toString().length; }
      function globalToPos(g) { if (g < 0) return null; var w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT, null), acc = 0, x, last = null; while (x = w.nextNode()) { last = x; if (acc + x.data.length >= g) return { node: x, offset: g - acc }; acc += x.data.length; } return last ? { node: last, offset: last.data.length } : null; }
      function saveSel() { var s = window.getSelection(); if (s && s.rangeCount && ed.contains(s.anchorNode)) { var r = s.getRangeAt(0); savedSel = { s: selToGlobal(r.startContainer, r.startOffset), e: selToGlobal(r.endContainer, r.endOffset) }; } }
      function restoreSel() { if (!savedSel || savedSel.s < 0) return; var a = globalToPos(savedSel.s), b = globalToPos(savedSel.e); if (!a || !b) return; try { var r = document.createRange(); r.setStart(a.node, a.offset); r.setEnd(b.node, b.offset); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); } catch (e) { } }
      ed.addEventListener('mouseup', saveSel);
      ed.addEventListener('keyup', function (e) {   // 키 입력마다 원고 전체를 직렬화하던 부담 제거 — 선택 이동 키에서만 저장
        var k = e.key || '';
        if (k.indexOf('Arrow') === 0 || k === 'Home' || k === 'End' || k === 'PageUp' || k === 'PageDown' || e.shiftKey) saveSel();
      });

      // ── 실행취소/다시실행: 자체 스냅샷 스택 ──────────────────────────────
      // 페이지 나눔(repaginate)이 execCommand 밖에서 DOM을 재구성(간격 삽입·문단 분할/병합)하기 때문에
      // 브라우저 기본 undo 스택은 금방 오염되어 Ctrl+Z가 엉뚱하게 동작한다.
      // → '깨끗한 HTML + 전역 캐럿 오프셋' 스냅샷을 직접 쌓고, Ctrl+Z/Y·툴바 ↶↷를 여기에 연결한다.
      var undoStack = [], redoStack = [], undoT = null, edComposing = false, UNDO_MAX = 100;
      function caretSnap() {
        var s = window.getSelection();
        if (s && s.rangeCount && ed.contains(s.anchorNode)) { var r = s.getRangeAt(0); return { s: selToGlobal(r.startContainer, r.startOffset), e: selToGlobal(r.endContainer, r.endOffset) }; }
        return null;
      }
      function takeSnap() { return { html: cleanContent(), sel: caretSnap() }; }
      function pushUndo() {
        clearTimeout(undoT); undoT = null;
        var snap = takeSnap();
        var top = undoStack[undoStack.length - 1];
        if (top && top.html === snap.html) { if (snap.sel) top.sel = snap.sel; return; }   // 내용 그대로면 스택·redo 유지
        undoStack.push(snap);
        if (undoStack.length > UNDO_MAX) undoStack.shift();
        redoStack.length = 0;
      }
      function schedPushUndo() { clearTimeout(undoT); undoT = setTimeout(pushUndo, 600); }
      function applySnap(snap) {
        ed.innerHTML = snap.html;
        if (typeof wdRepaginate === 'function') wdRepaginate();
        if (snap.sel && snap.sel.s >= 0) {   // 분할/병합은 텍스트 순서를 안 바꾸므로 전역 오프셋으로 정확히 복원됨
          var a = globalToPos(snap.sel.s), b = globalToPos(snap.sel.e);
          if (a && b) { try { var r = document.createRange(); r.setStart(a.node, a.offset); r.setEnd(b.node, b.offset); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) { } }
        }
        ed.focus();
        savedSel = snap.sel;
        try { ed.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) { }   // 카운트·미리보기·자동저장 갱신
      }
      function doUndo() { pushUndo(); if (undoStack.length < 2) return; redoStack.push(undoStack.pop()); applySnap(undoStack[undoStack.length - 1]); }
      function doRedo() { if (!redoStack.length) return; var s = redoStack.pop(); undoStack.push(s); applySnap(s); }
      ed.addEventListener('compositionstart', function () { edComposing = true; });
      ed.addEventListener('compositionend', function () { edComposing = false; schedPushUndo(); });
      ed.addEventListener('input', function () { if (!edComposing) schedPushUndo(); });   // 한글 조합 중엔 스냅샷 보류
      ed.addEventListener('keydown', function (e) {
        if (!(e.ctrlKey || e.metaKey)) return;
        var k = String(e.key).toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); }
        else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); doRedo(); }
      });
      undoStack.push(takeSnap());   // 초기 상태(불러온 원고)를 첫 스냅샷으로

      // ── 붙여넣기 클린업 ─────────────────────────────────────────────────
      // Word·한글·웹에서 복사한 지저분한 서식(클래스·mso 스타일·불필요한 계층)을 걷어내고
      // 문단·제목·목록·굵기·색 등 핵심 서식만 남긴다(원고 오염·페이지 계산 흔들림 방지).
      var PASTE_BLOCKMAP = { P: 'p', DIV: 'p', SECTION: 'p', ARTICLE: 'p', PRE: 'p', FIGURE: 'p', H1: 'h1', H2: 'h2', H3: 'h3', H4: 'h3', H5: 'h3', H6: 'h3', BLOCKQUOTE: 'blockquote', UL: 'ul', OL: 'ol', LI: 'li', TABLE: 'table', TR: 'tr', TD: 'td', TH: 'td' };
      var PASTE_INLINEMAP = { B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u', S: 's', STRIKE: 's', DEL: 's', SUB: 'sub', SUP: 'sup', MARK: 'mark', A: 'a', SPAN: 'span', FONT: 'span', CODE: 'span', LABEL: 'span' };
      var PASTE_DROP = { SCRIPT: 1, STYLE: 1, META: 1, LINK: 1, TITLE: 1, HEAD: 1, IMG: 1, VIDEO: 1, AUDIO: 1, IFRAME: 1, BUTTON: 1, INPUT: 1, TEXTAREA: 1, SELECT: 1, FORM: 1, OBJECT: 1, EMBED: 1, SVG: 1, CANVAS: 1, NOSCRIPT: 1 };
      var PASTE_STYLES = ['color', 'background-color', 'font-size', 'font-family', 'font-weight', 'font-style', 'text-decoration-line', 'text-align'];
      function copyAllowedStyles(src, dst, isBlock) {
        if (!src.style) return;
        PASTE_STYLES.forEach(function (pr) {
          if (isBlock !== (pr === 'text-align')) return;   // 블록엔 정렬만, 인라인엔 글자 서식만
          var v = src.style.getPropertyValue(pr);
          if (!v || v === 'normal' || v === 'initial' || v === 'inherit' || v === 'none') return;
          if (pr === 'font-weight' && !(parseInt(v, 10) >= 600 || v === 'bold' || v === 'bolder')) return;
          if (pr === 'background-color' && /transparent|rgba\(0,\s*0,\s*0,\s*0\)/.test(v)) return;
          try { dst.style.setProperty(pr, v); } catch (e) { }
        });
      }
      function sanitizeInto(node, out) {
        for (var ch = node.firstChild; ch; ch = ch.nextSibling) {
          if (ch.nodeType === 3) { out.appendChild(document.createTextNode(ch.data)); continue; }
          if (ch.nodeType !== 1) continue;
          var tag = ch.tagName;
          if (PASTE_DROP[tag]) continue;
          if (tag === 'BR' || tag === 'HR') { out.appendChild(document.createElement(tag.toLowerCase())); continue; }
          // 블록을 품은 래퍼 div/section 은 벗기고 내용만(중첩 p 방지)
          if ((tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE') && ch.querySelector('p,div,h1,h2,h3,h4,h5,h6,ul,ol,li,blockquote,table,section,article')) { sanitizeInto(ch, out); continue; }
          var bt = PASTE_BLOCKMAP[tag];
          if (bt) {
            var bel = document.createElement(bt);
            copyAllowedStyles(ch, bel, true);
            sanitizeInto(ch, bel);
            out.appendChild(bel);
            continue;
          }
          var it = PASTE_INLINEMAP[tag];
          if (it) {
            var iel = document.createElement(it);
            if (it === 'a') { var h = ch.getAttribute('href') || ''; if (/^https?:/i.test(h)) iel.setAttribute('href', h); }
            if (tag === 'FONT') { var fc = ch.getAttribute('color'); var ff = ch.getAttribute('face'); if (fc) iel.style.color = fc; if (ff) iel.style.fontFamily = ff; }
            copyAllowedStyles(ch, iel, false);
            sanitizeInto(ch, iel);
            if (it === 'span' && !iel.getAttribute('style')) { while (iel.firstChild) out.appendChild(iel.firstChild); }   // 서식 없는 span 은 벗김
            else out.appendChild(iel);
            continue;
          }
          sanitizeInto(ch, out);   // 모르는 태그(tbody 등) → 태그만 벗기고 내용 유지
        }
      }
      function sanitizePastedHtml(html) {
        var src = document.createElement('div');
        src.innerHTML = String(html || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<\/?o:p[^>]*>/gi, '');
        var out = document.createElement('div');
        sanitizeInto(src, out);
        Array.prototype.slice.call(out.querySelectorAll('p, h1, h2, h3, li, blockquote')).forEach(function (b) {
          if (!b.textContent.trim() && !b.querySelector('br')) b.remove();   // Word 가 흘리는 빈 문단 제거
        });
        return out.innerHTML;
      }
      function plainToParas(text) {
        var t = String(text || '').replace(/\r\n?/g, '\n');
        if (!t.trim()) return '';
        return t.split(/\n{2,}/).map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('');
      }
      ed.addEventListener('paste', function (e) {
        var cd = e.clipboardData || window.clipboardData;
        if (!cd) return;   // 아주 옛 브라우저 → 기본 동작
        var html = '', text = '';
        try { html = cd.getData('text/html') || ''; } catch (err) { }
        try { text = cd.getData('text/plain') || ''; } catch (err) { }
        var ins = html ? sanitizePastedHtml(html) : plainToParas(text);
        if (!ins) return;
        e.preventDefault();
        pushUndo();   // 붙여넣기 전 상태를 undo 한 단계로
        try { document.execCommand('insertHTML', false, ins); } catch (err) { }
        syncContent();
      });

      // 툴바의 select(문단·글꼴·크기·줄간격·자간)를 누르면 편집기 포커스를 가져가 선택영역이 사라진다.
      // 열리기 직전(mousedown/focus)에 현재 선택을 저장해 둬야 글꼴·문단 스타일이 실제로 적용된다.
      // (이게 빠져 있어 '글꼴·도구가 안 먹는' 것처럼 보였음)
      ['#se_block', '#se_font', '#se_size', '#se_lh', '#se_ls'].forEach(function (sel) {
        var el = ov.querySelector(sel); if (!el) return;
        el.addEventListener('mousedown', saveSel);
        el.addEventListener('focus', saveSel);
      });
      // 선택 영역에 글꼴 입히기 — execCommand fontName은 따옴표·대체글꼴 값에서 불안정하므로,
      // 명령 후 남는 <font face="…">를 실제 CSS font-family span으로 바꿔 글꼴이 확실히 적용되게 한다.
      function applyFontFamily(css) {
        ed.focus(); restoreSel();
        var s = window.getSelection();
        if (!s || !s.rangeCount || !ed.contains(s.anchorNode)) return;
        pushUndo();
        try { document.execCommand('styleWithCSS', false, true); document.execCommand('fontName', false, css); } catch (e) {}
        Array.prototype.forEach.call(ed.querySelectorAll('font[face]'), function (f) {
          var sp = document.createElement('span'); sp.style.fontFamily = f.getAttribute('face'); sp.innerHTML = f.innerHTML;
          f.parentNode.replaceChild(sp, f);
        });
        saveSel(); syncContent();
      }

      ov.querySelector('#se_block').onchange = function () { ed.focus(); restoreSel(); exec('formatBlock', this.value === 'p' ? 'P' : this.value.toUpperCase()); this.selectedIndex = 0; };

      // 글꼴 (모두 오픈폰트 라이선스)
      var fontSel = ov.querySelector('#se_font');
      if (fontSel) fontSel.onchange = function () { var v = this.value; if (!v) return; applyFontFamily(v); this.selectedIndex = 0; };

      // 글자 크기(px) — execCommand fontSize(7) 후 실제 px로 치환
      var sizeSel = ov.querySelector('#se_size');
      function applySize(px) {
        ed.focus(); restoreSel();
        pushUndo();
        try { document.execCommand('fontSize', false, '7'); } catch (e) {}
        Array.prototype.forEach.call(ed.querySelectorAll('font[size="7"]'), function (f) { f.removeAttribute('size'); f.style.fontSize = px + 'px'; });
        syncContent();
      }
      if (sizeSel) sizeSel.onchange = function () { applySize(Number(this.value)); };
      var sizeDn = ov.querySelector('#se_size_dn'), sizeUp = ov.querySelector('#se_size_up');
      if (sizeDn) { sizeDn.onmousedown = function (e) { e.preventDefault(); }; sizeDn.onclick = function () { if (sizeSel.selectedIndex > 0) sizeSel.selectedIndex--; applySize(Number(sizeSel.value)); }; }
      if (sizeUp) { sizeUp.onmousedown = function (e) { e.preventDefault(); }; sizeUp.onclick = function () { if (sizeSel.selectedIndex < sizeSel.options.length - 1) sizeSel.selectedIndex++; applySize(Number(sizeSel.value)); }; }

      // 색상 팔레트 (글자색 / 형광펜)
      function buildPop(popEl, colors, onPick, noneLabel) {
        popEl.innerHTML = colors.map(function (c) {
          if (c === 'transparent') return '<button type="button" class="se-sw se-none" data-c="transparent" title="' + (noneLabel || '없음') + '"></button>';
          return '<button type="button" class="se-sw" data-c="' + c + '" style="background:' + c + '" title="' + c + '"></button>';
        }).join('');
        Array.prototype.forEach.call(popEl.querySelectorAll('.se-sw'), function (b) {
          b.onmousedown = function (e) { e.preventDefault(); };
          b.onclick = function () { onPick(b.dataset.c); popEl.classList.remove('open'); };
        });
      }
      function closeAllPops() { Array.prototype.forEach.call(ov.querySelectorAll('.se-pop'), function (p) { p.classList.remove('open'); }); }
      function togglePop(popEl) {
        var was = popEl.classList.contains('open'); closeAllPops();
        if (!was) {
          // 버튼 바로 아래에 화면 기준으로 위치(리본이 잘라먹지 않게) — 오른쪽 화면 밖으로 나가면 왼쪽으로 당김
          var btn = popEl.previousElementSibling;
          if (btn && btn.getBoundingClientRect) {
            var r = btn.getBoundingClientRect();
            var left = Math.min(r.left, window.innerWidth - 190);
            popEl.style.top = (r.bottom + 6) + 'px';
            popEl.style.left = Math.max(8, left) + 'px';
          }
          popEl.classList.add('open');
        }
      }
      var forePop = ov.querySelector('#se_fore_pop'), hiPop = ov.querySelector('#se_hi_pop');
      var foreBar = ov.querySelector('#se_fore_bar'), hiIco = ov.querySelector('#se_hi_ico');
      buildPop(forePop, FORE_COLORS, function (c) { ed.focus(); restoreSel(); exec('foreColor', c); if (foreBar) foreBar.style.background = c; });
      buildPop(hiPop, HI_COLORS, function (c) { ed.focus(); restoreSel(); exec('hiliteColor', c === 'transparent' ? 'transparent' : c); if (hiIco && c !== 'transparent') hiIco.style.background = c; }, '형광 없음');
      ov.querySelector('#se_fore_btn').onmousedown = function (e) { e.preventDefault(); };
      ov.querySelector('#se_hi_btn').onmousedown = function (e) { e.preventDefault(); };
      ov.querySelector('#se_fore_btn').onclick = function () { togglePop(forePop); };
      ov.querySelector('#se_hi_btn').onclick = function () { togglePop(hiPop); };
      ov.addEventListener('mousedown', function (e) { if (!e.target.closest || !e.target.closest('.se-pop-wrap')) closeAllPops(); });

      ov.querySelector('#se_ins_bible').onmousedown = function (e) { e.preventDefault(); };
      ov.querySelector('#se_ins_bible').onclick = function () {
        var s = (ov.querySelector('#se_scripture').value || '').trim();
        if (!s) { var m = ov.querySelector('#se_msg'); m.style.color = '#c0392b'; m.textContent = '먼저 위 ‘본문(성경)’ 칸에 구절을 입력하세요.'; return; }
        exec('insertHTML', '<p><b>' + esc(s) + '</b></p>');
      };

      // ── 🙏 기도 AI 생성: 설교 원고 기반 300자 미만 기도문 ──
      ov.querySelector('#se_prayer_ai').onclick = function () {
        var s = sess(); var msg = ov.querySelector('#se_msg');
        if (!s || !s.token) { msg.style.color = '#c0392b'; msg.textContent = '로그인이 필요합니다.'; return; }
        var manuscript = htmlToPlain(cleanContent() || '').trim();
        var title = ov.querySelector('#se_title').value.trim(), scripture = ov.querySelector('#se_scripture').value.trim();
        if (!manuscript && !scripture) { msg.style.color = '#c0392b'; msg.textContent = '설교 원고(또는 본문)를 먼저 입력하면 기도문을 생성합니다.'; return; }
        var content = '설교 제목: ' + (title || '(없음)') + '\n본문: ' + (scripture || '(없음)') + '\n\n[설교 원고]\n' + (manuscript.slice(0, 6000) || '(없음)');
        var btn = this, old = btn.textContent; btn.disabled = true; btn.textContent = '✨ 생성 중…'; msg.style.color = '#7b8794'; msg.textContent = 'AI가 기도문을 작성하는 중입니다… (10초 내외)';
        fetch(SB.replace(/\/$/, '') + '/functions/v1/bulletin-ai', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.token, 'apikey': AK },
          body: JSON.stringify({ mode: 'prayer', content: content })
        }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
          .then(function (o) {
            btn.disabled = false; btn.textContent = old;
            if (!o.ok) { msg.style.color = '#c0392b'; msg.textContent = '기도문 생성 실패: ' + ((o.j && o.j.error) || ('HTTP ' + o.status)) + ((o.j && o.j.detail) ? ' (' + o.j.detail + ')' : ''); return; }
            var txt = (o.j && o.j.result || '').trim();
            if (txt) { ov.querySelector('#se_prayer').value = txt; msg.style.color = 'green'; msg.textContent = '✓ 기도문을 생성했습니다 (' + txt.replace(/\s/g, '').length + '자) — 확인 후 다듬어 주세요.'; }
            else { msg.style.color = '#c0392b'; msg.textContent = '생성 결과가 비어 있습니다 — bulletin-ai 함수가 ‘기도(prayer) 모드’ 최신 코드로 재배포됐는지 확인해 주세요.'; }
          })
          .catch(function (e) { btn.disabled = false; btn.textContent = old; msg.style.color = '#c0392b'; msg.textContent = '호출 실패: ' + e.message + ' (bulletin-ai Edge Function 배포 필요)'; });
      };

      // ── 생명의삶 자동분류 패널 ──
      ov.querySelector('#qtc_clear').onclick = function () { ov.querySelector('#qtc_paste').value = ''; ov.querySelector('#qtc_msg').textContent = ''; ov.querySelector('#qtc_result').innerHTML = ''; };
      ov.querySelector('#qtc_illus').onclick = function () { illustrationsModal({ pickLabel: '⬇ 원고에 삽입', onPick: function (r) { exec('insertHTML', '<blockquote>' + esc(r.content || '').replace(/\n/g, '<br>') + (r.source ? '<br><span style="font-size:.85em;color:#7a5d27">— ' + esc(r.source) + '</span>' : '') + '</blockquote><p><br></p>'); } }); };
      ov.querySelector('#qtc_run').onclick = function () {
        var raw = ov.querySelector('#qtc_paste').value || '';
        var msg = ov.querySelector('#qtc_msg'), result = ov.querySelector('#qtc_result');
        var p = parseSaengmyeong(raw);
        if (!p.gaeyeok && !p.title && !p.scripture) { msg.style.color = '#c0392b'; msg.textContent = '인식할 수 없습니다. 생명의삶 자료 전체(날짜·개역개정·우리말·설교 길잡이 포함)를 붙여넣어 주세요.'; result.innerHTML = ''; return; }
        function row(label, val) { return '<div class="qtc-rrow"><b>' + label + '</b><span>' + (val ? esc(val) : '—') + '</span></div>'; }
        if (p.date) ov.querySelector('#se_date').value = p.date;
        if (p.sunday && (p.sunday.title || p.sunday.sermonHtml)) {
          // ── 주일(일요일) QT: 주일설교를 축출해 '주일 낮 예배'로 분류 ──
          var sun = p.sunday;
          ov.querySelector('#se_service').value = '주일 낮 예배';
          var qtToggleS = ov.querySelector('#se_qt_toggle'); if (qtToggleS) { qtToggleS.checked = false; syncQt(); }
          if (sun.scripture) ov.querySelector('#se_scripture').value = sun.scripture;
          if (sun.title) ov.querySelector('#se_title').value = sun.title;
          if (sun.sermonHtml) { pushUndo(); ed.innerHTML = sun.sermonHtml; syncContent(); if (typeof wdRepaginate === 'function') wdRepaginate(); pushUndo(); }
          // 주일설교 본문(예: 시편 107:1-43)에 맞춰 개역개정·우리말 성경을 자동으로 불러옴
          if (sun.scripture && typeof doFetchBible === 'function') doFetchBible();
          result.innerHTML = row('분류', '주일 낮 예배 (주일설교 축출)') + row('날짜', p.date) + row('본문', sun.scripture) + row('제목', sun.title) +
            row('설교 원고', sun.sermonHtml ? '입력됨' : '') +
            row('예화 클립', p.illustration ? (p.illustration.length + '자') : '없음');
          msg.style.color = 'green'; msg.textContent = '✓ 주일설교를 축출해 ‘주일 낮 예배’로 분류했습니다. 본문 성경도 자동으로 불러왔습니다. 내용을 확인하고 저장하세요.';
        } else {
          // ── 평일 매일 QT ──
          ov.querySelector('#se_service').value = '매일 QT';
          var qtToggle = ov.querySelector('#se_qt_toggle'); if (qtToggle) { qtToggle.checked = true; syncQt(); }
          if (p.scripture) ov.querySelector('#se_scripture').value = p.scripture;
          if (p.title) ov.querySelector('#se_title').value = p.title;
          if (p.gaeyeok && ov.querySelector('#se_bible')) ov.querySelector('#se_bible').value = p.gaeyeok;
          if (p.woorimal && ov.querySelector('#se_qt_bible')) ov.querySelector('#se_qt_bible').value = p.woorimal;
          if (p.sermonHtml) { pushUndo(); ed.innerHTML = p.sermonHtml; syncContent(); if (typeof wdRepaginate === 'function') wdRepaginate(); pushUndo(); }
          result.innerHTML = row('날짜', p.date) + row('본문', p.scripture) + row('제목', p.title) +
            row('개역개정', p.gaeyeok ? (p.gaeyeok.split('\n').length + '절') : '') +
            row('우리말', p.woorimal ? (p.woorimal.split('\n').length + '절') : '') +
            row('설교 원고', p.sermonHtml ? '입력됨' : '') +
            row('예화 클립', p.illustration ? (p.illustration.length + '자') : '없음');
          msg.style.color = 'green'; msg.textContent = '✓ 자동 입력 완료. 내용을 확인하고 저장/내보내기 하세요.';
        }
        if (p.illustration) {
          saveIllustration(p, function () { msg.textContent = '✓ 자동 입력 완료 · 🗂 예화 클립도 보관함에 저장되었습니다.'; }, function (e) {
            msg.style.color = '#c0392b';
            msg.textContent = /42P01|PGRST205|does not exist|schema cache|Could not find/i.test(e.message || '') ? '입력 완료 · ⚠️ 예화 클립 저장엔 supabase/sermon_illustrations.sql 1회 실행이 필요합니다.' : ('입력 완료 · 예화 저장 실패: ' + e.message);
          });
        }
      };

      // ═══ 설교 매니저 스튜디오 — 바인더 탭·시리즈·미리보기·발표자·상태바 ═══
      var seriesArr = String(rec.series || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      function markSaved() {
        var el = ov.querySelector('#sb_saved'); if (!el) return;
        var d = new Date(), h = d.getHours(), ap = h < 12 ? '오전' : '오후'; h = h % 12 || 12;
        el.textContent = '저장됨 ' + ap + ' ' + String(h).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      }
      // 시리즈 · 몇 번째 설교 — 첫(대표) 시리즈 안에서 일자순 자동 넘버링 (예: "룻기 강해 · 5번째 설교")
      function seriesLineInfo() {
        if (!seriesArr || !seriesArr.length) return '';
        var prim = seriesArr[0];
        var d = ov.querySelector('#se_date').value || '';
        var no = 1;
        (smRows || []).forEach(function (r) {
          if (String(r.id) === String(rec.id)) return;
          var rs = String(r.series || '').split(',').map(function (s) { return s.trim(); });
          if (rs.indexOf(prim) < 0) return;
          if (r.sermon_date && d && r.sermon_date <= d) no++;
        });
        return prim + ' · ' + no + '번째 설교' + (seriesArr.length > 1 ? ' (' + seriesArr.slice(1).join(', ') + ')' : '');
      }
      if (!worshipMode) (function initStudio() {
        // ── 좌측 바인더 탭 (정보/시리즈/첨부) ──
        var bdPanes = { info: ov.querySelector('#bd_info'), attach: ov.querySelector('#bd_attach') };
        Array.prototype.forEach.call(ov.querySelectorAll('.bd-tab'), function (b) {
          b.onclick = function () {
            Array.prototype.forEach.call(ov.querySelectorAll('.bd-tab'), function (x) { x.classList.toggle('on', x === b); });
            Object.keys(bdPanes).forEach(function (k) { if (bdPanes[k]) bdPanes[k].style.display = (k === b.dataset.p ? '' : 'none'); });
          };
        });
        // ── 우측 패널 탭 (미리보기/자동분류) ──
        var rpPanes = { prev: ov.querySelector('#rp_prev'), qtc: ov.querySelector('#rp_qtc') };
        Array.prototype.forEach.call(ov.querySelectorAll('.rp-tab'), function (b) {
          b.onclick = function () {
            Array.prototype.forEach.call(ov.querySelectorAll('.rp-tab'), function (x) { x.classList.toggle('on', x === b); });
            Object.keys(rpPanes).forEach(function (k) { if (rpPanes[k]) rpPanes[k].style.display = (k === b.dataset.p ? '' : 'none'); });
            if (b.dataset.p === 'prev') renderPreview();
          };
        });

        // ── 시리즈: 칩 + 자동완성 + 같은 시리즈 설교 탐색(폴더) ──
        var chipsBox = ov.querySelector('#se_series_chips'), serIn = ov.querySelector('#se_series_in'), serList = ov.querySelector('#se_series_list'), docsBox = ov.querySelector('#se_series_docs');
        var allSeries = {};
        (smRows || []).forEach(function (r) { String(r.series || '').split(',').forEach(function (s) { s = s.trim(); if (s) allSeries[s] = (allSeries[s] || 0) + 1; }); });
        function splitSer(v) { return String(v || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
        // 시리즈 선택 드롭다운 열기/닫기(입력칸을 누르면 뜨고, 밖을 누르면 닫힘)
        function openSerDrop() { serList.classList.add('open'); renderSerList(); }
        function closeSerDrop() { serList.classList.remove('open'); }
        // 드롭다운 목록만 다시 그림(입력한 글자로 걸러짐) — 체크된 시리즈를 골라도 목록은 계속 스크롤 가능한 이 박스 하나 안에 있음
        function renderSerList() {
          var q = (serIn.value || '').trim().toLowerCase();
          var names = {}; Object.keys(allSeries).forEach(function (s) { names[s] = 1; }); seriesArr.forEach(function (s) { names[s] = 1; });
          var all = Object.keys(names).sort();
          if (q) all = all.filter(function (s) { return s.toLowerCase().indexOf(q) >= 0; });
          serList.innerHTML = all.length
            ? all.map(function (s) { var on = seriesArr.indexOf(s) >= 0; return '<button type="button" class="bd-seritem' + (on ? ' on' : '') + '" data-s="' + esc(s) + '">' + (on ? '✓ ' : '') + esc(s) + (allSeries[s] ? ' <span>(' + allSeries[s] + ')</span>' : '') + '</button>'; }).join('')
            : (q ? '<div style="font-size:.74rem;color:#75839a;padding:5px 7px">일치하는 시리즈가 없습니다. ‘＋ 추가’를 누르면 새로 만듭니다.</div>' : '<div style="font-size:.74rem;color:#75839a;padding:5px 7px">아직 등록된 시리즈가 없습니다 — 입력 후 ‘＋ 추가’를 누르세요.</div>');
          Array.prototype.forEach.call(serList.querySelectorAll('.bd-seritem'), function (b) {
            b.onclick = function () {
              var s = b.dataset.s, i = seriesArr.indexOf(s);
              if (i >= 0) seriesArr.splice(i, 1); else seriesArr.push(s);
              serIn.value = '';
              renderSerList(); renderChipsAndDocs();
            };
          });
        }
        function renderChipsAndDocs() {
          chipsBox.innerHTML = seriesArr.length ? seriesArr.map(function (s, i) { return '<span class="bd-chip">' + esc(s) + '<button type="button" data-i="' + i + '" title="제거">✕</button></span>'; }).join('') : '<span style="font-size:.74rem;color:#75839a">아직 시리즈가 없습니다.</span>';
          Array.prototype.forEach.call(chipsBox.querySelectorAll('button'), function (b) { b.onclick = function () { seriesArr.splice(Number(b.dataset.i), 1); renderChipsAndDocs(); if (serList.classList.contains('open')) renderSerList(); }; });
          // 시리즈별 그룹 + 일자순 자동 넘버링 — 지금 작성 중인 설교도 제 순번 자리에 표시(연속성 관리)
          if (!seriesArr.length) {
            docsBox.innerHTML = '<div style="font-size:.76rem;color:#75839a">시리즈를 추가하면 같은 시리즈의 설교(제목·본문)가 번호와 함께 표시됩니다.</div>';
          } else {
            var d0 = ov.querySelector('#se_date').value || '';
            var curTitle = ov.querySelector('#se_title') ? ov.querySelector('#se_title').value.trim() : '';
            function curItem(n) { return '<div class="bd-doc cur" style="cursor:default"><b>' + n + '. ' + esc(curTitle || '(지금 작성 중)') + ' <span style="font-weight:400">— 이번 설교</span></b><span>' + esc(fmtD(d0) || '날짜 미정') + '</span></div>'; }
            var htmlD = '';
            seriesArr.forEach(function (sname) {
              var ds = [];
              (smRows || []).forEach(function (r) { if (splitSer(r.series).indexOf(sname) >= 0) ds.push(r); });
              ds.sort(function (a, b) { return String(a.sermon_date || '').localeCompare(String(b.sermon_date || '')); });
              var isSaved = ds.some(function (r) { return String(r.id) === String(rec.id); });
              htmlD += '<div class="bd-serhead">📚 ' + esc(sname) + ' <span>· ' + (ds.length + (isSaved ? 0 : 1)) + '편</span></div>';
              var no = 0, curDone = false;
              ds.forEach(function (r) {
                if (!isSaved && !curDone && (!r.sermon_date || !d0 || String(r.sermon_date) > d0)) { no++; curDone = true; htmlD += curItem(no); }
                no++;
                var isCur = String(r.id) === String(rec.id);
                htmlD += '<button type="button" class="bd-doc' + (isCur ? ' cur' : '') + '" data-id="' + esc(r.id) + '"' + (isCur ? '' : ' title="새 창(읽기용)으로 열립니다 — 지금 작성 중인 문서는 그대로 유지됩니다"') + '><b>' + no + '. ' + esc(r.title || '(제목없음)') + (isCur ? ' <span style="font-weight:400">— 이번 설교</span>' : ' <span style="font-weight:400;font-size:.68rem;color:#8fa0b5">↗ 새 창</span>') + '</b><span>' + esc(fmtD(r.sermon_date) || '') + (r.scripture ? ' · ' + esc(r.scripture) : '') + '</span></button>';
              });
              if (!isSaved && !curDone) { no++; htmlD += curItem(no); }
            });
            docsBox.innerHTML = htmlD;
          }
          Array.prototype.forEach.call(docsBox.querySelectorAll('.bd-doc[data-id]'), function (b) {
            b.onclick = function () {
              if (String(b.dataset.id) === String(rec.id)) return;
              var found = null; (smRows || []).forEach(function (r) { if (String(r.id) === String(b.dataset.id)) found = r; });
              // 현재 작업 문서를 닫지 않고, 선택한 시리즈 설교를 '새 창(읽기용)'으로 열어 참고만 함
              if (found) sermonReadingView(found, { qt: false });
            };
          });
        }
        function renderSeries() { renderSerList(); renderChipsAndDocs(); }
        function addSeries() { var v = (serIn.value || '').trim(); if (!v) return; if (seriesArr.indexOf(v) < 0) seriesArr.push(v); serIn.value = ''; renderSerList(); renderChipsAndDocs(); }
        ov.querySelector('#se_series_add').onclick = addSeries;
        serIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addSeries(); } else if (e.key === 'Escape') { closeSerDrop(); } });
        serIn.addEventListener('focus', openSerDrop);
        serIn.addEventListener('click', openSerDrop);
        serIn.addEventListener('input', renderSerList);
        ov.addEventListener('mousedown', function (e) { if (!e.target.closest || !e.target.closest('.bd-serwrap')) closeSerDrop(); });
        renderSeries();
        // 일자·제목이 바뀌면 시리즈 순번(넘버링)도 갱신(드롭다운 목록 자체는 그대로 둠)
        ov.querySelector('#se_date').addEventListener('change', renderChipsAndDocs);
        var serTitleT = null;
        ov.querySelector('#se_title').addEventListener('input', function () { clearTimeout(serTitleT); serTitleT = setTimeout(renderChipsAndDocs, 500); });

        // ── 리본 패널 토글: 📖 본문 텍스트 / 🙏 기도 (하나만 열림) ──
        var pnMap = { se_pn_bible: 'pn_bible', se_pn_prayer: 'pn_prayer' };
        Object.keys(pnMap).forEach(function (bid) {
          var b = ov.querySelector('#' + bid), p = ov.querySelector('#' + pnMap[bid]);
          if (!b || !p) return;
          b.onclick = function () {
            var willOpen = (p.style.display === 'none');
            Object.keys(pnMap).forEach(function (k) {
              var pp = ov.querySelector('#' + pnMap[k]), bb = ov.querySelector('#' + k);
              if (pp) pp.style.display = 'none';
              if (bb) bb.classList.remove('on');
            });
            if (willOpen) { p.style.display = ''; b.classList.add('on'); }   // 우리말성경 체크 상태는 그대로 유지(예배 종류가 정한 기본값·사용자 선택 존중)
          };
        });

        // ── 첨부: 파일 업로드 ──
        var fupBtn = ov.querySelector('#se_file_up');
        if (fupBtn) fupBtn.onclick = function () {
          if (!(window.ChurchUpload && ChurchUpload.isReady())) { alert('업로드 서버가 설정되지 않았습니다.'); return; }
          var fi = document.createElement('input'); fi.type = 'file';
          fi.onchange = function () {
            var f = fi.files && fi.files[0]; if (!f) return;
            fupBtn.disabled = true; fupBtn.textContent = '⏳ 업로드 중…';
            ChurchUpload.upload(f, { folder: 'sermons/files', compress: false }).then(function (res) { ov.querySelector('#se_file').value = res.url; fupBtn.disabled = false; fupBtn.textContent = '⬆ 파일 업로드'; }).catch(function (e) { fupBtn.disabled = false; fupBtn.textContent = '⬆ 파일 업로드'; alert('업로드 실패: ' + e.message); });
          };
          fi.click();
        };

        // ── 툴바 확장: H1~H3·인용·체크·줄간격·자간·메모·이미지·영상·폰트초기화·예화 ──
        Array.prototype.forEach.call(ov.querySelectorAll('#se_tb [data-blk]'), function (b) {
          b.onmousedown = function (e) { e.preventDefault(); };
          b.onclick = function () { exec('formatBlock', b.dataset.blk.toUpperCase()); };
        });
        var chkBtn = ov.querySelector('#se_chk');
        if (chkBtn) { chkBtn.onmousedown = function (e) { e.preventDefault(); }; chkBtn.onclick = function () { exec('insertText', '☐ '); }; }
        var lhSel = ov.querySelector('#se_lh');
        if (lhSel) lhSel.onchange = function () {
          if (!this.value) return;
          ed.style.lineHeight = this.value;
          // 문단마다 붙어 있던 개별 줄간격(붙여넣기 등)을 걷어내야 문서 전체 줄간격이 실제로 바뀐다
          Array.prototype.forEach.call(ed.querySelectorAll('[style*="line-height"]'), function (el) { if (el !== ed) el.style.lineHeight = ''; });
          syncContent();
          if (typeof wdRepaginate === 'function') wdRepaginate();   // 줄 높이가 바뀌면 페이지 나눔도 다시 계산
        };
        var lsSel = ov.querySelector('#se_ls');
        if (lsSel) lsSel.onchange = function () {
          if (this.value === '') return;
          ed.style.letterSpacing = this.value + 'px';
          syncContent();
          if (typeof wdRepaginate === 'function') wdRepaginate();
        };
        var noteBtn = ov.querySelector('#se_note');
        if (noteBtn) {
          noteBtn.onmousedown = function (e) { e.preventDefault(); };
          noteBtn.onclick = function () {
            var t = prompt('메모(주석) 내용을 입력하세요 — 해당 부분에 마우스를 올리면 표시됩니다.'); if (t == null || !t.trim()) return;
            ed.focus(); restoreSel();
            var s = window.getSelection();
            if (s && s.rangeCount && !s.isCollapsed && ed.contains(s.anchorNode)) {
              var r = s.getRangeAt(0), span = document.createElement('span'); span.className = 'se-note'; span.title = t.trim();
              try { r.surroundContents(span); } catch (e2) { span.appendChild(r.extractContents()); r.insertNode(span); }
              syncContent();
            } else exec('insertHTML', '<span class="se-note" title="' + esc(t.trim()) + '">💬</span>&nbsp;');
          };
        }
        var imgBtn = ov.querySelector('#se_img');
        if (imgBtn) imgBtn.onclick = function () {
          if (window.ChurchUpload && ChurchUpload.isReady()) {
            var fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'image/*';
            fi.onchange = function () {
              var f = fi.files && fi.files[0]; if (!f) return;
              var m = ov.querySelector('#se_msg'); m.style.color = '#7b8794'; m.textContent = '🖼 이미지 업로드 중…';
              ChurchUpload.upload(f, { folder: 'sermons/img' }).then(function (res) { exec('insertHTML', '<img src="' + esc(res.url) + '" alt="">'); m.style.color = 'green'; m.textContent = '✓ 이미지를 넣었습니다'; }).catch(function (e) { m.style.color = '#c0392b'; m.textContent = '이미지 업로드 실패: ' + e.message; });
            };
            fi.click();
          } else { var u = prompt('이미지 주소(URL)를 입력하세요'); if (u && u.trim()) exec('insertHTML', '<img src="' + esc(u.trim()) + '" alt="">'); }
        };
        var vidBtn = ov.querySelector('#se_vid');
        if (vidBtn) vidBtn.onclick = function () {
          var u = prompt('영상 주소(유튜브 등)를 입력하세요'); if (!u || !u.trim()) return; u = u.trim();
          var yt = u.match(/(?:youtu\.be\/|v=|shorts\/)([\w-]{6,})/);
          if (yt) exec('insertHTML', '<p><iframe src="https://www.youtube.com/embed/' + esc(yt[1]) + '" style="width:100%;aspect-ratio:16/9;border:0;border-radius:8px" allowfullscreen></iframe></p>');
          else exec('insertHTML', '<p><a class="se-video" href="' + esc(u) + '" target="_blank" rel="noopener">▶ ' + esc(u) + '</a></p>');
        };
        var frBtn = ov.querySelector('#se_fontreset');
        if (frBtn) frBtn.onclick = function () {
          if (!confirm('원고 전체의 글꼴·크기·색상을 기본값으로 되돌릴까요?\n(굵게·제목·목록 등 구조는 유지됩니다)')) return;
          Array.prototype.forEach.call(ed.querySelectorAll('font'), function (f) { var sp = document.createElement('span'); sp.innerHTML = f.innerHTML; f.parentNode.replaceChild(sp, f); });
          Array.prototype.forEach.call(ed.querySelectorAll('*'), function (el) { el.style.fontFamily = ''; el.style.fontSize = ''; el.style.color = ''; el.style.backgroundColor = ''; });
          ed.style.lineHeight = ''; ed.style.letterSpacing = '';
          syncContent(); renderPreview();
          if (typeof wdRepaginate === 'function') wdRepaginate();   // 글자 크기가 바뀌면 문단 높이도 바뀌므로 페이지 나눔 재계산
        };
        var illIns = ov.querySelector('#se_ill_ins');
        if (illIns) illIns.onclick = function () { ov.querySelector('#qtc_illus').click(); };
        var illSave = ov.querySelector('#se_ill_save');
        if (illSave) illSave.onclick = function () {
          var s = window.getSelection(), txt = s ? String(s).trim() : '';
          var m = ov.querySelector('#se_msg');
          if (!txt) { m.style.color = '#c0392b'; m.textContent = '원고에서 예화로 저장할 부분을 먼저 드래그로 선택하세요.'; return; }
          api('POST', 'sermon_illustrations', { ref_date: ov.querySelector('#se_date').value || null, scripture: ov.querySelector('#se_scripture').value || null, title: ov.querySelector('#se_title').value || null, source: null, content: txt }, 'return=minimal')
            .then(function () { m.style.color = 'green'; m.textContent = '✓ 선택한 부분을 예화 보관함에 저장했습니다.'; })
            .catch(function (e) { m.style.color = '#c0392b'; m.textContent = /42P01|PGRST205|does not exist|schema cache|Could not find/i.test(e.message || '') ? '예화 저장엔 supabase/sermon_illustrations.sql 1회 실행이 필요합니다.' : ('예화 저장 실패: ' + e.message); });
        };

        // ── 도구상자 배치 변경: 도구를 꾹 눌러 끌면 위치 이동(그룹 간 이동 가능) · localStorage에 저장 ──
        (function tbLayout() {
          if (!window.Sortable) return;
          var tb = ov.querySelector('#se_tb'); if (!tb) return;
          var groups = Array.prototype.slice.call(tb.querySelectorAll('.se-grp'));
          function keyOf(el) {
            if (el.id) return '#' + el.id;
            if (el.dataset && el.dataset.cmd) return 'c:' + el.dataset.cmd;
            if (el.dataset && el.dataset.blk) return 'b:' + el.dataset.blk;
            var w = el.querySelector ? el.querySelector('[id]') : null;
            if (w) return 'w:' + w.id;
            return null;
          }
          function findByKey(k) {
            var hit = null;
            Array.prototype.forEach.call(tb.querySelectorAll('.se-grp > *'), function (el) { if (!hit && keyOf(el) === k) hit = el; });
            return hit;
          }
          function layoutOf() { return groups.map(function (g) { return Array.prototype.map.call(g.children, keyOf).filter(Boolean); }); }
          function applyLayout(saved) {
            (saved || []).forEach(function (keys, i) {
              var g = groups[i]; if (!g) return;
              (keys || []).forEach(function (k) { var el = findByKey(k); if (el) g.appendChild(el); });
            });
          }
          var LSK = 'wpSedTbLayout1';
          var original = layoutOf();   // 초기 배치(초기화용)
          try { var sv = JSON.parse(localStorage.getItem(LSK) || 'null'); if (sv && sv.length) applyLayout(sv); } catch (e) { }
          function saveLayout() { try { localStorage.setItem(LSK, JSON.stringify(layoutOf())); } catch (e) { } }
          groups.forEach(function (g) {
            Sortable.create(g, {
              group: 'sedtb', draggable: 'button, select, .se-size, .se-pop-wrap',
              animation: 150, delay: 220, delayOnTouchOnly: false, onEnd: saveLayout
            });
          });
          var rstBtn = ov.querySelector('#se_tb_reset');
          if (rstBtn) rstBtn.onclick = function () {
            try { localStorage.removeItem(LSK); } catch (e) { }
            applyLayout(original);
          };
        })();

        // ── 구글 문서 스타일 페이지 뷰: 용지 크기·여백·배율 + 실제 페이지 구분(간격) + 꺾쇠 여백 가이드 + 페이지 번호 ──
        (function wdPageView() {
          var wdPage = ov.querySelector('#wd_page'), wdSheet = ov.querySelector('#wd_area');
          var pgnumLayer = ov.querySelector('#wd_pgnum_layer'), cropLayer = ov.querySelector('#wd_crop_layer');
          var paperSel = ov.querySelector('#wd_paper'), marginSel = ov.querySelector('#wd_margin'), zoomR = ov.querySelector('#wd_zoom'), zoomLbl = ov.querySelector('#wd_zoom_v'), pgnumSel = ov.querySelector('#wd_pgnum');
          if (!wdPage || !wdSheet) return;
          var MMPX = 96 / 25.4;   // 1㎜ = 3.78px(96dpi) — 화면 크기와 무관한 고정 물리 크기, 배율은 이 전체를 확대/축소
          var GAP = 26;           // 페이지 사이 간격(구글 문서처럼 눈에 보이게 실제로 벌어짐)
          var PAPERS = { A4: [210, 297], iPad: [180, 240], Letter: [216, 279], B5: [176, 250] };
          var PGNUM_FMT = { num: '{i}', numTotal: '{i} / {n}', dash: '- {i} -', kr: '{i}페이지', paren: '({i})' };
          var LSK = 'wpWdPage1';
          var prefs = { paper: 'A4', margin: 20, zoom: 100, pgnum: 'off' };
          try { var sv = JSON.parse(localStorage.getItem(LSK) || 'null'); if (sv) { if (PAPERS[sv.paper]) prefs.paper = sv.paper; prefs.margin = Number(sv.margin) || 20; prefs.zoom = Number(sv.zoom) || 100; if (PGNUM_FMT[sv.pgnum] || sv.pgnum === 'off') prefs.pgnum = sv.pgnum; } } catch (e) { }
          function metrics() {
            var sz = PAPERS[prefs.paper] || PAPERS.A4;
            return { pw: Math.round(sz[0] * MMPX), ph: Math.round(sz[1] * MMPX), mg: Math.round(prefs.margin * MMPX) };
          }
          // 페이지마다(용지 네 귀퉁이) 꺾쇠(⌐) 여백 가이드를 반복 생성
          function renderCropMarks(totalPages, ph, mg) {
            if (!cropLayer) return;
            var off = mg - 18;
            var html = '';
            for (var i = 1; i <= totalPages; i++) {
              var top0 = (i - 1) * (ph + GAP);
              html += '<i class="wd-crop wd-tl" style="top:' + (top0 + off) + 'px;left:' + off + 'px"></i>';
              html += '<i class="wd-crop wd-tr" style="top:' + (top0 + off) + 'px;right:' + off + 'px"></i>';
              html += '<i class="wd-crop wd-bl" style="top:' + (top0 + ph - off - 17) + 'px;left:' + off + 'px"></i>';
              html += '<i class="wd-crop wd-br" style="top:' + (top0 + ph - off - 17) + 'px;right:' + off + 'px"></i>';
            }
            cropLayer.innerHTML = html;
          }
          function applyPage() {
            var m = metrics(), pw = m.pw, ph = m.ph, mg = m.mg;
            var z = (Number(prefs.zoom) || 100) / 100;
            wdPage.style.width = pw + 'px';
            wdPage.style.minHeight = ph + 'px';
            wdPage.style.padding = mg + 'px';
            // 페이지 경계 — 흰 용지 → 얇은 경계선 → 어두운 간격(GAP)으로 실제로 벌어져 보임(반복해서 다음 장들도 표시)
            wdPage.style.backgroundImage = 'repeating-linear-gradient(to bottom,#ffffff 0,#ffffff ' + (ph - 2) + 'px,#c7ccd6 ' + (ph - 2) + 'px,#c7ccd6 ' + ph + 'px,#242a34 ' + ph + 'px,#242a34 ' + (ph + GAP) + 'px)';
            ed.style.padding = '0';
            // 꺾쇠 가이드·페이지 번호는 실제 페이지 수를 알아야 하므로 repaginate()에서 그림
            // 배율 = 용지 전체를 transform으로 확대/축소(내용은 건드리지 않음 — 잘림·미스매치 없음)
            wdSheet.style.transform = 'scale(' + z + ')';
            if (zoomLbl) zoomLbl.textContent = prefs.zoom + '%';
            if (paperSel) paperSel.value = prefs.paper;
            if (marginSel) marginSel.value = String(prefs.margin);
            if (zoomR) zoomR.value = prefs.zoom;
            if (pgnumSel) pgnumSel.value = prefs.pgnum;
            try { localStorage.setItem(LSK, JSON.stringify(prefs)); } catch (e) { }
            repaginate();
          }
          // 실제 페이지 나눔: 원고 안의 문단(최상위 블록)을 훑어 한 쪽 분량을 넘기면 그 앞에 '빈 칸(간격)'을 끼워 다음 장으로 밀어냄
          // — 배경의 흰 용지/간격 줄무늬와 정확히 맞물려 진짜 워드처럼 페이지가 눈에 보이게 나뉜다.
          // 참고: 한 문단이 통째로 한 쪽보다 길면(드묾) 그 문단은 나누지 않음(문단 중간 강제분할은 하지 않음).
          // 최상위에 문단 태그 없이 떠 있는 텍스트/인라인(예: 붙여넣기로 들어온 원본)을 <p>로 감싸 — 그래야 페이지 나눔 계산에 잡힘
          // 연속된 텍스트/인라인은 하나의 <p>로 묶고(한 줄이 여러 문단으로 쪼개지지 않게), 블록 사이의 순수 공백은 제거(빈 문단 방지)
          var BLOCK_TAGS = /^(P|DIV|H1|H2|H3|H4|H5|H6|UL|OL|BLOCKQUOTE|HR|TABLE|FIGURE|PRE)$/;
          function normalizeTopLevel() {
            var node = ed.firstChild, wrapper = null;
            while (node) {
              var next = node.nextSibling;
              var isBlank = node.nodeType === 3 && !node.textContent.trim();
              var isInline = (node.nodeType === 3 && !isBlank) || (node.nodeType === 1 && !node.classList.contains('pg-break-spacer') && !BLOCK_TAGS.test(node.tagName));
              if (isBlank) {
                if (wrapper) wrapper.appendChild(node); else ed.removeChild(node);
              } else if (isInline) {
                if (!wrapper) { wrapper = document.createElement('p'); ed.insertBefore(wrapper, node); }
                wrapper.appendChild(node);
              } else {
                wrapper = null;
              }
              node = next;
            }
          }
          // ── 구글 문서처럼 '문단을 페이지 경계에서 줄 단위로 쪼갬' ──
          // 페이지를 넘길 때, 한 문단이 경계에 걸치면 통째로 다음 장으로 밀지 않고, 넘치는 줄부터 새 조각(.pg-cont)으로 나눠
          // 앞부분은 이번 페이지에, 뒷부분은 다음 페이지 맨 위에서 이어지게 한다(진짜 구글 문서 페이지 흐름).
          function mergeSplitsIn(root) {
            // 이전 계산에서 쪼갠 조각(.pg-cont)을 원래 문단(data-splitbase) 하나로 되돌림 — 한 문단의 모든 조각은 gid 하나를 공유
            var bases = {};
            Array.prototype.slice.call(root.querySelectorAll('[data-splitbase]')).forEach(function (b) { bases[b.getAttribute('data-splitbase')] = b; });
            Array.prototype.slice.call(root.querySelectorAll('.pg-cont')).forEach(function (c) {
              var gid = c.getAttribute('data-splitcont'), base = bases[gid];
              if (base) { while (c.firstChild) base.appendChild(c.firstChild); }
              c.remove();
            });
            Array.prototype.slice.call(root.querySelectorAll('[data-splitbase]')).forEach(function (b) { b.removeAttribute('data-splitbase'); b.normalize(); });
          }
          function pageScale() { var t = (wdSheet.style.transform || '').match(/scale\(([\d.]+)\)/); return t ? parseFloat(t[1]) : 1; }
          var GIDC = 0;
          // 문단 p를, page 기준 y좌표 limitY 를 넘는 줄부터 새 문단(.pg-cont)으로 분리. 연속 조각 반환 / 'ALL'(첫 줄부터 넘침) / null(안 넘침)
          function splitParagraphAt(p, limitY) {
            var scale = pageScale();
            var pRectTop = p.getBoundingClientRect().top, pTopLayout = p.offsetTop;
            // 실제 줄 상자들(Range.getClientRects = 줄마다 하나) — 줄 '바닥'이 한도를 넘지 않는 줄까지만 이번 페이지에(바닥 기준이라 하단 여백 침범 없음)
            var lrng = document.createRange(); lrng.selectNodeContents(p); var lr = lrng.getClientRects();
            if (!lr.length) return null;
            var lines = [];
            for (var li = 0; li < lr.length; li++) lines.push({ top: pTopLayout + (lr[li].top - pRectTop) / scale, bottom: pTopLayout + (lr[li].bottom - pRectTop) / scale });
            var firstBad = -1;
            for (var li2 = 0; li2 < lines.length; li2++) { if (lines[li2].bottom > limitY + 0.5) { firstBad = li2; break; } }
            if (firstBad < 0) return null;           // 모든 줄이 들어감
            if (firstBad === 0) return 'ALL';        // 첫 줄부터 안 들어감 → 통째로 다음 페이지
            var targetTop = lines[firstBad].top;
            // 넘치는 첫 줄의 시작 위치를 찾는다. 먼저 caretRangeFromPoint로 한 번에(리플로 1회) 시도하고,
            // 실패하면 문자 오프셋 이분 탐색으로 폴백 — 대량 문서에서 줄마다 getClientRects를 반복하던 지연을 줄인다.
            var pos = null;
            var badRect = lr[firstBad];
            if (document.caretRangeFromPoint) {
              try {
                var cr = document.caretRangeFromPoint(badRect.left + 1, (badRect.top + badRect.bottom) / 2);
                if (cr && p.contains(cr.startContainer) && cr.startContainer.nodeType === 3 && cr.startOffset > 0) pos = { node: cr.startContainer, offset: cr.startOffset };
              } catch (e) { }
            }
            if (!pos) {
              var walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null), nodes = [], total = 0, tn;
              while (tn = walker.nextNode()) { nodes.push({ node: tn, start: total, len: tn.data.length }); total += tn.data.length; }
              if (total === 0) return null;
              var posAt = function (idx) { for (var i = 0; i < nodes.length; i++) { if (idx <= nodes[i].start + nodes[i].len) return { node: nodes[i].node, offset: idx - nodes[i].start }; } var L = nodes[nodes.length - 1]; return { node: L.node, offset: L.len }; };
              var topAt = function (idx) { var pp = posAt(idx); var r = document.createRange(); r.setStart(pp.node, pp.offset); r.setEnd(pp.node, pp.offset); var rects = r.getClientRects(); var rect = rects.length ? rects[rects.length - 1] : r.getBoundingClientRect(); return pTopLayout + (rect.top - pRectTop) / scale; };
              var lo = 0, hi = total, splitIdx = total;   // 넘치는 첫 줄의 시작 문자 오프셋(top은 offset에 단조 증가 → 이분 탐색)
              while (lo < hi) { var midI = (lo + hi) >> 1; if (topAt(midI) >= targetTop - 0.5) { splitIdx = midI; hi = midI; } else lo = midI + 1; }
              if (splitIdx >= total || splitIdx <= 0) return 'ALL';
              pos = posAt(splitIdx);
            }
            var range = document.createRange(); range.setStart(pos.node, pos.offset); range.setEndAfter(p.lastChild);
            var frag = range.extractContents();
            var cont = document.createElement('p'); cont.className = 'pg-cont';
            var gid = p.getAttribute('data-splitbase') || p.getAttribute('data-splitcont');   // 조각들은 원래 문단 gid 하나 공유(체인 금지)
            if (!gid) { gid = 'g' + (++GIDC); p.setAttribute('data-splitbase', gid); }
            cont.setAttribute('data-splitcont', gid);
            cont.appendChild(frag);
            p.parentNode.insertBefore(cont, p.nextSibling);
            return cont;
          }
          // 커서를 '표시 안 되는 마커 노드'로 저장/복원 — 병합·분할로 노드가 갈아치워져도 정확히 따라감.
          // (전역 문자 오프셋 방식은 '문단 끝'과 '바로 다음 빈 문단 시작'을 구분 못 해서, 엔터로 새 문단 만든 뒤 커서가 앞 문단으로 되돌아가는 버그가 있었음)
          function insertCaretMarker() {
            var s = window.getSelection(); if (!s || !s.rangeCount) return null;
            var r = s.getRangeAt(0); if (!ed.contains(r.startContainer)) return null;
            var mk = document.createElement('span'); mk.setAttribute('data-caretmk', '1');   // 빈 인라인 스팬 — 줄 레이아웃에 영향 없음
            var r2 = r.cloneRange(); r2.collapse(true);
            try { r2.insertNode(mk); } catch (e) { return null; }
            return mk;
          }
          function restoreCaretMarker(mk) {
            if (!mk) return;
            if (!ed.contains(mk)) { if (mk.parentNode) mk.parentNode.removeChild(mk); return; }
            var parent = mk.parentNode;
            try { var r = document.createRange(); r.setStartAfter(mk); r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) { }
            if (parent) { parent.removeChild(mk); if (parent.normalize) parent.normalize(); }
          }
          // 저장·미리보기용 깨끗한 HTML: 간격·조각을 원상복구한 사본에서 뽑음(실제 편집기 ed는 건드리지 않음)
          function cleanHtml() {
            var c = ed.cloneNode(true);
            Array.prototype.forEach.call(c.querySelectorAll('.pg-break-spacer, [data-caretmk]'), function (n) { n.remove(); });
            mergeSplitsIn(c);
            return c.innerHTML;
          }
          wdCleanHtml = cleanHtml;
          function repaginate() {
            var m = metrics(), ph = m.ph, mg = m.mg;
            var pageInnerH = ph - 2 * mg;
            var hadFocus = (document.activeElement === ed);
            var caretMk = hadFocus ? insertCaretMarker() : null;   // 병합·분할 전에 커서 자리에 마커를 심고, 끝나면 그 자리로 정확히 복원
            Array.prototype.slice.call(ed.querySelectorAll('.pg-break-spacer')).forEach(function (n) { n.remove(); });
            mergeSplitsIn(ed);      // 이전 페이지 나눔 조각을 원래 문단으로 되돌린 뒤 처음부터 다시 계산
            normalizeTopLevel();
            var pageEndY = mg + pageInnerH;   // 현재 페이지의 본문 하단 경계(wd-page 기준 y좌표)
            var totalPages = 1, forceBreakAfter = false;
            var kids = Array.prototype.slice.call(ed.children), i = 0, guard = 0;
            while (i < kids.length && guard++ < 4000) {
              var k = kids[i];
              if (k.classList && k.classList.contains('pg-manual-break')) { forceBreakAfter = true; i++; continue; }
              if (k.classList && k.classList.contains('pg-break-spacer')) { i++; continue; }
              var top = k.offsetTop, bottom = top + k.offsetHeight;
              if (forceBreakAfter || bottom > pageEndY + 0.5) {
                // 이 문단을 현재 페이지 한도에서 줄 단위로 분리 시도 (수동 나눔·비문단은 통째로)
                var breakBefore = k;
                if (!forceBreakAfter && k.tagName === 'P') {
                  var res = splitParagraphAt(k, pageEndY);
                  if (res && res !== 'ALL') breakBefore = res;   // 넘치는 뒷부분(.pg-cont) 앞에서 나눔
                }
                var sp = document.createElement('div');
                sp.className = 'pg-break-spacer'; sp.contentEditable = 'false';
                sp.style.height = Math.max(0, Math.round(pageEndY - breakBefore.offsetTop) + 2 * mg + GAP) + 'px';
                ed.insertBefore(sp, breakBefore);
                pageEndY += ph + GAP; totalPages++; forceBreakAfter = false;
                kids = Array.prototype.slice.call(ed.children);
                i = kids.indexOf(breakBefore);   // 새 페이지 첫 조각부터 다시(그 조각도 또 넘칠 수 있음)
                continue;
              }
              i++;
            }
            // 마지막 장의 글이 짧아도 흰 용지 자체는 항상 '온전한 한 장'으로 보이게(배경·꺾쇠와 정확히 맞물림 — 구글 문서처럼)
            wdPage.style.minHeight = (totalPages * ph + (totalPages - 1) * GAP) + 'px';
            renderCropMarks(totalPages, ph, mg);
            renderPageNums(totalPages, ph);
            if (hadFocus) restoreCaretMarker(caretMk);
          }
          // Ctrl+Enter — 커서 다음의 글 전체가 다음 페이지로 넘어가도록 수동 페이지 나눔 삽입
          function insertManualBreak() {
            pushUndo();   // 나눔 전 상태를 undo 한 단계로
            document.execCommand('insertParagraph');   // 커서 위치에서 문단을 정확히 둘로 나눔(브라우저 기본 동작 재사용 — 서식 보존)
            var sel = window.getSelection();
            if (sel && sel.rangeCount) {
              var node = sel.getRangeAt(0).startContainer;
              while (node && node.parentNode !== ed) node = node.parentNode;
              if (node) {
                var mk = document.createElement('div');
                mk.className = 'pg-manual-break'; mk.contentEditable = 'false'; mk.setAttribute('data-pgbreak', '1');
                ed.insertBefore(mk, node);
              }
            }
            syncContent();
            repaginate();
          }
          ed.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); insertManualBreak(); }
          });
          function renderPageNums(totalPages, ph) {
            if (!pgnumLayer) return;
            var fmt = PGNUM_FMT[prefs.pgnum];
            if (!fmt) { pgnumLayer.innerHTML = ''; return; }
            var html = '';
            for (var i = 1; i <= totalPages; i++) {
              var y = (i - 1) * (ph + GAP) + ph - 26;   // 페이지 하단 여백 안(대략 중앙)
              var txt = fmt.replace('{i}', i).replace('{n}', totalPages);
              html += '<div class="wd-pagenum-item" style="top:' + y + 'px">' + esc(txt) + '</div>';
            }
            pgnumLayer.innerHTML = html;
          }
          if (paperSel) paperSel.onchange = function () { prefs.paper = this.value; applyPage(); };
          if (marginSel) marginSel.onchange = function () { prefs.margin = Number(this.value) || 20; applyPage(); };
          if (zoomR) zoomR.oninput = function () { prefs.zoom = Number(this.value) || 100; applyPage(); };
          if (pgnumSel) pgnumSel.onchange = function () { prefs.pgnum = this.value; try { localStorage.setItem(LSK, JSON.stringify(prefs)); } catch (e) { } repaginate(); };
          wdRepaginate = repaginate;   // 생명의삶 자동분류 등 코드로 ed.innerHTML을 바꿔치기하는 곳에서 재호출할 수 있게 바깥에 노출
          applyPage();
          // 웹폰트(본명조 등)가 늦게 로드되면 줄 높이가 바뀌므로, 로드 완료 후 페이지 나눔을 한 번 더 정확히 다시 계산
          try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { repaginate(); }); } catch (e) { }
          // 원고를 입력할 때마다(디바운스) 페이지 나눔·페이지 번호를 다시 계산
          var rpgT = null;
          // 페이지 나눔이 방금 커서 위치 바로 앞에 '간격(spacer)'을 끼워 넣으면, 화면은 그대로인데 실제 내용은 그 아래로 밀려나
          // 마치 '글이 사라진 것처럼' 보임 — 다시 계산한 뒤 커서 위치를 화면 안으로 스크롤해 맞춰줌(내용은 그대로, 위치만 보정)
          function keepCaretVisible() {
            try {
              var s = window.getSelection();
              if (!s || !s.rangeCount) return;
              var node = s.focusNode; if (!node) return;
              var el = node.nodeType === 3 ? node.parentElement : node;
              if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            } catch (e) { }
          }
          // 한글 IME 조합 중에는 DOM을 건드리면 조합이 깨지므로 페이지 나눔을 미룸
          var composing = false;
          function runRepaginate() {
            if (composing) { clearTimeout(rpgT); rpgT = setTimeout(runRepaginate, 200); return; }   // 조합 끝날 때까지 대기
            repaginate(); keepCaretVisible();
          }
          // 입력이 멈춘 뒤 다음 유휴/프레임에 페이지 나눔 — 타이핑 프레임을 막지 않아 체감 지연을 줄인다
          function schedRepaginate() { clearTimeout(rpgT); rpgT = setTimeout(function () { (window.requestAnimationFrame || window.setTimeout)(runRepaginate); }, 450); }
          ed.addEventListener('compositionstart', function () { composing = true; });
          ed.addEventListener('compositionend', function () { composing = false; schedRepaginate(); });
          ed.addEventListener('input', schedRepaginate);
        })();

        // ── 발표자 모드: 저장 없이 현재 화면 그대로 아이패드 발표 보기 ──
        var presBtn = ov.querySelector('#se_present');
        if (presBtn) presBtn.onclick = function () { sermonReadingView(gather(), { qt: false }); };

        // ── 우측 원고지 미리보기 + 하단 상태바(페이지·단어·글자·맞춤) ──
        var rpPaper = ov.querySelector('#rp_paper'), rpWrap = ov.querySelector('#rp_paperwrap'), rpInfo = ov.querySelector('#rp_pageinfo');
        var rpFlow = ov.querySelector('#rp_flow'), pgEl = ov.querySelector('#rp_pg'), pgPrev = ov.querySelector('#rp_pg_prev'), pgNext = ov.querySelector('#rp_pg_next');
        var sbCount = ov.querySelector('#sb_count'), zoomIn = ov.querySelector('#sb_zoom'), zoomV = ov.querySelector('#sb_zoom_v');
        var PG_INW = 434, PG_GAP = 86, PG_STRIDE = PG_INW + PG_GAP;   // 한 페이지 본문 폭 + 여백×2 = 페이지 넘김 간격
        var pgIdx = 0, pgTotal = 1;
        function updatePg() {
          if (!rpFlow) return;
          pgTotal = Math.max(1, Math.round((rpFlow.scrollWidth + PG_GAP) / PG_STRIDE));
          if (pgIdx > pgTotal - 1) pgIdx = pgTotal - 1;
          if (pgIdx < 0) pgIdx = 0;
          rpFlow.style.transform = 'translateX(' + (-pgIdx * PG_STRIDE) + 'px)';
          if (pgEl) pgEl.textContent = (pgIdx + 1) + ' / ' + pgTotal;
          if (pgPrev) pgPrev.disabled = (pgIdx <= 0);
          if (pgNext) pgNext.disabled = (pgIdx >= pgTotal - 1);
        }
        if (pgPrev) pgPrev.onclick = function () { pgIdx--; updatePg(); };
        if (pgNext) pgNext.onclick = function () { pgIdx++; updatePg(); };
        function applyZoom() {
          if (!rpPaper) return;
          var z = Number((zoomIn && zoomIn.value) || 66) / 100;
          rpPaper.style.transform = 'scale(' + z + ')';
          if (zoomV) zoomV.textContent = Math.round(z * 100) + '%';
          if (rpWrap) rpWrap.style.height = Math.ceil(rpPaper.offsetHeight * z) + 'px';
        }
        // "2026-07-02" → "2026년 7월 2일 (목)" — Apps Script fmtDateK_와 동일
        function fmtDateK(ymd) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '')) return ymd || '';
          var d = new Date(ymd + 'T00:00:00'), W = ['일', '월', '화', '수', '목', '금', '토'];
          return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + W[d.getDay()] + ')';
        }
        // PDF 내보내기(Apps Script exportSermonPdf)와 동일한 최종 결과물을 그대로 재현
        function renderPreview() {
          if (!rpPaper) return;
          var t = ov.querySelector('#se_title').value.trim() || '(제목없음)';
          var svcV = ov.querySelector('#se_service').value, cu = ov.querySelector('#se_svc_custom');
          if (svcV === '기타' && cu && cu.value.trim()) svcV = cu.value.trim();
          var meta = [fmtDateK(ov.querySelector('#se_date').value), svcV, ov.querySelector('#se_scripture').value.trim(), ov.querySelector('#se_preacher').value.trim()]
            .filter(Boolean).join('   ·   ');
          var bible = (ov.querySelector('#se_bible') ? ov.querySelector('#se_bible').value : '').trim();
          var plain = htmlToPlain(cleanContent() || '').trim();
          var paras = plain ? plain.split(/\n{2,}/) : ['(설교 원고가 비어 있습니다)'];
          var sLine = seriesLineInfo();
          var html = (sLine ? '<div class="pdf-series">📚 ' + esc(sLine) + '</div>' : '') + '<div class="pdf-t">' + esc(t) + '</div>';
          if (meta) html += '<div class="pdf-meta">' + esc(meta) + '</div>';
          html += '<hr class="pdf-hr">';
          if (bible.replace(/\s/g, '')) {
            html += '<div class="pdf-h">성경 본문  ·  개역개정</div>';
            bible.split(/\n+/).forEach(function (line) { line = line.trim(); if (line) html += '<div class="pdf-bible">' + esc(line) + '</div>'; });
            html += '<hr class="pdf-hr">';
          }
          html += '<div class="pdf-h">설교 원고</div>';
          paras.forEach(function (p) { var x = p.replace(/\n/g, ' ').trim(); if (x) html += '<p class="pdf-p">' + esc(x) + '</p>'; });
          if (rpFlow) rpFlow.innerHTML = html;
          updatePg();
          if (rpInfo) rpInfo.textContent = '아이패드 크기(3:4) · 실제 PDF 내보내기와 동일한 양식';
          var txt = (ed.innerText || '').trim();
          var words = txt ? txt.split(/\s+/).length : 0, chars = txt.replace(/\s/g, '').length;
          if (sbCount) sbCount.textContent = pgTotal + ' 페이지 · ' + words + ' 단어 · ' + chars + ' 글자';
          applyZoom();
        }
        if (zoomIn) zoomIn.oninput = applyZoom;
        var pvTimer = null;
        function schedPreview() { clearTimeout(pvTimer); pvTimer = setTimeout(function () { (window.requestIdleCallback || window.requestAnimationFrame || window.setTimeout)(renderPreview); }, 650); }
        ed.addEventListener('input', schedPreview);
        ['#se_title', '#se_scripture', '#se_preacher', '#se_bible', '#se_svc_custom'].forEach(function (sel) { var el = ov.querySelector(sel); if (el) el.addEventListener('input', schedPreview); });
        ov.querySelector('#se_service').addEventListener('change', schedPreview);
        ov.querySelector('#se_date').addEventListener('change', schedPreview);
        ov.querySelector('#qtc_run').addEventListener('click', function () { setTimeout(renderPreview, 350); });   // 자동분류 후 미리보기 갱신
        renderPreview();

        // ── Ctrl+S 저장 + 자동 임시저장(기본 10초, ⚙ 설정에서 조정) ──
        ov.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 's') { e.preventDefault(); save(null); } });
        var dirty = false;
        ov.addEventListener('input', function () { dirty = true; });
        var AS_LSK = 'wpSermonAutosave';
        var asCfg = { on: true, sec: 10 };
        try { var asv = JSON.parse(localStorage.getItem(AS_LSK) || 'null'); if (asv) { asCfg.on = asv.on !== false; asCfg.sec = Math.max(5, Math.min(600, Number(asv.sec) || 10)); } } catch (e) { }
        var asTimer = null, asSaving = false;
        function asStamp(txt) { var el = ov.querySelector('#sb_saved'); if (el) el.textContent = txt; }
        // 조용한 자동저장 — 새 문서/기존 문서 모두 저장(첫 저장 시 id 확보), 화면 하단에만 시각 표시
        function quietSave() {
          if (asSaving) return;
          var data = gather();
          if (!data.sermon_date || !data.title) return;   // 일자·제목이 없으면 조용히 건너뜀
          asSaving = true; dirty = false;
          var p = rec.id ? api('PATCH', 'sermons?id=eq.' + rec.id, data, 'return=representation') : api('POST', 'sermons', data, 'return=representation');
          p.then(function (rows) {
            if (rows && rows[0]) rec.id = rows[0].id;
            asSaving = false;
            var d = new Date(), h = d.getHours(), ap = h < 12 ? '오전' : '오후'; h = h % 12 || 12;
            asStamp('자동저장됨 ' + ap + ' ' + String(h).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'));
          }).catch(function () { asSaving = false; dirty = true; asStamp('자동저장 대기 중…'); });
        }
        function startAutosave() {
          if (asTimer) { clearInterval(asTimer); asTimer = null; }
          if (!asCfg.on) return;
          asTimer = setInterval(function () {
            if (!document.body.contains(ov)) { clearInterval(asTimer); return; }
            if (dirty) quietSave();
          }, Math.max(5, asCfg.sec) * 1000);
        }
        startAutosave();
        // ── ⚙ 자동저장 설정창 ──
        (function autosaveSettings() {
          var btn = ov.querySelector('#se_settings'); if (!btn) return;
          var box = document.createElement('div'); box.className = 'se-setpop'; box.style.display = 'none';
          box.innerHTML =
            '<div class="se-setpop-h">⚙ 자동 임시저장</div>' +
            '<label class="se-setpop-row"><input type="checkbox" id="as_on"' + (asCfg.on ? ' checked' : '') + '> 자동저장 사용</label>' +
            '<div class="se-setpop-row">간격 <input type="number" id="as_sec" min="5" max="600" step="5" value="' + asCfg.sec + '"> 초마다</div>' +
            '<div class="se-setpop-note">일자·제목이 채워진 뒤부터 자동으로 저장됩니다. (최소 5초 · 새 문서도 첫 저장 후 이어서 저장)</div>' +
            '<div style="text-align:right;margin-top:9px"><button type="button" class="btn btn-solid" id="as_apply" style="padding:5px 14px;font-size:.82rem">적용</button></div>';
          ov.appendChild(box);
          function place() { var r = btn.getBoundingClientRect(); box.style.top = (r.bottom + 6) + 'px'; box.style.left = Math.max(8, Math.min(r.left - 90, window.innerWidth - 244)) + 'px'; }
          btn.onclick = function () { if (box.style.display === 'none') { place(); box.style.display = 'block'; } else box.style.display = 'none'; };
          box.querySelector('#as_apply').onclick = function () {
            asCfg.on = box.querySelector('#as_on').checked;
            asCfg.sec = Math.max(5, Math.min(600, Number(box.querySelector('#as_sec').value) || 10));
            try { localStorage.setItem(AS_LSK, JSON.stringify(asCfg)); } catch (e) { }
            startAutosave();
            box.style.display = 'none';
            asStamp(asCfg.on ? ('자동저장 켜짐 · ' + asCfg.sec + '초 간격') : '자동저장 꺼짐');
          };
          document.addEventListener('mousedown', function (e) { if (box.style.display !== 'none' && !box.contains(e.target) && e.target !== btn) box.style.display = 'none'; });
        })();
      })();
    }
  }

  // 서식(HTML) 원고 → 평문(카카오톡 등). 평문이면 그대로.
  function htmlToPlain(html) {
    if (html == null) return '';
    var s = String(html);
    if (!/<[a-z!][\s\S]*>/i.test(s)) return s;
    var d = document.createElement('div');
    d.innerHTML = s.replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, '$&\n').replace(/<br\s*\/?>/gi, '\n');
    return (d.textContent || '').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
  }

  // QT 카카오톡 발송 양식 (텍스트) — 클립보드에 복사
  function kakaoQtText(r) {
    r = r || {};
    var d = r.sermon_date ? new Date(r.sermon_date + 'T00:00:00') : new Date();
    var DOW = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    var dateStr = d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0') + ' ' + DOW[d.getDay()];
    var lines = [];
    lines.push('📖 샬롬! 오늘의 QT입니다.');
    lines.push('');
    lines.push('📅 날짜: ' + dateStr);
    lines.push('');
    if (r.title) lines.push(r.title);
    if (r.scripture) lines.push(r.scripture);
    lines.push('');
    lines.push('📖 성경 본문 (우리말 성경)');
    lines.push((r.qt_bible_text || '').trim() || '(우리말성경 본문이 입력되지 않았습니다)');
    lines.push('');
    lines.push('📝 묵상');
    lines.push('');
    lines.push(htmlToPlain(r.content).trim());
    var prayer = htmlToPlain(r.prayer).trim();
    if (prayer) { lines.push(''); lines.push('🙏 기도'); lines.push(''); lines.push(prayer); }
    return lines.join('\n');
  }
  function copyKakaoQt(r) {
    var text = kakaoQtText(r);
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); alert('✓ 카카오톡 양식이 복사되었습니다. 카카오톡에 붙여 넣으세요.'); } catch (e) { alert('복사 실패: ' + e.message); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { alert('✓ 카카오톡 양식이 복사되었습니다. 카카오톡에 붙여 넣으세요.'); }, fallback);
    } else fallback();
  }

  // 아이패드용 설교문 보기(큰 글씨·스크롤·페이지넘김·전체화면·다크모드·인쇄)
  function sermonReadingView(r, opts) {
    r = r || {}; opts = opts || {};
    var qtMode = !!opts.qt;
    var w = opts.win || window.open('', '_blank'); // 미리 연 창(opts.win)이 있으면 재사용(팝업 차단 회피)
    if (!w) { alert('팝업이 차단되었습니다. 브라우저에서 팝업을 허용해 주세요.'); return; }
    var meta = [r.service, fmtD(r.sermon_date), r.preacher].filter(Boolean).map(function (x) { return esc(x); }).join(' · ');
    var hymnsTxt = hymnsLabel(r.hymns);
    var wOrder = (function () { try { return JSON.parse(r.worship_order || '[]') || []; } catch (e) { return []; } })();
    function isImg(u) { return /\.(jpg|jpeg|png|webp|gif|bmp)(\?|$)/i.test(u || ''); }

    function creedLines(arr) { return '<div class="lt-creed">' + arr.map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('') + '</div>'; }
    var bibleSrc = qtMode ? (r.qt_bible_text || r.bible_text || '') : (r.bible_text || '');
    var bibleLabel = qtMode ? '성경 본문 (우리말성경)' : '성경 본문 (개역개정)';
    var bibleHtml = bibleSrc ? '<div class="bible"><div class="bible-t">■ ' + bibleLabel + (r.scripture ? ' <span style="font-weight:400;color:#9a8f78">' + esc(r.scripture) + '</span>' : '') + '</div>' + esc(bibleSrc).replace(/\n/g, '<br>') + '</div>' : '';
    // 설교 원고는 페이지 모드에서 화면 높이에 맞춰 동적으로 분할됨(아래 JS). '<' 이스케이프로 </script> 차단
    // 설교 원고: 서식(HTML) 원고면 블록 단위로, 옛 평문이면 줄 단위로 분할(하위호환)
    var _craw = r.content || '';
    var _isHtml = /<(p|div|h[1-6]|ul|ol|li|blockquote|br|span|mark|b|i|strong|em|u|s|font)\b/i.test(_craw);
    var bodyIsHtml = false, bodyBlocks;
    if (_isHtml) {
      var _tmp = document.createElement('div'); _tmp.innerHTML = _craw;
      bodyBlocks = [];
      Array.prototype.forEach.call(_tmp.childNodes, function (n) {
        if (n.nodeType === 1) { if ((n.outerHTML || '').trim()) bodyBlocks.push(n.outerHTML); }
        else if (n.nodeType === 3 && n.textContent.trim()) bodyBlocks.push('<p>' + n.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>');
      });
      if (!bodyBlocks.length) bodyBlocks = [_craw];
      bodyIsHtml = true;
    } else { bodyBlocks = _craw.split('\n'); }
    // 🙏 기도: 설교 원고 뒤에 이어 붙임
    var prayerRaw = (r.prayer || '').trim();
    if (prayerRaw) {
      function _eh(x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
      if (bodyIsHtml) {
        bodyBlocks.push('<h2 class="lt-prayer-h">🙏 기도</h2>');
        if (/<(p|div|h[1-6]|br|span|b|i|u|strong|em)\b/i.test(prayerRaw)) {
          var _pt = document.createElement('div'); _pt.innerHTML = prayerRaw;
          Array.prototype.forEach.call(_pt.childNodes, function (n) { if (n.nodeType === 1) { if ((n.outerHTML || '').trim()) bodyBlocks.push(n.outerHTML); } else if (n.nodeType === 3 && n.textContent.trim()) bodyBlocks.push('<p>' + _eh(n.textContent) + '</p>'); });
        } else {
          prayerRaw.split(/\n{2,}/).forEach(function (p) { if (p.trim()) bodyBlocks.push('<p>' + _eh(p).replace(/\n/g, '<br>') + '</p>'); });
        }
      } else {
        bodyBlocks.push('', '🙏 기도');
        prayerRaw.split('\n').forEach(function (l) { bodyBlocks.push(l); });
      }
    }
    var bodyLinesJson = JSON.stringify(bodyBlocks).replace(/</g, '\\u003c');

    // 예배 순서 한 항목의 전문(교독문·사도신경·주기도문·성경봉독·가사/기도문 자동 펼침)
    function itemContent(it) {
      var label = it.label || '항목', c = '';
      if (label === '교독문') { var m = (it.detail || '').match(/(\d+)/); var g = m ? gyodokByNo(m[1]) : null; if (g) c += '<div class="it-d">' + esc(g.no + '. ' + g.title) + '</div><div class="lt-creed">' + gyodokBodyHTML(g.body) + '</div>'; else if (it.detail) c += '<div class="it-d">' + esc(it.detail) + '</div>'; }
      else if (label === '신앙고백') { c += '<div class="it-d">사도신경</div>' + creedLines(APOSTLES_CREED); }
      else if (label === '주기도문') { c += creedLines(LORDS_PRAYER); }
      else if (label === '성경봉독') { if (r.scripture) c += '<div class="it-d">' + esc(r.scripture) + '</div>'; if (r.bible_text) c += '<div class="lt-bible">' + esc(r.bible_text).replace(/\n/g, '<br>') + '</div>'; }
      else if (label === '말씀강해' || label === '말씀(설교)') { c += '<div class="it-stitle">' + esc(r.title || '') + '</div>' + (r.scripture ? '<div class="it-d">' + esc(r.scripture) + '</div>' : '') + '<div class="it-hint">▼ 다음 페이지부터 설교 원고</div>'; }
      else { if (it.detail) c += '<div class="it-d">' + esc(it.detail) + '</div>'; }
      if (it.body && it.body.trim()) c += '<div class="lt-body">' + esc(it.body).replace(/\n/g, '<br>') + '</div>';
      if (it.url && isImg(it.url)) c += '<div class="it-img"><img src="' + esc(it.url) + '" alt=""></div>';
      else if (it.url) c += '<div style="margin-top:8px"><a href="' + esc(it.url) + '" target="_blank" rel="noopener">📎 자료</a></div>';
      return c;
    }

    // ── 페이지 구성: 표지 → 예배 순서(항목당 1페이지) → (말씀강해 뒤) 설교 원고 동적 ──
    var pages = [];
    pages.push('<div class="pg pg-fixed pg-cover"><h1>' + esc(r.title || '(제목 없음)') + '</h1>' + (r.scripture ? '<div class="scr">' + esc(r.scripture) + '</div>' : '') + (meta ? '<div class="meta">' + meta + '</div>' : '') + '</div>');
    // 예배 순서 페이지는 정식 예배(주일·수요기도회·금요·특별집회)에만. 새벽기도·매일 QT 등은 성경 본문 페이지로.
    var ORDER_SERVICES = { '주일 낮 예배': 1, '주일 밤 예배': 1, '수요기도회': 1, '수요예배': 1, '금요기도회': 1, '특별집회': 1 };
    if (!qtMode && wOrder.length && ORDER_SERVICES[r.service]) {
      var visOrder = wOrder.filter(function (it) { return !it.noexport; });   // '출력제외' 항목 건너뜀
      var total = visOrder.length;
      visOrder.forEach(function (it, i) {
        var label = it.label || '항목';
        var isSermon = (label === '말씀강해' || label === '말씀(설교)');
        pages.push('<div class="pg pg-fixed pg-item' + (isSermon ? ' pg-sermon-anchor' : '') + '">' +
          '<div class="it-num">' + (i + 1) + ' / ' + total + '</div>' +
          '<div class="it-label">' + esc(label) + '</div>' + itemContent(it) + '</div>');
      });
    } else if (bibleHtml) {
      pages.push('<div class="pg pg-fixed pg-bible">' + bibleHtml + '</div>');
    }

    var css = [
      '*{box-sizing:border-box}',
      'html,body{margin:0;height:100%}',
      'body{font-family:"Noto Serif KR",serif;background:#fbf9f4;color:#1a1a1a;font-size:22px;line-height:1.9;-webkit-text-size-adjust:100%;display:flex;flex-direction:column}',
      /* 상단 바 */
      '.bar{flex-shrink:0;position:sticky;top:0;background:rgba(255,255,255,.96);border-bottom:1px solid #e3ddd0;padding:6px 12px;display:flex;gap:6px;align-items:center;flex-wrap:nowrap;overflow-x:auto;z-index:10;-webkit-overflow-scrolling:touch}',
      '.bar button{flex-shrink:0;font:inherit;font-size:14px;border:1px solid #cdd7e3;background:#fff;border-radius:8px;padding:5px 11px;cursor:pointer;white-space:nowrap}',
      '.bar button.active{background:#223350;color:#fff;border-color:#223350}',
      '.bar .hint{flex-shrink:0;font-size:12px;color:#9a8f78;margin-left:auto;white-space:nowrap}',
      /* 덱 컨테이너 */
      '#deck{flex:1;overflow:hidden;position:relative}',
      '#track{height:100%}',
      /* ── 스크롤 모드 (기본) ── */
      'body.scroll #deck{overflow-y:auto;overflow-x:hidden}',
      'body.scroll #track{display:block;height:auto;transform:none!important}',
      'body.scroll .pg{max-width:820px;margin:0 auto;padding:24px 22px 60px;height:auto}',
      'body.scroll .pg+.pg{border-top:2px dashed #e7e0cf;padding-top:36px}',
      /* ── 페이지 모드 (transform 슬라이드 — iOS 안정) ── */
      'body.paged #deck{overflow:hidden}',
      'body.paged #track{display:flex;flex-direction:row;height:100%;transition:transform .32s cubic-bezier(.4,0,.2,1);will-change:transform}',
      'body.paged .pg{flex:0 0 100%;width:100%;height:100%;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:24px 28px 44px}',
      'body.paged .pg-img{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px}',
      /* 공통 요소 */
      'h1{font-size:1.6em;margin:0 0 6px;line-height:1.35}',
      '.scr{font-size:1.05em;color:#7a5d27;font-weight:600;margin:0 0 4px}',
      '.meta{font-size:.78em;color:#9a8f78;margin:0 0 14px;font-family:"Noto Sans KR",sans-serif}',
      '.order{font-family:"Noto Sans KR",sans-serif;font-size:.82em;background:#f1ece0;border:1px solid #e4dcc9;border-radius:10px;padding:11px 15px;margin:0 0 0;line-height:1.85}',
      '.order-t{font-weight:700;color:#7a5d27;margin-bottom:5px}.order a{color:#1f6feb}',
      '.bible{font-size:1em;background:#f6f2e8;border:1px solid #e7e0cf;border-left:4px solid #b89b5e;border-radius:8px;padding:14px 18px;line-height:1.95}',
      '.bible-t{font-family:"Noto Sans KR",sans-serif;font-weight:700;font-size:.8em;color:#7a5d27;margin-bottom:7px}',
      /* 예배 순서 — 항목당 한 페이지 */
      '.pg-item .it-num{font-family:"Noto Sans KR",sans-serif;font-size:.62em;color:#b3a06f;letter-spacing:.05em;margin-bottom:6px}',
      '.pg-item .it-label{font-family:"Noto Sans KR",sans-serif;font-weight:800;font-size:1.5em;color:var(--accent,#0a2c5c);margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #e4dcc9}body.dark .pg-item .it-label{color:#e0c98a;border-bottom-color:#3a3d44}',
      '.pg-item .it-d{font-family:"Noto Sans KR",sans-serif;font-size:.92em;color:#7a5d27;margin-bottom:10px}body.dark .pg-item .it-d{color:#cbb98a}',
      '.pg-item .it-stitle{font-family:"Noto Serif KR",serif;font-weight:700;font-size:1.35em;color:#1a1a1a;margin:8px 0}body.dark .pg-item .it-stitle{color:#f0ece2}',
      '.pg-item .it-hint{font-family:"Noto Sans KR",sans-serif;font-size:.66em;color:#b3a06f;margin-top:18px}',
      '.pg-item .it-img{margin-top:12px;text-align:center}.pg-item .it-img img{max-width:100%;border-radius:6px}',
      /* 예배 순서 전문(큐시트) */
      '.lit-t{font-family:"Noto Sans KR",sans-serif;font-weight:700;font-size:.82em;color:#7a5d27;margin:0 0 12px}body.dark .lit-t{color:#e0c98a}',
      '.lt-item{margin:0 0 18px;padding:0 0 14px;border-bottom:1px dashed #e3ddcf}body.dark .lt-item{border-bottom-color:#3a3d44}',
      '.lt-h{font-family:"Noto Sans KR",sans-serif;font-weight:700;font-size:1.02em;color:var(--accent,#0a2c5c);margin-bottom:6px}body.dark .lt-h{color:#e0c98a}',
      '.lt-h .lt-n{display:inline-flex;align-items:center;justify-content:center;min-width:1.5em;height:1.5em;border-radius:50%;background:#0a2c5c;color:#fff;font-size:.72em;margin-right:5px}body.dark .lt-h .lt-n{background:#5b8dee}',
      '.lt-d{font-weight:500;font-size:.86em;color:#7a5d27}body.dark .lt-d{color:#cbb98a}',
      '.lt-creed{font-size:.98em;line-height:1.85;color:#2b2b2b}body.dark .lt-creed{color:#e3e0d8}',
      '.lt-creed>div{margin:3px 0}',
      '.lt-bible{font-size:.98em;line-height:1.9;white-space:normal}',
      '.lt-body{font-size:.98em;line-height:1.85;white-space:pre-wrap;margin-top:4px}',
      '.pg-img .img-pg-t{font-family:"Noto Sans KR",sans-serif;font-size:.75em;color:#7a5d27;font-weight:700;margin-bottom:10px;text-align:center}',
      '.pg-img img{max-width:100%;max-height:calc(100% - 40px);object-fit:contain;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,.1)}',
      '.body{white-space:normal}',
      '.body h1,.body h2{font-size:1.32em;font-weight:800;margin:.6em 0 .3em;line-height:1.4;color:#10243f}body.dark .body h1,body.dark .body h2{color:#e8edf6}',
      '.body h3{font-size:1.14em;font-weight:700;margin:.5em 0 .25em;color:#1b3a5c}body.dark .body h3{color:#9bbcf0}',
      '.body p{margin:.5em 0}.body ul,.body ol{margin:.5em 0;padding-left:1.5em}.body li{margin:.2em 0}',
      '.body blockquote{border-left:4px solid #d8cbab;margin:.6em 0;padding:.2em 0 .2em 16px;color:#6b5d3e;font-style:italic}body.dark .body blockquote{border-left-color:#5a513a;color:#cbb98a}',
      '.body mark{padding:0 2px;border-radius:2px}.body hr{border:none;border-top:1px solid #d8cbab;margin:.9em 0}body.dark .body hr{border-top-color:#3a3d44}',
      '.body .lt-prayer-h{font-size:1.18em;font-weight:800;color:#7a5d27;margin:1em 0 .35em;padding-top:.6em;border-top:2px solid #e4dcc9}body.dark .body .lt-prayer-h{color:#e0c98a;border-top-color:#3a3d44}',
      /* 페이지 표시기 */
      '#pg_ind{flex-shrink:0;font-size:12px;color:#9a8f78;min-width:44px;text-align:center;display:none}',
      'body.paged #pg_ind{display:block}',
      /* 몰입 모드(전체화면 폴백) — 상단 바 숨김 */
      'body.immersive .bar{display:none}',
      '#exitfs{position:fixed;top:8px;left:8px;z-index:30;display:none;font:inherit;font-size:12px;border:1px solid rgba(0,0,0,.12);background:rgba(255,255,255,.78);color:#5b6b7d;border-radius:16px;padding:5px 11px;cursor:pointer;box-shadow:0 1px 5px rgba(0,0,0,.1);opacity:.78}',
      'body.immersive #exitfs{display:block}',
      'body.dark #exitfs{background:rgba(35,38,44,.85);color:#cdd3dc;border-color:#3a3d44}',
      /* 페이지 모드: 양 끝 탭 영역 + 화살표 힌트 */
      '.edge{position:fixed;top:0;bottom:0;width:22%;max-width:150px;z-index:15;display:none;align-items:center;pointer-events:none}',
      'body.paged .edge{display:flex}',
      '#edgeL{left:0;justify-content:flex-start;padding-left:6px}#edgeR{right:0;justify-content:flex-end;padding-right:6px}',
      '.edge span{font-size:34px;line-height:1;color:rgba(60,72,90,.16);transition:color .15s}',
      '.edge:active span{color:rgba(60,72,90,.42)}',
      'body.dark .edge span{color:rgba(255,255,255,.18)}body.dark .edge:active span{color:rgba(255,255,255,.44)}',
      /* 다크 모드 */
      'body.dark{background:#15171b;color:#e9e6df}',
      'body.dark .bar{background:rgba(21,23,27,.96);border-color:#2a2d33}',
      'body.dark .bar button{background:#23262c;color:#e9e6df;border-color:#3a3d44}',
      'body.dark .bar button.active{background:#5b8dee;border-color:#5b8dee;color:#fff}',
      'body.dark .scr{color:#e0c98a}body.dark .meta{color:#8a8576}',
      'body.dark .order{background:#23262c;border-color:#3a3d44}body.dark .order-t{color:#e0c98a}',
      'body.dark .bible{background:#1e2026;border-color:#3a3d44;border-left-color:#7a5d27}body.dark .bible-t{color:#e0c98a}',
      'body.dark .pg+.pg{border-top-color:#2a2d33}',
      '@media print{.bar{display:none}body{display:block;font-size:13pt}#deck{display:block;overflow:visible}#track,body.paged #track{display:block;transform:none!important}body.paged .pg{width:auto;height:auto;page-break-after:always;overflow:visible}}'
    ].join('');

    var js = '(function(){' +
      'var b=document.body,s=22,deck=document.getElementById("deck"),track=document.getElementById("track"),ind=document.getElementById("pg_ind");' +
      'var BODY=' + bodyLinesJson + ';var HTML=' + (bodyIsHtml ? 'true' : 'false') + ';' +
      'var curPg=0,total=0,reflowTimer=null;' +
      'function eh(x){return String(x).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}' +
      'function lineHtml(x){return HTML?(x||""):((x?eh(x):"")+"<br>");}' +
      'function fullBodyHtml(){return HTML?BODY.join(""):BODY.map(function(x){return x?eh(x):"";}).join("<br>");}' +
      'function mkBodyPage(){var pg=document.createElement("div");pg.className="pg pg-body";var inr=document.createElement("div");inr.className="body";pg.appendChild(inr);return pg;}' +
      /* 설교 원고를 현재 화면 높이에 맞춰 분할(페이지 모드) 또는 한 덩어리(스크롤 모드) */
      'function buildBody(){' +
        'var olds=track.querySelectorAll(".pg-body");for(var k=0;k<olds.length;k++)olds[k].parentNode.removeChild(olds[k]);' +
        'var anchor=track.querySelector(".pg-sermon-anchor"),ref=anchor;' +
        'function addPg(pg){if(anchor){track.insertBefore(pg,ref.nextSibling);ref=pg;}else{track.appendChild(pg);}}' +
        'if(!b.classList.contains("paged")){var pg=mkBodyPage();addPg(pg);pg.firstChild.innerHTML=fullBodyHtml();}' +
        'else{var i=0;if(!BODY.length){var e=mkBodyPage();addPg(e);}' +
          'while(i<BODY.length){var pg=mkBodyPage();addPg(pg);var inr=pg.firstChild,started=false;' +
            'while(i<BODY.length){var prev=inr.innerHTML;inr.innerHTML=prev+lineHtml(BODY[i]);' +
              'if(started&&pg.scrollHeight>pg.clientHeight+1){inr.innerHTML=prev;break;}' +
              'started=true;i++;}' +
          '}' +
        '}' +
        'total=track.querySelectorAll(".pg").length;if(curPg>total-1)curPg=total-1;if(curPg<0)curPg=0;' +
      '}' +
      /* 글자 크기 */
      'function ap(){b.style.fontSize=s+"px";try{localStorage.setItem("sermonFs",s)}catch(e){}if(b.classList.contains("paged")){buildBody();apply();}}' +
      'try{var sv=parseInt(localStorage.getItem("sermonFs"),10);if(sv)s=sv}catch(e){}' +
      'document.getElementById("inc").onclick=function(){s=Math.min(52,s+2);ap()};' +
      'document.getElementById("dec").onclick=function(){s=Math.max(14,s-2);ap()};' +
      /* 다크 */
      'document.getElementById("dark").onclick=function(){b.classList.toggle("dark")};' +
      /* 전체화면 — 지원되면 Fullscreen API, 아이패드 등 미지원이면 몰입 모드(바 숨김) */
      'var fsBtn=document.getElementById("fs"),exitBtn=document.getElementById("exitfs");' +
      'function isFs(){return document.fullscreenElement||document.webkitFullscreenElement;}' +
      'function updateFs(){var on=isFs()||b.classList.contains("immersive");fsBtn.textContent=on?"⊡ 창모드":"⛶ 전체화면";fsBtn.classList.toggle("active",on);}' +
      'function reflow(){if(b.classList.contains("paged")){buildBody();apply();}}' +
      'function enterImmersive(){b.classList.add("immersive");updateFs();setTimeout(reflow,60);}' +
      'function exitImmersive(){b.classList.remove("immersive");updateFs();setTimeout(reflow,60);}' +
      'fsBtn.onclick=function(){var el=document.documentElement;' +
        'if(isFs()){(document.exitFullscreen||document.webkitExitFullscreen).call(document);return;}' +
        'if(b.classList.contains("immersive")){exitImmersive();return;}' +
        'var req=el.requestFullscreen||el.webkitRequestFullscreen;' +
        'if(req){try{var p=req.call(el);if(p&&p.catch)p.catch(function(){enterImmersive();});}catch(e){enterImmersive();}}' +
        'else{enterImmersive();}' +
      '};' +
      'exitBtn.onclick=function(){if(isFs()){(document.exitFullscreen||document.webkitExitFullscreen).call(document);}exitImmersive();};' +
      'document.addEventListener("fullscreenchange",function(){updateFs();setTimeout(reflow,60);});' +
      'document.addEventListener("webkitfullscreenchange",function(){updateFs();setTimeout(reflow,60);});' +
      /* transform 슬라이드 적용 */
      'function apply(){if(b.classList.contains("paged")){track.style.transform="translateX("+(-curPg*100)+"%)";}ind.textContent=(curPg+1)+"/"+total;}' +
      'function goPage(d){curPg=Math.max(0,Math.min(total-1,curPg+d));apply();}' +
      /* 페이지↔스크롤 토글 */
      'var pgBtn=document.getElementById("pgbtn");' +
      'function setMode(paged){' +
        'b.classList.toggle("paged",paged);b.classList.toggle("scroll",!paged);' +
        'pgBtn.classList.toggle("active",paged);' +
        'try{localStorage.setItem("sermonPaged",paged?"1":"0")}catch(e){}' +
        'if(!paged){track.style.transform="";}else{curPg=0;}' +
        'buildBody();apply();' +
      '}' +
      'pgBtn.onclick=function(){setMode(!b.classList.contains("paged"))};' +
      'ap();' +
      'try{setMode(localStorage.getItem("sermonPaged")==="1")}catch(e){setMode(false)}' +
      /* ◀ ▶ 버튼 */
      'document.getElementById("prev").onclick=function(){goPage(-1)};' +
      'document.getElementById("next").onclick=function(){goPage(1)};' +
      /* 키보드 */
      'document.addEventListener("keydown",function(e){' +
        'if(!b.classList.contains("paged"))return;' +
        'if(e.key==="ArrowRight"||e.key==="PageDown"||e.key===" "){e.preventDefault();goPage(1);}' +
        'else if(e.key==="ArrowLeft"||e.key==="PageUp"){e.preventDefault();goPage(-1);}' +
      '});' +
      /* 좌/우 가장자리 탭으로 페이지 넘김 (스와이프가 안 되는 환경 대비, 링크·버튼·스와이프 직후 제외) */
      'var moved=false;' +
      'deck.addEventListener("click",function(e){if(!b.classList.contains("paged"))return;if(moved){moved=false;return;}if(e.target.closest&&e.target.closest("a,button,input,textarea"))return;var x=e.clientX,w=window.innerWidth||deck.clientWidth;if(x<w*0.22){goPage(-1);}else if(x>w*0.78){goPage(1);}});' +
      /* 터치 스와이프 — 손가락 따라 미리보기 후 손 떼면 페이지 전환 */
      'var sx=0,sy=0,st=0,sw=0,dragging=false,locked=false;' +
      'track.addEventListener("touchstart",function(e){if(!b.classList.contains("paged"))return;var t=e.touches[0];sx=t.clientX;sy=t.clientY;st=Date.now();sw=deck.clientWidth||window.innerWidth||1;dragging=true;locked=false;track.style.transition="none";},{passive:true});' +
      'track.addEventListener("touchmove",function(e){if(!dragging)return;var t=e.touches[0],dx=t.clientX-sx,dy=t.clientY-sy;' +
        'if(!locked){if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>6){locked="x";}else if(Math.abs(dy)>10){locked="y";}}' +
        'if(locked==="x"){moved=true;var pct=(-curPg*100)+(dx/sw*100);track.style.transform="translateX("+pct+"%)";}},{passive:true});' +
      'track.addEventListener("touchend",function(e){if(!dragging)return;dragging=false;track.style.transition="";' +
        'var t=e.changedTouches[0],dx=t.clientX-sx,dy=t.clientY-sy,dt=Date.now()-st;' +
        'if(locked==="x"&&(Math.abs(dx)>sw*0.12||(dt<500&&Math.abs(dx)>30))){goPage(dx<0?1:-1);}else{apply();}' +
        'setTimeout(function(){moved=false;},50);},{passive:true});' +
      /* 창 크기/회전 시 재분할 */
      'window.addEventListener("resize",function(){clearTimeout(reflowTimer);reflowTimer=setTimeout(reflow,150);});' +
      /* 인쇄 */
      'document.getElementById("print").onclick=function(){window.print()};' +
      '})();';

    var html = '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
      '<title>' + esc(r.title || '설교문') + '</title>' +
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
      '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&family=Noto+Serif+KR:wght@400;600;700&display=swap" rel="stylesheet">' +
      '<style>' + css + '</style></head><body class="scroll">' +
      '<div class="bar">' +
        '<button id="dec">가–</button>' +
        '<button id="inc">가+</button>' +
        '<button id="dark">🌙</button>' +
        '<button id="fs">⛶ 전체화면</button>' +
        '<button id="pgbtn">📖 페이지</button>' +
        '<button id="prev">◀</button>' +
        '<span id="pg_ind"></span>' +
        '<button id="next">▶</button>' +
        '<button id="print">🖨</button>' +
        '<span class="hint">' + (qtMode ? 'QT · 우리말성경' : '설교') + ' · 좌우 끝을 탭하면 넘김</span>' +
      '</div>' +
      '<div id="deck"><div id="track">' + pages.join('') + '</div></div>' +
      '<div class="edge" id="edgeL"><span>‹</span></div><div class="edge" id="edgeR"><span>›</span></div>' +
      '<button id="exitfs">⊡ 도구 보기</button>' +
      '<script>' + js + '<\/script>' +
      '</body></html>';
    w.document.write(html); w.document.close(); w.focus();
  }

  // ====================================================================
  //  주보 제작 (설교 연동 · Supabase 저장/게시 · 인쇄 PDF)
  // ====================================================================
  var BULLETIN_PRESET = ['경배와찬양', '목회 기도', '송영', '성시교독', '신앙고백', '찬송', '기도', '성경봉독', '성가대찬양', '말씀강해', '헌금봉헌', '교회소식', '기도', '찬송', '축도'];
  var OFFER_KEYS = ['십일조', '감사헌금', '주일헌금', '건축헌금', '선교헌금', '유년부', '차량헌금', '일천번기도'];
  var AMOUNT_KEYS = ['십일조', '감사헌금', '주일헌금', '생일감사', '건축헌금', '선교헌금', '차량헌금', '일천번제', '합계'];
  var COMMITTEE_KEYS = ['헌금위원', '안내위원', '주차·사찰', '다음 주 기도'];
  function addDays(d, n) { var t = new Date(d + 'T00:00:00'); t.setDate(t.getDate() + n); return t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate()); }
  function nextSunday() { var d = new Date(); var add = (7 - d.getDay()) % 7; d.setDate(d.getDate() + (add === 0 ? 7 : add)); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  // 그 해 몇 번째 일요일(주차)
  function weekNoOfYear(bd) {
    var d = new Date(bd + 'T00:00:00'); var y = d.getFullYear();
    var jan1 = new Date(y, 0, 1);
    var firstSun = new Date(y, 0, 1 + ((7 - jan1.getDay()) % 7)); // 그 해 첫 일요일
    return Math.round((d - firstSun) / (7 * 86400000)) + 1;
  }
  // 교회 설립일(설정에서 변경). 호수의 주년 계산 기준
  var FOUNDED_DATE = '1964-03-01', FOUNDED_YEAR = 1964;
  var PDF_NAME = '{date} 주보'; // 주보 PDF 기본 파일명 형식
  function loadGeneral() {
    return api('GET', 'church_settings?key=eq.general&select=data').then(function (rows) {
      var g = (rows && rows[0] && rows[0].data) || {};
      if (g.founded) { FOUNDED_DATE = g.founded; FOUNDED_YEAR = new Date(g.founded + 'T00:00:00').getFullYear(); }
      if (g.pdf_name) PDF_NAME = g.pdf_name;
      return g;
    }).catch(function () { return {}; });
  }
  // 호수: (설립연도 기준 주년)-(그 해 주차). 예: 1964설립·2026-07-05 → 62-27
  function bulletinNo(bd) { if (!bd) return ''; var y = new Date(bd + 'T00:00:00').getFullYear(); return (y - FOUNDED_YEAR) + '-' + weekNoOfYear(bd); }
  // 주보 PDF 파일명: {date}=YYYYMMDD, {no}=호수, {week}=주차
  function bulletinFileName(rec) {
    rec = rec || {}; var d = rec.data || {};
    var ds = String(rec.bdate || '').replace(/-/g, '');
    return ((PDF_NAME || '{date} 주보').replace(/\{date\}/g, ds).replace(/\{no\}/g, d.no || '').replace(/\{week\}/g, d.week || '').replace(/\s+/g, ' ').trim()) || ('주보 ' + ds);
  }
  // 주차 라벨: "7월 첫째 주"
  function bulletinWeekLabel(bd) {
    if (!bd) return ''; var d = new Date(bd + 'T00:00:00');
    var nth = Math.floor((d.getDate() - 1) / 7) + 1;
    var ord = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째'][nth - 1] || (nth + '');
    return (d.getMonth() + 1) + '월 ' + ord + ' 주';
  }
  function ymOf(bd) { return String(bd || '').slice(0, 7); }
  function nextMonthYM(bd) { var d = new Date(bd + 'T00:00:00'); d.setMonth(d.getMonth() + 1); return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }
  // 그 달의 마지막 주일인가(다음 일요일이 다음 달이면 마지막 주일)
  function isLastSundayOfMonth(bd) { return new Date(addDays(bd, 7) + 'T00:00:00').getMonth() !== new Date(bd + 'T00:00:00').getMonth(); }

  // 연간 봉사위원 설정 캐시 (설정 탭에서 저장, 주보에서 사용)
  var COMMITTEES = null; // [{month:'2026-07', offering, guide, parking}]
  function loadCommittees() {
    return api('GET', 'church_settings?key=eq.committees&select=data').then(function (rows) {
      COMMITTEES = (rows && rows[0] && rows[0].data && rows[0].data.months) || [];
      return COMMITTEES;
    }).catch(function () { COMMITTEES = []; return COMMITTEES; });
  }
  function committeeFor(ym) { if (!COMMITTEES) return null; for (var i = 0; i < COMMITTEES.length; i++) if (COMMITTEES[i].month === ym) return COMMITTEES[i]; return null; }

  function renderBulletinAdmin(panel) {
    panel.innerHTML =
      '<div class="fin-card"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
      '<div><h3 style="margin:0 0 4px;color:var(--accent,#223350)">주보 제작</h3><p style="margin:0;color:var(--ink-soft,#7b8794);font-size:.9rem">설교목록에서 <b>다음 주 설교</b>를 불러와 채우고, <b>게시</b>하면 홈페이지 주보란에 자동 반영됩니다. (인쇄는 금액 포함, 홈페이지는 금액 제외)</p></div>' +
      '<button class="btn btn-solid" id="bt_new" style="white-space:nowrap">🖨 주보 제작</button></div></div>' +
      '<div id="bt_list"><p class="qt-loading">불러오는 중…</p></div>';
    panel.querySelector('#bt_new').onclick = function () { bulletinEditor({}); };
    loadBulletinList(panel);
  }
  function loadBulletinList(panel) {
    api('GET', 'bulletins?select=id,bdate,title,scripture,preacher,published,updated_at&order=bdate.desc').then(function (rows) {
      var box = panel.querySelector('#bt_list');
      if (!rows || !rows.length) { box.innerHTML = '<div class="fin-card"><p style="margin:0;color:var(--ink-soft)">아직 제작한 주보가 없습니다. <b>주보 제작</b>으로 시작하세요.</p></div>'; return; }
      box.innerHTML = '<div class="fin-card"><div style="overflow:auto"><table class="fin-table"><thead><tr><th>주일</th><th>제목</th><th>본문</th><th>게시</th><th>관리</th></tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr><td style="white-space:nowrap">' + esc(fmtD(r.bdate)) + '</td><td><b>' + esc(r.title || '(제목없음)') + '</b></td><td style="white-space:nowrap">' + esc(r.scripture || '') + '</td>' +
            '<td>' + (r.published ? '<span class="fin-pill" style="background:#e6f4ea;color:#1e874b">게시중</span>' : '<span class="fin-pill">비공개</span>') + '</td>' +
            '<td style="white-space:nowrap"><button class="btn btn-line bt-edit" data-id="' + esc(r.id) + '" style="padding:4px 10px;font-size:.78rem">수정</button> <button class="btn btn-line bt-print" data-id="' + esc(r.id) + '" style="padding:4px 10px;font-size:.78rem">🖨 인쇄</button> <button class="btn btn-line bt-del" data-id="' + esc(r.id) + '" style="padding:4px 9px;font-size:.78rem;color:#c0392b">삭제</button></td></tr>';
        }).join('') + '</tbody></table></div></div>';
      var byId = {}; rows.forEach(function (r) { byId[r.id] = r; });
      Array.prototype.forEach.call(box.querySelectorAll('.bt-edit'), function (b) { b.onclick = function () { api('GET', 'bulletins?id=eq.' + b.dataset.id + '&select=*').then(function (rs) { bulletinEditor((rs && rs[0]) || {}); }); }; });
      Array.prototype.forEach.call(box.querySelectorAll('.bt-print'), function (b) {
        b.onclick = function () {
          var w = window.open('', '_blank'); // 클릭 즉시 동기 오픈(팝업 차단 회피)
          api('GET', 'bulletins?id=eq.' + b.dataset.id + '&select=*').then(function (rs) {
            var rec = (rs && rs[0]) || {};
            if (w && window.BulletinRender) { w.document.write(window.BulletinRender.html(rec, { amounts: true, layout: 'print3', fileName: bulletinFileName(rec) })); w.document.close(); w.focus(); }
            else if (w) { w.close(); alert('주보 렌더러를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.'); }
          }).catch(function (e) { if (w) w.close(); alert('불러오기 실패: ' + e.message); });
        };
      });
      Array.prototype.forEach.call(box.querySelectorAll('.bt-del'), function (b) { b.onclick = function () { if (!confirm('이 주보를 삭제할까요?')) return; api('DELETE', 'bulletins?id=eq.' + b.dataset.id, null, 'return=minimal').then(function () { loadBulletinList(panel); }).catch(function (e) { alert('삭제 실패: ' + e.message); }); }; });
    }).catch(function (e) {
      var box = panel.querySelector('#bt_list');
      if (/42P01|PGRST205|does not exist|schema cache|Could not find the table/i.test(e.message)) box.innerHTML = msgCard('테이블 준비 필요', 'Supabase → SQL Editor 에서 supabase/bulletins.sql 을 1회 실행해 주세요.');
      else box.innerHTML = msgCard('조회 실패', e.message);
    });
  }

  function bulletinEditor(rec) {
    rec = rec || {}; var d = rec.data || {};
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:#f5f7fa;z-index:9000;overflow:auto';
    var bd0 = fmtD(rec.bdate) || nextSunday();
    var order = (d.order && d.order.length) ? d.order : BULLETIN_PRESET.map(function (n) { return { name: n, detail: '' }; });
    function tA(label, id, val, ph, h) { return '<div class="af-field" style="margin-bottom:10px"><label>' + label + '</label><textarea id="' + id + '" placeholder="' + esc(ph || '') + '" style="min-height:' + (h || 60) + 'px">' + esc(val || '') + '</textarea></div>'; }
    function tI(label, id, val, ph) { return '<div class="af-field"><label>' + label + '</label><input type="text" id="' + id + '" value="' + esc(val || '') + '" placeholder="' + esc(ph || '') + '"></div>'; }
    var off = d.offering || {}, amt = d.offering_amounts || {}, com = d.committee || {};
    ov.innerHTML =
      '<header style="position:sticky;top:0;z-index:6;background:linear-gradient(180deg,#fff,#f7f9fc);border-bottom:1px solid #e1e6ef;box-shadow:0 2px 10px rgba(34,51,80,.06)">' +
      '<div style="max-width:1100px;margin:0 auto;padding:11px 20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">' +
      '<button class="btn btn-line" id="bt_close" style="padding:8px 14px;border-radius:9px">‹ 닫기</button>' +
      '<div style="flex:1;text-align:center"><div style="font-family:\'Noto Serif KR\',serif;font-weight:700;font-size:1.2rem;color:var(--accent,#223350)">주보 제작</div><div style="font-size:.72rem;color:#9aa5b1">설교 연동 · 인쇄(PDF) · 홈페이지 게시</div></div>' +
      '<button class="btn btn-line" id="bt_pull" style="padding:8px 13px;border-radius:9px;background:#eef4ff;border-color:#9cc0f0">📥 데이터 불러오기</button>' +
      '<button class="btn btn-line" id="bt_ai" style="padding:8px 13px;border-radius:9px;background:#f3eefc;border-color:#c4a8ee">✨ AI 검수</button>' +
      '<button class="btn btn-line" id="bt_save" style="padding:8px 13px;border-radius:9px">💾 임시저장</button>' +
      '<button class="btn btn-line" id="bt_printbtn" style="padding:8px 13px;border-radius:9px">🖨 3단 인쇄(PDF)</button>' +
      '<button class="btn btn-solid" id="bt_publish" style="padding:8px 16px;border-radius:9px;font-weight:700">🌐 게시</button>' +
      '<div id="bt_msg" class="fin-msg" style="flex-basis:100%;text-align:right;margin-top:-2px"></div>' +
      '</div></header>' +
      '<div style="max-width:1100px;margin:0 auto;padding:20px 18px 70px">' +
      // 기본
      '<div class="fin-card"><h4 style="margin:0 0 10px;color:var(--accent)">① 기본 정보</h4>' +
      '<div class="fin-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">' +
      '<div class="af-field"><label>주일 날짜</label><input type="date" id="bt_bdate" value="' + esc(bd0) + '"></div>' +
      tI('호수(No.) <span style="font-weight:400;font-size:.72rem;color:#9aa5b1">날짜 선택 시 자동</span>', 'bt_no', d.no || bulletinNo(bd0), '예: 62-27') +
      tI('주차 <span style="font-weight:400;font-size:.72rem;color:#9aa5b1">자동</span>', 'bt_week', d.week || bulletinWeekLabel(bd0), '예: 7월 첫째 주') +
      '</div></div>' +
      // 주일 낮 예배
      '<div class="fin-card"><h4 style="margin:0 0 10px;color:var(--accent)">② 주일 낮 예배</h4>' +
      '<div class="fin-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:12px">' +
      tI('설교 제목', 'bt_title', rec.title) + tI('본문', 'bt_scripture', rec.scripture, '예: 나훔 2:8-13') + tI('설교자', 'bt_preacher', rec.preacher || '손병민 담임목사') +
      '</div>' +
      '<div class="af-field" style="margin-bottom:12px"><label>📜 표지 말씀 헤드라인 <button type="button" id="bt_headline_ai" class="btn btn-line" style="padding:2px 10px;font-size:.74rem;background:#f3eefc;border-color:#c4a8ee;margin-left:4px">✨ 자동</button> <span style="font-weight:400;font-size:.72rem;color:#9aa5b1">1면 표지에 크게 들어갈 대표 말씀</span></label>' +
      '<textarea id="bt_headline" placeholder="✨ 자동을 누르면 그 주 설교 본문에서 대표 말씀을 뽑아 채웁니다." style="min-height:64px;line-height:1.6;font-family:\'Noto Serif KR\',serif">' + esc(d.headline || '') + '</textarea></div>' +
      '<label style="font-size:.82rem;color:#7b8794;display:block;margin-bottom:6px">예배 순서 <span style="font-weight:400">(순서명 · 내용/담당) — 데이터 불러오기 시 자동 채워집니다</span></label>' +
      '<div id="bt_order"></div></div>' +
      // 주중 예배
      '<div class="fin-card"><h4 style="margin:0 0 10px;color:var(--accent)">③ 주중 · 새벽 · QT</h4>' +
      '<div class="fin-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      '<div>' + tI('수요기도회 — 강해 시리즈', 'bt_wed_series', d.wed_series, '예: 레위기 강해(1)') + '</div>' +
      '<div>' + tI('수요기도회 — 제목', 'bt_wed_title', d.wed_title, '예: 레위기란 어떤 책인가?') + '</div>' +
      '</div>' +
      tI('수요기도회 — 날짜·본문·설교자 <span style="font-weight:400;font-size:.72rem;color:#9aa5b1">날짜 자동(그 주 수요일)</span>', 'bt_wed_line', d.wed_dateline, '예: 2026. 07. 01 · 에베소서 1장 · 손병민 담임목사') +
      '<div class="fin-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px">' +
      '<div>' + tI('새벽기도회 본문', 'bt_dawn', d.dawn, '예: 나훔, 시편 강해') + '</div>' +
      '<div>' + tI('매일 QT 본문', 'bt_qt', d.qt, '예: 나훔 3장, 시편107편~109편') + '</div>' +
      '</div></div>' +
      // 향기로운 예물 + 헌금 금액(통합 동적 표 — 특별헌금 등 자유 추가)
      '<div class="fin-card"><h4 style="margin:0 0 4px;color:var(--accent)">④ 향기로운 예물 · 헌금</h4>' +
      '<p style="margin:0 0 10px;font-size:.8rem;color:#9aa5b1">항목을 자유롭게 추가할 수 있습니다(특별헌금·추수감사·맥추감사 등). <b>명단</b>은 홈페이지에도 공개되고, <b>금액</b>은 🔒 인쇄(PDF)에만 표시됩니다. — 데이터 불러오기 시 직전 주일 헌금이 항목별로 채워집니다.</p>' +
      '<div id="bt_offer"></div></div>' +
      // 봉사위원
      '<div class="fin-card"><h4 style="margin:0 0 10px;color:var(--accent)">⑥ 봉사위원 · 다음 주 기도 <span style="font-weight:400;font-size:.72rem;color:#9aa5b1">이번 주 기도자는 예배 순서 \'기도\'에 자동</span></h4>' +
      '<div class="fin-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      COMMITTEE_KEYS.map(function (k, i) { return tI(k, 'bt_com_' + i, com[k]); }).join('') +
      '</div></div>' +
      // 칼럼
      '<div class="fin-card"><h4 style="margin:0 0 10px;color:var(--accent);display:flex;align-items:center;gap:8px;flex-wrap:wrap">⑦ 신앙과 책 (칼럼) <button type="button" class="btn btn-line" id="bt_col_pick" style="padding:4px 11px;font-size:.76rem;font-weight:600">🔍 예화 클립에서 가져오기</button></h4>' +
      tI('제목/출처', 'bt_col_title', d.column_title, '예: 김다위, 「하나님 마음에 맞는 사람」 (두란노)') +
      tA('본문', 'bt_col_body', d.column_body, '칼럼 내용…', 140) + '</div>' +
      // 광고
      '<div class="fin-card"><h4 style="margin:0 0 10px;color:var(--accent)">⑧ 한 주의 소식 (광고)</h4>' +
      tA('소식 (한 줄에 하나씩)', 'bt_notices', d.notices, '다음 주는 맥추감사주일로 지킵니다.\n학습세례 문답 및 성찬 예식이 있습니다.', 140) + '</div>' +
      '</div>';
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    function close() { ov.remove(); document.body.style.overflow = ''; }
    ov.querySelector('#bt_close').onclick = close;
    function bmsg(t, c) { var e = ov.querySelector('#bt_msg'); e.style.color = c || '#7b8794'; e.textContent = t; }
    // ⑦ 신앙과 책: 예화 클립에서 검색해 바로 삽입(제목/출처+본문)
    var colPick = ov.querySelector('#bt_col_pick');
    if (colPick) colPick.onclick = function () {
      illustrationsModal({ pickLabel: '이 책으로 넣기', onPick: function (r) {
        var t = ov.querySelector('#bt_col_title'), b = ov.querySelector('#bt_col_body');
        if (t) t.value = r.source || illusBookLine(r) || (r.title || '');
        if (b) b.value = r.content || '';
        bmsg('✓ 예화 클립을 신앙과 책에 넣었습니다.', 'green');
      } });
    };

    // 수요기도회 날짜(그 주 수요일 = 주일+3) 자동 입력. 본문·설교자는 뒤에 유지
    function wedDateStr(bd) { var d = new Date(addDays(bd, 3) + 'T00:00:00'); return d.getFullYear() + '. ' + pad2(d.getMonth() + 1) + '. ' + pad2(d.getDate()); }
    function setWedDate(bd) {
      var el = ov.querySelector('#bt_wed_line'); if (!el) return;
      var dt = wedDateStr(bd), cur = el.value;
      var re = /^\s*\d{4}\s*[.\-]\s*\d{1,2}\s*[.\-]\s*\d{1,2}\s*\.?/;
      if (re.test(cur)) el.value = cur.replace(re, dt);            // 앞 날짜만 교체
      else if (!cur.trim()) el.value = dt + ' · ';                  // 비었으면 날짜+구분자
      else el.value = dt + ' · ' + cur;                            // 본문/설교자만 있으면 앞에 날짜
    }
    // 주일 날짜 선택 → 호수·주차·수요일 날짜 자동 갱신
    ov.querySelector('#bt_bdate').addEventListener('change', function () {
      var bd = this.value; if (!bd) return;
      ov.querySelector('#bt_no').value = bulletinNo(bd);
      ov.querySelector('#bt_week').value = bulletinWeekLabel(bd);
      setWedDate(bd);
    });
    if (!rec.id && !(d && d.wed_dateline)) setWedDate(bd0); // 신규 작성 시 기본 채움
    // 설립일(호수 주년 기준)이 아직 로드 전이면 로드 후 호수 보정(사용자가 비워둔 경우만)
    loadGeneral().then(function () {
      var bd = ov.querySelector('#bt_bdate').value;
      if (bd && !(d && d.no)) ov.querySelector('#bt_no').value = bulletinNo(bd);
    });

    // 예배 순서 편집
    var oBox = ov.querySelector('#bt_order');
    function renderBOrder() {
      oBox.innerHTML = order.map(function (it, i) {
        return '<div class="bo-row" style="display:flex;gap:7px;align-items:center;margin-bottom:6px">' +
          '<span style="flex:0 0 18px;text-align:center;color:#9aa5b1;font-size:.78rem">' + (i + 1) + '</span>' +
          '<input type="text" class="bo-name" data-i="' + i + '" value="' + esc(it.name || '') + '" placeholder="순서명" style="flex:0 0 130px;padding:6px 8px;border:1px solid #dfe5ee;border-radius:7px;font:inherit;font-size:.85rem">' +
          '<input type="text" class="bo-detail" data-i="' + i + '" value="' + esc(it.detail || '') + '" placeholder="내용/담당 (예: 79장, 김애자 권사)" style="flex:1;padding:6px 8px;border:1px solid #dfe5ee;border-radius:7px;font:inherit;font-size:.85rem">' +
          '<button type="button" class="bo-del" data-i="' + i + '" style="border:0;background:none;color:#c0392b;cursor:pointer">✕</button></div>';
      }).join('') + '<button type="button" class="btn btn-line" id="bo_add" style="padding:5px 12px;font-size:.8rem;margin-top:4px">＋ 순서 추가</button>';
      Array.prototype.forEach.call(oBox.querySelectorAll('.bo-name'), function (inp) { inp.oninput = function () { order[Number(inp.dataset.i)].name = inp.value; }; });
      Array.prototype.forEach.call(oBox.querySelectorAll('.bo-detail'), function (inp) { inp.oninput = function () { order[Number(inp.dataset.i)].detail = inp.value; }; });
      Array.prototype.forEach.call(oBox.querySelectorAll('.bo-del'), function (b) { b.onclick = function () { order.splice(Number(b.dataset.i), 1); renderBOrder(); }; });
      oBox.querySelector('#bo_add').onclick = function () { order.push({ name: '', detail: '' }); renderBOrder(); };
    }
    renderBOrder();

    // ── 헌금(향기로운 예물 명단 + 금액) 동적 표 — 특별헌금 등 자유 추가 ──
    var OFFER_BASE = ['십일조', '감사헌금', '주일헌금', '생일감사', '건축헌금', '선교헌금', '유년부', '차량헌금', '일천번기도'];
    var coffer = (function () {
      var names = [], idx = {};
      function add(n) { if (n && !idx[n]) { idx[n] = 1; names.push(n); } }
      OFFER_BASE.forEach(add);
      Object.keys(off).forEach(add);
      Object.keys(amt).forEach(function (k) { if (k !== '합계') add(k); });
      return names.map(function (n) { return { name: n, givers: off[n] || '', amount: amt[n] || '' }; });
    })();
    function numAmt(v) { return Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0; }
    function commaAmt(v) { var n = numAmt(v); return n ? n.toLocaleString('en-US') : ''; }
    var ofBox = ov.querySelector('#bt_offer');
    function renderOffer() {
      var total = coffer.reduce(function (s, r) { return s + numAmt(r.amount); }, 0);
      ofBox.innerHTML = '<div style="overflow:auto"><table class="fin-table" style="table-layout:fixed;width:100%;min-width:560px">' +
        '<colgroup><col style="width:22%"><col style="width:48%"><col style="width:24%"><col style="width:6%"></colgroup>' +
        '<thead><tr><th>항목</th><th>헌금자 명단 <span style="font-weight:400;color:#9aa5b1;font-size:.72rem">(공개)</span></th><th>금액 <span style="font-weight:400;color:#8a6d1f;font-size:.72rem">🔒</span></th><th></th></tr></thead><tbody>' +
        coffer.map(function (r, i) {
          return '<tr>' +
            '<td><input type="text" class="of-name" data-i="' + i + '" value="' + esc(r.name || '') + '" placeholder="예: 특별헌금" style="width:100%;padding:5px 7px;border:1px solid #dfe5ee;border-radius:7px;font:inherit;font-size:.84rem;font-weight:600;color:#34415c;box-sizing:border-box"></td>' +
            '<td><input type="text" class="of-givers" data-i="' + i + '" value="' + esc(r.givers || '') + '" placeholder="이름 이름 이름" title="' + esc(r.givers || '') + '" style="width:100%;padding:5px 7px;border:1px solid #dfe5ee;border-radius:7px;font:inherit;font-size:.84rem;box-sizing:border-box"></td>' +
            '<td><input type="text" class="of-amount" data-i="' + i + '" value="' + esc(r.amount || '') + '" placeholder="0" inputmode="numeric" style="width:100%;padding:5px 7px;border:1px solid #dfe5ee;border-radius:7px;font:inherit;font-size:.84rem;text-align:right;box-sizing:border-box"></td>' +
            '<td style="text-align:center"><button type="button" class="of-del" data-i="' + i + '" style="border:0;background:none;color:#c0392b;cursor:pointer">✕</button></td></tr>';
        }).join('') +
        '<tr style="background:#faf6ea"><td style="font-weight:700;color:#8a6d1f">합계</td><td></td><td style="text-align:right;font-weight:700">' + (total ? total.toLocaleString('en-US') + ' 원' : '') + '</td><td></td></tr>' +
        '</tbody></table></div>' +
        '<button type="button" class="btn btn-line" id="of_add" style="padding:5px 12px;font-size:.8rem;margin-top:8px">＋ 헌금 항목 추가</button>';
      Array.prototype.forEach.call(ofBox.querySelectorAll('.of-name'), function (inp) { inp.oninput = function () { coffer[Number(inp.dataset.i)].name = inp.value; }; });
      Array.prototype.forEach.call(ofBox.querySelectorAll('.of-givers'), function (inp) { inp.oninput = function () { coffer[Number(inp.dataset.i)].givers = inp.value; }; });
      Array.prototype.forEach.call(ofBox.querySelectorAll('.of-amount'), function (inp) {
        inp.oninput = function () { coffer[Number(inp.dataset.i)].amount = inp.value; };
        inp.onblur = function () { var i = Number(inp.dataset.i); coffer[i].amount = commaAmt(inp.value); renderOffer(); };
      });
      Array.prototype.forEach.call(ofBox.querySelectorAll('.of-del'), function (b) { b.onclick = function () { coffer.splice(Number(b.dataset.i), 1); renderOffer(); }; });
      ofBox.querySelector('#of_add').onclick = function () { coffer.push({ name: '', givers: '', amount: '' }); renderOffer(); var ins = ofBox.querySelectorAll('.of-name'); if (ins.length) ins[ins.length - 1].focus(); };
    }
    renderOffer();

    function gather() {
      var data = {
        no: ov.querySelector('#bt_no').value.trim(), week: ov.querySelector('#bt_week').value.trim(),
        order: order.filter(function (o) { return o.name || o.detail; }),
        wed_series: ov.querySelector('#bt_wed_series').value.trim(), wed_title: ov.querySelector('#bt_wed_title').value.trim(), wed_dateline: ov.querySelector('#bt_wed_line').value.trim(),
        dawn: ov.querySelector('#bt_dawn').value.trim(), qt: ov.querySelector('#bt_qt').value.trim(),
        offering: {}, offering_amounts: {}, committee: {},
        column_title: ov.querySelector('#bt_col_title').value.trim(), column_body: ov.querySelector('#bt_col_body').value,
        notices: ov.querySelector('#bt_notices').value,
        headline: ov.querySelector('#bt_headline').value.trim(),
        founded: FOUNDED_DATE
      };
      var tot = 0;
      coffer.forEach(function (r) {
        var nm = (r.name || '').trim(); if (!nm) return;
        if (r.givers && r.givers.trim()) data.offering[nm] = r.givers.trim();
        var a = numAmt(r.amount); if (a) { data.offering_amounts[nm] = commaAmt(r.amount); tot += a; }
      });
      if (tot) data.offering_amounts['합계'] = tot.toLocaleString('en-US');
      COMMITTEE_KEYS.forEach(function (k, i) { var el = ov.querySelector('#bt_com_' + i); if (el) data.committee[k] = el.value.trim(); });
      return {
        bdate: ov.querySelector('#bt_bdate').value || null,
        title: ov.querySelector('#bt_title').value.trim() || null,
        scripture: ov.querySelector('#bt_scripture').value.trim() || null,
        preacher: ov.querySelector('#bt_preacher').value.trim() || null,
        data: data
      };
    }
    function save(then, extra) {
      var payload = gather();
      if (extra) for (var k in extra) payload[k] = extra[k];
      if (!payload.bdate) { bmsg('주일 날짜는 필수입니다.', '#c0392b'); return; }
      payload.updated_at = new Date().toISOString();
      bmsg('저장 중…');
      var p = rec.id ? api('PATCH', 'bulletins?id=eq.' + rec.id, payload, 'return=representation') : api('POST', 'bulletins?on_conflict=bdate', payload, 'resolution=merge-duplicates,return=representation');
      p.then(function (rows) { var saved = (rows && rows[0]) || payload; if (rows && rows[0]) { rec.id = rows[0].id; rec.published = rows[0].published; } bmsg('✓ 저장되었습니다', 'green'); if (then) then(saved); })
        .catch(function (e) { if (/42P01|PGRST205|does not exist|schema cache/i.test(e.message)) bmsg('bulletins.sql 실행 필요', '#c0392b'); else bmsg('저장 실패: ' + e.message, '#c0392b'); });
    }
    ov.querySelector('#bt_save').onclick = function () { save(null); };
    ov.querySelector('#bt_printbtn').onclick = function () {
      // 새 창을 클릭 즉시 동기로 열어 팝업 차단을 피하고, 생성 오류는 창/메시지에 노출
      var w = window.open('', '_blank');
      if (!w) { bmsg('팝업이 차단되었습니다. 브라우저에서 팝업을 허용해 주세요.', '#c0392b'); return; }
      try {
        var data = gather();
        if (!window.BulletinRender) { w.document.write('주보 렌더러(bulletin-render.js)가 로드되지 않았습니다. 새로고침 후 다시 시도해 주세요.'); w.document.close(); return; }
        w.document.write(window.BulletinRender.html(data, { amounts: true, layout: 'print3', fileName: bulletinFileName(data) }));
        w.document.close(); w.focus();
        save(null);
      } catch (e) {
        try { w.document.write('<pre style="white-space:pre-wrap;padding:16px;font-size:14px">인쇄 생성 오류:\n' + (e && e.message) + '</pre>'); w.document.close(); } catch (_) { }
        bmsg('인쇄 생성 오류: ' + (e && e.message), '#c0392b');
      }
    };

    // ── ✨ AI 검수: 주보 초안을 직렬화해 bulletin-ai Edge Function 호출 ──
    function serializeBulletin(p) {
      var d = p.data || {}, L = [];
      L.push('[기본] 주일 ' + (p.bdate || '') + ' · 호수 ' + (d.no || '') + ' · ' + (d.week || ''));
      L.push('[주일 낮 예배] 제목: ' + (p.title || '(없음)') + ' / 본문: ' + (p.scripture || '(없음)') + ' / 설교자: ' + (p.preacher || '(없음)'));
      L.push('예배 순서: ' + (d.order || []).map(function (o, i) { return (i + 1) + '.' + (o.name || '') + (o.detail ? '(' + o.detail + ')' : ''); }).join(' '));
      L.push('[주중] 수요기도회: ' + [d.wed_series, d.wed_title, d.wed_dateline].filter(Boolean).join(' · '));
      L.push('새벽기도회: ' + (d.dawn || '') + ' / 매일 QT: ' + (d.qt || ''));
      var offs = Object.keys(d.offering || {}).map(function (k) { return k + '(' + d.offering[k] + ')'; });
      if (offs.length) L.push('[향기로운 예물] ' + offs.join(' / '));
      var amts = Object.keys(d.offering_amounts || {}).map(function (k) { return k + ':' + d.offering_amounts[k]; });
      if (amts.length) L.push('[헌금 금액(내부)] ' + amts.join(' / '));
      var coms = Object.keys(d.committee || {}).filter(function (k) { return d.committee[k]; }).map(function (k) { return k + ':' + d.committee[k]; });
      if (coms.length) L.push('[봉사위원] ' + coms.join(' / '));
      if (d.column_title || d.column_body) L.push('[칼럼] ' + (d.column_title || '') + '\n' + (d.column_body || ''));
      if (d.notices) L.push('[광고]\n' + d.notices);
      return L.join('\n');
    }
    function aiPanel() {
      var ai = document.createElement('div');
      ai.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9600;display:flex;align-items:center;justify-content:center;padding:16px';
      ai.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:760px;width:100%;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3)">' +
        '<div style="display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #eef1f5">' +
        '<b style="font-size:1.05rem;color:#5b34a8">✨ AI 주보 검수</b>' +
        '<span style="font-size:.74rem;color:#9aa5b1">헤드라인 제안 · 실수/누락 · 철자 · 특수상황</span>' +
        '<button id="ai_close" class="btn btn-line" style="margin-left:auto;padding:5px 12px">닫기</button></div>' +
        '<div id="ai_body" style="padding:18px 20px;overflow:auto;line-height:1.75;font-size:.95rem;white-space:pre-wrap;word-break:break-word"></div></div>';
      document.body.appendChild(ai);
      ai.querySelector('#ai_close').onclick = function () { ai.remove(); };
      ai.addEventListener('click', function (e) { if (e.target === ai) ai.remove(); });
      return ai.querySelector('#ai_body');
    }
    function mdLite(t) {
      return esc(t)
        .replace(/^\s*##\s*(.+)$/gm, '<div style="font-weight:700;color:#5b34a8;margin:14px 0 6px;font-size:1rem">$1</div>')
        .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
        .replace(/\n/g, '<br>');
    }
    ov.querySelector('#bt_ai').onclick = function () {
      var s = sess(); if (!s || !s.token) { bmsg('로그인이 필요합니다.', '#c0392b'); return; }
      var bodyEl = aiPanel();
      bodyEl.innerHTML = '<p style="color:#7b8794">AI가 주보를 검토하는 중입니다… (10~20초)</p>';
      fetch(SB.replace(/\/$/, '') + '/functions/v1/bulletin-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.token, 'apikey': AK },
        body: JSON.stringify({ content: serializeBulletin(gather()) })
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (o) {
          if (!o.ok) { bodyEl.innerHTML = '<p style="color:#c0392b">' + esc((o.j && o.j.error) || '검수에 실패했습니다.') + '</p>' + ((o.j && o.j.detail) ? '<p style="font-size:.8rem;color:#9aa5b1">' + esc(o.j.detail) + '</p>' : '') + '<p style="font-size:.82rem;color:#9aa5b1;margin-top:10px">※ bulletin-ai Edge Function 배포가 필요할 수 있습니다.</p>'; return; }
          bodyEl.innerHTML = mdLite((o.j && o.j.result) || '결과가 비어 있습니다.');
        })
        .catch(function (e) { bodyEl.innerHTML = '<p style="color:#c0392b">호출 실패: ' + esc(e.message) + '</p><p style="font-size:.82rem;color:#9aa5b1;margin-top:10px">※ Supabase에 bulletin-ai Edge Function을 배포해 주세요.</p>'; });
    };

    // ── 📜 표지 말씀 헤드라인 자동: 그 주 주일 설교(본문·성경 원문)로 대표 말씀 생성 ──
    ov.querySelector('#bt_headline_ai').onclick = function () {
      var s = sess(); if (!s || !s.token) { bmsg('로그인이 필요합니다.', '#c0392b'); return; }
      var bd = ov.querySelector('#bt_bdate').value; if (!bd) { bmsg('주일 날짜를 먼저 선택하세요.', '#c0392b'); return; }
      var btn = ov.querySelector('#bt_headline_ai'); btn.disabled = true; btn.textContent = '✨ 생성 중…';
      function done(t) { btn.disabled = false; btn.textContent = '✨ 자동'; if (t) bmsg(t, '#c0392b'); }
      // 그 주(주일~토) 주일 낮 예배 설교에서 본문·성경원문·요약 확보
      api('GET', 'sermons?select=title,scripture,bible_text,content,service&sermon_date=gte.' + bd + '&sermon_date=lte.' + addDays(bd, 6) + '&order=sermon_date.asc').then(function (rows) {
        rows = rows || [];
        var sun = null; for (var i = 0; i < rows.length; i++) if (rows[i].service === '주일 낮 예배') { sun = rows[i]; break; }
        var title = (sun && sun.title) || ov.querySelector('#bt_title').value || '';
        var scripture = (sun && sun.scripture) || ov.querySelector('#bt_scripture').value || '';
        var bible = (sun && sun.bible_text) || '';
        var summary = (sun && sun.content) ? String(sun.content).slice(0, 1500) : '';
        var content = '설교 제목: ' + title + '\n본문: ' + scripture + '\n\n[성경 본문 원문]\n' + (bible || '(없음)') + '\n\n[설교 요약]\n' + (summary || '(없음)');
        return fetch(SB.replace(/\/$/, '') + '/functions/v1/bulletin-ai', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.token, 'apikey': AK },
          body: JSON.stringify({ mode: 'headline', content: content })
        });
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (o) {
          if (!o.ok) { done(((o.j && o.j.error) || '생성 실패') + (o.j && o.j.detail ? ' (' + o.j.detail + ')' : '')); return; }
          var txt = (o.j && o.j.result || '').trim();
          if (txt) { ov.querySelector('#bt_headline').value = txt; bmsg('✓ 표지 말씀 헤드라인을 생성했습니다', 'green'); }
          done();
        })
        .catch(function (e) { done('생성 실패: ' + e.message + ' (bulletin-ai 배포 필요)'); });
    };
    ov.querySelector('#bt_publish').onclick = function () {
      if (!confirm('이 주보를 홈페이지에 게시할까요?\n(헌금 금액은 홈페이지에 노출되지 않습니다)')) return;
      save(function () { bmsg('✓ 게시되었습니다 — 홈페이지 주보란에 반영됩니다', 'green'); }, { published: true });
    };
    // 봉사위원 자동 채움(설정 → 연간 봉사위원). 마지막 주일이면 다음 달도 병기
    function fillCommittee(bd) {
      var cur = committeeFor(ymOf(bd)); if (!cur) return false;
      function ci(name) { return COMMITTEE_KEYS.indexOf(name); }
      function set(name, val) { var el = ov.querySelector('#bt_com_' + ci(name)); if (el && val) el.value = val; }
      var nextTxt = '';
      if (isLastSundayOfMonth(bd)) { var nx = committeeFor(nextMonthYM(bd)); if (nx) nextTxt = nx; }
      function merge(a, b) { return b ? (a || '') + (a ? '  /  ' : '') + '(다음 달) ' + b : (a || ''); }
      set('헌금위원', merge(cur.offering, nextTxt && nextTxt.offering));
      set('안내위원', merge(cur.guide, nextTxt && nextTxt.guide));
      set('주차·사찰', merge(cur.parking, nextTxt && nextTxt.parking));
      // 기도자(2부 예배 기도): 이번 주 → 예배 순서 '기도' 항목 / 다음 주 → ⑥ '다음 주 기도'
      function prayerOf(arr, n) { if (!arr) return null; for (var i = 0; i < arr.length; i++) { if ((arr[i].week || '').indexOf(n + '주') >= 0) return arr[i]; } return null; }
      var nth = Math.floor((new Date(bd + 'T00:00:00').getDate() - 1) / 7) + 1;
      var thisPr = prayerOf(cur.prayer, nth);
      var nextPr;
      if (isLastSundayOfMonth(bd)) { var nxc = committeeFor(nextMonthYM(bd)); nextPr = nxc ? prayerOf(nxc.prayer, 1) : null; }
      else nextPr = prayerOf(cur.prayer, nth + 1);
      // 이번 주 기도자 → 예배 순서에서 라벨이 '기도'인 첫 항목의 내용/담당
      if (thisPr && thisPr.person) {
        for (var oi = 0; oi < order.length; oi++) { if (order[oi].label === '기도') { order[oi].detail = thisPr.person; break; } }
        renderBOrder();
      }
      // 다음 주 기도자 → ⑥ 봉사위원 '다음 주 기도'
      set('다음 주 기도', nextPr ? nextPr.person : '');
      return true;
    }
    // 헌금 집계(Supabase offerings) → 동적 헌금 표(coffer)에 항목별 반영. 특별헌금 등은 자동 추가
    function fillOfferings(rows) {
      if (!rows) return false;
      var byCat = {};
      rows.forEach(function (r) {
        var c = (r.category || '기타').trim();
        if (!byCat[c]) byCat[c] = { givers: [], sum: 0 };
        if (r.giver && r.giver.trim()) byCat[c].givers.push(r.giver.trim());
        byCat[c].sum += Number(r.amount) || 0;
      });
      var ALIAS = { '일천번제': '일천번기도', '일천번기도': '일천번제' };
      Object.keys(byCat).forEach(function (cat) {
        var b = byCat[cat], row = null;
        for (var i = 0; i < coffer.length; i++) { if (coffer[i].name === cat || ALIAS[coffer[i].name] === cat) { row = coffer[i]; break; } }
        if (!row) { row = { name: cat, givers: '', amount: '' }; coffer.push(row); }
        row.givers = b.givers.join(' ');
        row.amount = b.sum ? b.sum.toLocaleString('en-US') : '';
      });
      renderOffer();
      return rows.length > 0;
    }
    // 데이터 불러오기: 설교(주일/수요/새벽/QT) + 봉사위원(설정) + 헌금(Supabase)
    ov.querySelector('#bt_pull').onclick = function () {
      var bd = ov.querySelector('#bt_bdate').value; if (!bd) { bmsg('주일 날짜를 먼저 선택하세요.', '#c0392b'); return; }
      bmsg('데이터 불러오는 중…');
      var prevSun = addDays(bd, -7); // 지난 주 헌금 = 직전 주일
      var pSerm = api('GET', 'sermons?select=*&sermon_date=gte.' + bd + '&sermon_date=lte.' + addDays(bd, 6) + '&order=sermon_date.asc');
      var pCom = COMMITTEES ? Promise.resolve(COMMITTEES) : loadCommittees();
      var pOff = api('GET', 'offerings?select=category,giver,amount&offer_date=eq.' + prevSun).catch(function () { return null; });
      Promise.all([pSerm, pCom, pOff]).then(function (res) {
        var rows = res[0] || [];
        function pick(svc) { for (var i = 0; i < rows.length; i++) if (rows[i].service === svc) return rows[i]; return null; }
        var sun = pick('주일 낮 예배'), wed = pick('수요기도회'), dawn = pick('새벽기도'), qt = pick('매일 QT');
        var n = 0, parts = [];
        if (sun) {
          if (sun.title) ov.querySelector('#bt_title').value = sun.title;
          if (sun.scripture) ov.querySelector('#bt_scripture').value = sun.scripture;
          if (sun.preacher) ov.querySelector('#bt_preacher').value = sun.preacher;
          var wo = []; try { wo = JSON.parse(sun.worship_order || '[]') || []; } catch (e) { wo = []; }
          if (wo.length) { order = wo.map(function (it) { return { name: it.label || '', detail: it.detail || '' }; }); renderBOrder(); }
          n++;
        }
        if (wed) { if (wed.title) ov.querySelector('#bt_wed_title').value = wed.title; ov.querySelector('#bt_wed_line').value = [fmtD(wed.sermon_date), wed.scripture, wed.preacher].filter(Boolean).join(' · '); n++; }
        if (dawn) { ov.querySelector('#bt_dawn').value = dawn.scripture || dawn.title || ''; n++; }
        if (qt) { ov.querySelector('#bt_qt').value = qt.scripture || qt.title || ''; n++; }
        if (n) parts.push('설교 ' + n + '건');
        if (fillCommittee(bd)) parts.push('봉사위원');
        var offs = res[2];
        if (offs && offs.length) { fillOfferings(offs); parts.push('헌금 ' + offs.length + '건(직전 주일 ' + prevSun + ')'); }
        bmsg(parts.length ? ('✓ ' + parts.join(' · ') + ' 불러옴') + (offs && !offs.length ? ' · 직전 주일(' + prevSun + ') 헌금 없음' : '') : '해당 주/일에 불러올 데이터가 없습니다.', parts.length ? 'green' : '#c0392b');
      }).catch(function (e) { bmsg('불러오기 실패: ' + e.message, '#c0392b'); });
    };
  }

  // 주보 보기/인쇄(새 창) — 공용 렌더러(js/bulletin-render.js) 사용. opts.amounts=true 면 금액 포함
  function bulletinView(rec, opts) {
    opts = opts || {};
    if (!opts.fileName) opts.fileName = bulletinFileName(rec); // PDF 기본 파일명
    if (window.BulletinRender) { window.BulletinRender.open(rec, opts); return; }
    alert('주보 렌더러(bulletin-render.js)가 로드되지 않았습니다. 페이지를 새로고침해 주세요.');
  }

  // 한글(.hwpx) '예배 봉사자' 표 파싱 → 월별 봉사위원
  //   표: c0=월 c1=안내 c2=헌금위원 c3/c4=2부기도(주차) c5=주차·사찰
  function parseBongsaHwpx(xml, filename) {
    function dec(s) { return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); }); }
    var tcs = xml.match(/<hp:tc\b[\s\S]*?<\/hp:tc>/g) || [];
    var grid = {}, maxr = 0;
    tcs.forEach(function (tc) {
      var a = tc.match(/<hp:cellAddr colAddr="(\d+)" rowAddr="(\d+)"/);
      if (!a) return;
      var sp = tc.match(/<hp:cellSpan colSpan="(\d+)" rowSpan="(\d+)"/);
      var col = +a[1], row = +a[2], rs = sp ? +sp[2] : 1;
      var ts = tc.match(/<hp:t>[\s\S]*?<\/hp:t>/g) || [];
      var txt = ts.map(function (t) { return dec(t.replace(/<\/?hp:t>/g, '')).trim(); }).join(' ').replace(/\s+/g, ' ').trim();
      grid[row + ',' + col] = { txt: txt, rs: rs };
      if (row > maxr) maxr = row;
    });
    function cell(r, c) { return grid[r + ',' + c] || { txt: '', rs: 1 }; }
    // 연도: 제목 셀 → 파일명 → 올해
    var ym = (cell(0, 0).txt.match(/(\d{4})/) || (String(filename || '').match(/(\d{4})/)) || [])[1];
    var year = ym || String(new Date().getFullYear());
    var months = [];
    for (var r = 1; r <= maxr; r++) {
      var c0 = cell(r, 0).txt; var mm = c0.match(/(\d{1,2})\s*월/);
      if (!mm) continue;
      var mno = ('0' + mm[1]).slice(-2);
      var rs = cell(r, 0).rs, prayer = [];
      for (var rr = r; rr < r + rs; rr++) { var wk = cell(rr, 3).txt, ps = cell(rr, 4).txt; if (ps) prayer.push({ week: wk, person: ps }); }
      months.push({ month: year + '-' + mno, guide: cell(r, 1).txt, offering: cell(r, 2).txt, parking: cell(r, 5).txt, prayer: prayer });
    }
    return { year: year, months: months };
  }

  // ====================================================================
  //  성경 보기 — 3단 뷰어 (책 → 장 → 본문, 개역개정4판 / 우리말성경)
  // ====================================================================
  var BBLK = [
    [1,'창세기','창',50,'ot'],[2,'출애굽기','출',40,'ot'],[3,'레위기','레',27,'ot'],
    [4,'민수기','민',36,'ot'],[5,'신명기','신',34,'ot'],[6,'여호수아','수',24,'ot'],
    [7,'사사기','삿',21,'ot'],[8,'룻기','룻',4,'ot'],[9,'사무엘상','삼상',31,'ot'],
    [10,'사무엘하','삼하',24,'ot'],[11,'열왕기상','왕상',22,'ot'],[12,'열왕기하','왕하',25,'ot'],
    [13,'역대상','대상',29,'ot'],[14,'역대하','대하',36,'ot'],[15,'에스라','스',10,'ot'],
    [16,'느헤미야','느',13,'ot'],[17,'에스더','에',10,'ot'],[18,'욥기','욥',42,'ot'],
    [19,'시편','시',150,'ot'],[20,'잠언','잠',31,'ot'],[21,'전도서','전',12,'ot'],
    [22,'아가','아',8,'ot'],[23,'이사야','사',66,'ot'],[24,'예레미야','렘',52,'ot'],
    [25,'예레미야애가','애',5,'ot'],[26,'에스겔','겔',48,'ot'],[27,'다니엘','단',12,'ot'],
    [28,'호세아','호',14,'ot'],[29,'요엘','욜',3,'ot'],[30,'아모스','암',9,'ot'],
    [31,'오바댜','옵',1,'ot'],[32,'요나','욘',4,'ot'],[33,'미가','미',7,'ot'],
    [34,'나훔','나',3,'ot'],[35,'하박국','합',3,'ot'],[36,'스바냐','습',3,'ot'],
    [37,'학개','학',2,'ot'],[38,'스가랴','슥',14,'ot'],[39,'말라기','말',4,'ot'],
    [40,'마태복음','마',28,'nt'],[41,'마가복음','막',16,'nt'],[42,'누가복음','눅',24,'nt'],
    [43,'요한복음','요',21,'nt'],[44,'사도행전','행',28,'nt'],[45,'로마서','롬',16,'nt'],
    [46,'고린도전서','고전',16,'nt'],[47,'고린도후서','고후',13,'nt'],[48,'갈라디아서','갈',6,'nt'],
    [49,'에베소서','엡',6,'nt'],[50,'빌립보서','빌',4,'nt'],[51,'골로새서','골',4,'nt'],
    [52,'데살로니가전서','살전',5,'nt'],[53,'데살로니가후서','살후',3,'nt'],[54,'디모데전서','딤전',6,'nt'],
    [55,'디모데후서','딤후',4,'nt'],[56,'디도서','딛',3,'nt'],[57,'빌레몬서','몬',1,'nt'],
    [58,'히브리서','히',13,'nt'],[59,'야고보서','약',5,'nt'],[60,'베드로전서','벧전',5,'nt'],
    [61,'베드로후서','벧후',3,'nt'],[62,'요한일서','요일',5,'nt'],[63,'요한이서','요이',1,'nt'],
    [64,'요한삼서','요삼',1,'nt'],[65,'유다서','유',1,'nt'],[66,'요한계시록','계',22,'nt']
  ];

  function renderBibleViewer(panel) {
    var bvTrans = 'gyr';
    var bvBook  = 1;
    var bvChap  = 1;

    panel.innerHTML =
      '<style>' +
      '.bv-wrap{display:flex;height:calc(100vh - 210px);min-height:500px;border:1px solid #e3e7ee;border-radius:0 0 12px 12px;overflow:hidden;background:#fff}' +
      '.bv-books{width:114px;flex-shrink:0;overflow-y:auto;background:#1a2b4a;padding:6px 5px}' +
      '.bv-sep{font-size:.6rem;color:#6a8aae;padding:7px 2px 3px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}' +
      '.bv-grp{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin-bottom:6px}' +
      '.bv-bb{padding:5px 2px;background:none;border:none;color:#8ea8cc;font-size:.72rem;font-weight:700;cursor:pointer;border-radius:5px;text-align:center;line-height:1.3;word-break:keep-all}' +
      '.bv-bb:hover{background:#2a3f60;color:#c8d8f0}' +
      '.bv-bb.on{background:#3a6db5;color:#fff}' +
      '.bv-chaps{width:50px;flex-shrink:0;overflow-y:auto;background:#f4f7fb;padding:5px 3px;border-right:1px solid #e3e7ee}' +
      '.bv-cb{display:block;width:100%;padding:4px 2px;background:none;border:none;color:#3a4a63;font-size:.8rem;font-weight:600;cursor:pointer;border-radius:4px;text-align:center;margin:1px 0}' +
      '.bv-cb:hover{background:#dde6f5}' +
      '.bv-cb.on{background:#223350;color:#fff}' +
      '.bv-text{flex:1;overflow-y:auto;padding:16px 22px;background:#fdfcf8;font-family:\'Noto Serif KR\',serif}' +
      '.bv-thead{font-size:.86rem;font-weight:700;color:#223350;padding-bottom:10px;border-bottom:1px solid #e8ecf2;margin-bottom:13px;display:flex;justify-content:space-between;align-items:center}' +
      '.bv-verse{margin-bottom:7px;font-size:.99rem;line-height:1.95;color:#1a1a1a}' +
      '.bv-vn{display:inline-block;font-size:.68rem;font-weight:800;color:#3a6db5;min-width:25px;vertical-align:top;margin-top:5px}' +
      '.bv-vt{display:inline}' +
      '.bv-hint{color:#9aa5b1;font-size:.88rem;padding:20px;font-style:italic}' +
      '</style>' +
      '<div style="display:flex;flex-direction:column;gap:0">' +
      '<div style="display:flex;gap:8px;align-items:center;padding:10px 14px;border:1px solid #e3e7ee;border-bottom:none;background:#f8fafc;border-radius:12px 12px 0 0">' +
      '<span style="font-size:.82rem;font-weight:700;color:#3a4a63">번역:</span>' +
      '<button class="bv-trans" data-v="gyr" style="padding:5px 14px;border:none;border-radius:999px;cursor:pointer;font-size:.83rem;font-weight:700;background:#223350;color:#fff">개역개정4판</button>' +
      '<button class="bv-trans" data-v="urm" style="padding:5px 14px;border:none;border-radius:999px;cursor:pointer;font-size:.83rem;font-weight:700;background:#eef2f7;color:#3a4a63">우리말성경</button>' +
      '</div>' +
      '<div class="bv-wrap">' +
      '<div class="bv-books" id="bv_books"></div>' +
      '<div class="bv-chaps" id="bv_chaps"></div>' +
      '<div class="bv-text" id="bv_text"><p class="bv-hint">왼쪽에서 성경책을 선택하세요.</p></div>' +
      '</div></div>';

    var booksEl = panel.querySelector('#bv_books');
    var chapsEl = panel.querySelector('#bv_chaps');
    var textEl  = panel.querySelector('#bv_text');

    function renderBooks() {
      var ot = BBLK.filter(function (b) { return b[4] === 'ot'; });
      var nt = BBLK.filter(function (b) { return b[4] === 'nt'; });
      function grpHTML(list) {
        return '<div class="bv-grp">' +
          list.map(function (b) {
            return '<button class="bv-bb' + (b[0] === bvBook ? ' on' : '') + '" data-n="' + b[0] + '">' + b[2] + '</button>';
          }).join('') + '</div>';
      }
      booksEl.innerHTML =
        '<div class="bv-sep">구약</div>' + grpHTML(ot) +
        '<div class="bv-sep">신약</div>' + grpHTML(nt);
      Array.prototype.forEach.call(booksEl.querySelectorAll('.bv-bb'), function (btn) {
        btn.onclick = function () { selectBook(Number(btn.dataset.n)); };
      });
      var sel = booksEl.querySelector('.bv-bb.on');
      if (sel) sel.scrollIntoView({ block: 'nearest' });
    }

    function renderChaps() {
      var bk = BBLK[bvBook - 1];
      var html = '';
      for (var c = 1; c <= bk[3]; c++) {
        html += '<button class="bv-cb' + (c === bvChap ? ' on' : '') + '" data-c="' + c + '">' + c + '</button>';
      }
      chapsEl.innerHTML = html;
      Array.prototype.forEach.call(chapsEl.querySelectorAll('.bv-cb'), function (btn) {
        btn.onclick = function () { selectChap(Number(btn.dataset.c)); };
      });
      var sel = chapsEl.querySelector('.bv-cb.on');
      if (sel) sel.scrollIntoView({ block: 'nearest' });
    }

    function selectBook(n) { bvBook = n; bvChap = 1; renderBooks(); renderChaps(); loadAndShow(); }
    function selectChap(c) { bvChap = c; renderChaps(); loadAndShow(); }

    function getCached() { return bvTrans === 'gyr' ? window.BIBLE_GYR : window.BIBLE_URM; }

    function loadAndShow() {
      var d = getCached();
      if (d) { showVerses(d); return; }
      textEl.innerHTML = '<p class="bv-hint">성경 데이터 로드 중… (최초 1회, 약 5~10초)</p>';
      fetch('data/bible-' + bvTrans + '.json?v=20260729')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (bvTrans === 'gyr') window.BIBLE_GYR = data;
          else window.BIBLE_URM = data;
          showVerses(data);
        })
        .catch(function () {
          textEl.innerHTML = '<p style="color:#e74c3c;padding:20px">데이터 로드 실패 — 새로고침 후 다시 시도해 주세요.</p>';
        });
    }

    function showVerses(data) {
      var bk     = BBLK[bvBook - 1];
      var verses = (data[bk[2]] || [])[bvChap - 1] || [];
      var tname  = bvTrans === 'gyr' ? '개역개정4판' : '우리말성경';
      var html   = '<div class="bv-thead"><span>' + esc(bk[1]) + ' ' + bvChap + '장</span>' +
                   '<span style="font-size:.74rem;color:#9aa5b1;font-weight:400">' + tname + ' · ' + verses.length + '절</span></div>';
      html += verses.map(function (v, i) {
        return '<div class="bv-verse"><span class="bv-vn">' + (i + 1) + '</span><span class="bv-vt">' + esc(v) + '</span></div>';
      }).join('');
      if (!verses.length) html += '<p class="bv-hint">해당 장의 데이터가 없습니다.</p>';
      textEl.innerHTML = html;
      textEl.scrollTop = 0;
    }

    Array.prototype.forEach.call(panel.querySelectorAll('.bv-trans'), function (btn) {
      btn.onclick = function () {
        bvTrans = btn.dataset.v;
        Array.prototype.forEach.call(panel.querySelectorAll('.bv-trans'), function (b) {
          b.style.background = b.dataset.v === bvTrans ? '#223350' : '#eef2f7';
          b.style.color      = b.dataset.v === bvTrans ? '#fff'    : '#3a4a63';
        });
        loadAndShow();
      };
    });

    renderBooks();
    renderChaps();
    loadAndShow();
  }

  // ====================================================================
  //  교육관리 — 교육 개설 / 참석자 연동
  // ====================================================================
  function renderEdu(panel) {
    panel.innerHTML =
      '<div class="fin-card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">' +
      '<div><b style="font-size:1.08rem;color:var(--accent,#223350)">교육 관리</b>' +
      '<div style="font-size:.84rem;color:var(--ink-soft);margin-top:4px">교육 과정을 개설하고 참석자(이수자)를 교적부에 연동합니다.</div></div>' +
      '<button class="btn btn-solid" id="edu_new_btn" style="padding:10px 20px">✏️ 교육 개설</button></div>' +
      '<div id="edu_list"><p class="qt-loading">불러오는 중…</p></div>';

    var eduAllRows = [];
    panel.querySelector('#edu_new_btn').onclick = function () { eduEditor(null); };

    function loadList() {
      api('GET', 'edu_records?select=*&order=edu_date.desc,created_at.desc')
        .then(function (rows) {
          eduAllRows = rows || [];
          var box = panel.querySelector('#edu_list');
          if (!rows || !rows.length) {
            box.innerHTML = '<div class="fin-card"><p style="color:var(--ink-soft);margin:0">개설된 교육이 없습니다. 위 <b>교육 개설</b>로 시작하세요.</p></div>'; return;
          }
          box.innerHTML =
            '<div class="fin-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><b>교육 목록 (' + rows.length + '건)</b></div>' +
            '<div style="overflow:auto"><table class="fin-table"><thead><tr>' +
            '<th>교육명</th><th>기수</th><th>반</th><th>기간</th><th>대상/부서</th><th>강사</th><th>참석자</th><th>관리</th>' +
            '</tr></thead><tbody>' +
            rows.map(function (r) {
              var parts = [];
              try { parts = JSON.parse(r.participants || '[]'); } catch (e) {}
              var s = r.edu_date || '', e2 = r.end_date || '';
              var period = s + (e2 && e2 !== s ? ' ~ ' + e2 : '');
              return '<tr>' +
                '<td><b class="edu-edit" data-id="' + esc(r.id) + '" style="cursor:pointer;color:var(--accent,#223350)">' + esc(r.title || '(제목없음)') + '</b></td>' +
                '<td style="white-space:nowrap">' + (r.cohort ? '<span class="fin-pill">' + esc(r.cohort) + '</span>' : '<span style="color:#c5ccd6">—</span>') + '</td>' +
                '<td style="white-space:nowrap">' + esc(r.class_name || '') + '</td>' +
                '<td style="white-space:nowrap">' + esc(period) + '</td>' +
                '<td>' + esc(r.target || '') + '</td>' +
                '<td>' + esc(r.teacher || '') + '</td>' +
                '<td style="max-width:260px">' + (parts.length ? parts.map(function (p) {
                  return '<span class="fin-pill" style="background:#e8f6ee;color:#1e874b;margin:1px">' + esc(p.name) + (p.key ? ' 🔗' : '') + '</span>';
                }).join('') : '<span style="color:#c5ccd6">—</span>') + '</td>' +
                '<td style="white-space:nowrap"><button class="btn btn-line edu-edit" data-id="' + esc(r.id) + '" style="padding:3px 9px;font-size:.78rem">수정</button>' +
                ' <button class="btn btn-line edu-del" data-id="' + esc(r.id) + '" style="padding:3px 9px;font-size:.78rem">삭제</button></td></tr>';
            }).join('') + '</tbody></table></div></div>';
          var byId = {}; rows.forEach(function (r) { byId[r.id] = r; });
          Array.prototype.forEach.call(box.querySelectorAll('.edu-edit'), function (b) {
            b.onclick = function () { eduEditor(byId[b.dataset.id]); };
          });
          Array.prototype.forEach.call(box.querySelectorAll('.edu-del'), function (b) {
            b.onclick = function () {
              if (!confirm('이 교육 과정을 삭제할까요?')) return;
              api('DELETE', 'edu_records?id=eq.' + b.dataset.id, null, 'return=minimal').then(loadList).catch(function (e) { alert('삭제 실패: ' + e.message); });
            };
          });
        })
        .catch(function (e) {
          var box = panel.querySelector('#edu_list');
          if (/does not exist|42P01|schema cache/i.test(e.message))
            box.innerHTML = msgCard('테이블 준비 필요', 'Supabase SQL Editor에서 affairs_modules.sql, edu_extra.sql을 실행해 주세요.');
          else box.innerHTML = msgCard('조회 실패', e.message);
        });
    }

    function eduEditor(rec) {
      rec = rec || {};
      var participants = [];
      try { participants = JSON.parse(rec.participants || '[]'); } catch (e) {}

      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:900;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:30px 16px 60px';
      ov.innerHTML =
        '<div style="background:#fff;border-radius:14px;width:100%;max-width:700px;box-shadow:0 8px 40px rgba(0,0,0,.22);padding:28px 24px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">' +
        '<h3 style="margin:0;color:var(--accent,#223350)">' + (rec.id ? '교육 수정' : '교육 개설') + '</h3>' +
        '<button type="button" id="edu_xbtn" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#9aa5b1;line-height:1">×</button></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 16px;margin-bottom:18px">' +
        '<div class="af-field" style="grid-column:1/-1;position:relative"><label>교육명</label><input type="text" id="edu_f_title" autocomplete="off" value="' + esc(rec.title || '') + '" placeholder="예: 새가족반, 제자훈련반" style="width:100%;box-sizing:border-box"></div>' +
        '<div class="af-field"><label>기수</label><input type="text" id="edu_f_cohort" value="' + esc(rec.cohort || '') + '" placeholder="예: 1기" style="width:100%;box-sizing:border-box"></div>' +
        '<div class="af-field" style="position:relative"><label>반</label><input type="text" id="edu_f_class" autocomplete="off" value="' + esc(rec.class_name || '') + '" placeholder="예: 목요일 반" style="width:100%;box-sizing:border-box"></div>' +
        '<div class="af-field"><label>시작일</label><input type="date" id="edu_f_start" value="' + esc(rec.edu_date || today()) + '" style="width:100%;box-sizing:border-box"></div>' +
        '<div class="af-field"><label>종료일</label><input type="date" id="edu_f_end" value="' + esc(rec.end_date || '') + '" style="width:100%;box-sizing:border-box"></div>' +
        '<div class="af-field"><label>대상/부서</label><input type="text" id="edu_f_target" value="' + esc(rec.target || '') + '" placeholder="예: 새가족, 중등부" style="width:100%;box-sizing:border-box"></div>' +
        '<div class="af-field"><label>강사/인도자</label><input type="text" id="edu_f_teacher" value="' + esc(rec.teacher || '') + '" style="width:100%;box-sizing:border-box"></div>' +
        '<div class="af-field" style="grid-column:1/-1"><label>내용/비고</label><textarea id="edu_f_content" style="min-height:70px;width:100%;box-sizing:border-box">' + esc(rec.content || '') + '</textarea></div>' +
        '</div>' +
        '<div style="margin-bottom:20px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
        '<label style="font-size:.82rem;color:var(--ink-soft);font-weight:600">참석자 / 이수자 <span id="edu_pcnt" style="color:var(--accent,#223350)">(' + participants.length + '명)</span></label>' +
        '<button type="button" id="edu_add_p" class="btn btn-line" style="padding:4px 13px;font-size:.82rem">＋ 추가</button></div>' +
        '<div id="edu_pbox" style="display:flex;flex-wrap:wrap;gap:6px;min-height:46px;padding:8px 10px;border:1px solid #dfe5ee;border-radius:8px;background:#fafbfc;align-items:flex-start"></div>' +
        '<div style="font-size:.75rem;color:#9aa5b1;margin-top:5px">추가 버튼을 누르면 입력창이 생깁니다. 이름을 입력하면 교적부에서 검색합니다. Enter 또는 선택으로 추가됩니다.</div>' +
        '</div>' +
        '<div style="margin-bottom:20px">' +
        '<label style="font-size:.82rem;color:var(--ink-soft);font-weight:600;display:block;margin-bottom:8px">📁 강의 자료실 <span style="font-weight:400;color:#9aa5b1">(수강생만 접근 가능)</span></label>' +
        '<div id="edu_mat_box">' + (rec.id ? '<p class="qt-loading">불러오는 중…</p>' : '<p style="color:#9aa5b1;font-size:.83rem;padding:10px;border:1px dashed #dfe5ee;border-radius:8px">먼저 저장한 뒤 자료를 첨부할 수 있습니다.</p>') + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:10px;align-items:center">' +
        '<button type="button" id="edu_save_btn" class="btn btn-solid" style="padding:10px 24px">저장</button>' +
        '<button type="button" id="edu_cancel_btn" class="btn btn-line" style="padding:10px 18px">닫기</button>' +
        '<span id="edu_msg" style="font-size:.85rem"></span></div></div>';

      document.body.appendChild(ov);

      var pbox = ov.querySelector('#edu_pbox');
      var pcnt = ov.querySelector('#edu_pcnt');

      function renderParts() {
        pbox.innerHTML = participants.map(function (p, i) {
          return '<span style="display:inline-flex;align-items:center;gap:5px;background:#e8f6ee;color:#155e32;border-radius:999px;padding:5px 11px;font-size:.83rem;font-weight:600">' +
            esc(p.name) + (p.key ? ' <span style="font-size:.68rem;opacity:.55">🔗</span>' : '') +
            ' <b data-rm="' + i + '" style="cursor:pointer;opacity:.45;font-size:.9rem;margin-left:1px">×</b></span>';
        }).join('');
        Array.prototype.forEach.call(pbox.querySelectorAll('[data-rm]'), function (b) {
          b.onclick = function () { participants.splice(Number(b.dataset.rm), 1); renderParts(); if (pcnt) pcnt.textContent = '(' + participants.length + '명)'; };
        });
        if (pcnt) pcnt.textContent = '(' + participants.length + '명)';
      }

      function addPartInput() {
        var wrap = document.createElement('div');
        wrap.style.cssText = 'position:relative;display:inline-block;vertical-align:middle';
        var inp = document.createElement('input');
        inp.type = 'text'; inp.placeholder = '이름 검색…';
        inp.style.cssText = 'padding:5px 10px;border:2px solid #3a6db5;border-radius:6px;font:inherit;font-size:.85rem;width:130px;outline:none';
        inp.setAttribute('autocomplete', 'off');
        wrap.appendChild(inp); pbox.appendChild(wrap); inp.focus();
        var pop = null, hi = -1, matches = [];
        function closePop() { if (pop) { pop.remove(); pop = null; hi = -1; } }
        function pickMember(m) { participants.push({ name: m.name, key: m.key || '' }); wrap.remove(); renderParts(); }
        function pickRaw() { var n = inp.value.trim(); if (n) { participants.push({ name: n, key: '' }); } wrap.remove(); renderParts(); }
        inp.addEventListener('input', function () {
          closePop();
          var q = inp.value.trim().toLowerCase(); if (!q || !MEMBERS.length) return;
          matches = MEMBERS.filter(function (m) { return (m.name || '').toLowerCase().indexOf(q) >= 0; }).slice(0, 8);
          if (!matches.length) return;
          pop = document.createElement('div'); pop.className = 'fin-sugg'; pop.style.zIndex = '950';
          matches.forEach(function (m) {
            var d = document.createElement('div');
            d.innerHTML = esc(m.name) + (memberLine(m) ? ' <span style="color:#9aa5b1;font-size:.78rem">' + esc(memberLine(m)) + '</span>' : '');
            d.onmousedown = function (e) { e.preventDefault(); pickMember(m); };
            pop.appendChild(d);
          });
          wrap.appendChild(pop);
        });
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); if (pop && matches.length) pickMember(matches[hi >= 0 ? hi : 0]); else pickRaw(); return; }
          if (e.key === 'Escape') { wrap.remove(); return; }
          if (!pop) return;
          var rows = pop.querySelectorAll('div');
          if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hi + 1, rows.length - 1); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(hi - 1, 0); }
          else return;
          Array.prototype.forEach.call(rows, function (r, i) { r.classList.toggle('hi', i === hi); });
        });
        inp.addEventListener('blur', function () { setTimeout(function () { if (wrap.parentNode) pickRaw(); }, 220); });
      }

      ov.querySelector('#edu_add_p').onclick = addPartInput;

      // ── 교육명 자동완성 (기존 교육 추천) + 기수 자동 제안 ──
      (function setupTitleSuggest() {
        var titleInp = ov.querySelector('#edu_f_title');
        var cohortInp = ov.querySelector('#edu_f_cohort');
        var field = titleInp.closest('.af-field');
        var pop = null, hi = -1, matches = [];
        function closePop() { if (pop) { pop.remove(); pop = null; hi = -1; } }
        function uniqueTitles(q) {
          var seen = {}, list = [];
          eduAllRows.forEach(function (r) {
            var t = (r.title || '').trim();
            if (!t || seen[t]) return;
            if (q && t.toLowerCase().indexOf(q) < 0) return;
            seen[t] = true; list.push(t);
          });
          return list.slice(0, 8);
        }
        function suggestCohort(t) {
          if (cohortInp.value.trim()) return; // 이미 입력했으면 건드리지 않음
          var nums = [];
          eduAllRows.forEach(function (r) {
            if ((r.title || '').trim() !== t) return;
            var m = String(r.cohort || '').match(/\d+/);
            if (m) nums.push(parseInt(m[0], 10));
          });
          if (nums.length) cohortInp.value = (Math.max.apply(null, nums) + 1) + '기';
        }
        function pick(t) { titleInp.value = t; closePop(); suggestCohort(t); }
        titleInp.addEventListener('input', function () {
          closePop();
          var q = titleInp.value.trim().toLowerCase();
          matches = uniqueTitles(q);
          if (!matches.length) return;
          pop = document.createElement('div'); pop.className = 'fin-sugg';
          matches.forEach(function (t) {
            var cnt = eduAllRows.filter(function (r) { return (r.title || '').trim() === t; }).length;
            var d = document.createElement('div');
            d.innerHTML = esc(t) + ' <span style="color:#9aa5b1;font-size:.78rem">기존 ' + cnt + '회 개설</span>';
            d.onmousedown = function (e) { e.preventDefault(); pick(t); };
            pop.appendChild(d);
          });
          field.appendChild(pop);
        });
        titleInp.addEventListener('focus', function () { if (!titleInp.value.trim()) titleInp.dispatchEvent(new Event('input')); });
        titleInp.addEventListener('keydown', function (e) {
          if (!pop) return; var rows = pop.querySelectorAll('div');
          if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hi + 1, rows.length - 1); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(hi - 1, 0); }
          else if (e.key === 'Enter') { if (matches.length && hi >= 0) { e.preventDefault(); pick(matches[hi]); } return; }
          else if (e.key === 'Escape') { closePop(); return; }
          else return;
          Array.prototype.forEach.call(rows, function (r, i) { r.classList.toggle('hi', i === hi); });
        });
        titleInp.addEventListener('blur', function () { setTimeout(closePop, 180); });
      })();

      // ── 반 자동완성 (같은 교육명의 기존 반 추천) ──
      (function setupClassSuggest() {
        var classInp = ov.querySelector('#edu_f_class');
        var titleInp = ov.querySelector('#edu_f_title');
        var field = classInp.closest('.af-field');
        var pop = null, hi = -1, matches = [];
        function closePop() { if (pop) { pop.remove(); pop = null; hi = -1; } }
        function uniqueClasses(q) {
          var t = titleInp.value.trim();
          var seen = {}, list = [];
          eduAllRows.forEach(function (r) {
            var c = (r.class_name || '').trim();
            if (!c || seen[c]) return;
            if (t && (r.title || '').trim() !== t) return;
            if (q && c.toLowerCase().indexOf(q) < 0) return;
            seen[c] = true; list.push(c);
          });
          return list.slice(0, 8);
        }
        function pick(c) { classInp.value = c; closePop(); }
        classInp.addEventListener('input', function () {
          closePop();
          var q = classInp.value.trim().toLowerCase();
          matches = uniqueClasses(q);
          if (!matches.length) return;
          pop = document.createElement('div'); pop.className = 'fin-sugg';
          matches.forEach(function (c) {
            var d = document.createElement('div'); d.textContent = c;
            d.onmousedown = function (e) { e.preventDefault(); pick(c); };
            pop.appendChild(d);
          });
          field.appendChild(pop);
        });
        classInp.addEventListener('focus', function () { if (!classInp.value.trim()) classInp.dispatchEvent(new Event('input')); });
        classInp.addEventListener('keydown', function (e) {
          if (!pop) return; var rows = pop.querySelectorAll('div');
          if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hi + 1, rows.length - 1); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(hi - 1, 0); }
          else if (e.key === 'Enter') { if (matches.length && hi >= 0) { e.preventDefault(); pick(matches[hi]); } return; }
          else if (e.key === 'Escape') { closePop(); return; }
          else return;
          Array.prototype.forEach.call(rows, function (r, i) { r.classList.toggle('hi', i === hi); });
        });
        classInp.addEventListener('blur', function () { setTimeout(closePop, 180); });
      })();

      function closeOv() { ov.remove(); }
      ov.querySelector('#edu_xbtn').onclick = closeOv;
      ov.querySelector('#edu_cancel_btn').onclick = closeOv;
      ov.addEventListener('click', function (e) { if (e.target === ov) closeOv(); });

      ov.querySelector('#edu_save_btn').onclick = function () {
        var title = ov.querySelector('#edu_f_title').value.trim();
        var start = ov.querySelector('#edu_f_start').value;
        var msgEl = ov.querySelector('#edu_msg');
        if (!title || !start) { msgEl.style.color = '#c0392b'; msgEl.textContent = '교육명과 시작일은 필수입니다.'; return; }
        var data = {
          title: title,
          cohort: ov.querySelector('#edu_f_cohort').value.trim() || null,
          class_name: ov.querySelector('#edu_f_class').value.trim() || null,
          edu_date: start,
          end_date: ov.querySelector('#edu_f_end').value || null,
          target: ov.querySelector('#edu_f_target').value.trim() || null,
          teacher: ov.querySelector('#edu_f_teacher').value.trim() || null,
          content: ov.querySelector('#edu_f_content').value || null,
          attendance: String(participants.length),
          participants: JSON.stringify(participants)
        };
        msgEl.style.color = '#7b8794'; msgEl.textContent = '저장 중…';
        var isNew = !rec.id;
        var pr = rec.id
          ? api('PATCH', 'edu_records?id=eq.' + rec.id, data, 'return=minimal')
          : api('POST', 'edu_records', data, 'return=representation');
        pr.then(function (rows) {
          msgEl.style.color = 'green'; msgEl.textContent = '✓ 저장되었습니다';
          if (isNew && rows && rows[0] && rows[0].id) {
            rec.id = rows[0].id;
            var h3 = ov.querySelector('h3'); if (h3) h3.textContent = '교육 수정';
            var matBox = ov.querySelector('#edu_mat_box'); if (matBox) matBox.innerHTML = '<p class="qt-loading">불러오는 중…</p>';
            loadMaterials();
            loadList();
            setTimeout(function () { msgEl.textContent = ''; }, 2000);
          } else {
            setTimeout(function () { closeOv(); loadList(); }, 600);
          }
        }).catch(function (e) {
          msgEl.style.color = '#c0392b';
          msgEl.textContent = '저장 실패: ' + e.message;
          if (/participants|end_date|cohort|class_name/i.test(e.message))
            msgEl.textContent += ' — Supabase SQL Editor에서 컬럼을 추가해 주세요.';
        });
      };

      // ── 강의 자료실(수강생만 접근) — Supabase Storage 'edu_materials' 버킷 ──
      function encPath(p) { return String(p).split('/').map(encodeURIComponent).join('/'); }
      function fmtSize(n) { if (!n && n !== 0) return ''; if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(0) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; }
      function matIcon(name) {
        var e = (String(name).split('.').pop() || '').toLowerCase();
        if (e === 'pdf') return '📕'; if (['hwp', 'hwpx'].indexOf(e) >= 0) return '📄'; if (['doc', 'docx'].indexOf(e) >= 0) return '📘';
        if (['xls', 'xlsx', 'csv'].indexOf(e) >= 0) return '📊'; if (['ppt', 'pptx'].indexOf(e) >= 0) return '📙';
        if (['png', 'jpg', 'jpeg', 'gif', 'webp'].indexOf(e) >= 0) return '🖼️'; if (['mp3', 'wav', 'm4a'].indexOf(e) >= 0) return '🎵'; if (['mp4', 'mov'].indexOf(e) >= 0) return '🎬';
        return '📎';
      }
      function loadMaterials() {
        var box = ov.querySelector('#edu_mat_box'); if (!box || !rec.id) return;
        api('GET', 'edu_materials?edu_id=eq.' + rec.id + '&select=*&order=created_at.desc')
          .then(function (rows) {
            rows = rows || [];
            box.innerHTML =
              '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px">' +
              '<input type="file" id="edu_mat_file" multiple style="display:none">' +
              '<button type="button" id="edu_mat_pick" class="btn btn-line" style="padding:5px 13px;font-size:.82rem">📎 파일 추가</button>' +
              '<span id="edu_mat_upmsg" style="font-size:.8rem;color:#7b8794"></span></div>' +
              (rows.length ? '<div style="border:1px solid #eef1f5;border-radius:8px;overflow:hidden">' + rows.map(function (r) {
                return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 11px;border-bottom:1px solid #f0f3f7;font-size:.86rem">' +
                  '<span>' + matIcon(r.title) + ' ' + esc(r.title) + (r.size ? ' <span style="color:#9aa5b1;font-size:.76rem">· ' + fmtSize(r.size) + '</span>' : '') + '</span>' +
                  '<span style="display:flex;gap:10px;align-items:center"><a href="#" class="mat-dl" data-id="' + esc(r.id) + '" style="color:var(--accent,#223350)">다운로드</a><b class="mat-del" data-id="' + esc(r.id) + '" style="cursor:pointer;color:#c0392b;font-size:.8rem">삭제</b></span></div>';
              }).join('') + '</div>' : '<p style="color:#9aa5b1;font-size:.83rem;padding:8px 0">등록된 자료가 없습니다.</p>');
            var byId = {}; rows.forEach(function (r) { byId[r.id] = r; });
            var upmsg = box.querySelector('#edu_mat_upmsg');
            box.querySelector('#edu_mat_pick').onclick = function () { box.querySelector('#edu_mat_file').click(); };
            box.querySelector('#edu_mat_file').onchange = function (e) {
              var files = Array.prototype.slice.call(e.target.files || []);
              if (!files.length) return;
              (function next(i) {
                if (i >= files.length) { upmsg.style.color = 'green'; upmsg.textContent = '✓ 업로드 완료'; loadMaterials(); return; }
                var f = files[i];
                upmsg.style.color = '#7b8794'; upmsg.textContent = '「' + f.name + '」 업로드 중… (' + (i + 1) + '/' + files.length + ')';
                uploadMaterial(f).then(function () { next(i + 1); }).catch(function (err) { upmsg.style.color = '#c0392b'; upmsg.textContent = '업로드 실패: ' + err.message; });
              })(0);
            };
            Array.prototype.forEach.call(box.querySelectorAll('.mat-dl'), function (a) {
              a.onclick = function (e) {
                e.preventDefault(); var r = byId[a.dataset.id]; if (!r) return;
                var old = a.textContent; a.textContent = '준비 중…';
                signedMaterialUrl(r.path, r.title).then(function (u) { window.open(u, '_blank'); a.textContent = old; }).catch(function (err) { alert('다운로드 오류: ' + err.message); a.textContent = old; });
              };
            });
            Array.prototype.forEach.call(box.querySelectorAll('.mat-del'), function (b) {
              b.onclick = function () {
                var r = byId[b.dataset.id]; if (!r) return;
                if (!confirm('「' + r.title + '」 자료를 삭제할까요?')) return;
                var s = sess();
                fetch(SB + '/storage/v1/object/edu_materials/' + encPath(r.path), { method: 'DELETE', headers: { apikey: AK, Authorization: 'Bearer ' + (s && s.token) } })
                  .catch(function () {})
                  .then(function () { return api('DELETE', 'edu_materials?id=eq.' + r.id, null, 'return=minimal'); })
                  .then(loadMaterials)
                  .catch(function (err) { alert('삭제 실패: ' + err.message); });
              };
            });
          })
          .catch(function (e) {
            if (/does not exist|42P01|schema cache/i.test(e.message))
              box.innerHTML = '<p style="color:#c0392b;font-size:.83rem">테이블 준비 필요 — Supabase SQL Editor에서 supabase/edu_extra.sql 을 실행해 주세요.</p>';
            else box.innerHTML = '<p style="color:#c0392b;font-size:.83rem">조회 실패: ' + esc(e.message) + '</p>';
          });
      }
      function uploadMaterial(file) {
        var s = sess();
        if (!s || !s.token) return Promise.reject(new Error('로그인이 필요합니다.'));
        var key = rec.id + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '_' + file.name;
        return fetch(SB + '/storage/v1/object/edu_materials/' + encPath(key), {
          method: 'POST',
          headers: { apikey: AK, Authorization: 'Bearer ' + s.token, 'x-upsert': 'true', 'Content-Type': file.type || 'application/octet-stream' },
          body: file
        }).then(function (r) {
          if (!r.ok) return r.text().then(function (t) { throw new Error(t || ('HTTP ' + r.status)); });
          return api('POST', 'edu_materials', { edu_id: rec.id, title: file.name, path: key, size: file.size }, 'return=minimal');
        });
      }
      function signedMaterialUrl(path, title) {
        var s = sess();
        return fetch(SB + '/storage/v1/object/sign/edu_materials/' + encPath(path), {
          method: 'POST', headers: { apikey: AK, Authorization: 'Bearer ' + (s && s.token), 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 })
        }).then(function (r) { return r.json(); }).then(function (d) {
          if (!d || !d.signedURL) throw new Error(d && d.message || '서명 URL 생성 실패');
          return SB + '/storage/v1' + d.signedURL + '&download=' + encodeURIComponent(title || '');
        });
      }

      renderParts();
      if (rec.id) loadMaterials();
    }

    loadList();
  }

  // ====================================================================
  //  설정 — 연간 봉사위원 (주보 제작 시 자동 채움)
  // ====================================================================
  function renderSettings(panel) {
    panel.innerHTML =
      '<div class="fin-card"><h3 style="margin:0 0 4px;color:var(--accent,#223350)">교회 기본 정보</h3>' +
      '<p style="margin:0 0 12px;color:var(--ink-soft,#7b8794);font-size:.9rem">설립일을 기준으로 주보 <b>호수(No.)</b>의 주년이 정해집니다. 예) 1964년 설립 → 2026년은 62주년 → 62-○○주.</p>' +
      '<div class="fin-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;align-items:end">' +
      '<div class="af-field"><label>교회 설립일</label><input type="date" id="set_founded" value=""></div>' +
      '<div class="af-field"><label>현재 주년(자동)</label><input type="text" id="set_anniv" value="" readonly style="background:#f5f7fa"></div>' +
      '</div></div>' +
      // 주보 PDF 저장
      '<div class="fin-card"><h3 style="margin:0 0 4px;color:var(--accent,#223350)">주보 PDF 저장</h3>' +
      '<p style="margin:0 0 12px;color:var(--ink-soft,#7b8794);font-size:.9rem">주보를 <b>🖨 3단 인쇄(PDF)</b> 할 때 PDF의 기본 <b>파일명</b>을 정합니다. 사용 가능한 항목: <code>{date}</code>(20260705) · <code>{no}</code>(62-27) · <code>{week}</code>(7월 첫째 주)</p>' +
      '<div class="fin-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;align-items:end">' +
      '<div class="af-field"><label>PDF 파일명 형식</label><input type="text" id="set_pdfname" value="" placeholder="{date} 주보"></div>' +
      '<div class="af-field"><label>미리보기</label><input type="text" id="set_pdfprev" value="" readonly style="background:#f5f7fa"></div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap"><button class="btn btn-solid" id="set_save_g" style="padding:8px 16px;font-size:.85rem">💾 기본 정보 저장</button> <span id="set_gmsg" class="fin-msg"></span></div>' +
      '<p style="margin:10px 0 0;color:#9aa5b1;font-size:.78rem">※ 브라우저 보안상 웹페이지가 PC의 저장 <b>폴더</b>를 직접 지정할 수는 없습니다. 인쇄 창에서 <b>대상 → ‘PDF로 저장’</b>을 고른 뒤 폴더를 한 번 선택하면, 브라우저가 그 위치를 기억해 다음부터 같은 폴더로 저장됩니다.</p>' +
      '</div>' +
      '<div class="fin-card"><h3 style="margin:0 0 4px;color:var(--accent,#223350)">연간 봉사위원</h3>' +
      '<p style="margin:0 0 12px;color:var(--ink-soft,#7b8794);font-size:.9rem">월별 봉사위원을 한 번 입력해 두면, <b>주보 제작 → 데이터 불러오기</b> 시 해당 월 봉사위원이 자동으로 채워집니다. 그 달 <b>마지막 주일</b> 주보에는 다음 달 봉사위원도 함께 표기됩니다.</p>' +
      '<div id="set_rows"></div>' +
      '<div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap"><button class="btn btn-line" id="set_add" style="padding:6px 13px;font-size:.85rem">＋ 월 추가</button><button class="btn btn-solid" id="set_save" style="padding:6px 16px;font-size:.85rem">💾 저장</button><span id="set_msg" class="fin-msg"></span></div>' +
      '<div id="set_drop" style="margin-top:14px;border:2px dashed #cdd7e3;border-radius:10px;padding:16px;text-align:center;color:#9aa5b1;font-size:.84rem">📄 한글(.hwpx) 봉사자 파일을 여기로 드래그하면 자동으로 채웁니다 <span style="font-size:.76rem">(텍스트 추출 · 베타)</span></div>' +
      '</div>';
    function msg(t, c) { var e = panel.querySelector('#set_msg'); if (e) { e.style.color = c || '#7b8794'; e.textContent = t; if (t) setTimeout(function () { if (e.textContent === t) e.textContent = ''; }, 3000); } }
    var coms = [];
    function rowsBox() { return panel.querySelector('#set_rows'); }
    function prayerToText(arr) { return (arr || []).map(function (p) { return (p.week ? p.week + ':' : '') + (p.person || ''); }).filter(Boolean).join('\n'); }
    function textToPrayer(s) { return String(s || '').split(/[\n\/]/).map(function (part) { var i = part.indexOf(':'); if (i < 0) { var t = part.trim(); return t ? { week: '', person: t } : null; } return { week: part.slice(0, i).trim(), person: part.slice(i + 1).trim() }; }).filter(function (p) { return p && p.person; }); }
    function renderRows() {
      var box = rowsBox();
      var ist = 'width:100%;padding:5px 7px;border:1px solid #dfe5ee;border-radius:7px;font:inherit;font-size:.84rem;box-sizing:border-box';
      box.innerHTML = '<div style="overflow:auto"><table class="fin-table" style="table-layout:fixed;width:100%;min-width:780px">' +
        '<colgroup><col style="width:8%"><col style="width:16%"><col style="width:14%"><col style="width:14%"><col style="width:45%"><col style="width:3%"></colgroup>' +
        '<thead><tr><th>월</th><th>헌금위원</th><th>안내위원</th><th>주차·사찰</th><th>이주의 기도 <span style="font-weight:400;color:#9aa5b1;font-size:.72rem">(주차별 · 한 줄에 하나)</span></th><th></th></tr></thead><tbody>' +
        coms.map(function (c, i) {
          var lines = Math.max(2, (c.prayer && c.prayer.length) || 0);
          return '<tr>' +
            '<td><input type="month" class="set-month" data-i="' + i + '" value="' + esc(c.month || '') + '" style="' + ist + '"></td>' +
            '<td><input type="text" class="set-offering" data-i="' + i + '" value="' + esc(c.offering || '') + '" placeholder="이름 이름" title="' + esc(c.offering || '') + '" style="' + ist + '"></td>' +
            '<td><input type="text" class="set-guide" data-i="' + i + '" value="' + esc(c.guide || '') + '" title="' + esc(c.guide || '') + '" style="' + ist + '"></td>' +
            '<td><input type="text" class="set-parking" data-i="' + i + '" value="' + esc(c.parking || '') + '" title="' + esc(c.parking || '') + '" style="' + ist + '"></td>' +
            '<td><textarea class="set-prayer" data-i="' + i + '" rows="' + lines + '" placeholder="1주:신용화 장로&#10;2주:박경자 권사" style="' + ist + ';line-height:1.5;resize:vertical;min-height:52px">' + esc(prayerToText(c.prayer)) + '</textarea></td>' +
            '<td style="text-align:center;vertical-align:top;padding-top:8px"><button type="button" class="set-del" data-i="' + i + '" style="border:0;background:none;color:#c0392b;cursor:pointer">✕</button></td></tr>';
        }).join('') + '</tbody></table></div>';
      function bind(cls, key) { Array.prototype.forEach.call(box.querySelectorAll('.' + cls), function (inp) { inp.oninput = function () { coms[Number(inp.dataset.i)][key] = inp.value; }; }); }
      bind('set-month', 'month'); bind('set-offering', 'offering'); bind('set-guide', 'guide'); bind('set-parking', 'parking');
      Array.prototype.forEach.call(box.querySelectorAll('.set-prayer'), function (inp) { inp.oninput = function () { coms[Number(inp.dataset.i)].prayer = textToPrayer(inp.value); }; });
      Array.prototype.forEach.call(box.querySelectorAll('.set-del'), function (b) { b.onclick = function () { coms.splice(Number(b.dataset.i), 1); renderRows(); }; });
    }
    // 교회 기본 정보(설립일) — 호수 주년 기준
    function gmsg(t, c) { var e = panel.querySelector('#set_gmsg'); if (e) { e.style.color = c || '#7b8794'; e.textContent = t; if (t) setTimeout(function () { if (e.textContent === t) e.textContent = ''; }, 3000); } }
    function annivOf(fdate) { if (!fdate) return ''; var fy = new Date(fdate + 'T00:00:00').getFullYear(); return (new Date().getFullYear() - fy) + '주년'; }
    var fEl = panel.querySelector('#set_founded'), aEl = panel.querySelector('#set_anniv');
    var pEl = panel.querySelector('#set_pdfname'), pvEl = panel.querySelector('#set_pdfprev');
    function pdfPreview() {
      var fmt = pEl.value || '{date} 주보';
      var ds = (nextSunday()).replace(/-/g, '');
      pvEl.value = fmt.replace(/\{date\}/g, ds).replace(/\{no\}/g, bulletinNo(nextSunday())).replace(/\{week\}/g, bulletinWeekLabel(nextSunday())).replace(/\s+/g, ' ').trim() + '.pdf';
    }
    fEl.addEventListener('change', function () { aEl.value = annivOf(fEl.value); });
    pEl.addEventListener('input', pdfPreview);
    panel.querySelector('#set_save_g').onclick = function () {
      var fd = fEl.value; if (!fd) { gmsg('설립일을 입력하세요.', '#c0392b'); return; }
      var pn = (pEl.value || '{date} 주보').trim();
      gmsg('저장 중…');
      api('POST', 'church_settings?on_conflict=key', { key: 'general', data: { founded: fd, pdf_name: pn }, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=minimal')
        .then(function () { FOUNDED_DATE = fd; FOUNDED_YEAR = new Date(fd + 'T00:00:00').getFullYear(); PDF_NAME = pn; gmsg('✓ 저장됨 — 주보 호수·PDF 파일명에 반영됩니다', 'green'); })
        .catch(function (e) { if (/42P01|PGRST205|does not exist|schema cache/i.test(e.message)) gmsg('church_settings.sql 실행 필요', '#c0392b'); else gmsg('저장 실패: ' + e.message, '#c0392b'); });
    };
    loadGeneral().then(function (g) { fEl.value = (g && g.founded) || FOUNDED_DATE; aEl.value = annivOf(fEl.value); pEl.value = (g && g.pdf_name) || PDF_NAME; pdfPreview(); });
    panel.querySelector('#set_add').onclick = function () { coms.push({ month: '', offering: '', guide: '', parking: '' }); renderRows(); };
    panel.querySelector('#set_save').onclick = function () {
      coms.sort(function (a, b) { return (a.month || '') < (b.month || '') ? -1 : 1; });
      msg('저장 중…');
      api('POST', 'church_settings?on_conflict=key', { key: 'committees', data: { months: coms }, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=minimal')
        .then(function () { COMMITTEES = coms.slice(); msg('✓ 저장되었습니다', 'green'); })
        .catch(function (e) { if (/42P01|PGRST205|does not exist|schema cache/i.test(e.message)) msg('church_settings.sql 실행 필요', '#c0392b'); else msg('저장 실패: ' + e.message, '#c0392b'); });
    };
    // 한글(.hwpx) 봉사자 파일 드롭 → 표 파싱 → 월별 봉사위원 자동 채움
    function applyParsed(parsed) {
      if (!parsed || !parsed.months || !parsed.months.length) { msg('봉사자 표를 찾지 못했습니다. (예배 봉사자 .hwpx 파일인지 확인해 주세요)', '#c0392b'); return; }
      var byMonth = {}; coms.forEach(function (c) { if (c.month) byMonth[c.month] = c; });
      var added = 0, updated = 0;
      parsed.months.forEach(function (m) {
        if (byMonth[m.month]) { var c = byMonth[m.month]; c.offering = m.offering; c.guide = m.guide; c.parking = m.parking; if (m.prayer) c.prayer = m.prayer; updated++; }
        else { coms.push(m); byMonth[m.month] = m; added++; }
      });
      coms = coms.filter(function (c) { return c.month || c.offering || c.guide || c.parking; });
      coms.sort(function (a, b) { return (a.month || '') < (b.month || '') ? -1 : 1; });
      renderRows();
      msg('✓ ' + parsed.year + '년 ' + parsed.months.length + '개월 불러옴 (추가 ' + added + ' · 갱신 ' + updated + ') — 확인 후 💾 저장하세요', 'green');
    }
    function handleFile(f) {
      if (!f) return;
      if (!/\.hwpx$/i.test(f.name)) { msg('한글 .hwpx 파일만 지원합니다. (.hwp 구형식은 한글에서 hwpx로 저장 후 사용)', '#c0392b'); return; }
      if (!window.JSZip) { msg('압축 해제 모듈(JSZip)이 로드되지 않았습니다. 새로고침 후 다시 시도해 주세요.', '#c0392b'); return; }
      msg('파일 분석 중…');
      f.arrayBuffer().then(function (buf) { return window.JSZip.loadAsync(buf); })
        .then(function (zip) { var fe = zip.file('Contents/section0.xml') || zip.file('section0.xml'); if (!fe) throw new Error('section0.xml 없음'); return fe.async('string').then(function (xml) { return { xml: xml, name: f.name }; }); })
        .then(function (o) { applyParsed(parseBongsaHwpx(o.xml, o.name)); })
        .catch(function (e) { msg('파일을 읽지 못했습니다: ' + e.message, '#c0392b'); });
    }
    var drop = panel.querySelector('#set_drop');
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.style.background = '#eef4ff'; });
    drop.addEventListener('dragleave', function () { drop.style.background = ''; });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.style.background = ''; handleFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });
    drop.style.cursor = 'pointer';
    drop.addEventListener('click', function () { var fi = document.createElement('input'); fi.type = 'file'; fi.accept = '.hwpx'; fi.onchange = function () { handleFile(fi.files && fi.files[0]); }; fi.click(); });
    api('GET', 'church_settings?key=eq.committees&select=data').then(function (rows) {
      coms = (rows && rows[0] && rows[0].data && rows[0].data.months) || [];
      COMMITTEES = coms.slice();
      if (!coms.length) coms.push({ month: '', offering: '', guide: '', parking: '' });
      renderRows();
    }).catch(function (e) {
      if (/42P01|PGRST205|does not exist|schema cache|Could not find the table/i.test(e.message)) rowsBox().innerHTML = msgCard('테이블 준비 필요', 'Supabase → SQL Editor 에서 supabase/church_settings.sql 을 1회 실행해 주세요.');
      else rowsBox().innerHTML = msgCard('조회 실패', e.message);
    });
  }

  // ── 부팅: 로그인 + 관리자 확인 ──
  var tries = 0;
  function boot() {
    if (!SB) { root.innerHTML = msgCard('준비 중', 'Supabase 설정이 없습니다.'); return; }
    var s = sess();
    if (!s || !s.uid || !s.token) {
      if (tries++ < 20) { setTimeout(boot, 400); return; }
      root.innerHTML = msgCard('로그인이 필요합니다', '상단에서 로그인 후 이용해 주세요.'); return;
    }
    api('GET', 'admins?uid=eq.' + s.uid + '&select=uid').then(function (rows) {
      if (!rows || !rows.length) { root.innerHTML = msgCard('접근 권한이 없습니다', '행정관리는 관리자만 이용할 수 있습니다.'); return; }
      loadMembers();
      loadGeneral(); // 설립일(호수 주년 기준) 미리 로드
      render();
      maybeQtIncoming();
    }).catch(function (e) { root.innerHTML = msgCard('오류', e.message); });
  }

  // 북마클릿이 du.plus 페이지 본문을 window.name 으로 실어 보내면, 여기서 받아 가져오기 모달을 자동으로 연다.
  function maybeQtIncoming() {
    try {
      var pref = 'QTIMPORT::';
      var nm = String(window.name || '');
      if (nm.indexOf(pref) !== 0) return;
      var txt = nm.slice(pref.length);
      window.name = '';                       // 1회성: 즉시 비움
      tab = 'sermon'; render();
      qtImportModal(txt);
    } catch (e) { /* noop */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

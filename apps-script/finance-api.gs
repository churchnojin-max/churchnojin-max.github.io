/*** ============================================================
 * ○○교회 — 재정 API (Apps Script 웹앱)
 * 역할: 구글시트(교적·재정)를 읽고/쓰는 보안 API.
 *   - 홈페이지에서 보낸 Supabase 로그인 토큰을 검증해
 *     "본인 헌금만 조회 / 재정관리는 권한자만" 을 서버에서 강제.
 *   - service_role 키는 이 스크립트의 '스크립트 속성'에만 보관(브라우저 노출 없음).
 *
 * [배포 전 1회 설정]
 *   1) ○○교회재정_장부 시트 ▸ 확장 프로그램 ▸ Apps Script 에 이 파일을 붙여넣기
 *   2) 좌측 톱니(프로젝트 설정) ▸ 스크립트 속성 ▸ 속성 추가:
 *        이름 : SUPABASE_SERVICE_KEY
 *        값   : (Supabase service_role 키)        ← 코드엔 절대 안 적음
 *   3) 편집기에서 함수 'setup' 한 번 실행(권한 허용) → 재정 시트에 탭 자동 생성
 *   4) 배포 ▸ 새 배포 ▸ 유형:웹 앱 ▸ 실행:나 ▸ 액세스:모든 사용자 ▸ 배포
 *   5) 나온 '웹 앱 URL'을 홈페이지 config 에 넣음(다음 단계에서 안내)
 * ============================================================ */

// ── 고정 설정(비밀 아님: 파일ID/공개URL/anon공개키) ──
var GYOJEOK_SHEET_ID = 'YOUR_GYOJEOK_SHEET_ID'; // ○○교회교적_데이터
var JAEJEONG_SHEET_ID = 'YOUR_JAEJEONG_SHEET_ID'; // ○○교회재정_장부
var YESAN_SHEET_ID = 'YOUR_YESAN_SHEET_ID';   // ○○교회재정_예산
var SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
var SUPABASE_ANON = 'YOUR_SUPABASE_ANON_KEY';

// ── 비밀: 스크립트 속성에서만 읽음 ──
function SERVICE_KEY_() {
  var k = PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_KEY');
  if (!k) throw new Error('스크립트 속성 SUPABASE_SERVICE_KEY 가 설정되지 않았습니다.');
  return k;
}

/* ============================================================
 * 1회 실행: 재정 시트 탭(전표/계정과목/예배) 생성 + 기본값 채우기
 * ============================================================ */
function setup() {
  var ss = SpreadsheetApp.openById(JAEJEONG_SHEET_ID);

  // 전표 탭(첫 시트 사용/이름 정리)
  var jeon = ss.getSheetByName('전표');
  if (!jeon) {
    jeon = ss.getSheets()[0];
    jeon.setName('전표');
  }
  if (jeon.getLastRow() < 1) {
    jeon.getRange(1, 1, 1, 13).setValues([[
      '전표ID', '일자', '구분', '종류', '계정', '예배', '헌금자', '매칭키', '금액', '수단', '적요', '등록자', '등록시각'
    ]]);
  }

  // 계정과목 탭
  if (!ss.getSheetByName('계정과목')) {
    var acc = ss.insertSheet('계정과목');
    acc.getRange(1, 1, 1, 4).setValues([['코드', '계정명', '구분', '분류']]);
    var accRows = [
      ['101', '십일조', '수입', '헌금'], ['102', '주일헌금', '수입', '헌금'],
      ['103', '감사헌금', '수입', '헌금'], ['104', '성일감사헌금', '수입', '헌금'],
      ['105', '구역헌금', '수입', '헌금'], ['106', '헌신예배헌금', '수입', '헌금'],
      ['107', '선교헌금', '수입', '헌금'], ['108', '건축헌금', '수입', '헌금'],
      ['109', '절기헌금', '수입', '헌금'], ['110', '장학헌금', '수입', '헌금'],
      ['111', '임직헌금', '수입', '헌금'], ['119', '기타헌금', '수입', '헌금'],
      ['150', '이자수입', '수입', '기타수입'], ['151', '기타수입', '수입', '기타수입'],
      ['201', '총회비', '지출', '상회비'], ['202', '노회비', '지출', '상회비'],
      ['203', '시찰비', '지출', '상회비'], ['204', '교역자회비', '지출', '상회비'],
      ['205', '세례의무금', '지출', '상회비'], ['206', '대외협력비', '지출', '상회비'],
      ['301', '교역자사례비', '지출', '인건비'], ['302', '직원급여', '지출', '인건비'],
      ['311', '사무비', '지출', '운영비'], ['312', '관리비(공과금)', '지출', '운영비'],
      ['313', '비품구입비', '지출', '운영비'], ['314', '수리유지비', '지출', '운영비'],
      ['401', '예배비', '지출', '사역비'], ['402', '교육비', '지출', '사역비'],
      ['403', '선교비', '지출', '사역비'], ['404', '전도비', '지출', '사역비'],
      ['405', '구제비', '지출', '사역비'], ['406', '심방비', '지출', '사역비'],
      ['407', '행사비', '지출', '사역비'], ['501', '건축비', '지출', '기타지출'],
      ['502', '예비비', '지출', '기타지출'], ['519', '기타지출', '지출', '기타지출']
    ];
    acc.getRange(2, 1, accRows.length, 4).setValues(accRows);
  }

  // 예배 탭
  if (!ss.getSheetByName('예배')) {
    var svc = ss.insertSheet('예배');
    svc.getRange(1, 1, 1, 2).setValues([['예배명', '순서']]);
    svc.getRange(2, 1, 6, 2).setValues([
      ['주일오전예배', 1], ['주일오후예배', 2], ['수요예배', 3],
      ['금요기도회', 4], ['새벽기도회', 5], ['절기/특별예배', 6]
    ]);
  }
  return '재정 시트 준비 완료 (전표/계정과목/예배)';
}

/* ============================================================
 * 웹앱 진입점
 *   - 홈페이지는 fetch(POST, Content-Type: text/plain) 로 호출(프리플라이트 회피)
 *   - body = JSON 문자열 { action, token, ... }
 * ============================================================ */
function doGet() {
  return json_({ ok: true, service: '○○교회재정 API', time: new Date().toISOString() });
}

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = req.action;
    if (action === 'match') return json_(actionMatch_(req));
    if (action === 'me') return json_(actionMe_(req));
    if (action === 'myOfferings') return json_(actionMyOfferings_(req));
    if (action === 'masters') return json_(actionMasters_(req));
    if (action === 'budget') return json_(actionBudget_(req));
    if (action === 'updateBudget') return json_(actionUpdateBudget_(req));
    if (action === 'listAccess') return json_(actionListAccess_(req));
    if (action === 'setAccess') return json_(actionSetAccess_(req));
    if (action === 'listGyojeok') return json_(actionListGyojeok_(req));
    if (action === 'addGyojeok') return json_(actionAddGyojeok_(req));
    if (action === 'updateGyojeok') return json_(actionUpdateGyojeok_(req));
    if (action === 'listVouchers') return json_(actionListVouchers_(req));
    if (action === 'addVoucher') return json_(actionAddVoucher_(req));
    if (action === 'addVouchersBulk') return json_(actionAddVouchersBulk_(req));
    if (action === 'updateVoucher') return json_(actionUpdateVoucher_(req));
    if (action === 'deleteVoucher') return json_(actionDeleteVoucher_(req));
    if (action === 'clearVouchers') return json_(actionClearVouchers_(req));
    if (action === 'exportSermonPdf') return json_(actionExportSermonPdf_(req));
    return json_({ ok: false, error: 'unknown action: ' + action });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

/* ============================================================
 * 액션들
 * ============================================================ */

// 교적 매칭(이름+생년월일) → 정/준회원 기록
function actionMatch_(req) {
  var user = verifyUser_(req.token);            // 토큰 검증(본인 확인)
  var name = String(req.name || '').trim();
  var birth = String(req.birth || '').replace(/[^0-9]/g, ''); // YYYYMMDD
  if (!name || birth.length !== 8) return { ok: false, error: '이름과 생년월일(YYYYMMDD)을 정확히 입력하세요.' };
  var key = name + '|' + birth;

  var hit = findGyojeokByKey_(key);
  if (hit) {
    upsertLink_(user.id, {
      member_status: '정회원', member_key: key,
      member_id: hit['교적ID'] ? Number(hit['교적ID']) : null,
      member_name: name, matched_at: new Date().toISOString(), updated_at: new Date().toISOString()
    });
    return { ok: true, status: '정회원', name: name };
  } else {
    upsertLink_(user.id, {
      member_status: '준회원', member_key: key, member_name: name,
      note: '교적 자동매칭 실패 — 관리자 승인 대기', updated_at: new Date().toISOString()
    });
    return { ok: true, status: '준회원', message: '교적에서 이름+생년월일이 일치하지 않습니다. 관리자 승인 후 정회원이 됩니다.' };
  }
}

// 내 상태(정/준회원, 재정권한) + 본인/배우자 매칭키
function actionMe_(req) {
  var user = verifyUser_(req.token);
  var link = getLink_(user.id);
  var memberKey = link && link.member_key ? String(link.member_key) : '';
  var spouse = '', spouseKey = '';
  if (link && link.member_status === '정회원' && memberKey) {
    var meRow = findGyojeokByKey_(memberKey);
    if (meRow && meRow['배우자매칭키']) { spouseKey = String(meRow['배우자매칭키']); spouse = meRow['배우자'] || ''; }
    // Supabase 헌금 RLS(본인+배우자 합산)용 spouse_key 동기화
    try { upsertLink_(user.id, { spouse_key: spouseKey, updated_at: new Date().toISOString() }); } catch (e) {}
  }
  return {
    ok: true,
    email: user.email,
    status: link ? link.member_status : '준회원',
    memberName: link ? link.member_name : '',
    memberKey: memberKey,
    spouse: spouse,
    spouseKey: spouseKey,
    canFinance: isAdmin_(user.id) || (link ? !!link.can_finance : false)
  };
}

// 본인 헌금 조회(정회원 + 매칭키 보유 시 본인 것만)
function actionMyOfferings_(req) {
  var user = verifyUser_(req.token);
  var link = getLink_(user.id);
  if (!link || link.member_status !== '정회원' || !link.member_key) {
    return { ok: true, status: link ? link.member_status : '준회원', offerings: [], total: 0 };
  }
  // 부부 합산: 내 매칭키 + 배우자 매칭키 모두 조회(가정 헌금)
  var selfKey = String(link.member_key);
  var keys = {}; keys[selfKey] = true;
  var meRow = findGyojeokByKey_(link.member_key);
  var spouseName = '';
  var spouseKey = '';
  if (meRow && meRow['배우자매칭키']) { spouseKey = String(meRow['배우자매칭키']); keys[spouseKey] = true; spouseName = meRow['배우자'] || ''; }
  var rows = readObjects_(JAEJEONG_SHEET_ID, '전표');
  var mine = rows.filter(function (r) { return keys[String(r['매칭키'])] && String(r['종류']) === '헌금'; });
  mine.sort(function (a, b) { return String(b['일자']).localeCompare(String(a['일자'])); });
  var total = 0;
  var out = mine.map(function (r) {
    var amt = Number(r['금액']) || 0; total += amt;
    var mk = String(r['매칭키']);
    // 본인/배우자 구분(매칭키 기준) — 프런트의 [본인·배우자] 분리 조회용
    return { date: ymd_(r['일자']), account: r['계정'], service: r['예배'], amount: amt, memo: r['적요'], giver: r['헌금자'] || '', who: (spouseKey && mk === spouseKey) ? 'spouse' : 'self' };
  });
  return { ok: true, status: '정회원', memberName: link.member_name, spouse: spouseName, offerings: out, total: total };
}

// 재정관리 화면용 기초데이터(권한자만)
function actionMasters_(req) {
  var user = verifyUser_(req.token);
  requireFinance_(user.id);
  var members = readObjects_(GYOJEOK_SHEET_ID, '교적').map(function (m) {
    return { name: m['이름'], key: m['매칭키'], birth: m['생년월일'], group: m['그룹'], role: m['직책'] || '',
             spouse: m['배우자'] || '', spouseKey: m['배우자매칭키'] || '', head: m['세대주'] || '', rel: m['관계'] || '' };
  }).filter(function (m) { return m.name; });
  var accounts = readObjects_(JAEJEONG_SHEET_ID, '계정과목');
  var services = readObjects_(JAEJEONG_SHEET_ID, '예배');
  return { ok: true, members: members, accounts: accounts, services: services };
}

// 예산 조회(권한자만) — ○○교회재정_예산 시트
function actionBudget_(req) {
  var user = verifyUser_(req.token);
  requireFinance_(user.id);
  var rows = readObjects_(YESAN_SHEET_ID, '○○교회재정_예산');
  if (!rows.length) rows = readObjects_(YESAN_SHEET_ID, SpreadsheetApp.openById(YESAN_SHEET_ID).getSheets()[0].getName());
  return { ok: true, budget: rows };
}

// 예산 금년예산 수정(권한자만) — ○○교회재정_예산 시트에 직접 기록
function actionUpdateBudget_(req) {
  var user = verifyUser_(req.token);
  requireFinance_(user.id);
  var ss = SpreadsheetApp.openById(YESAN_SHEET_ID);
  var sh = ss.getSheetByName('○○교회재정_예산') || ss.getSheets()[0];
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return { ok: false, error: '예산 시트가 비어 있습니다.' };
  var head = data[0];
  var codeCol = head.indexOf('계정코드');
  var amtCol = head.indexOf('예산');
  if (codeCol < 0) codeCol = head.indexOf('코드');
  if (codeCol < 0 || amtCol < 0) return { ok: false, error: '예산 시트에 계정코드/예산 열이 필요합니다.' };
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][codeCol]) === String(req.code)) {
      sh.getRange(i + 1, amtCol + 1).setValue(Number(req.amount) || 0);
      return { ok: true };
    }
  }
  return { ok: false, error: '예산 항목을 찾을 수 없습니다: ' + req.code };
}

// ── 관리자(교적관리)용: 회원 접근권한 목록 ──
// 가입회원(profiles) + 정/준회원(member_links) + 관리자(admins) + 재정권한 병합
function actionListAccess_(req) {
  var user = verifyUser_(req.token);
  requireAdmin_(user.id);
  var profiles = sbAdmin_('get', '/rest/v1/profiles?select=id,name,email');
  var links = sbAdmin_('get', '/rest/v1/member_links?select=user_id,member_status,member_name,can_finance');
  var admins = sbAdmin_('get', '/rest/v1/admins?select=uid');
  var linkMap = {}; links.forEach(function (l) { linkMap[l.user_id] = l; });
  var adminSet = {}; admins.forEach(function (a) { adminSet[a.uid] = true; });
  var out = profiles.map(function (p) {
    var l = linkMap[p.id] || {};
    return { uid: p.id, name: l.member_name || p.name || '', email: p.email || '',
             status: l.member_status || '준회원', canFinance: !!l.can_finance, isAdmin: !!adminSet[p.id] };
  });
  return { ok: true, users: out };
}

// 관리자/재정권한 부여·회수 (관리자만, service_role로 기록)
function actionSetAccess_(req) {
  var user = verifyUser_(req.token);
  requireAdmin_(user.id);
  var uid = req.targetUid;
  if (!uid) return { ok: false, error: '대상 사용자가 없습니다.' };
  if (typeof req.isAdmin === 'boolean') {
    if (req.isAdmin) sbAdmin_('post', '/rest/v1/admins?on_conflict=uid', { uid: uid }, { 'Prefer': 'resolution=merge-duplicates,return=minimal' });
    else sbAdmin_('delete', '/rest/v1/admins?uid=eq.' + uid, null, { 'Prefer': 'return=minimal' });
  }
  if (typeof req.canFinance === 'boolean') {
    sbAdmin_('post', '/rest/v1/member_links?on_conflict=user_id', { user_id: uid, can_finance: req.canFinance, updated_at: new Date().toISOString() }, { 'Prefer': 'resolution=merge-duplicates,return=minimal' });
  }
  return { ok: true };
}

// 교적 명단(관리자만)
function actionListGyojeok_(req) {
  var user = verifyUser_(req.token);
  requireAdmin_(user.id);
  return { ok: true, members: readObjects_(GYOJEOK_SHEET_ID, '교적') };
}

// 교적 신규 등록(재정권한자) — 헌금 입력 중 새 이름을 즉시 교적에 추가
//  - 생년월일 없이 이름만으로도 등록 가능(매칭키='이름|')
function actionAddGyojeok_(req) {
  var user = verifyUser_(req.token);
  requireFinance_(user.id);
  var name = String(req.name || '').trim();
  if (!name) return { ok: false, error: '이름은 필수입니다.' };
  var birth = String(req.birth || '').replace(/[^0-9]/g, ''); // YYYYMMDD 또는 빈값
  if (birth && birth.length !== 8) return { ok: false, error: '생년월일은 8자리(YYYYMMDD)로 입력하거나 비워 두세요.' };
  var key = name + '|' + birth;
  var dup = findGyojeokByKey_(key);
  if (dup) return { ok: true, key: key, name: name, dup: true };
  var sh = SpreadsheetApp.openById(GYOJEOK_SHEET_ID).getSheetByName('교적');
  if (!sh) return { ok: false, error: '교적 시트를 찾을 수 없습니다.' };
  var head = sh.getDataRange().getValues()[0];
  var birthStr = birth ? (birth.slice(0, 4) + '-' + birth.slice(4, 6) + '-' + birth.slice(6, 8)) : '';
  var row = head.map(function (h) {
    if (h === '이름') return name;
    if (h === '생년월일') return birthStr;
    if (h === '매칭키') return key;
    if (h === '교적ID') return 'M' + Date.now();
    if (h === '회원상태') return '헌금등록';
    return '';
  });
  sh.appendRow(row);
  return { ok: true, key: key, name: name, added: true };
}

// 교적 수정(관리자만) — 교적ID로 행을 찾아 지정 항목 수정. 사진 열 없으면 자동 생성.
function actionUpdateGyojeok_(req) {
  var user = verifyUser_(req.token);
  requireAdmin_(user.id);
  var id = String(req.id || '');
  var fields = req.fields || {};
  if (!id) return { ok: false, error: '교적ID가 없습니다.' };
  var sh = SpreadsheetApp.openById(GYOJEOK_SHEET_ID).getSheetByName('교적');
  if (!sh) return { ok: false, error: '교적 시트를 찾을 수 없습니다.' };
  var data = sh.getDataRange().getValues();
  var head = data[0];
  // 들어온 필드 중 헤더에 없는 열(예: 사진)은 끝에 추가
  Object.keys(fields).forEach(function (k) {
    if (head.indexOf(k) < 0) { head.push(k); sh.getRange(1, head.length).setValue(k); }
  });
  var idCol = head.indexOf('교적ID');
  if (idCol < 0) return { ok: false, error: '교적 시트에 교적ID 열이 없습니다.' };
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === id) {
      Object.keys(fields).forEach(function (k) { var c = head.indexOf(k); if (c >= 0) sh.getRange(i + 1, c + 1).setValue(fields[k] == null ? '' : fields[k]); });
      // 이름/생년월일 바뀌면 매칭키 재계산
      var keyCol = head.indexOf('매칭키'), nameCol = head.indexOf('이름'), birthCol = head.indexOf('생년월일');
      var finalKey = keyCol >= 0 ? data[i][keyCol] : '';
      if (keyCol >= 0 && (('이름' in fields) || ('생년월일' in fields))) {
        var nm = ('이름' in fields) ? fields['이름'] : data[i][nameCol];
        var bdRaw = ('생년월일' in fields) ? fields['생년월일'] : ymd_(data[i][birthCol]);
        var bstr = String(bdRaw || '').replace(/[^0-9]/g, '').slice(0, 8);
        finalKey = String(nm).trim() + '|' + bstr;
        sh.getRange(i + 1, keyCol + 1).setValue(finalKey);
      }
      // 회원상태=정회원이면 연결된 홈페이지 계정도 정회원으로 자동 승격
      var promoted = false;
      if (String(fields['회원상태'] || '') === '정회원' && finalKey) {
        try {
          sbAdmin_('patch', '/rest/v1/member_links?member_key=eq.' + encodeURIComponent(finalKey),
            { member_status: '정회원', updated_at: new Date().toISOString() }, { 'Prefer': 'return=minimal' });
          promoted = true;
        } catch (e) { /* 연결 계정 없으면 무시 */ }
      }
      return { ok: true, promoted: promoted };
    }
  }
  return { ok: false, error: '교적을 찾을 수 없습니다: ' + id };
}

// 전표 목록(권한자만)
function actionListVouchers_(req) {
  var user = verifyUser_(req.token);
  requireFinance_(user.id);
  var rows = readObjects_(JAEJEONG_SHEET_ID, '전표');
  rows.forEach(function (r) { r['일자'] = ymd_(r['일자']); }); // 시트가 날짜로 바꾼 값을 문자열로 정규화
  if (req.from) rows = rows.filter(function (r) { return String(r['일자']) >= req.from; });
  if (req.to) rows = rows.filter(function (r) { return String(r['일자']) <= req.to; });
  rows.sort(function (a, b) { return String(b['일자']).localeCompare(String(a['일자'])); });
  return { ok: true, vouchers: rows };
}

// 전표 추가(권한자만)
function actionAddVoucher_(req) {
  var user = verifyUser_(req.token);
  requireFinance_(user.id);
  var v = req.voucher || {};
  var sh = SpreadsheetApp.openById(JAEJEONG_SHEET_ID).getSheetByName('전표');
  var id = 'V' + Date.now();
  sh.appendRow([
    id, v.date || '', v.type || '', v.kind || '', v.account || '', v.service || '',
    v.payer || '', v.memberKey || '', Number(v.amount) || 0, v.method || '',
    v.memo || '', user.email || '', new Date().toISOString()
  ]);
  return { ok: true, id: id };
}

// 전표 일괄 추가(권한자만) — 명단 붙여넣기 등에서 여러 건을 한 번에 저장
function actionAddVouchersBulk_(req) {
  var user = verifyUser_(req.token);
  requireFinance_(user.id);
  var vs = req.vouchers || [];
  if (!vs.length) return { ok: true, count: 0, ids: [] };
  var sh = SpreadsheetApp.openById(JAEJEONG_SHEET_ID).getSheetByName('전표');
  var now = new Date().toISOString();
  var base = Date.now();
  var rows = vs.map(function (v, i) {
    return [
      'V' + base + '_' + i, v.date || '', v.type || '', v.kind || '', v.account || '', v.service || '',
      v.payer || '', v.memberKey || '', Number(v.amount) || 0, v.method || '',
      v.memo || '', user.email || '', now
    ];
  });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  return { ok: true, count: rows.length, ids: rows.map(function (r) { return r[0]; }) };
}

// 전표 일괄 삭제(권한자만) — 구분(수입/지출)별 전체 비우기. type 미지정이면 전체.
//  · 헤더와 미일치 행은 보존하고 시트를 다시 써서 안전하게 처리.
function actionClearVouchers_(req) {
  var user = verifyUser_(req.token);
  requireFinance_(user.id);
  var type = req.type ? String(req.type) : ''; // '수입' | '지출' | ''(전체)
  var sh = SpreadsheetApp.openById(JAEJEONG_SHEET_ID).getSheetByName('전표');
  if (!sh) return { ok: false, error: '전표 시트를 찾을 수 없습니다.' };
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return { ok: true, deleted: 0 };
  var head = data[0];
  var gi = head.indexOf('구분');
  if (type && gi < 0) return { ok: false, error: '전표 시트에 "구분" 열이 없습니다.' };
  var kept = [head], deleted = 0;
  for (var i = 1; i < data.length; i++) {
    var match = type ? (String(data[i][gi]) === type) : true;
    if (match) deleted++; else kept.push(data[i]);
  }
  sh.getRange(1, 1, data.length, head.length).clearContent();
  if (kept.length) sh.getRange(1, 1, kept.length, head.length).setValues(kept);
  return { ok: true, deleted: deleted, kept: kept.length - 1 };
}

// 전표 수정(권한자만)
function actionUpdateVoucher_(req) {
  var user = verifyUser_(req.token);
  requireFinance_(user.id);
  var sh = SpreadsheetApp.openById(JAEJEONG_SHEET_ID).getSheetByName('전표');
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(req.id)) {
      var v = req.voucher || {};
      sh.getRange(i + 1, 2, 1, 10).setValues([[
        v.date, v.type, v.kind, v.account, v.service, v.payer, v.memberKey, Number(v.amount) || 0, v.method, v.memo
      ]]);
      return { ok: true };
    }
  }
  return { ok: false, error: '전표를 찾을 수 없습니다: ' + req.id };
}

// 전표 삭제(권한자만)
function actionDeleteVoucher_(req) {
  var user = verifyUser_(req.token);
  requireFinance_(user.id);
  var sh = SpreadsheetApp.openById(JAEJEONG_SHEET_ID).getSheetByName('전표');
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(req.id)) { sh.deleteRow(i + 1); return { ok: true }; }
  }
  return { ok: false, error: '전표를 찾을 수 없습니다: ' + req.id };
}

// 설교문을 PDF로 만들어 구글드라이브 "설교 ▸ YYYY년 M월" 폴더에 저장(관리자 전용)
function actionExportSermonPdf_(req) {
  var user = verifyUser_(req.token);
  requireAdmin_(user.id);
  var date = String(req.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('일자 형식이 올바르지 않습니다(YYYY-MM-DD).');
  var title = String(req.title || '(제목없음)');
  var service = String(req.service || '');
  var preacher = String(req.preacher || '');
  var scripture = String(req.scripture || '');
  var bibleText = String(req.bibleText || '');
  var contentHtml = String(req.contentHtml || '');

  var y = date.slice(0, 4);
  // 폴더 구조: '{연도}설교 / {예배명} / {일자 제목}.pdf'  (예: 2026설교/새벽기도/2026-07-02 폭풍 속의 주.pdf)
  var rootName = y + '설교';
  var svcName = (service || '기타').replace(/[\\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim() || '기타';
  var rootFolder = getOrCreateFolder_(DriveApp.getRootFolder(), rootName);
  var targetFolder = getOrCreateFolder_(rootFolder, svcName);

  var SERIF = 'Noto Serif KR';
  var NAVY = '#1f3a63', INK = '#1a1a1a', SUB = '#8a8f99', BIBLE = '#33445c';

  var doc = DocumentApp.create(date + ' ' + title);
  var body = doc.getBody();
  body.clear();
  // 아이패드(4:3 화면) 보기에 맞춘 페이지: 576×768pt(3:4 비율) · 여백 상하 44 / 좌우 48pt
  body.setPageWidth(576).setPageHeight(768);
  body.setMarginTop(44).setMarginBottom(44).setMarginLeft(48).setMarginRight(48);

  // 시리즈 · 몇 번째 설교 (제목 왼쪽 위, 작게)
  var seriesLine = String(req.seriesLine || '');
  if (seriesLine) setP_(body.appendParagraph('📚 ' + seriesLine), { size: 10, bold: true, font: SERIF, color: NAVY, after: 4 });

  // 제목 (가운데, 크게)
  setP_(body.appendParagraph(title), { size: 26, bold: true, font: SERIF, color: INK, align: 'center', after: 6 });

  // 메타 (일자 · 예배 · 본문 · 설교자)
  var meta = [fmtDateK_(date), service, scripture, preacher].filter(function (s) { return s; }).join('   ·   ');
  if (meta) setP_(body.appendParagraph(meta), { size: 11, font: SERIF, color: SUB, align: 'center', after: 16 });

  body.appendHorizontalRule();

  // 성경 본문(개역개정)
  if (bibleText.replace(/\s/g, '')) {
    setP_(body.appendParagraph('성경 본문  ·  개역개정'), { size: 12, bold: true, font: SERIF, color: NAVY, before: 16, after: 8 });
    bibleText.split(/\n+/).forEach(function (line) {
      line = line.replace(/\s+$/, '').trim();
      if (!line) return;
      setP_(body.appendParagraph(line), { size: 14, font: SERIF, color: BIBLE, lineSpacing: 1.55, after: 3, indentStart: 6 });
    });
    body.appendHorizontalRule();
  }

  // 설교 원고 (본문 16pt)
  setP_(body.appendParagraph('설교 원고'), { size: 12, bold: true, font: SERIF, color: NAVY, before: 16, after: 10 });
  var plain = htmlToPlainText_(contentHtml);
  var paras = plain.length ? plain.split(/\n{2,}/) : ['(설교 원고가 비어 있습니다)'];
  paras.forEach(function (p) {
    var t = p.replace(/\n/g, ' ').trim();
    if (!t) return;
    setP_(body.appendParagraph(t), { size: 16, font: SERIF, color: INK, lineSpacing: 1.7, after: 12 });
  });

  doc.saveAndClose();

  var docFile = DriveApp.getFileById(doc.getId());
  var pdfBlob = docFile.getAs('application/pdf');
  var fileName = date + ' ' + title + '.pdf';
  pdfBlob.setName(fileName);
  var pdfFile = targetFolder.createFile(pdfBlob);
  docFile.setTrashed(true); // 중간 생성된 구글 문서는 정리

  return { ok: true, url: pdfFile.getUrl(), fileName: fileName, folder: rootName + '/' + svcName };
}

// 문단 스타일 적용 헬퍼 (Google Docs)
function setP_(p, o) {
  o = o || {};
  var A = DocumentApp.Attribute, at = {};
  if (o.size != null) at[A.FONT_SIZE] = o.size;
  if (o.bold != null) at[A.BOLD] = o.bold;
  if (o.italic != null) at[A.ITALIC] = o.italic;
  if (o.font != null) at[A.FONT_FAMILY] = o.font;
  if (o.color != null) at[A.FOREGROUND_COLOR] = o.color;
  if (o.lineSpacing != null) at[A.LINE_SPACING] = o.lineSpacing;
  if (o.before != null) at[A.SPACING_BEFORE] = o.before;
  if (o.after != null) at[A.SPACING_AFTER] = o.after;
  if (o.indentStart != null) at[A.INDENT_START] = o.indentStart;
  p.setAttributes(at);
  if (o.align === 'center') p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  else if (o.align === 'right') p.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  return p;
}

// "2026-07-02" → "2026년 7월 2일 (목)"
function fmtDateK_(ymd) {
  var mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  if (!mm) return String(ymd || '');
  var wd = ['일', '월', '화', '수', '목', '금', '토'];
  var d = new Date(Number(mm[1]), Number(mm[2]) - 1, Number(mm[3]));
  return mm[1] + '년 ' + Number(mm[2]) + '월 ' + Number(mm[3]) + '일 (' + wd[d.getDay()] + ')';
}

function getOrCreateFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

// 리치텍스트(HTML) → 평문(줄바꿈 유지, 구글 문서용)
function htmlToPlainText_(html) {
  if (!html) return '';
  var s = String(html);
  s = s.replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, '$&\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

/* ============================================================
 * 보안/유틸
 * ============================================================ */

// Supabase 토큰 검증 → { id, email }  (위조 불가: Supabase 서버가 검증)
function verifyUser_(token) {
  if (!token) throw new Error('로그인이 필요합니다(토큰 없음).');
  var res = UrlFetchApp.fetch(SUPABASE_URL + '/auth/v1/user', {
    method: 'get', muteHttpExceptions: true,
    headers: { 'Authorization': 'Bearer ' + token, 'apikey': SUPABASE_ANON }
  });
  if (res.getResponseCode() !== 200) throw new Error('로그인 토큰이 유효하지 않습니다.');
  var u = JSON.parse(res.getContentText());
  if (!u || !u.id) throw new Error('사용자 정보를 확인할 수 없습니다.');
  return { id: u.id, email: u.email };
}

// 재정 접근 권한 강제(관리자거나 can_finance)
function requireFinance_(uid) {
  if (isAdmin_(uid)) return true;
  var link = getLink_(uid);
  if (link && link.can_finance) return true;
  throw new Error('재정관리 접근 권한이 없습니다.');
}

function isAdmin_(uid) {
  var r = sbAdmin_('get', '/rest/v1/admins?uid=eq.' + uid + '&select=uid');
  return r.length > 0;
}
function requireAdmin_(uid) {
  if (!isAdmin_(uid)) throw new Error('관리자만 접근할 수 있습니다.');
  return true;
}
function getLink_(uid) {
  var r = sbAdmin_('get', '/rest/v1/member_links?user_id=eq.' + uid + '&select=*');
  return r.length ? r[0] : null;
}
function upsertLink_(uid, fields) {
  fields.user_id = uid;
  sbAdmin_('post', '/rest/v1/member_links?on_conflict=user_id', fields, { 'Prefer': 'resolution=merge-duplicates,return=minimal' });
}

// Supabase REST 호출(service_role → RLS 우회). 서버 전용.
function sbAdmin_(method, path, body, extraHeaders) {
  var key = SERVICE_KEY_();
  var headers = { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' };
  if (extraHeaders) for (var h in extraHeaders) headers[h] = extraHeaders[h];
  var opt = { method: method, headers: headers, muteHttpExceptions: true };
  if (body) opt.payload = JSON.stringify(body);
  var res = UrlFetchApp.fetch(SUPABASE_URL + path, opt);
  var code = res.getResponseCode();
  if (code >= 300) throw new Error('Supabase 오류 ' + code + ': ' + res.getContentText());
  var txt = res.getContentText();
  return txt ? JSON.parse(txt) : [];
}

// 시트 → 객체배열(첫 행을 헤더로)
function readObjects_(sheetId, tabName) {
  var sh = SpreadsheetApp.openById(sheetId).getSheetByName(tabName);
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  var head = data[0];
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var o = {}; var blank = true;
    for (var c = 0; c < head.length; c++) { o[head[c]] = data[i][c]; if (data[i][c] !== '') blank = false; }
    if (!blank) out.push(o);
  }
  return out;
}

function findGyojeokByKey_(key) {
  var rows = readObjects_(GYOJEOK_SHEET_ID, '교적');
  for (var i = 0; i < rows.length; i++) if (String(rows[i]['매칭키']) === key) return rows[i];
  return null;
}

// 날짜 정규화: 시트가 날짜로 바꾼 Date → 'YYYY-MM-DD' 문자열, 그 외는 앞 10자
function ymd_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v == null ? '' : v).slice(0, 10);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

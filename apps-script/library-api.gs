/****************************************************************
 * 노진교회 — 나의 도서관 (구글 드라이브 책 목록 웹앱) · 캐시판 + 중복 정리
 * --------------------------------------------------------------
 * 폴더가 많으면 한 번에 다 훑다가 구글의 6분 제한에 걸린다.
 * 그래서 목록을 미리 만들어 파일 하나에 저장해 두고, 홈페이지는
 * 그 저장본만 읽는다. 만드는 일은 시간이 모자라면 스스로 이어서 한다.
 *
 * ▼ 설정 (한 번만)
 *   1) 기존 코드 전체를 이 코드로 교체 → 저장(Ctrl+S)
 *   2) 왼쪽 '서비스(Services)' + → "Drive API" 추가 (이미 하셨으면 OK)
 *   3) rebuildNow 실행 → 목록 만들기 시작 (권한 승인 창이 뜨면 허용)
 *   4) 잠시 뒤 checkStatus 실행 → "완성: N권"이 뜨면 끝
 *   5) 배포 ▸ 배포 관리 ▸ 연필 ▸ 버전 "새 버전" ▸ 배포 (주소는 그대로)
 *
 * ▼ 책을 새로 올린 뒤
 *   rebuildNow 를 다시 실행하거나 웹앱 주소 뒤에 ?refresh=1 을 붙여 한 번 연다.
 *   setupDailyRefresh 를 한 번 실행해 두면 매일 새벽 4시에 저절로 갱신된다.
 *
 * ▼ 중복 정리 (원본을 지우지 않는다 — 폴더만 옮긴다)
 *   1) planDuplicates   → 내용이 완전히 같은 파일을 찾아 옮길 목록을 만든다(옮기지는 않음)
 *   2) checkStatus      → 몇 권이 옮겨질지 확인
 *   3) moveDuplicatesNow→ '중복(검토용)' 폴더로 실제로 옮긴다(시간이 걸리면 이어서 돈다)
 *   4) undoMoveDuplicates → 옮긴 것을 전부 제자리로 되돌린다
 ****************************************************************/

var FOLDER_ID = '1ZhcNP93jnTE9EDCKCQ8HD9Cf8VJTU3OL';   // 책PDF 폴더 ID (노진교회)
var BOOK_EXT = /\.(pdf|epub|hwp|hwpx|docx?|txt)$/i;
var FOLDER_MIME = 'application/vnd.google-apps.folder';

var CACHE_NAME = 'library-cache.json';          // 완성된 목록(홈페이지가 읽는 것)
var STATE_NAME = 'library-build-state.json';    // 목록 만드는 중간 상태
var HASH_NAME = 'library-hashes.json';          // 파일 지문(중복 판정용)
var PLAN_NAME = 'library-dup-plan.json';        // 옮길 목록
var LOG_NAME = 'library-dup-log.json';          // 옮긴 기록(되돌리기용)
var DUP_FOLDER_NAME = '중복(검토용)';

var TIME_BUDGET_MS = 4 * 60 * 1000;             // 한 번에 4분까지만 일하고 넘긴다(제한 6분)
var MOVE_BUDGET_MS = 3.5 * 60 * 1000;
var PARENT_CHUNK = 25;                          // 폴더 25개를 한 번의 조회로 묶는다
var BACKUP_HINT = /백업/;                       // 남길 한 벌을 고를 때 뒤로 미룰 폴더

/* ══════════════ 홈페이지가 부르는 곳 ══════════════ */

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.refresh === '1') {
      startBuild_();
      return json_({ ok: false, building: true, error: '목록을 새로 만드는 중입니다. 몇 분 뒤 다시 열어 주세요.' });
    }
    var f = findFile_(CACHE_NAME);
    if (!f) {
      startBuild_();
      return json_({ ok: false, building: true, error: '목록을 아직 만들지 않았습니다. 지금 만들기 시작했으니 몇 분 뒤 다시 열어 주세요.' });
    }
    return ContentService.createTextOutput(f.getBlob().getDataAsString('UTF-8'))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

/* ══════════════ 목록 만들기 ══════════════ */

function rebuildNow() {
  startBuild_();
  buildLibraryCache();
}

function startBuild_() {
  clearTriggersFor_('buildLibraryCache');
  saveJson_(STATE_NAME, { queue: [{ id: FOLDER_ID, cat: '' }], books: [], hashes: [], started: new Date().toISOString() });
}

function buildLibraryCache() {
  var t0 = Date.now();
  var st = readJson_(STATE_NAME);
  if (!st) st = { queue: [{ id: FOLDER_ID, cat: '' }], books: [], hashes: [], started: new Date().toISOString() };
  if (!st.hashes) st.hashes = [];

  while (st.queue.length && Date.now() - t0 < TIME_BUDGET_MS) {
    var chunk = st.queue.splice(0, PARENT_CHUNK);
    var catById = {};
    for (var c = 0; c < chunk.length; c++) catById[chunk[c].id] = chunk[c].cat;

    var q = '(' + chunk.map(function (n) { return "'" + n.id + "' in parents"; }).join(' or ') + ') and trashed = false';
    var pageToken = null;
    do {
      var params = { q: q, pageSize: 1000, fields: 'nextPageToken, files(id,name,mimeType,parents,md5Checksum,size)' };
      if (pageToken) params.pageToken = pageToken;
      var res = Drive.Files.list(params);
      var files = res.files || [];
      for (var i = 0; i < files.length; i++) {
        var it = files[i];
        var pid = parentIn_(it.parents, catById);
        var pcat = pid ? catById[pid] : '';
        if (it.mimeType === FOLDER_MIME) {
          st.queue.push({ id: it.id, cat: pcat || it.name });      // 최상위 하위폴더명 = 분류
        } else if (BOOK_EXT.test(it.name || '')) {
          var title = String(it.name).replace(BOOK_EXT, '').trim();
          st.books.push({ id: it.id, title: title, author: '', category: pcat || '' });
          if (it.md5Checksum) {
            st.hashes.push({ id: it.id, md5: it.md5Checksum, sz: Number(it.size || 0), p: pid || '', c: pcat || '', t: title });
          }
        }
      }
      pageToken = res.nextPageToken;
    } while (pageToken);
  }

  if (st.queue.length) {          // 아직 남았다 — 저장하고 1분 뒤 이어서
    saveJson_(STATE_NAME, st);
    clearTriggersFor_('buildLibraryCache');
    ScriptApp.newTrigger('buildLibraryCache').timeBased().after(60 * 1000).create();
    Logger.log('진행 중… 지금까지 ' + st.books.length + '권, 남은 폴더 ' + st.queue.length + '개');
    return;
  }

  st.books.sort(function (a, b) { return a.title < b.title ? -1 : (a.title > b.title ? 1 : 0); });
  saveJson_(CACHE_NAME, { ok: true, count: st.books.length, built: new Date().toISOString(), books: st.books });
  saveJson_(HASH_NAME, { count: st.hashes.length, built: new Date().toISOString(), files: st.hashes });
  removeFile_(STATE_NAME);
  clearTriggersFor_('buildLibraryCache');
  Logger.log('완성: ' + st.books.length + '권 (지문 ' + st.hashes.length + '개)');
}

/* ══════════════ 중복 찾기 ══════════════ */

/**
 * 내용이 완전히 같은 파일(지문+크기가 같은 것)만 중복으로 본다.
 * 이름이 같아도 내용이 다르면 건드리지 않는다.
 * 한 벌은 반드시 남긴다 — 백업 폴더가 아닌 쪽을 우선 남긴다.
 */
function planDuplicates() {
  var h = readJson_(HASH_NAME);
  if (!h) { Logger.log('먼저 rebuildNow 로 목록을 만들어 주세요.'); return; }

  var groups = {};
  for (var i = 0; i < h.files.length; i++) {
    var f = h.files[i];
    var key = f.md5 + ':' + f.sz;
    (groups[key] || (groups[key] = [])).push(f);
  }

  var plan = [], kinds = 0;
  for (var k in groups) {
    var g = groups[k];
    if (g.length < 2) continue;
    kinds++;
    g.sort(function (a, b) {                       // 남길 한 벌을 앞으로
      var ab = BACKUP_HINT.test(a.c) ? 1 : 0, bb = BACKUP_HINT.test(b.c) ? 1 : 0;
      if (ab !== bb) return ab - bb;               // 백업 폴더는 뒤로
      return a.id < b.id ? -1 : 1;
    });
    for (var j = 1; j < g.length; j++) plan.push({ id: g[j].id, from: g[j].p, t: g[j].t, c: g[j].c });
  }

  saveJson_(PLAN_NAME, { made: new Date().toISOString(), kinds: kinds, count: plan.length, items: plan });
  Logger.log('내용이 같은 책 ' + kinds + '종 발견 · 옮길 사본 ' + plan.length + '권');
  Logger.log('확인되셨으면 moveDuplicatesNow 를 실행하세요. (되돌리기: undoMoveDuplicates)');
}

/* ══════════════ 중복 옮기기 (지우지 않는다) ══════════════ */

function moveDuplicatesNow() {
  var t0 = Date.now();
  var plan = readJson_(PLAN_NAME);
  if (!plan || !plan.items || !plan.items.length) { Logger.log('옮길 목록이 없습니다. planDuplicates 를 먼저 실행하세요.'); return; }

  var dup = dupFolder_();
  var log = readJson_(LOG_NAME) || { moved: [] };
  var moved = 0, failed = 0;

  while (plan.items.length && Date.now() - t0 < MOVE_BUDGET_MS) {
    var it = plan.items.shift();
    try {
      var file = DriveApp.getFileById(it.id);
      var parents = [], pit = file.getParents();
      while (pit.hasNext()) parents.push(pit.next().getId());
      file.moveTo(dup);
      log.moved.push({ id: it.id, from: parents, t: it.t });
      moved++;
    } catch (e) {
      failed++;
    }
  }

  saveJson_(PLAN_NAME, plan);
  saveJson_(LOG_NAME, log);

  if (plan.items.length) {
    clearTriggersFor_('moveDuplicatesNow');
    ScriptApp.newTrigger('moveDuplicatesNow').timeBased().after(60 * 1000).create();
    Logger.log('옮기는 중… 이번에 ' + moved + '권(실패 ' + failed + ') · 남은 ' + plan.items.length + '권');
    return;
  }
  clearTriggersFor_('moveDuplicatesNow');
  Logger.log('옮기기 끝. 누적 ' + log.moved.length + '권이 "' + DUP_FOLDER_NAME + '" 폴더에 있습니다.');
  Logger.log('목록에 반영하려면 rebuildNow 를 실행하세요.');
}

/** 옮긴 것을 전부 제자리로 되돌린다 */
function undoMoveDuplicates() {
  var t0 = Date.now();
  var log = readJson_(LOG_NAME);
  if (!log || !log.moved || !log.moved.length) { Logger.log('되돌릴 기록이 없습니다.'); return; }

  var back = 0, failed = 0;
  while (log.moved.length && Date.now() - t0 < MOVE_BUDGET_MS) {
    var m = log.moved.pop();
    try {
      var file = DriveApp.getFileById(m.id);
      if (m.from && m.from.length) file.moveTo(DriveApp.getFolderById(m.from[0]));
      back++;
    } catch (e) { failed++; }
  }
  saveJson_(LOG_NAME, log);

  if (log.moved.length) {
    clearTriggersFor_('undoMoveDuplicates');
    ScriptApp.newTrigger('undoMoveDuplicates').timeBased().after(60 * 1000).create();
    Logger.log('되돌리는 중… 이번에 ' + back + '권(실패 ' + failed + ') · 남은 ' + log.moved.length + '권');
    return;
  }
  clearTriggersFor_('undoMoveDuplicates');
  Logger.log('되돌리기 끝.');
}

/* ══════════════ 상태 확인·자동 갱신 ══════════════ */

function checkStatus() {
  var cache = readJson_(CACHE_NAME);
  if (cache) Logger.log('목록 완성: ' + cache.count + '권 (만든 시각 ' + cache.built + ')');
  else Logger.log('완성본 없음');

  var st = readJson_(STATE_NAME);
  if (st) Logger.log('목록 만드는 중… 지금까지 ' + st.books.length + '권, 남은 폴더 ' + st.queue.length + '개');

  var plan = readJson_(PLAN_NAME);
  if (plan) Logger.log('중복 계획: ' + plan.kinds + '종 · 옮길 사본 남은 수 ' + plan.items.length + '권');

  var log = readJson_(LOG_NAME);
  if (log) Logger.log('지금까지 옮긴 사본: ' + log.moved.length + '권');
}

function setupDailyRefresh() {
  clearTriggersFor_('rebuildNow');
  ScriptApp.newTrigger('rebuildNow').timeBased().atHour(4).everyDays(1).create();
  Logger.log('매일 새벽 4시 갱신을 걸었습니다.');
}

/* ══════════════ 잔심부름 ══════════════ */

function folder_() { return DriveApp.getFolderById(FOLDER_ID); }

function dupFolder_() {
  var it = folder_().getFoldersByName(DUP_FOLDER_NAME);
  return it.hasNext() ? it.next() : folder_().createFolder(DUP_FOLDER_NAME);
}

function findFile_(name) {
  var it = folder_().getFilesByName(name);
  return it.hasNext() ? it.next() : null;
}

function saveJson_(name, obj) {
  var content = JSON.stringify(obj);
  var f = findFile_(name);
  if (f) f.setContent(content);
  else folder_().createFile(name, content, MimeType.PLAIN_TEXT);
}

function readJson_(name) {
  var f = findFile_(name);
  if (!f) return null;
  try { return JSON.parse(f.getBlob().getDataAsString('UTF-8')); } catch (e) { return null; }
}

function removeFile_(name) {
  var f = findFile_(name);
  if (f) f.setTrashed(true);
}

/** 파일의 부모 중 이번 묶음에 든 폴더 하나를 돌려준다 */
function parentIn_(parents, catById) {
  if (!parents) return '';
  for (var i = 0; i < parents.length; i++) {
    if (Object.prototype.hasOwnProperty.call(catById, parents[i])) return parents[i];
  }
  return '';
}

function clearTriggersFor_(fn) {
  var ts = ScriptApp.getProjectTriggers();
  for (var i = 0; i < ts.length; i++) if (ts[i].getHandlerFunction() === fn) ScriptApp.deleteTrigger(ts[i]);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

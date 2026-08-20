/****************************************************************
 * 노진교회 — 나의 도서관 (구글 드라이브 책 목록 웹앱) · 캐시판
 * --------------------------------------------------------------
 * 폴더가 많으면 한 번에 다 훑다가 구글의 6분 제한에 걸린다.
 * 그래서 목록을 미리 만들어 파일 하나에 저장해 두고, 홈페이지는
 * 그 저장본만 읽는다. 만드는 일은 시간이 모자라면 스스로 이어서 한다.
 *
 * ▼ 설정 (한 번만)
 *   1) 기존 코드 전체를 이 코드로 교체 → 저장(Ctrl+S)
 *   2) 왼쪽 '서비스(Services)' + → "Drive API" 추가 (이미 하셨으면 OK)
 *   3) 함수 선택 칸에서 rebuildNow 실행 → 목록 만들기 시작
 *      (권한 승인 창이 뜨면 허용. 책이 많으면 몇 번에 나눠 저절로 이어서 돈다)
 *   4) 잠시 뒤 checkStatus 실행 → 로그에 "완성: N권"이 뜨면 끝
 *   5) 배포 ▸ 배포 관리 ▸ (기존 배포) 편집 ▸ 버전 "새 버전" ▸ 배포 (주소는 그대로)
 *
 * ▼ 책을 새로 올린 뒤
 *   rebuildNow 를 다시 실행하거나, 웹앱 주소 뒤에 ?refresh=1 을 붙여 한 번 열면 된다.
 *   설정해 두면 매일 새벽 4시에 저절로 다시 만든다(setupDailyRefresh 실행).
 ****************************************************************/

var FOLDER_ID = '1ZhcNP93jnTE9EDCKCQ8HD9Cf8VJTU3OL';   // 책PDF 폴더 ID (노진교회)
var BOOK_EXT = /\.(pdf|epub|hwp|hwpx|docx?|txt)$/i;
var FOLDER_MIME = 'application/vnd.google-apps.folder';

var CACHE_NAME = 'library-cache.json';          // 완성된 목록
var STATE_NAME = 'library-build-state.json';    // 만드는 중간 상태
var TIME_BUDGET_MS = 4 * 60 * 1000;             // 한 번에 4분까지만 일하고 넘긴다(제한 6분)
var PARENT_CHUNK = 25;                          // 폴더 25개를 한 번의 조회로 묶는다

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
    // 저장본을 그대로 넘긴다(다시 만들지 않으므로 즉시 응답)
    return ContentService.createTextOutput(f.getBlob().getDataAsString('UTF-8'))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

/* ══════════════ 목록 만들기 ══════════════ */

/** 처음부터 다시 만든다. 편집창에서 이걸 실행하면 된다. */
function rebuildNow() {
  startBuild_();
  buildLibraryCache();
}

function startBuild_() {
  clearBuildTriggers_();
  saveState_({ queue: [{ id: FOLDER_ID, cat: '' }], books: [], started: new Date().toISOString() });
}

/**
 * 큐에 남은 폴더를 4분 동안 훑는다. 다 못 끝내면 상태를 저장하고
 * 1분 뒤 자기 자신을 다시 부르는 트리거를 걸어 이어서 한다.
 */
function buildLibraryCache() {
  var t0 = Date.now();
  var st = loadState_();
  if (!st) { st = { queue: [{ id: FOLDER_ID, cat: '' }], books: [], started: new Date().toISOString() }; }

  while (st.queue.length && Date.now() - t0 < TIME_BUDGET_MS) {
    var chunk = st.queue.splice(0, PARENT_CHUNK);
    var catById = {};
    for (var c = 0; c < chunk.length; c++) catById[chunk[c].id] = chunk[c].cat;

    var q = '(' + chunk.map(function (n) { return "'" + n.id + "' in parents"; }).join(' or ') + ') and trashed = false';
    var pageToken = null;
    do {
      var params = { q: q, pageSize: 1000, fields: 'nextPageToken, files(id,name,mimeType,parents)' };
      if (pageToken) params.pageToken = pageToken;
      var res = Drive.Files.list(params);
      var files = res.files || [];
      for (var i = 0; i < files.length; i++) {
        var it = files[i];
        var pcat = parentCat_(it.parents, catById);
        if (it.mimeType === FOLDER_MIME) {
          st.queue.push({ id: it.id, cat: pcat || it.name });      // 최상위 하위폴더명 = 분류
        } else if (BOOK_EXT.test(it.name || '')) {
          st.books.push({ id: it.id, title: String(it.name).replace(BOOK_EXT, '').trim(), author: '', category: pcat || '' });
        }
      }
      pageToken = res.nextPageToken;
    } while (pageToken);
  }

  if (st.queue.length) {          // 아직 남았다 — 저장하고 1분 뒤 이어서
    saveState_(st);
    clearBuildTriggers_();
    ScriptApp.newTrigger('buildLibraryCache').timeBased().after(60 * 1000).create();
    Logger.log('진행 중… 지금까지 ' + st.books.length + '권, 남은 폴더 ' + st.queue.length + '개');
    return;
  }

  // 다 훑었다 — 정리해서 저장본으로 굳힌다
  st.books.sort(function (a, b) { return a.title < b.title ? -1 : (a.title > b.title ? 1 : 0); });
  writeFile_(CACHE_NAME, JSON.stringify({ ok: true, count: st.books.length, built: new Date().toISOString(), books: st.books }));
  removeFile_(STATE_NAME);
  clearBuildTriggers_();
  Logger.log('완성: ' + st.books.length + '권');
}

/** 파일이 속한 부모 중, 이번 묶음에 든 폴더의 분류를 찾는다 */
function parentCat_(parents, catById) {
  if (!parents) return '';
  for (var i = 0; i < parents.length; i++) {
    if (Object.prototype.hasOwnProperty.call(catById, parents[i])) return catById[parents[i]];
  }
  return '';
}

/* ══════════════ 상태 확인·자동 갱신 ══════════════ */

/** 지금 어디까지 됐는지 본다 */
function checkStatus() {
  var cache = findFile_(CACHE_NAME);
  if (cache) {
    var d = JSON.parse(cache.getBlob().getDataAsString('UTF-8'));
    Logger.log('완성: ' + d.count + '권 (만든 시각 ' + d.built + ')');
  } else {
    Logger.log('완성본 없음');
  }
  var st = loadState_();
  if (st) Logger.log('만드는 중… 지금까지 ' + st.books.length + '권, 남은 폴더 ' + st.queue.length + '개');
}

/** 매일 새벽 4시에 목록을 새로 만든다 (한 번만 실행해 두면 된다) */
function setupDailyRefresh() {
  var ts = ScriptApp.getProjectTriggers();
  for (var i = 0; i < ts.length; i++) if (ts[i].getHandlerFunction() === 'rebuildNow') ScriptApp.deleteTrigger(ts[i]);
  ScriptApp.newTrigger('rebuildNow').timeBased().atHour(4).everyDays(1).create();
  Logger.log('매일 새벽 4시 갱신을 걸었습니다.');
}

/* ══════════════ 잔심부름 ══════════════ */

function folder_() { return DriveApp.getFolderById(FOLDER_ID); }

function findFile_(name) {
  var it = folder_().getFilesByName(name);
  return it.hasNext() ? it.next() : null;
}

function writeFile_(name, content) {
  var f = findFile_(name);
  if (f) f.setContent(content);
  else folder_().createFile(name, content, MimeType.PLAIN_TEXT);
}

function removeFile_(name) {
  var f = findFile_(name);
  if (f) f.setTrashed(true);
}

function saveState_(st) { writeFile_(STATE_NAME, JSON.stringify(st)); }

function loadState_() {
  var f = findFile_(STATE_NAME);
  if (!f) return null;
  try { return JSON.parse(f.getBlob().getDataAsString('UTF-8')); } catch (e) { return null; }
}

function clearBuildTriggers_() {
  var ts = ScriptApp.getProjectTriggers();
  for (var i = 0; i < ts.length; i++) {
    if (ts[i].getHandlerFunction() === 'buildLibraryCache') ScriptApp.deleteTrigger(ts[i]);
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

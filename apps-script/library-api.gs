/****************************************************************
 * ○○교회 — 나의 도서관 (구글 드라이브 책 목록 웹앱) · Drive API v3 고속판
 * --------------------------------------------------------------
 * 드라이브 '나의 도서관' 폴더(+하위폴더)의 책 목록을 빠르게 반환합니다.
 * Drive 고급 서비스(Drive API v3, Drive.Files.list 1000개씩)를 사용합니다.
 *
 * ▼ 설정 (한 번만)
 *   1) 기존 코드 전체를 이 코드로 교체
 *   2) 왼쪽 '서비스(Services)' + → "Drive API" 추가 (식별자 Drive) — 이미 하셨으면 OK
 *   3) 배포 ▸ 배포 관리 ▸ (기존 배포) 편집 ▸ 버전: "새 버전" ▸ 배포 (URL 그대로 유지)
 *   4) (테스트) listBooksTest 실행 → 실행 로그에 "책 N권"
 *   ※ FOLDER_ID 는 이미 '나의 도서관' 폴더로 채워두었습니다(사이트도 이 폴더를 넘깁니다).
 ****************************************************************/

var FOLDER_ID = '1AvTRhMLV1ZSIBTSEEa-SbXKhE8U1V67V';   // 나의 도서관 폴더 ID
var BOOK_EXT = /\.(pdf|epub|hwp|hwpx|docx?|txt)$/i;
var FOLDER_MIME = 'application/vnd.google-apps.folder';

function doGet(e) {
  try {
    var fid = (e && e.parameter && e.parameter.folderId) || FOLDER_ID;
    var books = listBooks_(resolveFolderId_(fid));
    return json_({ ok: true, count: books.length, books: books });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

/** 폴더 ID 또는 이름 → 폴더 ID (Drive API v3) */
function resolveFolderId_(idOrName) {
  if (/^[A-Za-z0-9_\-]{20,}$/.test(idOrName)) return idOrName;     // 이미 ID
  var res = Drive.Files.list({
    q: "mimeType = '" + FOLDER_MIME + "' and name = '" + String(idOrName).replace(/'/g, "\\'") + "' and trashed = false",
    pageSize: 1,
    fields: 'files(id)'
  });
  if (res.files && res.files.length) return res.files[0].id;
  throw new Error('폴더를 찾을 수 없습니다: ' + idOrName + ' (폴더 ID 권장)');
}

/** 폴더(+하위폴더 전체)의 책 파일을 Drive.Files.list(v3) 로 빠르게 수집 */
function listBooks_(rootId) {
  var out = [], queue = [{ id: rootId, cat: '' }], guard = 0;
  while (queue.length && guard < 8000) {
    guard++;
    var node = queue.shift();
    var pageToken = null;
    do {
      var params = {
        q: "'" + node.id + "' in parents and trashed = false",
        pageSize: 1000,
        fields: 'nextPageToken, files(id, name, mimeType)'
      };
      if (pageToken) params.pageToken = pageToken;
      var res = Drive.Files.list(params);
      var files = res.files || [];
      for (var i = 0; i < files.length; i++) {
        var it = files[i];
        if (it.mimeType === FOLDER_MIME) {
          queue.push({ id: it.id, cat: node.cat || it.name });     // 최상위 하위폴더명 = 분류 힌트
        } else if (BOOK_EXT.test(it.name || '')) {
          out.push({ id: it.id, title: String(it.name).replace(BOOK_EXT, '').trim(), author: '', category: node.cat || '' });
        }
      }
      pageToken = res.nextPageToken;
    } while (pageToken);
  }
  out.sort(function (a, b) { return a.title < b.title ? -1 : (a.title > b.title ? 1 : 0); });
  return out;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** 설정 확인용 */
function listBooksTest() {
  var books = listBooks_(resolveFolderId_(FOLDER_ID));
  Logger.log('책 ' + books.length + '권');
  books.slice(0, 20).forEach(function (b) { Logger.log((b.category ? '[' + b.category + '] ' : '') + b.title); });
}

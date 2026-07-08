/****************************************************************
 * ○○교회 — 나눔터 새 글 푸시 자동 발송 (Google Apps Script)
 * --------------------------------------------------------------
 * 동작: 몇 분마다 Supabase의 나눔터(posts)를 확인하여
 *       새 글이 올라오면 OneSignal로 모든 구독자에게 푸시를 보냅니다.
 *         제목 : 📝 나눔터 새 글
 *         본문 : ○○○님 · (글 제목)
 *       알림을 탭하면 나눔터(community.html)가 열립니다.
 *
 *  ※ posts 테이블은 누구나 읽기 허용(RLS: select using(true))이라
 *     공개 anon 키만으로 안전하게 새 글을 감지합니다.
 *     OneSignal REST 키만 비밀이며, 이 스크립트(비공개)에만 들어갑니다.
 *
 * ▼ 설정 방법 (한 번만)
 *   1) QT 푸시와 같은 Apps Script 프로젝트에 이 파일을 추가해도 되고,
 *      script.google.com 에서 새 프로젝트를 만들어 붙여넣어도 됩니다.
 *   2) 아래 POST_CONFIG 의 ONESIGNAL_APP_ID / ONESIGNAL_REST_KEY 를 채우기
 *        (SUPABASE 두 값은 공개키라 이미 채워져 있음)
 *   3) 함수 목록에서  createPostPollTrigger  를 한 번 실행 (권한 승인)
 *        → 5분마다 새 글 확인이 등록됩니다.
 *   4) (테스트) 글을 하나 올린 뒤  pollNewPosts  를 직접 실행하면 즉시 발송됩니다.
 ****************************************************************/

const POST_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY", // 공개키(안전)
  SITE_URL: "https://example.com/",
  ONESIGNAL_APP_ID: "YOUR_ONESIGNAL_APP_ID",
  ONESIGNAL_REST_KEY: "여기에_OneSignal_REST_API_KEY",
  POLL_MINUTES: 5,   // 새 글 확인 주기(분) — 1/5/10/15/30 중 하나
  MAX_PUSH: 5,       // 한 번에 보낼 최대 개수(이보다 많으면 요약 1건)
};

/** 5분마다 새 글 확인 트리거 등록 (한 번만 실행) */
function createPostPollTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "pollNewPosts") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("pollNewPosts").timeBased().everyMinutes(POST_CONFIG.POLL_MINUTES).create();
  Logger.log(POST_CONFIG.POLL_MINUTES + "분마다 나눔터 새 글 확인 트리거가 등록되었습니다.");
  // 첫 등록 시, 기존 글로 알림이 쏟아지지 않도록 현재 최신 글을 '이미 본 것'으로 표시
  primeLastPostId_();
}

/** 새 글을 찾아 푸시 발송 */
function pollNewPosts() {
  const props = PropertiesService.getScriptProperties();
  const lastSeen = Number(props.getProperty("lastPostId") || 0);

  // 최신 글 목록(id 오름차순 처리 위해 받아온 뒤 정렬)
  const url = POST_CONFIG.SUPABASE_URL +
    "/rest/v1/posts?select=id,author_name,title,category&order=id.desc&limit=20";
  const res = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      apikey: POST_CONFIG.SUPABASE_ANON_KEY,
      Authorization: "Bearer " + POST_CONFIG.SUPABASE_ANON_KEY,
    },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    Logger.log("Supabase 조회 실패: " + res.getResponseCode() + " " + res.getContentText());
    return;
  }
  const rows = JSON.parse(res.getContentText() || "[]");
  if (!rows.length) { Logger.log("글 없음"); return; }

  // 첫 실행(기록 없음)이면 폭주 방지: 최신 id만 저장하고 끝
  const maxId = Math.max.apply(null, rows.map(function (r) { return Number(r.id); }));
  if (!lastSeen) {
    props.setProperty("lastPostId", String(maxId));
    Logger.log("최초 실행 — 기준 id=" + maxId + " 저장(발송 안 함)");
    return;
  }

  const fresh = rows
    .filter(function (r) { return Number(r.id) > lastSeen; })
    .sort(function (a, b) { return Number(a.id) - Number(b.id); });

  if (!fresh.length) { Logger.log("새 글 없음 (lastSeen=" + lastSeen + ")"); return; }

  if (fresh.length > POST_CONFIG.MAX_PUSH) {
    osPush_("📝 나눔터 새 글", fresh.length + "개의 새 글이 올라왔습니다. 확인해 보세요!");
  } else {
    fresh.forEach(function (p) {
      const who = (p.author_name || "성도") + "님";
      const what = p.title ? (" · " + p.title) : " 글을 남겼어요";
      osPush_("📝 나눔터 새 글", who + what);
    });
  }

  props.setProperty("lastPostId", String(maxId));
  Logger.log("발송 완료: 새 글 " + fresh.length + "건, 기준 id=" + maxId);
}

/** 현재 최신 글 id를 '이미 본 것'으로 저장(첫 설정용) */
function primeLastPostId_() {
  const url = POST_CONFIG.SUPABASE_URL + "/rest/v1/posts?select=id&order=id.desc&limit=1";
  const res = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      apikey: POST_CONFIG.SUPABASE_ANON_KEY,
      Authorization: "Bearer " + POST_CONFIG.SUPABASE_ANON_KEY,
    },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() === 200) {
    const rows = JSON.parse(res.getContentText() || "[]");
    const maxId = rows.length ? Number(rows[0].id) : 0;
    PropertiesService.getScriptProperties().setProperty("lastPostId", String(maxId));
    Logger.log("기준 id=" + maxId + " 저장 완료");
  }
}

/** OneSignal 푸시 전송 */
function osPush_(title, body) {
  const payload = {
    app_id: POST_CONFIG.ONESIGNAL_APP_ID,
    target_channel: "push",
    included_segments: ["Subscribed Users"],
    headings: { en: title, ko: title },
    contents: { en: body, ko: body },
    url: POST_CONFIG.SITE_URL + "community.html",
  };
  const res = UrlFetchApp.fetch("https://api.onesignal.com/notifications", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Key " + POST_CONFIG.ONESIGNAL_REST_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  Logger.log("OneSignal 응답: " + res.getResponseCode() + " " + res.getContentText());
}

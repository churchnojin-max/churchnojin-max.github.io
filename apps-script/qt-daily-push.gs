/****************************************************************
 * ○○교회 — 매일 아침 QT 푸시 자동 발송 (Google Apps Script)
 * --------------------------------------------------------------
 * 동작: 매일 아침 06:30(한국시간)에 Supabase qt_published 뷰에서
 *       "오늘 날짜(한국)" QT가 올라와 있으면 OneSignal로 푸시 알림을 보냅니다.
 *         제목 : 새로운 QT가 올라왔습니다 🙏
 *         본문 : 말씀과 기도로 하루를 시작하세요!
 *       알림을 탭하면 홈페이지의 오늘 QT 전문이 열립니다.
 *       (그날 QT가 없거나 본문이 비어 있으면 보내지 않습니다.)
 *
 *  ※ 2026-06-30: 데이터 소스를 구글시트 → Supabase(qt_published 뷰)로 변경.
 *     홈페이지 QT가 Supabase 전용이 되어, 푸시 발송 판단도 같은 소스로 맞췄습니다.
 *
 * ▼ 설정 방법 (한 번만)
 *   1) Apps Script 프로젝트 열기 (기존 QT 스크립트 위치 그대로 사용 가능)
 *   2) 이 코드 전체를 붙여넣기(기존 시트 기반 코드 위에 덮어쓰기)
 *   3) 아래 CONFIG 에서 ONESIGNAL_REST_KEY 만 본인 값으로 채우기
 *        (SUPABASE_URL / SUPABASE_ANON_KEY 는 공개키라 그대로 두면 됩니다)
 *   4) 함수 목록에서 createDailyTrigger 를 한 번 실행 (권한 승인)
 *        → 매일 06:30(한국시간) 자동 발송이 등록됩니다.
 *   5) (테스트) sendTodayQT 를 직접 실행하면 즉시 한 번 발송됩니다.
 ****************************************************************/

const CONFIG = {
  // Supabase 공개 설정 (config.js 와 동일 — 공개돼도 안전한 공개키)
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
  SITE_URL: "https://example.com/",
  ONESIGNAL_APP_ID: "YOUR_ONESIGNAL_APP_ID",
  ONESIGNAL_REST_KEY: "여기에_OneSignal_REST_API_KEY",
};

/** 매일 06:30 트리거 등록 (한 번만 실행) */
function createDailyTrigger() {
  // 기존 동일 트리거 제거(중복 방지)
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "sendTodayQT") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("sendTodayQT").timeBased().atHour(6).nearMinute(30).everyDays(1).create();
  Logger.log("매일 06:30 발송 트리거가 등록되었습니다.");
}

/** 오늘(한국) 날짜 QT가 Supabase에 올라와 있으면 푸시 발송 */
function sendTodayQT() {
  const today = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");
  const url = CONFIG.SUPABASE_URL.replace(/\/+$/, "") +
    "/rest/v1/qt_published?select=sermon_date,title,scripture,qt_bible_text,content" +
    "&sermon_date=eq." + today + "&limit=1";

  const res = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      apikey: CONFIG.SUPABASE_ANON_KEY,
      Authorization: "Bearer " + CONFIG.SUPABASE_ANON_KEY,
    },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    Logger.log("Supabase 조회 실패: " + res.getResponseCode() + " " + res.getContentText());
    return;
  }

  let rows;
  try { rows = JSON.parse(res.getContentText()); } catch (e) { rows = []; }
  const row = rows && rows[0];
  const hasContent = row && (String(row.qt_bible_text || "").trim() || String(row.content || "").trim());
  if (!hasContent) {
    Logger.log("오늘(" + today + ") QT가 없거나 본문이 비어 있어 발송하지 않습니다.");
    return;
  }

  // 새 QT가 올라와 있으면 고정 메시지로 발송
  const title = "새로운 QT가 올라왔습니다 🙏";
  const body = "말씀과 기도로 하루를 시작하세요!";

  sendPush(title, body);
  Logger.log("발송 완료(" + today + " · " + (row.scripture || "") + "): " + title);
}

/** OneSignal 푸시 전송 */
function sendPush(title, body) {
  const payload = {
    app_id: CONFIG.ONESIGNAL_APP_ID,
    target_channel: "push",
    included_segments: ["Subscribed Users"], // 대시보드의 세그먼트 이름과 일치해야 함
    headings: { en: title, ko: title },
    contents: { en: body, ko: body },
    url: CONFIG.SITE_URL + "?qt=open",
  };
  const res = UrlFetchApp.fetch("https://api.onesignal.com/notifications", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Key " + CONFIG.ONESIGNAL_REST_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  Logger.log("OneSignal 응답: " + res.getResponseCode() + " " + res.getContentText());
}

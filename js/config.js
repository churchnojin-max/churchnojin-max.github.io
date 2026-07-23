/* ============================================================
   외부 서비스 설정 — 우리 교회 것으로 채우세요
   ------------------------------------------------------------
   ※ 아래 값들은 "공개되어도 안전한 공개키"입니다. 실제 보안은
     각 서비스(Supabase RLS 등)에서 지킵니다.
   ※ 비워 두면 해당 기능만 "준비 중"으로 표시되고, 나머지 사이트는
     정상 동작합니다. (교회명·주소 등 기본 정보는 js/church.js 에서 설정)

   ★ 중요 — 데이터 분리 ★
     이 파일은 반드시 "우리 교회 전용" 서비스 계정으로 채워야 합니다.
     다른 교회의 Supabase 주소를 그대로 두면 교인·헌금·기도 자료가
     뒤섞입니다. 각 항목은 배포안내.md 의 순서대로 새로 발급하세요.
   ============================================================ */

/* --- 푸시 알림(OneSignal) ---
   OneSignal 대시보드 ▸ Settings ▸ Keys & IDs 의 App ID.
   비어 있으면 푸시 기능만 꺼집니다(사이트는 정상). */
window.ONESIGNAL_APP_ID = "";

/* --- 회원/로그인/게시판(Supabase) ---
   Supabase ▸ Project Settings ▸ API 의 Project URL 과 anon(public) key.
   비어 있으면 로그인·게시판 기능이 "준비 중"으로 표시됩니다. */
window.SUPABASE_URL = "https://vwuzmklacdwiqyqjrxyt.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3dXpta2xhY2R3aXF5cWpyeHl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MDE5MTAsImV4cCI6MjA5OTA3NzkxMH0.DSdstEsMoNGzCEWsXfDblY0KuxLS3Ay-MuePJrIjdDE";

/* --- 파일 업로드(Cloudflare R2 Worker) ---
   Cloudflare Worker 배포 후 받은 주소. 예: "https://church-files.<계정>.workers.dev"
   비어 있으면 사진/파일 업로드 기능이 자동으로 숨겨집니다. */
window.R2_UPLOAD_URL = "";

/* --- 재정 API (Apps Script 웹앱) ---
   구글시트 기반 재정 API를 쓰는 경우의 웹앱 URL(/exec).
   비어 있으면 헌금조회·재정관리 메뉴만 "준비 중"으로 표시됩니다. */
window.FINANCE_API_URL = "";

/* --- 연말정산 신청 알림 이메일(FormSubmit) ---
   FormSubmit 에서 관리자 이메일을 등록하면 받는 별칭(alias) 값.
   비어 있으면 이메일 알림만 꺼집니다(신청·조회는 정상). */
window.FORMSUBMIT_EMAIL = "";

/* --- 나의 도서관(구글 드라이브 책 목록 Apps Script 웹앱) ---
   apps-script/library-api.gs 를 배포한 뒤 받은 웹앱 주소(/exec). */
window.LIBRARY_API_URL = "";
/* 책 폴더 ID(드라이브 폴더 주소 .../folders/XXXX 의 XXXX). */
window.LIBRARY_FOLDER_ID = "";

/* --- 영상 제작 스튜디오 (선택) ---
   설교 영상 자동 제작 기능. 교회 PC 작업 프로그램과 Cloudflare 설정이 필요해
   기본은 꺼져 있습니다. 준비가 되면 true 로 바꾸세요. */
window.VIDEO_STUDIO = false;

-- ============================================================
--  ○○교회 — QT 음성 자동 생성(prewarm) 예약
--  30분마다 tts-prewarm 함수를 호출 → 오늘·내일 QT 음성을 미리 생성(캐시)해 둔다.
--  (이미 만들어진 음성이 있으면 건너뛰므로 추가 비용 없음)
--  Supabase ▸ SQL Editor 에서 1회 실행. (tts-prewarm 함수 배포 후)
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 기존 등록이 있으면 제거(재실행 안전)
do $$
begin
  perform cron.unschedule('tts-prewarm');
exception when others then null;
end $$;

-- 30분마다 실행 (원하면 '*/15 * * * *' 등으로 조정)
select cron.schedule(
  'tts-prewarm',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-PROJECT.supabase.co/functions/v1/tts-prewarm-',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_qfq4Hvs4tF_1ZIezPoMojg_h6XNw01G',
      'Authorization', 'Bearer sb_publishable_qfq4Hvs4tF_1ZIezPoMojg_h6XNw01G'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 확인: 등록된 예약 보기
-- select jobid, schedule, jobname, active from cron.job where jobname = 'tts-prewarm';
-- 해제하려면: select cron.unschedule('tts-prewarm');

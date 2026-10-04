-- ============================================================
--  노진교회 — 실시간 예배 방송 상태 한 줄 (2026-10-04 목사님 요청: "10시 30분부터 실시간인지 확인해서 연동")
--  Supabase ▸ SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.
-- ------------------------------------------------------------
--  · 사무실 PC(tools/live_watch.py, 예약 작업 LiveWatch)가 주일 10:20~16:00 2분마다 유튜브 채널의
--    '실시간' 화면을 보고 이 한 줄을 고친다(service_role).
--  · 홈페이지(js/live-status.js)는 누구나 읽기만 한다 → 실시간 점·설교 영상 칸이 실제 방송에 맞춰 켜지고 꺼진다.
--  · 방송 여부·영상 번호·제목은 유튜브에 이미 공개된 정보라 공개 읽기로 둔다. 쓰기는 홈페이지에서 못 한다.
-- ============================================================
create table if not exists public.site_live (
  id         int primary key default 1 check (id = 1),
  is_live    boolean not null default false,
  video_id   text,
  title      text,
  started_at timestamptz,
  checked_at timestamptz not null default now()
);
insert into public.site_live (id) values (1) on conflict (id) do nothing;
alter table public.site_live enable row level security;
revoke all on public.site_live from anon, authenticated;
grant select on public.site_live to anon, authenticated;
drop policy if exists "site_live_read" on public.site_live;
create policy "site_live_read" on public.site_live for select to anon, authenticated using (true);

select * from public.site_live;

-- ============================================================
--  ○○교회 — AI 음성(QT 낭독) 생성 기록
--  tts Edge Function이 새로 생성할 때마다 한 줄씩 기록 → 목회행정 대시보드에서 열람.
--  Supabase ▸ SQL Editor 에 1회 실행.
-- ============================================================

create table if not exists public.tts_log (
  id         bigint generated always as identity primary key,
  qt_date    date,          -- 그 QT 날짜(있을 때)
  label      text,          -- 본문 앞부분(제목/구절)
  url        text,          -- 공개 재생 URL
  bytes      bigint,        -- 파일 크기
  voice      text,          -- 사용 목소리
  created_at timestamptz default now()
);
create index if not exists tts_log_created_idx on public.tts_log(created_at desc);

alter table public.tts_log enable row level security;

-- 관리자만 열람. (함수는 service_role로 기록하므로 RLS 우회)
drop policy if exists "admin read tts_log" on public.tts_log;
create policy "admin read tts_log" on public.tts_log for select
  using (exists (select 1 from public.admins a where a.uid = auth.uid()));

-- 관리자만 삭제(대시보드에서 기록 지우기)
drop policy if exists "admin delete tts_log" on public.tts_log;
create policy "admin delete tts_log" on public.tts_log for delete
  using (exists (select 1 from public.admins a where a.uid = auth.uid()));

-- 저장된 음원 파일(tts-cache 버킷)도 관리자면 삭제 가능하게
drop policy if exists "admin delete tts-cache" on storage.objects;
create policy "admin delete tts-cache" on storage.objects for delete
  using (bucket_id = 'tts-cache'
         and exists (select 1 from public.admins a where a.uid = auth.uid()));

-- 예배 찬양 배정(sermon_songs): 설교(예배)마다 찬양을 슬롯별로 지정 — 찬양곡 라이브러리(worship_songs)와 연결.
-- 노션 「설교계획」의 찬양1·2·3·예배전·응답·성가대곡 relation을 옮긴 것.
-- 이 배정 기록에서 곡별 '사용횟수'와 '최근 사용일(3주 순환)'이 자동 계산됩니다.
-- 선행: supabase/worship_songs.sql 을 먼저 실행. 그 다음 이 파일을 SQL Editor 에서 1회 실행하세요.

create table if not exists public.sermon_songs (
  id uuid primary key default gen_random_uuid(),
  sermon_id uuid not null references public.sermons(id) on delete cascade,
  song_id   uuid not null references public.worship_songs(id) on delete cascade,
  slot text not null,   -- pre(예배전) · s1·s2·s3(찬양1~3) · resp(응답) · choir(성가대곡)
  position int default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);

create index if not exists sermon_songs_sermon_idx on public.sermon_songs (sermon_id);
create index if not exists sermon_songs_song_idx   on public.sermon_songs (song_id);

alter table public.sermon_songs enable row level security;

drop policy if exists "admin all sermon_songs" on public.sermon_songs;
create policy "admin all sermon_songs" on public.sermon_songs for all
  using (exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (exists (select 1 from public.admins a where a.uid = auth.uid()));

-- ============================================================
--  ○○교회 — 나의 성경읽기 (구속사 365 읽기표 진도)
--  성도별 일차(1~365) 체크를 저장. 대시보드 '나의 성경읽기' 카드가 사용.
--  Supabase ▸ SQL Editor 에 1회 실행.
-- ============================================================

create table if not exists public.bible_reading (
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day_no   smallint not null check (day_no between 1 and 365),
  done_at  timestamptz not null default now(),
  primary key (user_id, day_no)
);
create index if not exists bible_reading_user_idx on public.bible_reading(user_id);

alter table public.bible_reading enable row level security;

-- 본인 진도: 조회·체크·해제
drop policy if exists "own read bible_reading" on public.bible_reading;
create policy "own read bible_reading" on public.bible_reading for select
  using (auth.uid() = user_id);
drop policy if exists "own insert bible_reading" on public.bible_reading;
create policy "own insert bible_reading" on public.bible_reading for insert
  with check (auth.uid() = user_id);
drop policy if exists "own delete bible_reading" on public.bible_reading;
create policy "own delete bible_reading" on public.bible_reading for delete
  using (auth.uid() = user_id);

-- 관리자: 전체 현황 조회(목회행정 카드)
drop policy if exists "admin read bible_reading" on public.bible_reading;
create policy "admin read bible_reading" on public.bible_reading for select
  using (exists (select 1 from public.admins a where a.uid = auth.uid()));

-- 함께 읽는 성도 수(최근 30일 내 체크한 사람) — 로그인한 성도 누구나 조회 가능
create or replace function public.bible_readers_count()
returns integer
language sql stable security definer set search_path = public
as $$
  select count(distinct user_id)::int
  from public.bible_reading
  where done_at > now() - interval '30 days';
$$;
grant execute on function public.bible_readers_count() to authenticated;

-- ============================================================
--  ○○교회 — 교적(gyojeok) 테이블 + 보안(RLS)
--  Supabase ▸ SQL Editor 에 붙여넣고 Run (1회).
--  · 개인정보 보호: 관리자/재정권한자만 조회·수정 (is_finance()).
--  · is_finance() 는 offerings.sql 에서 생성됨(없으면 아래 정의 사용).
-- ============================================================

create or replace function public.is_finance()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists(select 1 from public.admins a where a.uid = auth.uid())
      or exists(select 1 from public.member_links m where m.user_id = auth.uid() and m.can_finance = true)
$$;

create table if not exists public.gyojeok (
  id              bigint generated always as identity primary key,
  gyojeok_id      integer,
  name            text,
  birth           date,
  member_key      text,
  head            text,        -- 세대주
  relation        text,        -- 관계
  spouse          text,        -- 배우자
  spouse_key      text,        -- 배우자매칭키
  groups          text,        -- 그룹(구역)
  role            text,        -- 직책
  grade           text,        -- 신급
  sex             text,
  phone           text,
  address         text,
  status          text,        -- 회원상태
  photo           text,
  baptism_date    date,
  ordination_date date,
  belong_groups   text,        -- 소속그룹
  created_at      timestamptz default now()
);
create index if not exists gyojeok_member_key_idx on public.gyojeok(member_key);
create index if not exists gyojeok_name_idx       on public.gyojeok(name);

alter table public.gyojeok enable row level security;
drop policy if exists gyojeok_select on public.gyojeok;
create policy gyojeok_select on public.gyojeok for select using ( public.is_finance() );
drop policy if exists gyojeok_write on public.gyojeok;
create policy gyojeok_write on public.gyojeok for all using ( public.is_finance() ) with check ( public.is_finance() );

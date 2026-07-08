-- ============================================================
--  ○○교회 — 헌금(offerings) 테이블 + 보안(RLS)
--  Supabase ▸ SQL Editor 에 붙여넣고 Run (1회).
--  · 조회: 본인(+배우자) 헌금만, 재정권한자/관리자는 전체.
-- ============================================================

create table if not exists public.offerings (
  id          bigint generated always as identity primary key,
  offer_date  date,
  category    text,            -- 항목(계정). 현재 데이터엔 없음(향후 입력분부터 채움)
  service     text,            -- 예배
  giver       text,            -- 헌금자 이름
  member_key  text,            -- 교적 매칭키(이름|YYYYMMDD)
  amount      integer not null default 0,
  method      text,            -- 수단
  memo        text,            -- 적요
  source      text,            -- 출처
  created_at  timestamptz default now()
);
create index if not exists offerings_member_key_idx on public.offerings(member_key);
create index if not exists offerings_date_idx       on public.offerings(offer_date);

-- 배우자 합산용 컬럼(지금은 비어 있어도 무방 — 본인 조회는 정상 동작)
alter table public.member_links add column if not exists spouse_key text;

-- 내 매칭키 집합(본인+배우자). security definer 로 안전하게 조회.
create or replace function public.my_member_keys()
returns setof text language sql security definer stable
set search_path = public as $$
  select member_key from public.member_links where user_id = auth.uid() and coalesce(member_key,'') <> ''
  union
  select spouse_key from public.member_links where user_id = auth.uid() and coalesce(spouse_key,'') <> ''
$$;

-- 재정권한자/관리자 여부
create or replace function public.is_finance()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists(select 1 from public.admins a where a.uid = auth.uid())
      or exists(select 1 from public.member_links m where m.user_id = auth.uid() and m.can_finance = true)
$$;

alter table public.offerings enable row level security;

drop policy if exists offerings_select on public.offerings;
create policy offerings_select on public.offerings for select
  using ( public.is_finance() or member_key in (select public.my_member_keys()) );

drop policy if exists offerings_write on public.offerings;
create policy offerings_write on public.offerings for all
  using ( public.is_finance() ) with check ( public.is_finance() );

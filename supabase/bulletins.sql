-- 주보(디지털 주보) 저장 — 목회행정 '주보제작'에서 작성/게시.
-- data(jsonb)에 주보 전체가 들어가며, 헌금 '금액'은 data.offering_amounts 키에만 둔다.
-- 공개 뷰(bulletins_public)는 published=true 인 주보에서 offering_amounts 키를 제거해 노출한다.
--   → 인쇄/PDF(관리자)는 금액 포함, 홈페이지(anon)는 금액 제외.

create table if not exists public.bulletins (
  id         uuid primary key default gen_random_uuid(),
  bdate      date not null,            -- 주보 주일 날짜
  title      text,                     -- 주일 설교 제목(목록 표시용)
  scripture  text,                     -- 주일 설교 본문
  preacher   text,                     -- 설교자
  data       jsonb not null default '{}'::jsonb,  -- 주보 전체 데이터
  published  boolean not null default false,      -- 홈페이지 게시 여부
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists bulletins_bdate_uidx on public.bulletins (bdate);
create index if not exists bulletins_pub_idx on public.bulletins (published, bdate desc);

alter table public.bulletins enable row level security;
drop policy if exists "admin all bulletins" on public.bulletins;
create policy "admin all bulletins" on public.bulletins for all
  using (exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (exists (select 1 from public.admins a where a.uid = auth.uid()));

-- 공개 뷰: 게시된 주보만, 헌금 금액(offering_amounts) 제거 후 노출
drop view if exists public.bulletins_public;
create view public.bulletins_public as
  select id, bdate, title, scripture, preacher,
         (data - 'offering_amounts') as data,
         updated_at
  from public.bulletins
  where published = true;
grant select on public.bulletins_public to anon, authenticated;

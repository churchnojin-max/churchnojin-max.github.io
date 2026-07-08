-- 행정관리: 심방관리(visitations) · 상담관리(counsels)
-- 관리자(admins 테이블에 등록된 사용자)만 읽기/쓰기 가능.
-- Supabase → SQL Editor 에 붙여넣고 1회 실행하세요.

create table if not exists public.visitations (
  id uuid primary key default gen_random_uuid(),
  visit_date date,
  member_name text,
  member_key text,
  category text,            -- 심방종류
  location text,
  pastor text,              -- 심방자
  content text,
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);

create table if not exists public.counsels (
  id uuid primary key default gen_random_uuid(),
  counsel_date date,
  member_name text,
  member_key text,
  category text,            -- 상담분류
  counselor text,           -- 상담자
  content text,
  followup text,            -- 후속조치
  is_private boolean default true,
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);

alter table public.visitations enable row level security;
alter table public.counsels enable row level security;

-- 관리자만 전체 접근
drop policy if exists "admin all visitations" on public.visitations;
create policy "admin all visitations" on public.visitations for all
  using (exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (exists (select 1 from public.admins a where a.uid = auth.uid()));

drop policy if exists "admin all counsels" on public.counsels;
create policy "admin all counsels" on public.counsels for all
  using (exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (exists (select 1 from public.admins a where a.uid = auth.uid()));

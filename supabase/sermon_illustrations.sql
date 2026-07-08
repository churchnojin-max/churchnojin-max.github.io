-- ============================================================
-- ○○교회 — 예화 클립 모음 (설교 매니저)
-- 생명의삶 자동분류 시 '예화 클립'을 따로 모아 두는 보관함.
-- 관리자만 읽기/쓰기. Supabase ▸ SQL Editor 에 1회 실행.
-- ============================================================

create table if not exists public.sermon_illustrations (
  id         uuid primary key default gen_random_uuid(),
  ref_date   date,                -- 출처 날짜(생명의삶 일자)
  scripture  text,                -- 관련 본문
  title      text,                -- 관련 설교 제목
  source     text,                -- 출처(책/저자 등)
  content    text not null,       -- 예화 본문
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);

alter table public.sermon_illustrations enable row level security;
drop policy if exists "admin all sermon_illustrations" on public.sermon_illustrations;
create policy "admin all sermon_illustrations" on public.sermon_illustrations for all
  using (exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (exists (select 1 from public.admins a where a.uid = auth.uid()));

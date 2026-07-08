-- ============================================================
--  ○○교회 — 재정 설정(app_settings) 키-값 테이블
--  Supabase ▸ SQL Editor 에 붙여넣고 Run (1회).
--  · 이월금 등 회계 설정 저장. 재정권한자/관리자만 조회·수정.
--  · 키 예: carryover_2026 = 전기이월금(원)
--  · is_finance() 는 offerings.sql / finance_migration.sql 에서 생성됨.
-- ============================================================

create table if not exists public.app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz default now()
);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select using (public.is_finance());

drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings for all
  using (public.is_finance()) with check (public.is_finance());

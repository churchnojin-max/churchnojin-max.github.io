-- 교회 설정(연간 봉사위원 등) 저장. 관리자만 읽기/쓰기.
-- key='committees' → data = { months:[ {month:'2026-07', offering, guide, parking}, ... ] }
create table if not exists public.church_settings (
  key        text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table public.church_settings enable row level security;
drop policy if exists "admin all church_settings" on public.church_settings;
create policy "admin all church_settings" on public.church_settings for all
  using (exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (exists (select 1 from public.admins a where a.uid = auth.uid()));

-- 예배별 순서 양식(템플릿): 주일 낮 예배 / 수요예배 등 예배 종류마다 저장.
create table if not exists public.worship_templates (
  service    text primary key,   -- 예배 종류
  items      jsonb,              -- 예배 순서 [{label,detail,url}]
  updated_at timestamptz default now()
);
alter table public.worship_templates enable row level security;
drop policy if exists "admin all worship_templates" on public.worship_templates;
create policy "admin all worship_templates" on public.worship_templates for all
  using (exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (exists (select 1 from public.admins a where a.uid = auth.uid()));

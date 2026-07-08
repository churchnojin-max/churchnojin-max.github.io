-- ============================================================
-- ○○교회 — 양육 자료실 (Supabase Storage + resources 테이블)
-- Supabase ▸ SQL Editor 에 붙여넣고 Run 하세요. (한 번만, 다시 실행해도 안전)
-- 로그인 교인: 목록/다운로드, 관리자(admins): 업로드/삭제
-- ============================================================

-- 1) 비공개 버킷
insert into storage.buckets (id, name, public)
values ('resources', 'resources', false)
on conflict (id) do nothing;

-- 2) Storage 권한: 회원은 다운로드(select), 관리자만 업로드/수정/삭제
drop policy if exists "resources_read_authenticated" on storage.objects;
create policy "resources_read_authenticated" on storage.objects
  for select to authenticated using (bucket_id = 'resources');

drop policy if exists "resources_insert_admin" on storage.objects;
create policy "resources_insert_admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resources' and auth.uid() in (select uid from public.admins));

drop policy if exists "resources_update_admin" on storage.objects;
create policy "resources_update_admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'resources' and auth.uid() in (select uid from public.admins));

drop policy if exists "resources_delete_admin" on storage.objects;
create policy "resources_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'resources' and auth.uid() in (select uid from public.admins));

-- 3) 자료 목록 테이블(원본 파일명·카테고리 보관)
create table if not exists public.resources (
  id         bigint generated always as identity primary key,
  category   text not null,
  title      text not null,                 -- 원본 파일명(표시용)
  path       text not null,                 -- storage object key(영문 안전키)
  size       bigint,
  created_at timestamptz not null default now()
);
alter table public.resources enable row level security;

drop policy if exists "resources_tbl_read" on public.resources;
create policy "resources_tbl_read" on public.resources
  for select to authenticated using (true);

drop policy if exists "resources_tbl_insert_admin" on public.resources;
create policy "resources_tbl_insert_admin" on public.resources
  for insert to authenticated
  with check (auth.uid() in (select uid from public.admins));

drop policy if exists "resources_tbl_delete_admin" on public.resources;
create policy "resources_tbl_delete_admin" on public.resources
  for delete to authenticated
  using (auth.uid() in (select uid from public.admins));

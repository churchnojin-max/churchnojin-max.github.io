-- ============================================================
-- 교육관리 확장: 기간·기수·반·참석자(교적 연동) + 강의 자료실(수강생 전용)
-- Supabase ▸ SQL Editor 에 붙여넣고 Run 하세요. (한 번만, 다시 실행해도 안전)
-- ============================================================

-- 1) edu_records 확장 컬럼 (기간·기수·반·참석자)
alter table public.edu_records add column if not exists end_date date;
alter table public.edu_records add column if not exists cohort text;
alter table public.edu_records add column if not exists class_name text;
alter table public.edu_records add column if not exists participants text default '[]';

-- 1-1) 수강생 본인은 자신이 참석자로 등록된 교육을 조회할 수 있음(관리자 전용 정책에 追加, "나의 정보"·교적에서 조회용)
drop policy if exists "edu_records_read_participant" on public.edu_records;
create policy "edu_records_read_participant" on public.edu_records
  for select to authenticated
  using (
    exists (
      select 1
      from public.member_links ml
      cross join lateral jsonb_array_elements(coalesce(nullif(edu_records.participants, '')::jsonb, '[]'::jsonb)) elem
      where ml.user_id = auth.uid() and elem->>'key' = ml.member_key
    )
  );

-- 2) 경로 첫 세그먼트를 uuid로 안전 변환(형식이 아니면 null)
create or replace function public.edu_id_from_path(p text)
returns uuid language plpgsql immutable as $$
declare v_id uuid;
begin
  begin
    v_id := split_part(p, '/', 1)::uuid;
  exception when others then
    v_id := null;
  end;
  return v_id;
end $$;

-- 3) 수강생 판별 함수: 관리자이거나, 해당 교육의 참석자(교적 매칭키)와 내 계정이 연결되어 있으면 true
create or replace function public.can_access_edu(p_edu_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from public.admins a where a.uid = auth.uid())
    or exists (
      select 1
      from public.edu_records er
      join public.member_links ml on ml.user_id = auth.uid()
      cross join lateral jsonb_array_elements(coalesce(nullif(er.participants, '')::jsonb, '[]'::jsonb)) elem
      where er.id = p_edu_id
        and ml.member_key is not null
        and elem->>'key' = ml.member_key
    );
$$;

-- 4) 강의 자료실: 파일 목록 테이블(수강생만 조회, 관리자만 업로드/삭제)
create table if not exists public.edu_materials (
  id bigint generated always as identity primary key,
  edu_id uuid not null references public.edu_records(id) on delete cascade,
  title text not null,
  path text not null,
  size bigint,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.edu_materials enable row level security;

drop policy if exists "edu_materials_read" on public.edu_materials;
create policy "edu_materials_read" on public.edu_materials
  for select to authenticated using (public.can_access_edu(edu_id));

drop policy if exists "edu_materials_write_admin" on public.edu_materials;
create policy "edu_materials_write_admin" on public.edu_materials
  for all to authenticated
  using (exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (exists (select 1 from public.admins a where a.uid = auth.uid()));

-- 5) Storage 버킷(비공개) — 객체 경로는 "{edu_id}/파일명" 형태로 저장
insert into storage.buckets (id, name, public)
values ('edu_materials', 'edu_materials', false)
on conflict (id) do nothing;

drop policy if exists "edu_materials_storage_read" on storage.objects;
create policy "edu_materials_storage_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'edu_materials' and public.can_access_edu(public.edu_id_from_path(name)));

drop policy if exists "edu_materials_storage_write_admin" on storage.objects;
create policy "edu_materials_storage_write_admin" on storage.objects
  for all to authenticated
  using (bucket_id = 'edu_materials' and exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (bucket_id = 'edu_materials' and exists (select 1 from public.admins a where a.uid = auth.uid()));

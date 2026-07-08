-- ============================================================
--  교회 앨범 사진 테이블 (Cloudflare R2에 저장된 사진의 메타데이터)
--  Supabase → SQL Editor 에 붙여넣고 RUN 한 번만 실행하세요.
-- ============================================================
create table if not exists public.album_photos (
  id          bigint generated always as identity primary key,
  category    text not null,
  url         text not null,            -- R2 공개 URL
  key         text,                     -- R2 객체 키(삭제용)
  caption     text,
  user_id     uuid not null references auth.users (id) on delete cascade,
  author_name text,
  created_at  timestamptz not null default now()
);

alter table public.album_photos enable row level security;

-- 누구나 사진 목록 조회 가능(교회 앨범 공개)
drop policy if exists "album_select_all" on public.album_photos;
create policy "album_select_all" on public.album_photos
  for select using (true);

-- 로그인한 본인만 업로드(본인 user_id로만)
drop policy if exists "album_insert_own" on public.album_photos;
create policy "album_insert_own" on public.album_photos
  for insert with check (auth.uid() = user_id);

-- 본인 사진 삭제
drop policy if exists "album_delete_own" on public.album_photos;
create policy "album_delete_own" on public.album_photos
  for delete using (auth.uid() = user_id);

-- 관리자는 모든 사진 삭제 가능(admins 테이블 기준)
drop policy if exists "album_delete_admin" on public.album_photos;
create policy "album_delete_admin" on public.album_photos
  for delete using (exists (select 1 from public.admins a where a.uid = auth.uid()));

create index if not exists album_photos_category_idx on public.album_photos (category, created_at desc);

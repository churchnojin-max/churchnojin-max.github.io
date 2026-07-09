-- ============================================================
-- 사진/파일 업로드용 공개 Storage 버킷 'uploads'
-- (앨범 '우리들 소식', 게시판, 교적 사진 등 공용 — js/upload.js 사용)
-- Cloudflare R2 대신 Supabase Storage를 쓰기 위한 설정.
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run 한 번 실행하세요.
-- ============================================================

-- 1) 공개 버킷 생성(이미 있으면 공개로 전환)
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do update set public = true;

-- 2) 정책: 누구나 읽기(공개), 로그인 사용자 업로드, 본인/관리자 삭제
drop policy if exists "uploads public read"   on storage.objects;
drop policy if exists "uploads auth insert"    on storage.objects;
drop policy if exists "uploads owner delete"   on storage.objects;
drop policy if exists "uploads owner update"   on storage.objects;

create policy "uploads public read"
  on storage.objects for select
  using (bucket_id = 'uploads');

create policy "uploads auth insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads');

create policy "uploads owner update"
  on storage.objects for update to authenticated
  using (bucket_id = 'uploads' and (owner = auth.uid()
         or exists (select 1 from public.admins a where a.uid = auth.uid())));

create policy "uploads owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'uploads' and (owner = auth.uid()
         or exists (select 1 from public.admins a where a.uid = auth.uid())));

-- 참고: 파일 경로는 js/upload.js가 'album/<시각>_<랜덤>.jpg' 형태로 만들며,
-- 공개 URL은 <SUPABASE_URL>/storage/v1/object/public/uploads/<경로> 입니다.

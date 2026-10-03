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

-- 2026-10-03: '누구나 읽기' 규칙은 로그인 안 한 사람도 파일 목록을 통째로 받을 수 있게 하므로 없앴다.
-- 공개 주소(/object/public/uploads/…)로 보는 것은 이 규칙 없이도 된다. 목록·관리용 읽기는 본인과 권한자만.
drop policy if exists "uploads read own or staff" on storage.objects;
create policy "uploads read own or staff"
  on storage.objects for select to authenticated
  using (bucket_id = 'uploads' and (owner = auth.uid() or owner_id = auth.uid()::text
         or exists (select 1 from public.admins a where a.uid = auth.uid())
         or exists (select 1 from public.member_links m where m.user_id = auth.uid()
                    and (m.can_finance or m.can_gyojeok or m.can_affairs or m.can_worship or m.can_homepage))));

-- 2026-10-03: 민감한 폴더(성도 문서·심방/상담 첨부·교적 사진·직인·설교 원고·자료실)는 비공개 보관함
-- 'private_files'(supabase/private_files_bucket.sql)에 올린다. 공개 보관함에는 그 폴더 이름으로 올릴 수 없다.
create policy "uploads auth insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'uploads'
    and (name like 'sermons/img/%'
         or split_part(name, '/', 1) not in ('archive', 'affairs', 'gyojeok', 'finance', 'sermons', 'resources'))
  );

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

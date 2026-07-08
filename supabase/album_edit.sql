-- ============================================================
--  ○○교회 — 홈 '우리들 소식' 본인 글 수정 허용
--  album_photos 에 UPDATE 정책이 없어(작성자도 수정 불가), 본인 글 수정 정책을 추가.
--  Supabase ▸ SQL Editor 에 1회 실행. (album.sql 이 먼저 실행돼 있어야 합니다.)
-- ============================================================

drop policy if exists "album_update_own" on public.album_photos;
create policy "album_update_own" on public.album_photos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

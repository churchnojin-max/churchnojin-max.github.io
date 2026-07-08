-- ============================================================
-- ○○교회 — 나눔터: 관리자 전체 삭제 권한
-- Supabase ▸ SQL Editor 에 붙여넣고 Run 하세요. (한 번만)
-- 작성자 본인 삭제는 기존 정책으로 이미 가능하며, 여기에 관리자 삭제를 더합니다.
-- ============================================================

-- 글(posts): 본인 또는 관리자가 삭제 가능
drop policy if exists "posts_delete_own_or_admin" on public.posts;
create policy "posts_delete_own_or_admin" on public.posts for delete
  using (auth.uid() = user_id or auth.uid() in (select uid from public.admins));

-- 댓글(comments): 본인 또는 관리자가 삭제 가능
drop policy if exists "comments_delete_own_or_admin" on public.comments;
create policy "comments_delete_own_or_admin" on public.comments for delete
  using (auth.uid() = user_id or auth.uid() in (select uid from public.admins));

-- ============================================================
-- ○○교회 나눔터 — Supabase 스키마 + 보안 정책(RLS)
-- Supabase ▸ SQL Editor 에 붙여넣고 "Run" 하세요. (한 번만)
-- ============================================================

-- ===== 게시글 =====
create table if not exists public.posts (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  author_name text not null,
  title       text not null check (char_length(title) between 1 and 100),
  content     text not null check (char_length(content) between 1 and 5000),
  created_at  timestamptz not null default now()
);

-- ===== 댓글 =====
create table if not exists public.comments (
  id          bigint generated always as identity primary key,
  post_id     bigint not null references public.posts (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  author_name text not null,
  content     text not null check (char_length(content) between 1 and 1000),
  created_at  timestamptz not null default now()
);

-- ===== RLS(행 수준 보안) 활성화 =====
alter table public.posts    enable row level security;
alter table public.comments enable row level security;

-- ----- 게시글 정책 -----
-- 누구나 읽기 가능
create policy "posts_select_all" on public.posts
  for select using (true);
-- 로그인한 본인만 작성(본인 user_id로만)
create policy "posts_insert_own" on public.posts
  for insert with check (auth.uid() = user_id);
-- 본인 글만 수정
create policy "posts_update_own" on public.posts
  for update using (auth.uid() = user_id);
-- 본인 글만 삭제
create policy "posts_delete_own" on public.posts
  for delete using (auth.uid() = user_id);

-- ----- 댓글 정책 -----
create policy "comments_select_all" on public.comments
  for select using (true);
create policy "comments_insert_own" on public.comments
  for insert with check (auth.uid() = user_id);
create policy "comments_delete_own" on public.comments
  for delete using (auth.uid() = user_id);

-- ============================================================
-- (선택) 관리자가 모든 글/댓글을 삭제할 수 있게 하려면:
-- 1) auth.users 의 본인 계정 UUID를 확인하고
-- 2) 아래처럼 관리자 UUID를 허용하는 정책을 추가하세요.
--
-- create policy "posts_admin_delete" on public.posts
--   for delete using ( auth.uid() = '관리자-UUID-여기에' );
-- create policy "comments_admin_delete" on public.comments
--   for delete using ( auth.uid() = '관리자-UUID-여기에' );
-- ============================================================

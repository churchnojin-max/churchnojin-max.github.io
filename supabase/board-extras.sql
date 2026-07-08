-- ============================================================
-- ○○교회 — 나눔터 확장: 글 성격(category) + 반응(이모지)
-- Supabase ▸ SQL Editor 에 붙여넣고 Run 하세요. (한 번만, 다시 실행해도 안전)
-- ============================================================

-- 1) 글 성격 컬럼
alter table public.posts add column if not exists category text;

-- 2) 게시글 반응 테이블 (좋아요·응원·기도 등)
create table if not exists public.post_reactions (
  id         bigint generated always as identity primary key,
  post_id    bigint not null references public.posts (id) on delete cascade,
  user_id    uuid   not null references auth.users (id) on delete cascade,
  type       text   not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id, type)
);
alter table public.post_reactions enable row level security;

-- 누구나 반응 수를 볼 수 있음
drop policy if exists "reactions_read_all" on public.post_reactions;
create policy "reactions_read_all" on public.post_reactions
  for select using (true);

-- 로그인 회원은 본인 반응 추가/취소 가능
drop policy if exists "reactions_insert_own" on public.post_reactions;
create policy "reactions_insert_own" on public.post_reactions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "reactions_delete_own" on public.post_reactions;
create policy "reactions_delete_own" on public.post_reactions
  for delete to authenticated using (auth.uid() = user_id);

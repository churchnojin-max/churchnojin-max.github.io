-- ============================================================
--  우리들 소식 — 앨범 사진 좋아요 · 댓글 · 제목/날짜 (인스타그램형 UI 지원)
--  Supabase → SQL Editor 에 붙여넣고 RUN 하세요. (여러 번 실행해도 안전)
--  (album.sql 의 album_photos 테이블이 먼저 있어야 합니다.)
-- ============================================================

-- ── 사진 제목 · 사용자 지정 날짜(미지정 시 업로드일) ──────────
alter table public.album_photos add column if not exists title      text;
alter table public.album_photos add column if not exists event_date date;

-- ── 좋아요 ─────────────────────────────────────────────
create table if not exists public.album_likes (
  photo_id   bigint not null references public.album_photos (id) on delete cascade,
  user_id    uuid   not null references auth.users (id)          on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id)
);

alter table public.album_likes enable row level security;

-- 좋아요 수는 누구나 조회 가능(공개 앨범)
drop policy if exists "album_likes_select_all" on public.album_likes;
create policy "album_likes_select_all" on public.album_likes
  for select using (true);

-- 로그인 본인만 좋아요 추가/취소
drop policy if exists "album_likes_insert_own" on public.album_likes;
create policy "album_likes_insert_own" on public.album_likes
  for insert with check (auth.uid() = user_id);

drop policy if exists "album_likes_delete_own" on public.album_likes;
create policy "album_likes_delete_own" on public.album_likes
  for delete using (auth.uid() = user_id);

create index if not exists album_likes_photo_idx on public.album_likes (photo_id);


-- ── 댓글 ───────────────────────────────────────────────
create table if not exists public.album_comments (
  id          bigint generated always as identity primary key,
  photo_id    bigint not null references public.album_photos (id) on delete cascade,
  user_id     uuid   not null references auth.users (id)          on delete cascade,
  author_name text,
  body        text   not null check (char_length(body) between 1 and 500),
  created_at  timestamptz not null default now()
);

alter table public.album_comments enable row level security;

-- 댓글은 누구나 조회 가능
drop policy if exists "album_comments_select_all" on public.album_comments;
create policy "album_comments_select_all" on public.album_comments
  for select using (true);

-- 로그인 본인만 댓글 작성
drop policy if exists "album_comments_insert_own" on public.album_comments;
create policy "album_comments_insert_own" on public.album_comments
  for insert with check (auth.uid() = user_id);

-- 본인 댓글 삭제
drop policy if exists "album_comments_delete_own" on public.album_comments;
create policy "album_comments_delete_own" on public.album_comments
  for delete using (auth.uid() = user_id);

-- 관리자는 모든 댓글 삭제 가능
drop policy if exists "album_comments_delete_admin" on public.album_comments;
create policy "album_comments_delete_admin" on public.album_comments
  for delete using (exists (select 1 from public.admins a where a.uid = auth.uid()));

create index if not exists album_comments_photo_idx on public.album_comments (photo_id, created_at);


-- ── 좋아요/댓글 수를 사진과 함께 한 번에 조회하는 뷰 ──────────
--  (프런트에서 album_feed 로 사진+집계를 함께 읽습니다. 없으면 album_photos 로 폴백)
--  title·event_date 컬럼 추가로 컬럼 순서가 바뀌므로 기존 뷰를 먼저 삭제 후 재생성
drop view if exists public.album_feed;
create view public.album_feed as
select
  p.*,
  coalesce(l.cnt, 0) as like_count,
  coalesce(c.cnt, 0) as comment_count
from public.album_photos p
left join (select photo_id, count(*)::int cnt from public.album_likes    group by photo_id) l on l.photo_id = p.id
left join (select photo_id, count(*)::int cnt from public.album_comments group by photo_id) c on c.photo_id = p.id;

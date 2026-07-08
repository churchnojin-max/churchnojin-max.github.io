-- ============================================================
--  나눔터 게시글 사진 첨부용 컬럼 추가
--  Supabase → SQL Editor 에 붙여넣고 RUN 한 번만 실행하세요.
--  (이미 있으면 아무 일도 일어나지 않습니다 — 안전)
-- ============================================================
alter table public.posts
  add column if not exists images jsonb not null default '[]'::jsonb;

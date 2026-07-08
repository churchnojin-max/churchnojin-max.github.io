-- ============================================================
--  우리들 소식 — 공지사항(notices) + 앨범 카테고리 관리(album_categories)
--  Supabase → SQL Editor 에 붙여넣고 RUN 하세요. (여러 번 실행해도 안전)
--  관리자 판정은 기존 public.admins(uid) 테이블 기준입니다.
-- ============================================================

-- ── 앨범 카테고리 (관리자가 화면에서 추가/삭제) ───────────────
create table if not exists public.album_categories (
  name       text primary key,
  sort       int  not null default 100,
  created_at timestamptz not null default now()
);

alter table public.album_categories enable row level security;

-- 누구나 조회(업로드 폼·앨범 카드에서 사용)
drop policy if exists "album_cat_select_all" on public.album_categories;
create policy "album_cat_select_all" on public.album_categories
  for select using (true);

-- 추가/수정/삭제는 관리자만
drop policy if exists "album_cat_admin_insert" on public.album_categories;
create policy "album_cat_admin_insert" on public.album_categories
  for insert with check (exists (select 1 from public.admins a where a.uid = auth.uid()));
drop policy if exists "album_cat_admin_update" on public.album_categories;
create policy "album_cat_admin_update" on public.album_categories
  for update using (exists (select 1 from public.admins a where a.uid = auth.uid()));
drop policy if exists "album_cat_admin_delete" on public.album_categories;
create policy "album_cat_admin_delete" on public.album_categories
  for delete using (exists (select 1 from public.admins a where a.uid = auth.uid()));

-- 초기 카테고리 시드(이미 있으면 유지) — sort 오름차순 → 이름
insert into public.album_categories (name, sort) values
  ('주일 예배', 10), ('여름성경학교', 20), ('수련회', 30), ('지역 섬김', 40),
  ('전 성도 식사', 50), ('연합예배', 60), ('일상', 70), ('여행', 80),
  ('맛집', 90), ('정보', 100), ('취미', 110), ('건강', 120),
  ('감사', 130), ('축하', 140), ('반려동물', 150), ('문화·나들이', 160), ('봉사', 170)
on conflict (name) do nothing;


-- ── 공지사항 (관리자만 작성) ──────────────────────────────
create table if not exists public.notices (
  id          bigint generated always as identity primary key,
  title       text not null check (char_length(title) between 1 and 200),
  body        text not null default '',
  pinned      boolean not null default false,
  author_name text,
  user_id     uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.notices enable row level security;

-- 누구나 공지 조회 가능(공개)
drop policy if exists "notices_select_all" on public.notices;
create policy "notices_select_all" on public.notices
  for select using (true);

-- 작성/수정/삭제는 관리자만
drop policy if exists "notices_admin_insert" on public.notices;
create policy "notices_admin_insert" on public.notices
  for insert with check (exists (select 1 from public.admins a where a.uid = auth.uid()));
drop policy if exists "notices_admin_update" on public.notices;
create policy "notices_admin_update" on public.notices
  for update using (exists (select 1 from public.admins a where a.uid = auth.uid()));
drop policy if exists "notices_admin_delete" on public.notices;
create policy "notices_admin_delete" on public.notices
  for delete using (exists (select 1 from public.admins a where a.uid = auth.uid()));

create index if not exists notices_order_idx on public.notices (pinned desc, created_at desc);

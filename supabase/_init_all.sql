-- ============================================================
-- 노진교회 Supabase 전체 초기화 SQL (자동 생성)
-- Supabase ▸ SQL Editor 에 전체 붙여넣고 Run 하세요. (한 번)
-- 모든 테이블 if-not-exists / 정책 drop-create 라 재실행 안전.
-- ============================================================


-- ####################  schema.sql  ####################

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

-- ####################  album.sql  ####################

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

-- ####################  affairs.sql  ####################

-- 행정관리: 심방관리(visitations) · 상담관리(counsels)
-- 관리자(admins 테이블에 등록된 사용자)만 읽기/쓰기 가능.
-- Supabase → SQL Editor 에 붙여넣고 1회 실행하세요.

create table if not exists public.visitations (
  id uuid primary key default gen_random_uuid(),
  visit_date date,
  member_name text,
  member_key text,
  category text,            -- 심방종류
  location text,
  pastor text,              -- 심방자
  content text,
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);

create table if not exists public.counsels (
  id uuid primary key default gen_random_uuid(),
  counsel_date date,
  member_name text,
  member_key text,
  category text,            -- 상담분류
  counselor text,           -- 상담자
  content text,
  followup text,            -- 후속조치
  is_private boolean default true,
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);

alter table public.visitations enable row level security;
alter table public.counsels enable row level security;

-- 관리자만 전체 접근
drop policy if exists "admin all visitations" on public.visitations;
create policy "admin all visitations" on public.visitations for all
  using (exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (exists (select 1 from public.admins a where a.uid = auth.uid()));

drop policy if exists "admin all counsels" on public.counsels;
create policy "admin all counsels" on public.counsels for all
  using (exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (exists (select 1 from public.admins a where a.uid = auth.uid()));

-- ####################  affairs_modules.sql  ####################

-- 목회 행정 추가 모듈: 교육관리(edu_records) · 설교관리(sermons) · 문서관리(documents)
-- 관리자(admins)만 읽기/쓰기. Supabase → SQL Editor 에 1회 실행.

create table if not exists public.edu_records (
  id uuid primary key default gen_random_uuid(),
  edu_date   date,
  title      text,      -- 교육명
  target     text,      -- 대상/부서
  teacher    text,      -- 강사/인도자
  attendance text,      -- 참석 인원
  content    text,      -- 내용/비고
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);

create table if not exists public.sermons (
  id uuid primary key default gen_random_uuid(),
  sermon_date date,
  service    text,      -- 예배
  title      text,      -- 제목
  scripture  text,      -- 본문(성경)
  preacher   text,      -- 설교자
  media_url  text,      -- 영상/음성 링크
  file_url   text,      -- 원고/자료 파일
  content    text,      -- 요약/메모
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  doc_date   date,
  title      text,      -- 제목
  category   text,      -- 분류
  manager    text,      -- 담당/부서
  file_url   text,      -- 첨부 파일
  content    text,      -- 내용/비고
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);

alter table public.edu_records enable row level security;
alter table public.sermons enable row level security;
alter table public.documents enable row level security;

do $$
declare t text;
begin
  foreach t in array array['edu_records','sermons','documents'] loop
    execute format('drop policy if exists "admin all %1$s" on public.%1$s', t);
    execute format('create policy "admin all %1$s" on public.%1$s for all using (exists (select 1 from public.admins a where a.uid = auth.uid())) with check (exists (select 1 from public.admins a where a.uid = auth.uid()))', t);
  end loop;
end $$;

-- ####################  profiles-admin.sql  ####################

-- ============================================================
-- ○○교회 — 회원 프로필 + 관리자 (회원 목록 관리용)
-- Supabase ▸ SQL Editor 에 붙여넣고 Run 하세요. (한 번만)
-- ============================================================

-- ===== 회원 프로필 =====
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text,
  email      text,
  provider   text,
  created_at timestamptz not null default now()
);

-- ===== 관리자 목록 (여기에 등록된 사람만 전체 회원을 볼 수 있음) =====
create table if not exists public.admins (
  uid uuid primary key references auth.users (id) on delete cascade
);

alter table public.profiles enable row level security;
alter table public.admins   enable row level security;

-- ===== 신규 가입 시 프로필 자동 생성 (카카오/이메일 공통) =====
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, provider)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name',
             new.raw_user_meta_data->>'full_name',
             new.raw_user_meta_data->>'nickname',
             split_part(coalesce(new.email,''),'@',1)),
    new.email,
    coalesce(new.raw_app_meta_data->>'provider','email')
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== 기존 가입자 보충(트리거 적용 전 가입자) =====
insert into public.profiles (id, name, email, provider)
select u.id,
       coalesce(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'nickname', split_part(coalesce(u.email,''),'@',1)),
       u.email,
       coalesce(u.raw_app_meta_data->>'provider','email')
from auth.users u
on conflict (id) do nothing;

-- ===== RLS 정책 =====
-- 본인 프로필, 또는 관리자는 전체 조회 가능
create policy "profiles_select_self_or_admin" on public.profiles
  for select using (
    auth.uid() = id
    or auth.uid() in (select uid from public.admins)
  );
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id);

-- admins: 본인이 관리자인지 확인용(자기 행만 조회)
create policy "admins_select_self" on public.admins
  for select using (auth.uid() = uid);

-- ============================================================
-- ★ 관리자 지정 (한 번만) ★
-- 1) 사이트에서 한 번 로그인한 뒤
-- 2) Supabase ▸ Authentication ▸ Users 에서 본인 계정의 User UID 복사
-- 3) 아래 한 줄의 '여기에-UID'를 바꿔 실행:
--
-- insert into public.admins (uid) values ('여기에-UID') on conflict do nothing;
-- ============================================================

-- ####################  add-family-column.sql  ####################

-- 내 정보 "내 가족" 입력란 저장용 컬럼
-- Supabase → SQL Editor 에 붙여넣고 1회 실행하면 됩니다. (본인만 수정 가능 — 기존 profiles RLS 적용)
alter table public.profiles add column if not exists family text;

-- ####################  admin_set_member.sql  ####################

-- ============================================================
--  ○○교회 — 관리자가 회원의 정/준회원 상태 + 교적 연결을 직접 설정
--  Supabase ▸ SQL Editor 에 붙여넣고 Run (1회).
--  · 권한관리 화면에서 준회원→정회원 승격 시 교적(매칭키)과 연동.
--  · 관리자만 호출 가능. 정회원 연결 시 교적의 배우자매칭키도 동기화.
-- ============================================================

create or replace function public.admin_set_member(p_uid uuid, p_status text, p_member_key text, p_member_name text)
returns json language plpgsql security definer set search_path = public as $$
declare v_spousekey text := '';
begin
  if not exists (select 1 from public.admins where uid = auth.uid()) then
    return json_build_object('ok', false, 'error', '관리자만 가능합니다.');
  end if;
  if p_status = '정회원' and coalesce(p_member_key, '') <> '' then
    select coalesce(spouse_key, '') into v_spousekey from public.gyojeok where member_key = p_member_key limit 1;
  end if;
  insert into public.member_links (user_id, member_status, member_key, member_name, spouse_key, updated_at)
  values (p_uid, p_status, nullif(p_member_key, ''), nullif(p_member_name, ''), nullif(v_spousekey, ''), now())
  on conflict (user_id) do update set
    member_status = excluded.member_status,
    member_key    = excluded.member_key,
    member_name   = coalesce(excluded.member_name, public.member_links.member_name),
    spouse_key    = excluded.spouse_key,
    updated_at    = now();
  return json_build_object('ok', true);
end $$;

-- ####################  album-social.sql  ####################

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

-- ####################  album_edit.sql  ####################

-- ============================================================
--  ○○교회 — 홈 '우리들 소식' 본인 글 수정 허용
--  album_photos 에 UPDATE 정책이 없어(작성자도 수정 불가), 본인 글 수정 정책을 추가.
--  Supabase ▸ SQL Editor 에 1회 실행. (album.sql 이 먼저 실행돼 있어야 합니다.)
-- ============================================================

drop policy if exists "album_update_own" on public.album_photos;
create policy "album_update_own" on public.album_photos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ####################  app_settings.sql  ####################

-- ============================================================
--  ○○교회 — 재정 설정(app_settings) 키-값 테이블
--  Supabase ▸ SQL Editor 에 붙여넣고 Run (1회).
--  · 이월금 등 회계 설정 저장. 재정권한자/관리자만 조회·수정.
--  · 키 예: carryover_2026 = 전기이월금(원)
--  · is_finance() 는 offerings.sql / finance_migration.sql 에서 생성됨.
-- ============================================================

create table if not exists public.app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz default now()
);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select using (public.is_finance());

drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings for all
  using (public.is_finance()) with check (public.is_finance());

-- ####################  bible_reading.sql  ####################

-- ============================================================
--  ○○교회 — 나의 성경읽기 (구속사 365 읽기표 진도)
--  성도별 일차(1~365) 체크를 저장. 대시보드 '나의 성경읽기' 카드가 사용.
--  Supabase ▸ SQL Editor 에 1회 실행.
-- ============================================================

create table if not exists public.bible_reading (
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day_no   smallint not null check (day_no between 1 and 365),
  done_at  timestamptz not null default now(),
  primary key (user_id, day_no)
);
create index if not exists bible_reading_user_idx on public.bible_reading(user_id);

alter table public.bible_reading enable row level security;

-- 본인 진도: 조회·체크·해제
drop policy if exists "own read bible_reading" on public.bible_reading;
create policy "own read bible_reading" on public.bible_reading for select
  using (auth.uid() = user_id);
drop policy if exists "own insert bible_reading" on public.bible_reading;
create policy "own insert bible_reading" on public.bible_reading for insert
  with check (auth.uid() = user_id);
drop policy if exists "own delete bible_reading" on public.bible_reading;
create policy "own delete bible_reading" on public.bible_reading for delete
  using (auth.uid() = user_id);

-- 관리자: 전체 현황 조회(목회행정 카드)
drop policy if exists "admin read bible_reading" on public.bible_reading;
create policy "admin read bible_reading" on public.bible_reading for select
  using (exists (select 1 from public.admins a where a.uid = auth.uid()));

-- 함께 읽는 성도 수(최근 30일 내 체크한 사람) — 로그인한 성도 누구나 조회 가능
create or replace function public.bible_readers_count()
returns integer
language sql stable security definer set search_path = public
as $$
  select count(distinct user_id)::int
  from public.bible_reading
  where done_at > now() - interval '30 days';
$$;
grant execute on function public.bible_readers_count() to authenticated;

-- ####################  board-extras.sql  ####################

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

-- ####################  board-images.sql  ####################

-- ============================================================
--  나눔터 게시글 사진 첨부용 컬럼 추가
--  Supabase → SQL Editor 에 붙여넣고 RUN 한 번만 실행하세요.
--  (이미 있으면 아무 일도 일어나지 않습니다 — 안전)
-- ============================================================
alter table public.posts
  add column if not exists images jsonb not null default '[]'::jsonb;

-- ####################  bulletins.sql  ####################

-- 주보(디지털 주보) 저장 — 목회행정 '주보제작'에서 작성/게시.
-- data(jsonb)에 주보 전체가 들어가며, 헌금 '금액'은 data.offering_amounts 키에만 둔다.
-- 공개 뷰(bulletins_public)는 published=true 인 주보에서 offering_amounts 키를 제거해 노출한다.
--   → 인쇄/PDF(관리자)는 금액 포함, 홈페이지(anon)는 금액 제외.

create table if not exists public.bulletins (
  id         uuid primary key default gen_random_uuid(),
  bdate      date not null,            -- 주보 주일 날짜
  title      text,                     -- 주일 설교 제목(목록 표시용)
  scripture  text,                     -- 주일 설교 본문
  preacher   text,                     -- 설교자
  data       jsonb not null default '{}'::jsonb,  -- 주보 전체 데이터
  published  boolean not null default false,      -- 홈페이지 게시 여부
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists bulletins_bdate_uidx on public.bulletins (bdate);
create index if not exists bulletins_pub_idx on public.bulletins (published, bdate desc);

alter table public.bulletins enable row level security;
drop policy if exists "admin all bulletins" on public.bulletins;
create policy "admin all bulletins" on public.bulletins for all
  using (exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (exists (select 1 from public.admins a where a.uid = auth.uid()));

-- 공개 뷰: 게시된 주보만, 헌금 금액(offering_amounts) 제거 후 노출
drop view if exists public.bulletins_public;
create view public.bulletins_public as
  select id, bdate, title, scripture, preacher,
         (data - 'offering_amounts') as data,
         updated_at
  from public.bulletins
  where published = true;
grant select on public.bulletins_public to anon, authenticated;

-- ####################  church_settings.sql  ####################

-- 교회 설정(연간 봉사위원 등) 저장. 관리자만 읽기/쓰기.
-- key='committees' → data = { months:[ {month:'2026-07', offering, guide, parking}, ... ] }
create table if not exists public.church_settings (
  key        text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table public.church_settings enable row level security;
drop policy if exists "admin all church_settings" on public.church_settings;
create policy "admin all church_settings" on public.church_settings for all
  using (exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (exists (select 1 from public.admins a where a.uid = auth.uid()));

-- ####################  community-admin.sql  ####################

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

-- ####################  counsel-usage.sql  ####################

-- ============================================================
--  상담 AI(○○교회 말씀지기) — 1인 1일 질문 한도용 사용량 테이블
--  Supabase → SQL Editor 에 붙여넣고 RUN 한 번만 실행하세요.
-- ============================================================

create table if not exists public.counsel_usage (
  user_id uuid not null,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);

-- 본인 외에는 접근 불가(함수가 security definer로 우회 처리)
alter table public.counsel_usage enable row level security;

-- 오늘 사용량을 확인하고, 한도 미만이면 1 증가시키는 함수.
-- auth.uid()로 호출자 본인만 집계하므로 위조 불가.
create or replace function public.counsel_check_and_bump(p_limit int default 20)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  cur int;
begin
  uid := auth.uid();
  if uid is null then
    return json_build_object('allowed', false, 'count', 0, 'limit', p_limit);
  end if;

  select count into cur from public.counsel_usage
   where user_id = uid and day = current_date;
  cur := coalesce(cur, 0);

  if cur >= p_limit then
    return json_build_object('allowed', false, 'count', cur, 'limit', p_limit);
  end if;

  insert into public.counsel_usage(user_id, day, count)
  values (uid, current_date, 1)
  on conflict (user_id, day)
  do update set count = public.counsel_usage.count + 1;

  return json_build_object('allowed', true, 'count', cur + 1, 'limit', p_limit);
end;
$$;

grant execute on function public.counsel_check_and_bump(int) to authenticated;

-- ####################  donation_receipts.sql  ####################

-- 기부금영수증 발급대장 (소득세법 시행규칙 별지 제45호의2서식 발급 이력)
-- 재정 권한자만 조회/발급/취소 가능. is_finance() 는 offerings.sql 에서 정의됨.
create table if not exists public.donation_receipts (
  id           bigint generated always as identity primary key,
  receipt_no   text not null,                 -- 일련번호 예) 2026-0001
  fy           int  not null,                  -- 회계연도(라벨연도)
  member_key   text,                           -- 대표 기부자 매칭키(이름|YYYYMMDD)
  donor_name   text not null,                  -- 기부자 성명
  donor_birth  text,                           -- 생년월일 YYYYMMDD
  donor_rrn    text,                           -- 주민등록번호(선택)
  donor_addr   text,                           -- 주소
  included_keys text[] default '{}',           -- 합산된 매칭키들(부부합산 시 본인+배우자)
  detail       text not null default 'sum',    -- 명세방식: sum(합계) | month(월별) | account(항목별)
  spouse       boolean not null default false, -- 부부합산 여부
  period_label text,                           -- 기간 라벨 예) 2026년도(2025-12-01~2026-11-30)
  amount       bigint not null default 0,      -- 기부금 합계
  cnt          int not null default 0,         -- 헌금 건수
  method       text not null default 'print',  -- 발급방식: print(출력) | pdf
  status       text not null default 'issued', -- issued | cancelled
  issued_by    text,                           -- 발급자(이메일)
  issued_at    timestamptz not null default now(),
  cancelled_at timestamptz
);

create index if not exists donation_receipts_fy_idx on public.donation_receipts (fy);
create index if not exists donation_receipts_key_idx on public.donation_receipts (member_key);

alter table public.donation_receipts enable row level security;

drop policy if exists donation_receipts_all on public.donation_receipts;
create policy donation_receipts_all on public.donation_receipts for all
  using ( public.is_finance() ) with check ( public.is_finance() );

-- ####################  edu_extra.sql  ####################

-- ============================================================
-- 교육관리 확장: 기간·기수·반·참석자(교적 연동) + 강의 자료실(수강생 전용)
-- Supabase ▸ SQL Editor 에 붙여넣고 Run 하세요. (한 번만, 다시 실행해도 안전)
-- ============================================================

-- 1) edu_records 확장 컬럼 (기간·기수·반·참석자)
alter table public.edu_records add column if not exists end_date date;
alter table public.edu_records add column if not exists cohort text;
alter table public.edu_records add column if not exists class_name text;
alter table public.edu_records add column if not exists participants text default '[]';

-- 1-1) 수강생 본인은 자신이 참석자로 등록된 교육을 조회할 수 있음(관리자 전용 정책에 追加, "나의 정보"·교적에서 조회용)
drop policy if exists "edu_records_read_participant" on public.edu_records;
create policy "edu_records_read_participant" on public.edu_records
  for select to authenticated
  using (
    exists (
      select 1
      from public.member_links ml
      cross join lateral jsonb_array_elements(coalesce(nullif(edu_records.participants, '')::jsonb, '[]'::jsonb)) elem
      where ml.user_id = auth.uid() and elem->>'key' = ml.member_key
    )
  );

-- 2) 경로 첫 세그먼트를 uuid로 안전 변환(형식이 아니면 null)
create or replace function public.edu_id_from_path(p text)
returns uuid language plpgsql immutable as $$
declare v_id uuid;
begin
  begin
    v_id := split_part(p, '/', 1)::uuid;
  exception when others then
    v_id := null;
  end;
  return v_id;
end $$;

-- 3) 수강생 판별 함수: 관리자이거나, 해당 교육의 참석자(교적 매칭키)와 내 계정이 연결되어 있으면 true
create or replace function public.can_access_edu(p_edu_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from public.admins a where a.uid = auth.uid())
    or exists (
      select 1
      from public.edu_records er
      join public.member_links ml on ml.user_id = auth.uid()
      cross join lateral jsonb_array_elements(coalesce(nullif(er.participants, '')::jsonb, '[]'::jsonb)) elem
      where er.id = p_edu_id
        and ml.member_key is not null
        and elem->>'key' = ml.member_key
    );
$$;

-- 4) 강의 자료실: 파일 목록 테이블(수강생만 조회, 관리자만 업로드/삭제)
create table if not exists public.edu_materials (
  id bigint generated always as identity primary key,
  edu_id uuid not null references public.edu_records(id) on delete cascade,
  title text not null,
  path text not null,
  size bigint,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.edu_materials enable row level security;

drop policy if exists "edu_materials_read" on public.edu_materials;
create policy "edu_materials_read" on public.edu_materials
  for select to authenticated using (public.can_access_edu(edu_id));

drop policy if exists "edu_materials_write_admin" on public.edu_materials;
create policy "edu_materials_write_admin" on public.edu_materials
  for all to authenticated
  using (exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (exists (select 1 from public.admins a where a.uid = auth.uid()));

-- 5) Storage 버킷(비공개) — 객체 경로는 "{edu_id}/파일명" 형태로 저장
insert into storage.buckets (id, name, public)
values ('edu_materials', 'edu_materials', false)
on conflict (id) do nothing;

drop policy if exists "edu_materials_storage_read" on storage.objects;
create policy "edu_materials_storage_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'edu_materials' and public.can_access_edu(public.edu_id_from_path(name)));

drop policy if exists "edu_materials_storage_write_admin" on storage.objects;
create policy "edu_materials_storage_write_admin" on storage.objects
  for all to authenticated
  using (bucket_id = 'edu_materials' and exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (bucket_id = 'edu_materials' and exists (select 1 from public.admins a where a.uid = auth.uid()));

-- ####################  finance-membership.sql  ####################

-- ============================================================
-- ○○교회 — 정회원/준회원 + 재정관리 권한 (교적 연동)
-- Supabase ▸ SQL Editor 에 통째로 붙여넣고 Run 하세요. (여러 번 실행해도 안전)
--
-- [설계]
--  - 교적 매칭(이름+생년월일) 결과와 '재정관리' 접근 권한을 담는 표입니다.
--  - 보안: 회원 본인은 자기 상태를 "읽기"만 가능, "쓰기"는 관리자(admins) 또는
--    서버(Apps Script의 service_role)만 가능 → 스스로 정회원/재정권한 승격 불가.
--  - 헌금 등 재정 데이터 자체는 여기 저장하지 않습니다(구글시트에 보관).
--    이 표는 "이 로그인 계정이 교적의 누구인가 + 재정 접근 가능한가"만 담습니다.
-- ============================================================

-- ── 1) 회원-교적 연결 표 ─────────────────────────────────────
create table if not exists public.member_links (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  member_status  text    not null default '준회원',  -- '준회원' | '정회원'
  member_key     text,                               -- 교적 매칭키 (이름|YYYYMMDD)
  member_id      integer,                            -- 교적ID (구글시트 교적 탭)
  member_name    text,                               -- 매칭된 교적 이름
  can_finance    boolean not null default false,     -- 재정관리 페이지 접근 권한
  matched_at     timestamptz,                        -- 정회원 매칭 시각
  note           text,                               -- 관리자 메모(수동승인 사유 등)
  updated_at     timestamptz not null default now()
);

create index if not exists member_links_key_idx on public.member_links (member_key);

alter table public.member_links enable row level security;

-- PostgREST(REST API)에서 접근 가능하도록 권한 부여 (실제 차단은 아래 RLS가 함)
grant select, insert, update, delete on public.member_links to authenticated;

-- ── 2) RLS 정책 ─────────────────────────────────────────────
-- (가) 조회: 본인 또는 관리자
drop policy if exists "member_links_select" on public.member_links;
create policy "member_links_select" on public.member_links
  for select using (
    auth.uid() = user_id
    or auth.uid() in (select uid from public.admins)
  );

-- (나) 쓰기(등록/수정/삭제): 관리자만.
--      일반 회원에게는 쓰기 정책이 없으므로 RLS가 자동 차단합니다.
--      Apps Script는 service_role 키로 호출 → RLS를 우회해 매칭 결과를 기록합니다.
drop policy if exists "member_links_admin_write" on public.member_links;
create policy "member_links_admin_write" on public.member_links
  for all
  using      (auth.uid() in (select uid from public.admins))
  with check (auth.uid() in (select uid from public.admins));

-- ── 3) 편의 함수: 현재 로그인 사용자의 재정 접근 가능 여부 ─────
--     (관리자이거나 can_finance=true 이면 true)
create or replace function public.can_access_finance()
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    exists (select 1 from public.admins a where a.uid = auth.uid())
    or exists (select 1 from public.member_links m
               where m.user_id = auth.uid() and m.can_finance = true);
$$;

-- ============================================================
-- ★ 운영 참고 (수동 작업 예시) ★
--
-- 1) 특정 회원에게 '재정관리' 권한 주기 (UID는 Authentication ▸ Users에서 확인):
--    insert into public.member_links (user_id, can_finance, member_status)
--    values ('여기에-UID', true, '정회원')
--    on conflict (user_id) do update set can_finance = true;
--
-- 2) 생년월일 미입력 교인(영유아 등) 수동 정회원 승인:
--    update public.member_links
--      set member_status = '정회원', member_id = 82, member_name = '김준상',
--          matched_at = now(), note = '생년월일 미입력 수동승인'
--      where user_id = '여기에-UID';
--
-- 3) 관리자 본인(목사님)은 admins 테이블에 있으면 can_access_finance()가 자동 true.
-- ============================================================

-- ####################  finance_audit.sql  ####################

-- 재정 전표 감사추적: 입력자/입력일시·수정자/수정일시 + 전체 변경 로그
-- offerings(수입), expenses(지출) 공통. is_finance() 는 offerings.sql 에서 정의됨.

-- 1) 감사 컬럼
alter table public.offerings add column if not exists created_by text;
alter table public.offerings add column if not exists created_at timestamptz default now();
alter table public.offerings add column if not exists updated_by text;
alter table public.offerings add column if not exists updated_at timestamptz;
alter table public.expenses add column if not exists created_by text;
alter table public.expenses add column if not exists created_at timestamptz default now();
alter table public.expenses add column if not exists updated_by text;
alter table public.expenses add column if not exists updated_at timestamptz;

-- 2) 현재 사용자 표기(이름 우선, 없으면 이메일)
create or replace function public.actor_label() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'name', ''),
    nullif(current_setting('request.jwt.claims', true)::json ->> 'email', ''),
    auth.uid()::text
  )
$$;

-- 3) 입력/수정 스탬프 트리거
create or replace function public.stamp_voucher() returns trigger language plpgsql as $$
begin
  if (TG_OP = 'INSERT') then
    if new.created_by is null then new.created_by := public.actor_label(); end if;
    if new.created_at is null then new.created_at := now(); end if;
  elsif (TG_OP = 'UPDATE') then
    new.created_by := old.created_by;     -- 입력자 보존
    new.created_at := old.created_at;
    new.updated_by := public.actor_label();
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_stamp on public.offerings;
create trigger trg_stamp before insert or update on public.offerings for each row execute function public.stamp_voucher();
drop trigger if exists trg_stamp on public.expenses;
create trigger trg_stamp before insert or update on public.expenses for each row execute function public.stamp_voucher();

-- 4) 전체 변경 로그(추가·수정·삭제 모두 기록)
create table if not exists public.finance_audit (
  id       bigint generated always as identity primary key,
  tbl      text not null,            -- 'offerings' | 'expenses'
  row_id   bigint,
  action   text not null,            -- INSERT | UPDATE | DELETE
  actor    text,
  at       timestamptz not null default now(),
  amount   bigint,
  account  text,
  party    text,                     -- giver(헌금자) / payee(수령인)
  snapshot jsonb
);
create index if not exists finance_audit_at_idx on public.finance_audit (at desc);

alter table public.finance_audit enable row level security;
drop policy if exists finance_audit_sel on public.finance_audit;
create policy finance_audit_sel on public.finance_audit for select using ( public.is_finance() );
-- INSERT 정책 없음: 아래 트리거(security definer)만 기록 가능 → 위변조 방지

create or replace function public.log_voucher_audit() returns trigger language plpgsql security definer as $$
declare r record; acct text; pty text;
begin
  if (TG_OP = 'DELETE') then r := old; else r := new; end if;
  if (TG_TABLE_NAME = 'offerings') then acct := r.category; pty := r.giver; else acct := r.account; pty := r.payee; end if;
  insert into public.finance_audit(tbl, row_id, action, actor, amount, account, party, snapshot)
    values (TG_TABLE_NAME, r.id, TG_OP, public.actor_label(), r.amount, acct, pty, to_jsonb(r));
  return null;
end $$;

drop trigger if exists trg_audit on public.offerings;
create trigger trg_audit after insert or update or delete on public.offerings for each row execute function public.log_voucher_audit();
drop trigger if exists trg_audit on public.expenses;
create trigger trg_audit after insert or update or delete on public.expenses for each row execute function public.log_voucher_audit();

-- ####################  finance_migration.sql  ####################

-- ============================================================
--  ○○교회 — 재정/교적 Supabase 완전 전환 (Apps Script 대체)
--  Supabase ▸ SQL Editor 에 붙여넣고 Run (1회).
--  선행: offerings.sql, gyojeok.sql 실행됨.
--  의존 기존 테이블: admins(uid), profiles(id,name,email),
--    member_links(user_id UNIQUE, member_status, member_name, member_key, can_finance, spouse_key)
-- ============================================================

-- 공통 보안 함수(이미 있으면 갱신) ----------------------------------------
create or replace function public.is_finance()
returns boolean language sql security definer stable set search_path = public as $$
  select exists(select 1 from public.admins a where a.uid = auth.uid())
      or exists(select 1 from public.member_links m where m.user_id = auth.uid() and m.can_finance = true)
$$;

create or replace function public.my_member_keys()
returns setof text language sql security definer stable set search_path = public as $$
  select member_key from public.member_links where user_id = auth.uid() and coalesce(member_key,'') <> ''
  union
  select spouse_key from public.member_links where user_id = auth.uid() and coalesce(spouse_key,'') <> ''
$$;

-- ── 마스터/거래 테이블 ───────────────────────────────────────────────
create table if not exists public.accounts (   -- 계정과목
  id bigint generated always as identity primary key,
  code text, atype text,            -- atype: 수입 / 지출
  category text, name text,         -- category=상위계정, name=계정명
  sort int default 0
);

create table if not exists public.services (   -- 예배
  id bigint generated always as identity primary key,
  name text, sort int default 0, active boolean default true
);

create table if not exists public.budget (     -- 예산
  id bigint generated always as identity primary key,
  code text, name text, atype text,
  prev_budget bigint default 0, prev_actual bigint default 0, budget bigint default 0
);

create table if not exists public.expenses (   -- 지출 전표
  id bigint generated always as identity primary key,
  exp_date date, account text, category text, payee text,
  amount integer not null default 0, method text, memo text,
  created_by uuid default auth.uid(), created_at timestamptz default now()
);
create index if not exists expenses_date_idx on public.expenses(exp_date);

-- offerings(헌금)에 항목/예배 입력분 대비 컬럼 보강(이미 있으면 무시)
alter table public.offerings add column if not exists created_by uuid;

-- ── RLS ──────────────────────────────────────────────────────────────
alter table public.accounts enable row level security;
alter table public.services enable row level security;
alter table public.budget   enable row level security;
alter table public.expenses enable row level security;

do $$ begin
  -- 마스터(accounts/services/budget): 재정권한자만 조회·수정
  drop policy if exists accounts_all on public.accounts;
  create policy accounts_all on public.accounts for all using (public.is_finance()) with check (public.is_finance());
  drop policy if exists services_all on public.services;
  create policy services_all on public.services for all using (public.is_finance()) with check (public.is_finance());
  drop policy if exists budget_all on public.budget;
  create policy budget_all on public.budget for all using (public.is_finance()) with check (public.is_finance());
  drop policy if exists expenses_all on public.expenses;
  create policy expenses_all on public.expenses for all using (public.is_finance()) with check (public.is_finance());
end $$;

-- ============================================================
--  RPC (security definer) — Apps Script 대체 권한 작업
-- ============================================================

-- 교적 인증(이름+생년월일 → 정/준회원 기록). actionMatch_ 대체.
create or replace function public.match_member(p_name text, p_birth text)
returns json language plpgsql security definer set search_path = public as $$
declare v_key text; v_g public.gyojeok%rowtype; v_found boolean := false;
begin
  if coalesce(p_name,'') = '' or p_birth !~ '^[0-9]{8}$' then
    return json_build_object('ok', false, 'error', '이름과 생년월일(YYYYMMDD)을 정확히 입력하세요.');
  end if;
  v_key := p_name || '|' || p_birth;
  select * into v_g from public.gyojeok where member_key = v_key limit 1;
  v_found := found;
  insert into public.member_links(user_id, member_status, member_key, member_name, spouse_key, updated_at)
  values (auth.uid(), case when v_found then '정회원' else '준회원' end, v_key, p_name,
          case when v_found then coalesce(v_g.spouse_key,'') else null end, now())
  on conflict (user_id) do update set
    member_status = excluded.member_status, member_key = excluded.member_key,
    member_name = excluded.member_name,
    spouse_key = coalesce(excluded.spouse_key, public.member_links.spouse_key),
    updated_at = now();
  if v_found then
    return json_build_object('ok', true, 'status', '정회원', 'name', p_name);
  else
    return json_build_object('ok', true, 'status', '준회원', 'message', '교적에서 이름+생년월일이 일치하지 않습니다. 관리자 승인 후 정회원이 됩니다.');
  end if;
end $$;

-- 내 상태(정/준회원·매칭키·배우자·재정권한). actionMe_ 대체. + spouse_key 동기화.
create or replace function public.my_profile()
returns json language plpgsql security definer set search_path = public as $$
declare v_link public.member_links%rowtype; v_g public.gyojeok%rowtype;
        v_spouse text := ''; v_spousekey text := '';
begin
  select * into v_link from public.member_links where user_id = auth.uid() limit 1;
  if v_link.member_status = '정회원' and coalesce(v_link.member_key,'') <> '' then
    select * into v_g from public.gyojeok where member_key = v_link.member_key limit 1;
    if found then
      v_spouse := coalesce(v_g.spouse,''); v_spousekey := coalesce(v_g.spouse_key,'');
      update public.member_links set spouse_key = v_spousekey
        where user_id = auth.uid() and coalesce(spouse_key,'') <> v_spousekey;
    end if;
  end if;
  return json_build_object(
    'status', coalesce(v_link.member_status, '준회원'),
    'memberName', coalesce(v_link.member_name, ''),
    'memberKey', coalesce(v_link.member_key, ''),
    'spouse', v_spouse, 'spouseKey', v_spousekey,
    'canFinance', (exists(select 1 from public.admins where uid = auth.uid()) or coalesce(v_link.can_finance, false))
  );
end $$;

-- 권한 목록(관리자만). actionListAccess_ 대체.
create or replace function public.list_access()
returns json language sql security definer set search_path = public as $$
  select coalesce(json_agg(row), '[]'::json) from (
    select json_build_object(
      'uid', p.id, 'name', coalesce(l.member_name, p.name, ''), 'email', coalesce(p.email,''),
      'status', coalesce(l.member_status,'준회원'), 'canFinance', coalesce(l.can_finance,false),
      'isAdmin', exists(select 1 from public.admins a where a.uid = p.id)
    ) as row
    from public.profiles p left join public.member_links l on l.user_id = p.id
    where exists(select 1 from public.admins where uid = auth.uid())
    order by exists(select 1 from public.admins a where a.uid = p.id) desc, coalesce(l.member_name, p.name)
  ) t;
$$;

-- 권한 부여/회수(관리자만). actionSetAccess_ 대체.
create or replace function public.set_access(p_uid uuid, p_is_admin boolean, p_can_finance boolean)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.admins where uid = auth.uid()) then
    return json_build_object('ok', false, 'error', '관리자만 가능합니다.');
  end if;
  if p_is_admin is not null then
    if p_is_admin then insert into public.admins(uid) values (p_uid) on conflict (uid) do nothing;
    else delete from public.admins where uid = p_uid; end if;
  end if;
  if p_can_finance is not null then
    insert into public.member_links(user_id, can_finance, updated_at) values (p_uid, p_can_finance, now())
    on conflict (user_id) do update set can_finance = p_can_finance, updated_at = now();
  end if;
  return json_build_object('ok', true);
end $$;

-- 정회원 승격 시 헌금조회 즉시 가능하도록: 교적 매칭키 기준 정회원 자동 승격은
-- 관리자 화면(권한관리)에서 set_access 로 처리.

-- ── 기본 예배(services) 시드 (없을 때만) ──────────────────────────────
insert into public.services (name, sort)
select x.name, x.sort from (values
  ('주일 낮 예배',1),('주일 오후 예배',2),('수요 예배',3),('금요 기도회',4),('새벽 기도회',5)
) as x(name, sort)
where not exists (select 1 from public.services);

-- ####################  gyojeok.sql  ####################

-- ============================================================
--  ○○교회 — 교적(gyojeok) 테이블 + 보안(RLS)
--  Supabase ▸ SQL Editor 에 붙여넣고 Run (1회).
--  · 개인정보 보호: 관리자/재정권한자만 조회·수정 (is_finance()).
--  · is_finance() 는 offerings.sql 에서 생성됨(없으면 아래 정의 사용).
-- ============================================================

create or replace function public.is_finance()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists(select 1 from public.admins a where a.uid = auth.uid())
      or exists(select 1 from public.member_links m where m.user_id = auth.uid() and m.can_finance = true)
$$;

create table if not exists public.gyojeok (
  id              bigint generated always as identity primary key,
  gyojeok_id      integer,
  name            text,
  birth           date,
  member_key      text,
  head            text,        -- 세대주
  relation        text,        -- 관계
  spouse          text,        -- 배우자
  spouse_key      text,        -- 배우자매칭키
  groups          text,        -- 그룹(구역)
  role            text,        -- 직책
  grade           text,        -- 신급
  sex             text,
  phone           text,
  address         text,
  status          text,        -- 회원상태
  photo           text,
  baptism_date    date,
  ordination_date date,
  belong_groups   text,        -- 소속그룹
  created_at      timestamptz default now()
);
create index if not exists gyojeok_member_key_idx on public.gyojeok(member_key);
create index if not exists gyojeok_name_idx       on public.gyojeok(name);

alter table public.gyojeok enable row level security;
drop policy if exists gyojeok_select on public.gyojeok;
create policy gyojeok_select on public.gyojeok for select using ( public.is_finance() );
drop policy if exists gyojeok_write on public.gyojeok;
create policy gyojeok_write on public.gyojeok for all using ( public.is_finance() ) with check ( public.is_finance() );

-- ####################  gyojeok_origin_head.sql  ####################

-- 분가 세대 연결: 세대주가 어느 부모 가정에서 분가했는지(출신 세대주 이름)
-- 세대를 합치지 않고 가계도에서 부모→분가 가정을 가지로 표시하기 위함.
alter table public.gyojeok add column if not exists origin_head text;

-- ####################  library_overrides.sql  ####################

-- ============================================================
-- ○○교회 — 나의 도서관: 수동 분류 변경 저장
-- 드래그&드롭으로 책의 분류를 옮기면 여기에 저장됩니다.
-- (자동 키워드 분류보다 우선 적용 / 관리자 공유 / 영구 보존)
-- Supabase ▸ SQL Editor 에 붙여넣고 Run 하세요. (한 번만)
-- ============================================================

create table if not exists public.library_overrides (
  book_id    text primary key,          -- 구글 드라이브 파일 ID
  category   text not null,             -- 옮긴 분류 이름
  subcat     text,                      -- 세부분류(시리즈/종류). 없으면 자동
  updated_at timestamptz not null default now()
);

-- 이미 만들어 둔 경우에도 안전하게 세부분류 컬럼 추가(재실행 가능)
alter table public.library_overrides add column if not exists subcat text;

alter table public.library_overrides enable row level security;

-- 관리자(admins 등록자)만 읽기/쓰기 가능
drop policy if exists "libov_admin_all" on public.library_overrides;
create policy "libov_admin_all" on public.library_overrides
  for all
  using (exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (exists (select 1 from public.admins a where a.uid = auth.uid()));

-- ####################  member_files.sql  ####################

-- ============================================================
--  ○○교회 — 자료실(member_files): 성도별 자료 보관
--  학습·세례증명서·수료증·보고서·숙제·과제물 등 파일을 교인별로 저장.
--  관리자(admins)만 읽기/쓰기. Supabase ▸ SQL Editor 에 1회 실행.
-- ============================================================

create table if not exists public.member_files (
  id          bigint generated always as identity primary key,
  member_key  text,          -- 교적 매칭키(이름|YYYYMMDD). 교적 미연결이면 null
  member_name text,          -- 성도 이름(표시·검색용)
  category    text,          -- 분류: 학습·세례증명서·입교·임직·수료증·보고서·숙제·과제물 등
  title       text,          -- 자료 제목
  file_url    text,          -- 파일 URL
  file_key    text,          -- 스토리지 key(삭제용)
  file_name   text,          -- 원본 파일명
  file_size   bigint,        -- 바이트
  memo        text,
  doc_date    date,          -- 자료 일자(선택)
  uploaded_by text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz default now()
);
create index if not exists member_files_key_idx  on public.member_files(member_key);
create index if not exists member_files_name_idx on public.member_files(member_name);
create index if not exists member_files_cat_idx  on public.member_files(category);

alter table public.member_files enable row level security;

drop policy if exists "admin all member_files" on public.member_files;
create policy "admin all member_files" on public.member_files for all
  using (exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (exists (select 1 from public.admins a where a.uid = auth.uid()));

-- 성도 본인 열람: 자신(+배우자)의 자료만 SELECT 허용 (대시보드 '나의 문서')
-- public.my_member_keys() 는 offerings.sql 에 정의돼 있습니다(헌금조회와 동일).
drop policy if exists "member_files_select_own" on public.member_files;
create policy "member_files_select_own" on public.member_files for select
  using ( member_key in (select public.my_member_keys()) );

-- ####################  my_family.sql  ####################

-- 내 가족 가계도: 로그인 회원이 '본인 가족'만 조회(이름·관계·생년·직분만, 연락처 제외).
-- 교적 전체는 관리자만(RLS) — 이 RPC는 security definer 로 본인 세대 + 부모/분가 세대만 안전 반환.
create or replace function public.my_family()
returns table (
  name text, member_key text, head text, relation text,
  spouse text, spouse_key text, origin_head text, birth date, role text
)
language sql security definer stable
set search_path = public
as $$
  with me as (
    select g.head, g.name
    from public.gyojeok g
    where g.member_key in (select public.my_member_keys())
    order by g.id limit 1
  ),
  myhead as (
    select coalesce(nullif((select head from me), ''), (select name from me)) as h
  ),
  headrow as (
    select g.origin_head
    from public.gyojeok g
    where g.name = (select h from myhead)
    order by g.id limit 1
  ),
  heads as (
    select (select h from myhead) as h
    union
    select nullif((select origin_head from headrow), '')               -- 부모 세대(분가 출신)
    union
    select g.name from public.gyojeok g                                -- 분가한 자녀 세대
      where g.origin_head = (select h from myhead) and coalesce(g.origin_head, '') <> ''
  )
  select g.name, g.member_key, g.head, g.relation, g.spouse, g.spouse_key, g.origin_head, g.birth, g.role
  from public.gyojeok g
  where coalesce(nullif(g.head, ''), g.name) in (select h from heads where coalesce(h, '') <> '');
$$;

grant execute on function public.my_family() to authenticated;

-- ####################  notices-categories.sql  ####################

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

-- ####################  offerings.sql  ####################

-- ============================================================
--  ○○교회 — 헌금(offerings) 테이블 + 보안(RLS)
--  Supabase ▸ SQL Editor 에 붙여넣고 Run (1회).
--  · 조회: 본인(+배우자) 헌금만, 재정권한자/관리자는 전체.
-- ============================================================

create table if not exists public.offerings (
  id          bigint generated always as identity primary key,
  offer_date  date,
  category    text,            -- 항목(계정). 현재 데이터엔 없음(향후 입력분부터 채움)
  service     text,            -- 예배
  giver       text,            -- 헌금자 이름
  member_key  text,            -- 교적 매칭키(이름|YYYYMMDD)
  amount      integer not null default 0,
  method      text,            -- 수단
  memo        text,            -- 적요
  source      text,            -- 출처
  created_at  timestamptz default now()
);
create index if not exists offerings_member_key_idx on public.offerings(member_key);
create index if not exists offerings_date_idx       on public.offerings(offer_date);

-- 배우자 합산용 컬럼(지금은 비어 있어도 무방 — 본인 조회는 정상 동작)
alter table public.member_links add column if not exists spouse_key text;

-- 내 매칭키 집합(본인+배우자). security definer 로 안전하게 조회.
create or replace function public.my_member_keys()
returns setof text language sql security definer stable
set search_path = public as $$
  select member_key from public.member_links where user_id = auth.uid() and coalesce(member_key,'') <> ''
  union
  select spouse_key from public.member_links where user_id = auth.uid() and coalesce(spouse_key,'') <> ''
$$;

-- 재정권한자/관리자 여부
create or replace function public.is_finance()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists(select 1 from public.admins a where a.uid = auth.uid())
      or exists(select 1 from public.member_links m where m.user_id = auth.uid() and m.can_finance = true)
$$;

alter table public.offerings enable row level security;

drop policy if exists offerings_select on public.offerings;
create policy offerings_select on public.offerings for select
  using ( public.is_finance() or member_key in (select public.my_member_keys()) );

drop policy if exists offerings_write on public.offerings;
create policy offerings_write on public.offerings for all
  using ( public.is_finance() ) with check ( public.is_finance() );

-- ####################  profile-extra.sql  ####################

-- 회원 정보 추가 컬럼(연락처·한 줄 소개)
-- Supabase ▸ SQL Editor 에 붙여넣고 Run 하세요. (한 번만)
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists bio text;

-- ####################  profile-tax.sql  ####################

-- ============================================================
-- ○○교회 — 직책·주소·생년월일 + 연말정산 신청
-- Supabase ▸ SQL Editor 에 붙여넣고 Run 하세요. (한 번만)
-- ============================================================

-- 1) profiles 추가 컬럼
alter table public.profiles add column if not exists role text;     -- 직책(관리자가 지정)
alter table public.profiles add column if not exists address text;  -- 주소
alter table public.profiles add column if not exists birth text;    -- 생년월일

-- 2) 관리자는 모든 프로필 수정 가능(직책 지정용), 일반 회원은 본인만
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles for update
  using (auth.uid() = id or auth.uid() in (select uid from public.admins));

-- 3) 연말정산 신청 테이블
create table if not exists public.tax_requests (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete set null,
  name       text not null,
  phone      text not null,
  address    text not null,
  birth      text not null,
  rrn_front  text not null,                 -- 주민번호 앞자리(민감정보)
  status     text not null default '접수',
  created_at timestamptz not null default now()
);
alter table public.tax_requests enable row level security;

-- 본인 신청 등록, 본인·관리자만 조회
drop policy if exists "tax_insert_own" on public.tax_requests;
drop policy if exists "tax_select_self_or_admin" on public.tax_requests;
drop policy if exists "tax_delete_self_or_admin" on public.tax_requests;
create policy "tax_insert_own" on public.tax_requests for insert with check (auth.uid() = user_id);
create policy "tax_select_self_or_admin" on public.tax_requests for select
  using (auth.uid() = user_id or auth.uid() in (select uid from public.admins));
create policy "tax_delete_self_or_admin" on public.tax_requests for delete
  using (auth.uid() = user_id or auth.uid() in (select uid from public.admins));

-- ####################  qt_checks.sql  ####################

-- ============================================================
-- 대시보드 "오늘의 큐티" 아멘 체크 기록
-- Supabase ▸ SQL Editor 에 붙여넣고 Run 하세요. (한 번만, 다시 실행해도 안전)
-- 본인은 자신의 체크를 읽고/쓸 수 있고, 관리자는 전체 체크 현황을 읽을 수 있습니다
-- (목회행정 대시보드의 "QT 출석부"용).
-- ============================================================

create table if not exists public.qt_checks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  check_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, check_date)
);
alter table public.qt_checks enable row level security;

drop policy if exists "qt_checks_own" on public.qt_checks;
create policy "qt_checks_own" on public.qt_checks
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "qt_checks_admin_read" on public.qt_checks;
create policy "qt_checks_admin_read" on public.qt_checks
  for select to authenticated
  using (exists (select 1 from public.admins a where a.uid = auth.uid()));

-- 본인이 그 날짜에 몇 번째로 아멘 체크했는지(순위)만 알려주는 함수.
-- RLS 우회(security definer)로 전체 체크 수를 세지만, 다른 사람의 신원은 노출하지 않음.
create or replace function public.qt_check_rank(p_date date)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.qt_checks c
  where c.check_date = p_date
    and c.created_at <= (
      select created_at from public.qt_checks
      where user_id = auth.uid() and check_date = p_date
    );
$$;
grant execute on function public.qt_check_rank(date) to authenticated;

-- ####################  qt_imports.sql  ####################

-- 생명의 삶 가져오기(개인 참고용 비공개 보관함) — 관리자만 읽기/쓰기.
-- ⚠️ 공개 뷰(qt_published)나 홈페이지에는 절대 노출되지 않는다(별도 테이블, anon 권한 없음).
-- Supabase → SQL Editor 에 1회 실행.
create table if not exists public.qt_imports (
  ref_date   date primary key,   -- QT 날짜(하루 1건; 같은 날짜 다시 가져오면 덮어씀)
  title      text,               -- 제목(파싱되면)
  scripture  text,               -- 본문 참조(파싱되면)
  raw_text   text,               -- 붙여넣은 원문 전체(신뢰 보관)
  created_by uuid default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.qt_imports enable row level security;
drop policy if exists "admin all qt_imports" on public.qt_imports;
create policy "admin all qt_imports" on public.qt_imports for all
  using (exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (exists (select 1 from public.admins a where a.uid = auth.uid()));

-- ####################  resources.sql  ####################

-- ============================================================
-- ○○교회 — 양육 자료실 (Supabase Storage + resources 테이블)
-- Supabase ▸ SQL Editor 에 붙여넣고 Run 하세요. (한 번만, 다시 실행해도 안전)
-- 로그인 교인: 목록/다운로드, 관리자(admins): 업로드/삭제
-- ============================================================

-- 1) 비공개 버킷
insert into storage.buckets (id, name, public)
values ('resources', 'resources', false)
on conflict (id) do nothing;

-- 2) Storage 권한: 회원은 다운로드(select), 관리자만 업로드/수정/삭제
drop policy if exists "resources_read_authenticated" on storage.objects;
create policy "resources_read_authenticated" on storage.objects
  for select to authenticated using (bucket_id = 'resources');

drop policy if exists "resources_insert_admin" on storage.objects;
create policy "resources_insert_admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resources' and auth.uid() in (select uid from public.admins));

drop policy if exists "resources_update_admin" on storage.objects;
create policy "resources_update_admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'resources' and auth.uid() in (select uid from public.admins));

drop policy if exists "resources_delete_admin" on storage.objects;
create policy "resources_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'resources' and auth.uid() in (select uid from public.admins));

-- 3) 자료 목록 테이블(원본 파일명·카테고리 보관)
create table if not exists public.resources (
  id         bigint generated always as identity primary key,
  category   text not null,
  title      text not null,                 -- 원본 파일명(표시용)
  path       text not null,                 -- storage object key(영문 안전키)
  size       bigint,
  created_at timestamptz not null default now()
);
alter table public.resources enable row level security;

drop policy if exists "resources_tbl_read" on public.resources;
create policy "resources_tbl_read" on public.resources
  for select to authenticated using (true);

drop policy if exists "resources_tbl_insert_admin" on public.resources;
create policy "resources_tbl_insert_admin" on public.resources
  for insert to authenticated
  with check (auth.uid() in (select uid from public.admins));

drop policy if exists "resources_tbl_delete_admin" on public.resources;
create policy "resources_tbl_delete_admin" on public.resources
  for delete to authenticated
  using (auth.uid() in (select uid from public.admins));

-- ####################  sermon_illustrations.sql  ####################

-- ============================================================
-- ○○교회 — 예화 클립 모음 (설교 매니저)
-- 생명의삶 자동분류 시 '예화 클립'을 따로 모아 두는 보관함.
-- 관리자만 읽기/쓰기. Supabase ▸ SQL Editor 에 1회 실행.
-- ============================================================

create table if not exists public.sermon_illustrations (
  id         uuid primary key default gen_random_uuid(),
  ref_date   date,                -- 출처 날짜(생명의삶 일자)
  scripture  text,                -- 관련 본문
  title      text,                -- 관련 설교 제목
  source     text,                -- 출처(책/저자 등)
  content    text not null,       -- 예화 본문
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);

alter table public.sermon_illustrations enable row level security;
drop policy if exists "admin all sermon_illustrations" on public.sermon_illustrations;
create policy "admin all sermon_illustrations" on public.sermon_illustrations for all
  using (exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (exists (select 1 from public.admins a where a.uid = auth.uid()));

-- ####################  sermons_dawn_to_qt_migrate.sql  ####################

-- ============================================================
--  새벽기도 → 매일 QT 전환/정리 (2026-07 게시정책 변경, 1회 실행)
--  Supabase ▸ SQL Editor 에 붙여넣고 Run. (SQL Editor는 RLS를 우회하므로 안전하게 처리됨)
--  목적: "게시는 매일 QT만" 정책에 맞춰
--    · 과거 새벽기도 말씀(여호수아·룻기·고린도전서·시편 등 약 5개월치)은 '매일 QT'로 전환해 공개 QT·진행표에 보존
--    · 같은 날 이미 '매일 QT'가 있으면(예: 생명의삶으로 이미 분류된 날) 그날 새벽기도는 게시하지 않음
--        - 제목·본문이 완전히 같은 중복본은 삭제
--        - 내용이 다르면 '새벽기도'로 그대로 두어(비게시) 기록은 보존
--  ※ 반드시 sermons_extra.sql(qt_published 뷰: service='매일 QT'만 게시)도 함께 Run 해야 실제로 새벽기도가 내려갑니다.
--  ※ 재실행해도 안전(idempotent): 새벽기도가 없으면 아무 것도 하지 않음.
-- ============================================================

-- 1) 같은 날짜에 '새벽기도'가 둘 이상이면 하나만 남기고 삭제(내용이 더 긴 것 우선)
delete from public.sermons a
using public.sermons b
where a.service = '새벽기도' and b.service = '새벽기도'
  and a.sermon_date = b.sermon_date
  and a.ctid <> b.ctid
  and ( length(coalesce(a.content, '')) < length(coalesce(b.content, ''))
        or ( length(coalesce(a.content, '')) = length(coalesce(b.content, '')) and a.ctid < b.ctid ) );

-- 2) 같은 날 '매일 QT'와 제목·본문이 동일한 '새벽기도' 완전중복본은 삭제
delete from public.sermons d
where d.service = '새벽기도'
  and exists (
    select 1 from public.sermons q
    where q.service = '매일 QT'
      and q.sermon_date = d.sermon_date
      and coalesce(q.title, '')     = coalesce(d.title, '')
      and coalesce(q.scripture, '') = coalesce(d.scripture, '')
  );

-- 3) 같은 날 '매일 QT'가 없는 '새벽기도'는 '매일 QT'로 전환(과거 QT 아카이브 보존)
--    (내용이 다른 채로 같은 날 '매일 QT'가 이미 있는 새벽기도는 전환하지 않고 '새벽기도'로 남겨 비게시·기록 보존)
update public.sermons d
set service = '매일 QT'
where d.service = '새벽기도'
  and not exists (
    select 1 from public.sermons q
    where q.service = '매일 QT' and q.sermon_date = d.sermon_date
  );

-- ####################  sermons_extra.sql  ####################

-- 설교 기록에 예배 정보(교독문·찬송가) 저장용 컬럼
alter table public.sermons add column if not exists gyodok text;  -- 교독문 (예: 23. 시편 23편)
alter table public.sermons add column if not exists hymns  text;  -- 찬송가 번호 목록 (예: 1,305,391)
alter table public.sermons add column if not exists praise text;  -- 찬양곡 업로드 JSON: [{"title":"...","url":"..."}]
alter table public.sermons add column if not exists worship_order text;  -- 예배 순서 JSON: [{"label":"...","detail":"...","url":"..."}]
alter table public.sermons add column if not exists bible_text text;  -- 설교 성경 본문 전문 (개역개정 — 새벽기도회/주일 등)
alter table public.sermons add column if not exists qt_bible_text text;  -- QT 전용 성경 본문 (우리말성경)
alter table public.sermons add column if not exists prayer text;  -- 설교 후 기도 (설교 원고 아래)

-- 홈페이지 '오늘의 말씀(QT)' 공개 뷰
--  · 게시는 '매일 QT'만! (2026-07 정책 변경) — '새벽기도'는 공개 QT에 노출하지 않는다.
--    과거 새벽기도 말씀은 sermons_dawn_to_qt_migrate.sql 로 '매일 QT'로 전환해 보존.
--  · 본문은 우리말성경(qt_bible_text) 우선, 없으면 개역개정(bible_text)
--  · 오늘까지의 글만 anon 에 노출(미래 QT는 당일이 되기 전까지 숨김)
--  · 날짜 비교는 반드시 한국시각(Asia/Seoul) 기준! current_date(UTC)를 쓰면
--    한국 00:00~09:00 사이에는 UTC가 아직 전날이라 그날 QT가 숨겨지는 버그가 생긴다.
drop view if exists public.qt_published;
create view public.qt_published as
  select sermon_date, title, scripture,
         coalesce(nullif(btrim(qt_bible_text), ''), bible_text) as qt_bible_text,
         content, prayer
  from public.sermons
  where service = '매일 QT'
    and sermon_date is not null
    and sermon_date <= (now() at time zone 'Asia/Seoul')::date
  order by sermon_date desc;
grant select on public.qt_published to anon, authenticated;

-- ####################  sermons_manager.sql  ####################

-- ============================================================
--  설교 매니저 확장 컬럼 (2026-07, 1회 실행)
--  Supabase ▸ SQL Editor 에 붙여넣고 Run.
--  · series   : 설교 시리즈 (쉼표로 여러 개 — 예: "룻기 강해, 새벽 시리즈")
--  · keywords : 키워드 (쉼표, 최대 3개)
--  · summary  : 미리보기 요약 (최대 500자 — 목록·카드 하단 노출용)
--  · status   : 작성 상태 (작성중 / 수정중 / 완료)
--  실행하지 않아도 설교 저장은 되지만, 시리즈·키워드·요약·상태는 저장되지 않습니다.
-- ============================================================
alter table public.sermons add column if not exists series   text;
alter table public.sermons add column if not exists keywords text;
alter table public.sermons add column if not exists summary  text;
alter table public.sermons add column if not exists status   text default '작성중';

-- ####################  tts_cache_bucket.sql  ####################

-- ============================================================
--  ○○교회 — TTS 음성 캐시 버킷(tts-cache)
--  글→음성을 한 번만 만들고 저장해 두고 재사용(재생은 사실상 무료).
--  Supabase ▸ SQL Editor 에 1회 실행. (tts Edge Function 배포 전/후 아무 때나)
-- ============================================================

-- 공개 버킷: 읽기는 누구나(그냥 QT 음성), 쓰기는 Edge Function이 서비스 키로만 함
insert into storage.buckets (id, name, public)
values ('tts-cache', 'tts-cache', true)
on conflict (id) do update set public = true;

-- ####################  tts_log.sql  ####################

-- ============================================================
--  ○○교회 — AI 음성(QT 낭독) 생성 기록
--  tts Edge Function이 새로 생성할 때마다 한 줄씩 기록 → 목회행정 대시보드에서 열람.
--  Supabase ▸ SQL Editor 에 1회 실행.
-- ============================================================

create table if not exists public.tts_log (
  id         bigint generated always as identity primary key,
  qt_date    date,          -- 그 QT 날짜(있을 때)
  label      text,          -- 본문 앞부분(제목/구절)
  url        text,          -- 공개 재생 URL
  bytes      bigint,        -- 파일 크기
  voice      text,          -- 사용 목소리
  created_at timestamptz default now()
);
create index if not exists tts_log_created_idx on public.tts_log(created_at desc);

alter table public.tts_log enable row level security;

-- 관리자만 열람. (함수는 service_role로 기록하므로 RLS 우회)
drop policy if exists "admin read tts_log" on public.tts_log;
create policy "admin read tts_log" on public.tts_log for select
  using (exists (select 1 from public.admins a where a.uid = auth.uid()));

-- 관리자만 삭제(대시보드에서 기록 지우기)
drop policy if exists "admin delete tts_log" on public.tts_log;
create policy "admin delete tts_log" on public.tts_log for delete
  using (exists (select 1 from public.admins a where a.uid = auth.uid()));

-- 저장된 음원 파일(tts-cache 버킷)도 관리자면 삭제 가능하게
drop policy if exists "admin delete tts-cache" on storage.objects;
create policy "admin delete tts-cache" on storage.objects for delete
  using (bucket_id = 'tts-cache'
         and exists (select 1 from public.admins a where a.uid = auth.uid()));

-- ####################  tts_prewarm_cron.sql  ####################

-- ============================================================
--  ○○교회 — QT 음성 자동 생성(prewarm) 예약
--  30분마다 tts-prewarm 함수를 호출 → 오늘·내일 QT 음성을 미리 생성(캐시)해 둔다.
--  (이미 만들어진 음성이 있으면 건너뛰므로 추가 비용 없음)
--  Supabase ▸ SQL Editor 에서 1회 실행. (tts-prewarm 함수 배포 후)
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 기존 등록이 있으면 제거(재실행 안전)
do $$
begin
  perform cron.unschedule('tts-prewarm');
exception when others then null;
end $$;

-- 30분마다 실행 (원하면 '*/15 * * * *' 등으로 조정)
select cron.schedule(
  'tts-prewarm',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-PROJECT.supabase.co/functions/v1/tts-prewarm-',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_qfq4Hvs4tF_1ZIezPoMojg_h6XNw01G',
      'Authorization', 'Bearer sb_publishable_qfq4Hvs4tF_1ZIezPoMojg_h6XNw01G'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 확인: 등록된 예약 보기
-- select jobid, schedule, jobname, active from cron.job where jobname = 'tts-prewarm';
-- 해제하려면: select cron.unschedule('tts-prewarm');

-- ####################  withdraw.sql  ####################

-- ============================================================
-- ○○교회 — 회원 탈퇴(본인 프로필 삭제) 권한
-- Supabase ▸ SQL Editor 에 붙여넣고 Run 하세요. (한 번만)
-- ============================================================

-- 본인 또는 관리자가 프로필을 삭제할 수 있도록 허용
drop policy if exists "profiles_delete_self_or_admin" on public.profiles;
create policy "profiles_delete_self_or_admin" on public.profiles for delete
  using (auth.uid() = id or auth.uid() in (select uid from public.admins));

-- (참고) 연말정산 신청 본인 삭제 권한은 profile-tax.sql 에서 이미 생성됨:
--   tax_delete_self_or_admin

-- ####################  worship_templates.sql  ####################

-- 예배별 순서 양식(템플릿): 주일 낮 예배 / 수요예배 등 예배 종류마다 저장.
create table if not exists public.worship_templates (
  service    text primary key,   -- 예배 종류
  items      jsonb,              -- 예배 순서 [{label,detail,url}]
  updated_at timestamptz default now()
);
alter table public.worship_templates enable row level security;
drop policy if exists "admin all worship_templates" on public.worship_templates;
create policy "admin all worship_templates" on public.worship_templates for all
  using (exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (exists (select 1 from public.admins a where a.uid = auth.uid()));

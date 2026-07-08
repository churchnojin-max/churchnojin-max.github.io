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
